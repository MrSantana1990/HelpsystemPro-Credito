import readXlsxFile from "read-excel-file/node";
import { createHash } from "node:crypto";

const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const dateIso = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const text = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  return null;
};

const number = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(
    String(value ?? "")
      .replace(/\./g, "")
      .replace(",", "."),
  );
  return Number.isFinite(parsed) ? parsed : null;
};

const cents = (value) => {
  const parsed = number(value);
  return parsed === null ? null : Math.round(parsed * 100);
};

const status = (value) => {
  const key = normalize(value);
  if (key === "pago" || key === "quitado") return "paid";
  if (key.includes("renegoci")) return "renegotiated";
  if (key.includes("somente juros") || key.includes("so juros"))
    return "review_required";
  if (key.includes("aberto")) return "open";
  return "review_required";
};

export async function previewLegacyWorkbook(
  buffer,
  fileName,
  defaultClientName,
) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0)
    throw new Error("Arquivo Excel vazio.");
  if (buffer.length > 10 * 1024 * 1024)
    throw new Error("O arquivo excede o limite de 10 MB.");
  const sheets = await readXlsxFile(buffer);
  const sheet =
    sheets.find((item) =>
      normalize(item.sheet).includes("controle de contratos"),
    ) ||
    sheets.find((item) => normalize(item.sheet).includes("contratos")) ||
    sheets.find((item) =>
      item.data.some((row) =>
        row.some((cell) => normalize(cell) === "principal (r$)"),
      ),
    );
  if (!sheet)
    throw new Error("A aba “Controle de Contratos” não foi encontrada.");
  const headerIndex = sheet.data.findIndex(
    (row) =>
      row.some((cell) => normalize(cell) === "id") &&
      row.some((cell) => normalize(cell).includes("principal")),
  );
  if (headerIndex < 0)
    throw new Error("O cabeçalho dos contratos não foi encontrado.");
  const headers = sheet.data[headerIndex].map(normalize);
  const column = (...names) =>
    headers.findIndex((header) =>
      names.some((name) => header === normalize(name)),
    );
  const indexes = {
    id: column("ID"),
    date: column("Data Empréstimo"),
    principal: column("Principal (R$)"),
    rate: column("Taxa"),
    interest: column("Juros (R$)"),
    total: column("Total (R$)"),
    due: column("Vencimento"),
    status: column("Status"),
    paidDate: column("Pago em"),
    paid: column("Pago (R$)"),
    balance: column("Saldo (R$)"),
  };
  if (
    [
      indexes.id,
      indexes.date,
      indexes.principal,
      indexes.rate,
      indexes.due,
      indexes.status,
    ].some((value) => value < 0)
  ) {
    throw new Error("A planilha não possui todas as colunas obrigatórias.");
  }

  const rows = [];
  for (let index = headerIndex + 1; index < sheet.data.length; index += 1) {
    const source = sheet.data[index];
    const principalCents = cents(source[indexes.principal]);
    if (!principalCents) continue;
    const normalizedStatus = status(source[indexes.status]);
    const paidCents = indexes.paid >= 0 ? cents(source[indexes.paid]) : null;
    const interestCents =
      indexes.interest >= 0 ? cents(source[indexes.interest]) : null;
    const warnings = [];
    if (normalizedStatus === "review_required")
      warnings.push(
        "Status exige conferência manual antes de entrar nos totais.",
      );
    if (
      normalize(source[indexes.status]).includes("somente juros") &&
      paidCents &&
      interestCents &&
      paidCents !== interestCents
    )
      warnings.push("Valor pago difere dos juros registrados.");
    if (normalizedStatus === "paid" && !dateIso(source[indexes.paidDate]))
      warnings.push("Contrato pago sem data de pagamento na origem.");
    const startDate = dateIso(source[indexes.date]);
    const dueDate = dateIso(source[indexes.due]);
    if (!startDate || !dueDate)
      warnings.push("Data de empréstimo ou vencimento inválida.");
    rows.push({
      sourceRow: index + 1,
      legacyId: String(source[indexes.id] ?? index + 1),
      clientName: defaultClientName,
      startDate,
      dueDate,
      principalCents,
      interestRate: number(source[indexes.rate]) ?? 0,
      interestCents: interestCents ?? 0,
      totalCents: indexes.total >= 0 ? cents(source[indexes.total]) : null,
      originalStatus: String(source[indexes.status] ?? ""),
      normalizedStatus,
      paidDate: dateIso(source[indexes.paidDate]),
      paidCents,
      balanceCents:
        indexes.balance >= 0 ? cents(source[indexes.balance]) : null,
      warnings,
      raw: source.map((cell) => (cell instanceof Date ? dateIso(cell) : cell)),
    });
  }
  if (rows.length === 0)
    throw new Error("Nenhum contrato preenchido foi encontrado.");
  return {
    fileHash: createHash("sha256").update(buffer).digest("hex"),
    fileName,
    sheetName: sheet.sheet,
    clientName: defaultClientName,
    rows,
    summary: {
      totalRows: rows.length,
      openRows: rows.filter((row) => row.normalizedStatus === "open").length,
      paidRows: rows.filter((row) => row.normalizedStatus === "paid").length,
      renegotiatedRows: rows.filter(
        (row) => row.normalizedStatus === "renegotiated",
      ).length,
      reviewRows: rows.filter(
        (row) => row.normalizedStatus === "review_required",
      ).length,
      warningCount: rows.reduce((total, row) => total + row.warnings.length, 0),
    },
  };
}
