import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { db, transaction, audit } from "../server/database.js";
import { previewLegacyWorkbook } from "../server/import-legacy.js";
import { allocate } from "../server/finance.js";

const [fileArgument, clientNameArgument, mode = "dry-run"] = process.argv.slice(2);
if (!fileArgument || !clientNameArgument) {
  throw new Error("Uso: node scripts/import-legacy-cli.js <arquivo.xlsx> <cliente> [dry-run|apply]");
}
const filePath = resolve(fileArgument);
const buffer = readFileSync(filePath);
const preview = await previewLegacyWorkbook(buffer, basename(filePath), clientNameArgument.trim());
const open = preview.rows.filter((row) => row.normalizedStatus === "open");
const report = {
  mode,
  fileHash: preview.fileHash,
  clientName: preview.clientName,
  summary: preview.summary,
  openPrincipalCents: open.reduce((sum, row) => sum + row.principalCents, 0),
  openInterestCents: open.reduce((sum, row) => sum + row.interestCents, 0),
  rows: preview.rows.map(({ legacyId, originalStatus, normalizedStatus, principalCents, interestCents, startDate, dueDate, warnings }) => ({
    legacyId, originalStatus, normalizedStatus, principalCents, interestCents, startDate, dueDate, warnings,
  })),
};
if (mode === "dry-run") {
  console.log(JSON.stringify(report, null, 2));
  db.close();
  process.exit(0);
}
if (mode !== "apply") throw new Error("Modo inválido. Use dry-run ou apply.");
if (process.env.IMPORT_CONFIRM_SHA256 !== preview.fileHash) {
  throw new Error("Importação bloqueada: confirme o SHA-256 exibido na simulação.");
}
if (db.prepare("SELECT id FROM import_batches WHERE file_hash = ?").get(preview.fileHash)) {
  throw new Error("Este arquivo já foi importado anteriormente.");
}
const admin = db.prepare("SELECT id FROM users WHERE active = 1 ORDER BY id LIMIT 1").get();
if (!admin) throw new Error("Nenhum administrador ativo foi encontrado.");

const result = transaction(() => {
  let client = db.prepare("SELECT id FROM clients WHERE name = ? COLLATE NOCASE ORDER BY id LIMIT 1").get(preview.clientName);
  if (!client) {
    const created = db.prepare("INSERT INTO clients (name, notes) VALUES (?, ?)").run(preview.clientName, "Cliente criado pela importação segura da planilha original.");
    client = { id: Number(created.lastInsertRowid) };
  }
  const batch = db.prepare("INSERT INTO import_batches (file_hash, file_name, source_sheet, row_count, imported_by) VALUES (?, ?, ?, ?, ?)")
    .run(preview.fileHash, preview.fileName, preview.sheetName, preview.rows.length, admin.id);
  const batchId = Number(batch.lastInsertRowid);
  const ids = [];
  for (const row of preview.rows) {
    const termDays = Math.max(1, Math.round((Date.parse(`${row.dueDate}T00:00:00Z`) - Date.parse(`${row.startDate}T00:00:00Z`)) / 86_400_000));
    const contract = db.prepare(`INSERT INTO contracts
      (client_id, principal_cents, interest_rate, term_days, start_date, due_date, status, notes, legacy_reference)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(client.id, row.principalCents, row.interestRate, termDays, row.startDate, row.dueDate, row.normalizedStatus,
        `Importado da planilha original. Status original: ${row.originalStatus}.${row.paidDate ? "" : row.normalizedStatus === "paid" ? " Data de quitação ausente na origem." : ""}`, row.legacyId);
    const contractId = Number(contract.lastInsertRowid);
    ids.push({ id: contractId, legacyId: row.legacyId });
    const cycle = db.prepare(`INSERT INTO cycles
      (contract_id, cycle_number, start_date, due_date, opening_principal_cents, interest_cents, status, closed_at)
      VALUES (?, 1, ?, ?, ?, ?, ?, ?)`)
      .run(contractId, row.startDate, row.dueDate, row.principalCents, row.interestCents, row.normalizedStatus,
        row.normalizedStatus === "open" || row.normalizedStatus === "review_required" ? null : row.paidDate || row.dueDate);
    if (row.paidCents && row.paidDate) {
      const allocation = allocate(row.paidCents, { fee: 0, interest: row.interestCents, principal: row.principalCents });
      db.prepare(`INSERT INTO payments
        (contract_id, cycle_id, amount_cents, fee_cents, interest_cents, principal_cents, unapplied_cents, payment_date, method, note, created_by)
        VALUES (?, ?, ?, 0, ?, ?, ?, ?, 'legacy', ?, ?)`)
        .run(contractId, Number(cycle.lastInsertRowid), row.paidCents, allocation.toInterest, allocation.toPrincipal, allocation.unapplied,
          row.paidDate, "Pagamento importado da planilha original.", admin.id);
    }
    db.prepare(`INSERT INTO legacy_import_rows
      (batch_id, source_row, legacy_reference, normalized_status, raw_json, contract_id)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .run(batchId, row.sourceRow, row.legacyId, row.normalizedStatus, JSON.stringify(row.raw), contractId);
  }
  audit(admin.id, "legacy.imported.cli", "import_batch", batchId, { fileName: preview.fileName, clientId: client.id, rows: ids.length, fileHash: preview.fileHash });
  return { batchId, clientId: client.id, contracts: ids };
});
console.log(JSON.stringify({ ...report, result }, null, 2));
db.close();
