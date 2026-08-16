import express from "express";
import multer from "multer";
import { existsSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { db, dataDirectory, transaction, audit } from "./database.js";
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  hashToken,
} from "./security.js";
import { accruedDailyFee, addDays, allocate, interestFor } from "./finance.js";
import { previewLegacyWorkbook } from "./import-legacy.js";
import { createConsistentBackup } from "./backup.js";
import { calculateInternalCreditScore } from "./credit-score.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const app = express();
const port = Number(process.env.PORT || 8091);
const host = process.env.HOST || "127.0.0.1";
const sessionHours = Math.max(1, Number(process.env.SESSION_HOURS || 12));
const secureCookie = process.env.COOKIE_SECURE === "true";
const appOrigin = process.env.APP_ORIGIN || "";
const loginAttempts = new Map();
const importSessions = new Map();
const serverLockPath = resolve(dataDirectory, "server.lock");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) =>
    callback(null, /\.(xlsx|xlsm)$/i.test(file.originalname)),
});

app.disable("x-powered-by");
if (process.env.TRUST_PROXY === "true") app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  );
  next();
});
app.use((req, res, next) => {
  if (appOrigin && ["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const origin = req.get("origin");
    if (origin && origin !== appOrigin) {
      return res
        .status(403)
        .json({ error: "Origem da requisição não autorizada." });
    }
  }
  next();
});

function cookieValue(req, name) {
  const match = req.headers.cookie
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function currentUser(req) {
  const token = cookieValue(req, "hsp_session");
  if (!token) return null;
  return (
    db
      .prepare(
        `
    SELECT users.id, users.name, users.email, users.role
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > datetime('now') AND users.active = 1
  `,
      )
      .get(hashToken(token)) ?? null
  );
}

function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user)
    return res.status(401).json({ error: "Sessão inválida ou expirada." });
  req.user = user;
  next();
}

function cleanText(value, max = 255, required = false) {
  const text = typeof value === "string" ? value.trim() : "";
  if (required && !text) throw new Error("Campo obrigatório não informado.");
  if (text.length > max) throw new Error(`Texto excede ${max} caracteres.`);
  return text || null;
}

function positiveInteger(value, field) {
  if (!Number.isInteger(value) || value <= 0)
    throw new Error(`${field} deve ser um número inteiro positivo.`);
  return value;
}

function getSettings() {
  return db.prepare("SELECT * FROM settings WHERE id = 1").get();
}

function currentDate() {
  return new Date().toISOString().slice(0, 10);
}

function handle(handler) {
  return (req, res) => {
    try {
      handler(req, res);
    } catch (error) {
      console.error(error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Operação inválida.",
      });
    }
  };
}

app.get("/api/status", (req, res) => {
  const setupRequired =
    db.prepare("SELECT COUNT(*) AS total FROM users").get().total === 0;
  res.json({ setupRequired, authenticated: Boolean(currentUser(req)) });
});

app.post(
  "/api/setup",
  handle((req, res) => {
    if (db.prepare("SELECT COUNT(*) AS total FROM users").get().total > 0) {
      return res
        .status(409)
        .json({ error: "O administrador já foi configurado." });
    }
    const name = cleanText(req.body.name, 100, true);
    const email = cleanText(req.body.email, 160, true)?.toLowerCase();
    const passwordHash = hashPassword(req.body.password);
    const result = db
      .prepare(
        "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
      )
      .run(name, email, passwordHash);
    audit(
      Number(result.lastInsertRowid),
      "setup.completed",
      "user",
      Number(result.lastInsertRowid),
      { email },
    );
    res.status(201).json({ ok: true });
  }),
);

app.post(
  "/api/login",
  handle((req, res) => {
    const key = req.ip || "local";
    const attempt = loginAttempts.get(key) || { count: 0, blockedUntil: 0 };
    if (attempt.blockedUntil > Date.now())
      return res
        .status(429)
        .json({ error: "Muitas tentativas. Aguarde alguns minutos." });
    const email = cleanText(req.body.email, 160, true)?.toLowerCase();
    const user = db
      .prepare("SELECT * FROM users WHERE email = ? AND active = 1")
      .get(email);
    if (
      !user ||
      !verifyPassword(String(req.body.password || ""), user.password_hash)
    ) {
      attempt.count += 1;
      if (attempt.count >= 5) {
        attempt.blockedUntil = Date.now() + 5 * 60_000;
        attempt.count = 0;
      }
      loginAttempts.set(key, attempt);
      return res.status(401).json({ error: "E-mail ou senha inválidos." });
    }
    loginAttempts.delete(key);
    const token = createSessionToken();
    const expires = new Date(
      Date.now() + sessionHours * 3_600_000,
    ).toISOString();
    db.prepare(
      "DELETE FROM sessions WHERE expires_at <= datetime('now')",
    ).run();
    db.prepare(
      "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
    ).run(user.id, hashToken(token), expires);
    audit(user.id, "auth.login", "user", user.id);
    res.setHeader(
      "Set-Cookie",
      `hsp_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionHours * 3600}${secureCookie ? "; Secure" : ""}`,
    );
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  }),
);

app.post("/api/logout", requireAuth, (req, res) => {
  const token = cookieValue(req, "hsp_session");
  if (token)
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(
      hashToken(token),
    );
  res.setHeader(
    "Set-Cookie",
    `hsp_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookie ? "; Secure" : ""}`,
  );
  res.json({ ok: true });
});

app.get("/api/me", requireAuth, (req, res) => res.json({ user: req.user }));

app.get("/api/settings", requireAuth, (_req, res) => {
  res.json({ settings: getSettings() });
});

app.patch(
  "/api/settings",
  requireAuth,
  handle((req, res) => {
    const rate = Number(req.body.defaultInterestRate);
    const term = positiveInteger(req.body.defaultTermDays, "Prazo padrão");
    const dailyFee = Number(req.body.dailyFeeCents);
    if (!Number.isFinite(rate) || rate < 0 || rate > 10) {
      throw new Error("Taxa padrão inválida.");
    }
    if (!Number.isInteger(dailyFee) || dailyFee < 0) {
      throw new Error("Multa diária inválida.");
    }
    const enabled = req.body.dailyFeeEnabled === true ? 1 : 0;
    db.prepare(
      "UPDATE settings SET default_interest_rate = ?, default_term_days = ?, daily_fee_cents = ?, daily_fee_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
    ).run(rate, term, dailyFee, enabled);
    audit(req.user.id, "settings.updated", "settings", 1, {
      rate,
      term,
      dailyFee,
      enabled: Boolean(enabled),
    });
    res.json({ settings: getSettings() });
  }),
);

app.post(
  "/api/import/preview",
  requireAuth,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file)
        return res.status(400).json({ error: "Selecione um arquivo .xlsx." });
      const clientName = cleanText(req.body.clientName, 120, true);
      const preview = await previewLegacyWorkbook(
        req.file.buffer,
        req.file.originalname,
        clientName,
      );
      if (
        db
          .prepare("SELECT id FROM import_batches WHERE file_hash = ?")
          .get(preview.fileHash)
      ) {
        return res
          .status(409)
          .json({ error: "Este arquivo já foi importado anteriormente." });
      }
      const token = createSessionToken();
      importSessions.set(hashToken(token), {
        preview,
        userId: req.user.id,
        expiresAt: Date.now() + 30 * 60_000,
      });
      res.json({ token, preview });
    } catch (error) {
      console.error(error);
      res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível ler a planilha.",
      });
    }
  },
);

app.post(
  "/api/import/apply",
  requireAuth,
  handle((req, res) => {
    const tokenHash = hashToken(cleanText(req.body.token, 200, true));
    const session = importSessions.get(tokenHash);
    if (
      !session ||
      session.userId !== req.user.id ||
      session.expiresAt < Date.now()
    ) {
      importSessions.delete(tokenHash);
      throw new Error("A pré-visualização expirou. Leia a planilha novamente.");
    }
    const invalid = session.preview.rows.filter(
      (row) => !row.startDate || !row.dueDate,
    );
    if (invalid.length)
      throw new Error(
        `${invalid.length} contrato(s) possuem datas inválidas e impedem a importação.`,
      );
    const imported = transaction(() => {
      let client = db
        .prepare(
          "SELECT id FROM clients WHERE name = ? COLLATE NOCASE ORDER BY id LIMIT 1",
        )
        .get(session.preview.clientName);
      if (!client) {
        const created = db
          .prepare("INSERT INTO clients (name, notes) VALUES (?, ?)")
          .run(
            session.preview.clientName,
            "Cliente criado pela importação da planilha legada.",
          );
        client = { id: Number(created.lastInsertRowid) };
      }
      const batchResult = db
        .prepare(
          `INSERT INTO import_batches (file_hash, file_name, source_sheet, row_count, imported_by) VALUES (?, ?, ?, ?, ?)`,
        )
        .run(
          session.preview.fileHash,
          session.preview.fileName,
          session.preview.sheetName,
          session.preview.rows.length,
          req.user.id,
        );
      const batchId = Number(batchResult.lastInsertRowid);
      const contractIds = [];
      for (const row of session.preview.rows) {
        const termDays = Math.max(
          1,
          Math.round(
            (Date.parse(`${row.dueDate}T00:00:00Z`) -
              Date.parse(`${row.startDate}T00:00:00Z`)) /
              86_400_000,
          ),
        );
        const contractResult = db
          .prepare(
            `INSERT INTO contracts (client_id, principal_cents, interest_rate, term_days, start_date, due_date, status, notes, legacy_reference) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            client.id,
            row.principalCents,
            row.interestRate,
            termDays,
            row.startDate,
            row.dueDate,
            row.normalizedStatus,
            `Importado da planilha. Status original: ${row.originalStatus}.`,
            row.legacyId,
          );
        const contractId = Number(contractResult.lastInsertRowid);
        contractIds.push(contractId);
        const cycleResult = db
          .prepare(
            `INSERT INTO cycles (contract_id, cycle_number, start_date, due_date, opening_principal_cents, interest_cents, status, closed_at) VALUES (?, 1, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            contractId,
            row.startDate,
            row.dueDate,
            row.principalCents,
            row.interestCents,
            row.normalizedStatus,
            row.normalizedStatus === "open" ||
              row.normalizedStatus === "review_required"
              ? null
              : row.paidDate || row.dueDate,
          );
        const cycleId = Number(cycleResult.lastInsertRowid);
        if (row.paidCents && row.paidDate) {
          const allocation = allocate(row.paidCents, {
            fee: 0,
            interest: row.interestCents,
            principal: row.principalCents,
          });
          db.prepare(
            `INSERT INTO payments (contract_id, cycle_id, amount_cents, fee_cents, interest_cents, principal_cents, unapplied_cents, payment_date, method, note, created_by) VALUES (?, ?, ?, 0, ?, ?, ?, ?, 'legacy', ?, ?)`,
          ).run(
            contractId,
            cycleId,
            row.paidCents,
            allocation.toInterest,
            allocation.toPrincipal,
            allocation.unapplied,
            row.paidDate,
            "Pagamento importado da planilha legada.",
            req.user.id,
          );
        }
        db.prepare(
          `INSERT INTO legacy_import_rows (batch_id, source_row, legacy_reference, normalized_status, raw_json, contract_id) VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(
          batchId,
          row.sourceRow,
          row.legacyId,
          row.normalizedStatus,
          JSON.stringify(row.raw),
          contractId,
        );
      }
      audit(req.user.id, "legacy.imported", "import_batch", batchId, {
        fileName: session.preview.fileName,
        rows: contractIds.length,
        clientId: client.id,
      });
      return { batchId, clientId: client.id, contractIds };
    });
    importSessions.delete(tokenHash);
    res
      .status(201)
      .json({ ...imported, importedRows: imported.contractIds.length });
  }),
);

app.get("/api/clients", requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `
    SELECT clients.*, COUNT(contracts.id) AS contract_count,
      (SELECT score FROM credit_assessments WHERE client_id = clients.id ORDER BY id DESC LIMIT 1) AS credit_score,
      (SELECT risk_band FROM credit_assessments WHERE client_id = clients.id ORDER BY id DESC LIMIT 1) AS risk_band,
      (SELECT recommended_limit_cents FROM credit_assessments WHERE client_id = clients.id ORDER BY id DESC LIMIT 1) AS recommended_limit_cents
    FROM clients LEFT JOIN contracts ON contracts.client_id = clients.id
    GROUP BY clients.id ORDER BY clients.name
  `,
    )
    .all();
  res.json({ clients: rows });
});

app.post(
  "/api/clients/:id/credit-assessments",
  requireAuth,
  handle((req, res) => {
    const clientId = positiveInteger(Number(req.params.id), "Cliente");
    const client = db.prepare("SELECT id FROM clients WHERE id = ?").get(clientId);
    if (!client) throw new Error("Cliente não encontrado.");
    const history = db
      .prepare(
        `SELECT
          SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paidContracts,
          SUM(CASE WHEN status = 'renegotiated' THEN 1 ELSE 0 END) AS renegotiatedContracts,
          SUM(CASE WHEN status = 'open' AND due_date < date('now') THEN 1 ELSE 0 END) AS overdueContracts
         FROM contracts WHERE client_id = ?`,
      )
      .get(clientId);
    const input = {
      monthlyIncomeCents: positiveInteger(req.body.monthlyIncomeCents, "Renda mensal"),
      monthlyExpensesCents: Math.max(0, Number(req.body.monthlyExpensesCents || 0)),
      existingDebtCents: Math.max(0, Number(req.body.existingDebtCents || 0)),
      requestedCents: positiveInteger(req.body.requestedCents, "Valor solicitado"),
      employmentMonths: Math.max(0, Number(req.body.employmentMonths || 0)),
    };
    const result = calculateInternalCreditScore(input, history);
    const inserted = db
      .prepare(
        `INSERT INTO credit_assessments
          (client_id, monthly_income_cents, monthly_expenses_cents, existing_debt_cents, requested_cents, employment_months, score, recommended_limit_cents, risk_band, reasons_json, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        clientId,
        input.monthlyIncomeCents,
        input.monthlyExpensesCents,
        input.existingDebtCents,
        input.requestedCents,
        input.employmentMonths,
        result.score,
        result.recommendedLimitCents,
        result.riskBand,
        JSON.stringify(result.reasons),
        req.user.id,
      );
    audit(req.user.id, "credit.assessed", "client", clientId, {
      assessmentId: Number(inserted.lastInsertRowid),
      score: result.score,
      riskBand: result.riskBand,
      recommendedLimitCents: result.recommendedLimitCents,
    });
    res.status(201).json({ id: Number(inserted.lastInsertRowid), ...result });
  }),
);

app.get("/api/payments", requireAuth, (_req, res) => {
  const payments = db.prepare(`
    SELECT payments.*, clients.name AS client_name, contracts.legacy_reference,
      cycles.cycle_number
    FROM payments
    JOIN contracts ON contracts.id = payments.contract_id
    JOIN clients ON clients.id = contracts.client_id
    LEFT JOIN cycles ON cycles.id = payments.cycle_id
    ORDER BY payments.payment_date DESC, payments.id DESC
  `).all().map((payment) => ({
    ...payment,
    receiptCode: hashToken(`${payment.id}:${payment.contract_id}:${payment.amount_cents}:${payment.created_at}`).slice(0, 12).toUpperCase(),
  }));
  res.json({ payments });
});

app.get("/api/renewals", requireAuth, (_req, res) => {
  const renewals = db.prepare(`
    SELECT cycles.*, clients.name AS client_name, contracts.legacy_reference
    FROM cycles
    JOIN contracts ON contracts.id = cycles.contract_id
    JOIN clients ON clients.id = contracts.client_id
    WHERE cycles.cycle_number > 1
    ORDER BY cycles.start_date DESC, cycles.id DESC
  `).all();
  res.json({ renewals });
});

app.post(
  "/api/clients",
  requireAuth,
  handle((req, res) => {
    const name = cleanText(req.body.name, 120, true);
    const result = db
      .prepare(
        `INSERT INTO clients (name, document, phone, email, notes) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        name,
        cleanText(req.body.document, 30),
        cleanText(req.body.phone, 30),
        cleanText(req.body.email, 160),
        cleanText(req.body.notes, 1000),
      );
    audit(
      req.user.id,
      "client.created",
      "client",
      Number(result.lastInsertRowid),
      { name },
    );
    res.status(201).json({ id: Number(result.lastInsertRowid) });
  }),
);

app.patch(
  "/api/clients/:id",
  requireAuth,
  handle((req, res) => {
    const clientId = positiveInteger(Number(req.params.id), "Cliente");
    const current = db.prepare("SELECT * FROM clients WHERE id = ?").get(clientId);
    if (!current) throw new Error("Cliente não encontrado.");
    const name = cleanText(req.body.name, 120, true);
    const values = {
      document: cleanText(req.body.document, 30),
      phone: cleanText(req.body.phone, 30),
      email: cleanText(req.body.email, 160),
      notes: cleanText(req.body.notes, 1000),
    };
    db.prepare(
      "UPDATE clients SET name = ?, document = ?, phone = ?, email = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    ).run(
      name,
      values.document,
      values.phone,
      values.email,
      values.notes,
      clientId,
    );
    audit(req.user.id, "client.updated", "client", clientId, {
      before: {
        name: current.name,
        document: current.document,
        phone: current.phone,
        email: current.email,
      },
      after: { name, ...values },
    });
    res.json({ id: clientId, updated: true });
  }),
);

app.get("/api/contracts", requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `
    SELECT contracts.*, clients.name AS client_name,
      COALESCE((SELECT SUM(principal_cents) FROM payments WHERE contract_id = contracts.id AND reversed_at IS NULL), 0) AS principal_paid_cents,
      (SELECT cycle_number FROM cycles WHERE contract_id = contracts.id ORDER BY cycle_number DESC LIMIT 1) AS current_cycle,
      COALESCE((SELECT MAX(0, cycles.interest_cents - COALESCE((SELECT SUM(payments.interest_cents) FROM payments WHERE payments.cycle_id = cycles.id AND payments.reversed_at IS NULL), 0)) FROM cycles WHERE cycles.contract_id = contracts.id AND cycles.status = 'open' ORDER BY cycles.cycle_number DESC LIMIT 1), 0) AS current_interest_cents,
      COALESCE((SELECT MAX(0, cycles.fee_cents - COALESCE((SELECT SUM(payments.fee_cents) FROM payments WHERE payments.cycle_id = cycles.id AND payments.reversed_at IS NULL), 0)) FROM cycles WHERE cycles.contract_id = contracts.id AND cycles.status = 'open' ORDER BY cycles.cycle_number DESC LIMIT 1), 0) AS current_fee_cents,
      COALESCE((SELECT COALESCE((SELECT SUM(payments.fee_cents) FROM payments WHERE payments.cycle_id = cycles.id AND payments.reversed_at IS NULL), 0) FROM cycles WHERE cycles.contract_id = contracts.id AND cycles.status = 'open' ORDER BY cycles.cycle_number DESC LIMIT 1), 0) AS current_fee_paid_cents
    FROM contracts JOIN clients ON clients.id = contracts.client_id
    ORDER BY CASE WHEN contracts.status = 'open' THEN 0 ELSE 1 END, contracts.due_date
  `,
    )
    .all()
    .map((row) => {
      const settings = getSettings();
      const accrued = accruedDailyFee(
        row.due_date,
        currentDate(),
        settings.daily_fee_cents,
        Boolean(settings.daily_fee_enabled),
      );
      const baseFee = row.current_fee_cents + row.current_fee_paid_cents;
      return {
        ...row,
        current_fee_cents: Math.max(
          0,
          Math.max(baseFee, accrued) - row.current_fee_paid_cents,
        ),
        balance_principal_cents: Math.max(
          0,
          row.principal_cents - row.principal_paid_cents,
        ),
      };
    });
  res.json({ contracts: rows });
});

app.post(
  "/api/contracts",
  requireAuth,
  handle((req, res) => {
    const clientId = positiveInteger(req.body.clientId, "Cliente");
    const principal = positiveInteger(req.body.principalCents, "Principal");
    const rate = Number(req.body.interestRate);
    const term = positiveInteger(req.body.termDays || 30, "Prazo");
    const startDate = cleanText(req.body.startDate, 10, true);
    if (
      !db
        .prepare("SELECT id FROM clients WHERE id = ? AND active = 1")
        .get(clientId)
    )
      throw new Error("Cliente não encontrado.");
    const interest = interestFor(principal, rate);
    const dueDate = addDays(startDate, term);
    const id = transaction(() => {
      const contract = db
        .prepare(
          `INSERT INTO contracts (client_id, principal_cents, interest_rate, term_days, start_date, due_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          clientId,
          principal,
          rate,
          term,
          startDate,
          dueDate,
          cleanText(req.body.notes, 1000),
        );
      const contractId = Number(contract.lastInsertRowid);
      db.prepare(
        `INSERT INTO cycles (contract_id, cycle_number, start_date, due_date, opening_principal_cents, interest_cents) VALUES (?, 1, ?, ?, ?, ?)`,
      ).run(contractId, startDate, dueDate, principal, interest);
      audit(req.user.id, "contract.created", "contract", contractId, {
        principal,
        rate,
        dueDate,
      });
      return contractId;
    });
    res.status(201).json({
      id,
      dueDate,
      interestCents: interest,
      totalCents: principal + interest,
    });
  }),
);

app.post(
  "/api/contracts/:id/payments",
  requireAuth,
  handle((req, res) => {
    const contractId = positiveInteger(Number(req.params.id), "Contrato");
    const amount = positiveInteger(req.body.amountCents, "Pagamento");
    const paymentDate = cleanText(req.body.paymentDate, 10, true);
    const renew = req.body.renew === true;
    const result = transaction(() => {
      const contract = db
        .prepare("SELECT * FROM contracts WHERE id = ? AND status = 'open'")
        .get(contractId);
      if (!contract) throw new Error("Contrato aberto não encontrado.");
      const cycle = db
        .prepare(
          "SELECT * FROM cycles WHERE contract_id = ? AND status = 'open' ORDER BY cycle_number DESC LIMIT 1",
        )
        .get(contractId);
      if (!cycle) throw new Error("Ciclo aberto não encontrado.");
      const principalPaid = db
        .prepare(
          "SELECT COALESCE(SUM(principal_cents), 0) AS total FROM payments WHERE contract_id = ? AND reversed_at IS NULL",
        )
        .get(contractId).total;
      const cyclePaid = db
        .prepare(
          "SELECT COALESCE(SUM(fee_cents), 0) AS fee, COALESCE(SUM(interest_cents), 0) AS interest FROM payments WHERE cycle_id = ? AND reversed_at IS NULL",
        )
        .get(cycle.id);
      const remainingPrincipal = Math.max(
        0,
        contract.principal_cents - principalPaid,
      );
      const settings = getSettings();
      const accruedFee = accruedDailyFee(
        cycle.due_date,
        paymentDate,
        settings.daily_fee_cents,
        Boolean(settings.daily_fee_enabled),
      );
      const remainingFee = Math.max(
        0,
        Math.max(cycle.fee_cents, accruedFee) - cyclePaid.fee,
      );
      const remainingInterest = Math.max(
        0,
        cycle.interest_cents - cyclePaid.interest,
      );
      const allocation = allocate(amount, {
        fee: remainingFee,
        interest: remainingInterest,
        principal: remainingPrincipal,
      });
      if (
        renew &&
        (allocation.toInterest !== remainingInterest ||
          allocation.toPrincipal > 0 ||
          allocation.toFee !== remainingFee ||
          allocation.unapplied > 0)
      ) {
        throw new Error(
          "Para renovar, o pagamento deve quitar exatamente multa e juros, preservando o principal.",
        );
      }
      const payment = db
        .prepare(
          `INSERT INTO payments (contract_id, cycle_id, amount_cents, fee_cents, interest_cents, principal_cents, unapplied_cents, payment_date, method, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          contractId,
          cycle.id,
          amount,
          allocation.toFee,
          allocation.toInterest,
          allocation.toPrincipal,
          allocation.unapplied,
          paymentDate,
          cleanText(req.body.method, 30) || "pix",
          cleanText(req.body.note, 500),
          req.user.id,
        );
      let nextDueDate = null;
      if (renew) {
        db.prepare(
          "UPDATE cycles SET status = 'renewed', closed_at = CURRENT_TIMESTAMP WHERE id = ?",
        ).run(cycle.id);
        nextDueDate = addDays(paymentDate, contract.term_days);
        const nextInterest = interestFor(
          remainingPrincipal,
          contract.interest_rate,
        );
        db.prepare(
          `INSERT INTO cycles (contract_id, cycle_number, start_date, due_date, opening_principal_cents, interest_cents) VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(
          contractId,
          cycle.cycle_number + 1,
          paymentDate,
          nextDueDate,
          remainingPrincipal,
          nextInterest,
        );
        db.prepare(
          "UPDATE contracts SET due_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        ).run(nextDueDate, contractId);
      } else if (allocation.toPrincipal === remainingPrincipal) {
        db.prepare(
          "UPDATE cycles SET status = 'paid', closed_at = CURRENT_TIMESTAMP WHERE id = ?",
        ).run(cycle.id);
        db.prepare(
          "UPDATE contracts SET status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        ).run(contractId);
      }
      audit(
        req.user.id,
        renew ? "contract.renewed" : "payment.created",
        "contract",
        contractId,
        { amount, allocation, nextDueDate },
      );
      return {
        paymentId: Number(payment.lastInsertRowid),
        allocation,
        nextDueDate,
      };
    });
    res.status(201).json(result);
  }),
);

app.post(
  "/api/contracts/:id/renegotiate",
  requireAuth,
  handle((req, res) => {
    const contractId = positiveInteger(Number(req.params.id), "Contrato");
    const amount = positiveInteger(req.body.amountCents, "Pagamento");
    const paymentDate = cleanText(req.body.paymentDate, 10, true);
    const result = transaction(() => {
      const contract = db
        .prepare("SELECT * FROM contracts WHERE id = ? AND status = 'open'")
        .get(contractId);
      if (!contract) throw new Error("Contrato aberto não encontrado.");
      const cycle = db
        .prepare(
          "SELECT * FROM cycles WHERE contract_id = ? AND status = 'open' ORDER BY cycle_number DESC LIMIT 1",
        )
        .get(contractId);
      if (!cycle) throw new Error("Ciclo aberto não encontrado.");
      const totals = db
        .prepare(
          `SELECT COALESCE(SUM(fee_cents), 0) AS fee, COALESCE(SUM(interest_cents), 0) AS interest, COALESCE(SUM(principal_cents), 0) AS principal FROM payments WHERE contract_id = ? AND reversed_at IS NULL`,
        )
        .get(contractId);
      const cycleTotals = db
        .prepare(
          `SELECT COALESCE(SUM(fee_cents), 0) AS fee, COALESCE(SUM(interest_cents), 0) AS interest FROM payments WHERE cycle_id = ? AND reversed_at IS NULL`,
        )
        .get(cycle.id);
      const remainingPrincipal = Math.max(
        0,
        contract.principal_cents - totals.principal,
      );
      const settings = getSettings();
      const accruedFee = accruedDailyFee(
        cycle.due_date,
        paymentDate,
        settings.daily_fee_cents,
        Boolean(settings.daily_fee_enabled),
      );
      const remainingFee = Math.max(
        0,
        Math.max(cycle.fee_cents, accruedFee) - cycleTotals.fee,
      );
      const remainingInterest = Math.max(
        0,
        cycle.interest_cents - cycleTotals.interest,
      );
      const allocation = allocate(amount, {
        fee: remainingFee,
        interest: remainingInterest,
        principal: remainingPrincipal,
      });
      if (
        allocation.toFee !== remainingFee ||
        allocation.toInterest !== remainingInterest
      ) {
        throw new Error(
          "A renegociação exige quitar primeiro as multas e os juros pendentes.",
        );
      }
      if (allocation.unapplied > 0)
        throw new Error("O pagamento excede o saldo do contrato.");
      const newPrincipal = remainingPrincipal - allocation.toPrincipal;
      if (newPrincipal <= 0)
        throw new Error(
          "O pagamento quita o contrato; registre uma quitação em vez de renegociar.",
        );
      const newRate =
        req.body.interestRate === undefined
          ? contract.interest_rate
          : Number(req.body.interestRate);
      const newTerm = positiveInteger(
        req.body.termDays || contract.term_days,
        "Prazo",
      );
      const newDueDate = addDays(paymentDate, newTerm);
      const newInterest = interestFor(newPrincipal, newRate);
      const note = cleanText(req.body.note, 1000, true);

      const payment = db
        .prepare(
          `INSERT INTO payments (contract_id, cycle_id, amount_cents, fee_cents, interest_cents, principal_cents, unapplied_cents, payment_date, method, note, created_by) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
        )
        .run(
          contractId,
          cycle.id,
          amount,
          allocation.toFee,
          allocation.toInterest,
          allocation.toPrincipal,
          paymentDate,
          cleanText(req.body.method, 30) || "pix",
          note,
          req.user.id,
        );
      db.prepare(
        "UPDATE cycles SET status = 'renegotiated', closed_at = CURRENT_TIMESTAMP WHERE id = ?",
      ).run(cycle.id);
      db.prepare(
        "UPDATE contracts SET status = 'renegotiated', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      ).run(contractId);
      const next = db
        .prepare(
          `INSERT INTO contracts (client_id, parent_contract_id, principal_cents, interest_rate, term_days, start_date, due_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          contract.client_id,
          contractId,
          newPrincipal,
          newRate,
          newTerm,
          paymentDate,
          newDueDate,
          note,
        );
      const newContractId = Number(next.lastInsertRowid);
      db.prepare(
        `INSERT INTO cycles (contract_id, cycle_number, start_date, due_date, opening_principal_cents, interest_cents) VALUES (?, 1, ?, ?, ?, ?)`,
      ).run(newContractId, paymentDate, newDueDate, newPrincipal, newInterest);
      audit(req.user.id, "contract.renegotiated", "contract", contractId, {
        paymentId: Number(payment.lastInsertRowid),
        newContractId,
        newPrincipal,
        newRate,
        newDueDate,
      });
      return {
        oldContractId: contractId,
        newContractId,
        paymentId: Number(payment.lastInsertRowid),
        newPrincipalCents: newPrincipal,
        newInterestCents: newInterest,
        newDueDate,
      };
    });
    res.status(201).json(result);
  }),
);

app.post(
  "/api/contracts/:id/review",
  requireAuth,
  handle((req, res) => {
    const contractId = positiveInteger(Number(req.params.id), "Contrato");
    const resolution = cleanText(req.body.resolution, 30, true);
    const note = cleanText(req.body.note, 1000, true);
    if (!["open", "paid", "archived"].includes(resolution)) {
      throw new Error("Decisão de revisão inválida.");
    }
    const result = transaction(() => {
      const contract = db
        .prepare(
          "SELECT * FROM contracts WHERE id = ? AND status = 'review_required'",
        )
        .get(contractId);
      if (!contract) {
        throw new Error("Contrato pendente de revisão não encontrado.");
      }
      db.prepare(
        "UPDATE contracts SET status = ?, notes = COALESCE(notes, '') || ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      ).run(resolution, `\nRevisão da importação: ${note}`, contractId);
      db.prepare(
        "UPDATE cycles SET status = ?, closed_at = CASE WHEN ? = 'open' THEN NULL ELSE CURRENT_TIMESTAMP END WHERE contract_id = ? AND status = 'review_required'",
      ).run(resolution, resolution, contractId);
      audit(req.user.id, "legacy.reviewed", "contract", contractId, {
        resolution,
        note,
      });
      return { id: contractId, status: resolution };
    });
    res.json(result);
  }),
);

app.get(
  "/api/contracts/:id/history",
  requireAuth,
  handle((req, res) => {
    const contractId = positiveInteger(Number(req.params.id), "Contrato");
    const contract = db
      .prepare(
        `SELECT contracts.*, clients.name AS client_name, clients.document AS client_document FROM contracts JOIN clients ON clients.id = contracts.client_id WHERE contracts.id = ?`,
      )
      .get(contractId);
    if (!contract)
      return res.status(404).json({ error: "Contrato não encontrado." });
    const cycles = db
      .prepare(
        "SELECT * FROM cycles WHERE contract_id = ? ORDER BY cycle_number",
      )
      .all(contractId);
    const payments = db
      .prepare(
        `SELECT payments.*, users.name AS created_by_name FROM payments JOIN users ON users.id = payments.created_by WHERE contract_id = ? ORDER BY payment_date, payments.id`,
      )
      .all(contractId);
    const descendants = db
      .prepare(
        "SELECT id, status, principal_cents, start_date, due_date FROM contracts WHERE parent_contract_id = ? ORDER BY id",
      )
      .all(contractId);
    res.json({
      contract,
      cycles,
      payments: payments.map((payment) => ({
        ...payment,
        receiptCode: hashToken(
          `${payment.id}:${payment.created_at}:${payment.amount_cents}`,
        )
          .slice(0, 12)
          .toUpperCase(),
      })),
      descendants,
    });
  }),
);

app.get(
  "/api/payments/:id/receipt",
  requireAuth,
  handle((req, res) => {
    const paymentId = positiveInteger(Number(req.params.id), "Pagamento");
    const payment = db
      .prepare(
        `
    SELECT payments.*, contracts.id AS contract_number, clients.name AS client_name, clients.document AS client_document, users.name AS confirmed_by
    FROM payments
    JOIN contracts ON contracts.id = payments.contract_id
    JOIN clients ON clients.id = contracts.client_id
    JOIN users ON users.id = payments.created_by
    WHERE payments.id = ?
  `,
      )
      .get(paymentId);
    if (!payment)
      return res.status(404).json({ error: "Pagamento não encontrado." });
    const receiptCode = hashToken(
      `${payment.id}:${payment.created_at}:${payment.amount_cents}`,
    )
      .slice(0, 12)
      .toUpperCase();
    res.json({
      receipt: { ...payment, receiptCode, issuer: "HelpSystemPro Crédito" },
    });
  }),
);

app.post(
  "/api/payments/:id/reverse",
  requireAuth,
  handle((req, res) => {
    const paymentId = positiveInteger(Number(req.params.id), "Pagamento");
    const reason = cleanText(req.body.reason, 1000, true);
    const result = transaction(() => {
      const payment = db
        .prepare(
          `SELECT payments.*, cycles.status AS cycle_status, contracts.status AS contract_status
           FROM payments
           JOIN cycles ON cycles.id = payments.cycle_id
           JOIN contracts ON contracts.id = payments.contract_id
           WHERE payments.id = ?`,
        )
        .get(paymentId);
      if (!payment) throw new Error("Pagamento não encontrado.");
      if (payment.reversed_at)
        throw new Error("Este pagamento já foi estornado.");
      if (!["open", "paid"].includes(payment.cycle_status)) {
        throw new Error(
          "Este pagamento gerou renovação ou renegociação e exige correção assistida da cadeia contratual.",
        );
      }
      db.prepare(
        "UPDATE payments SET reversed_at = CURRENT_TIMESTAMP, reversed_by = ?, reversal_reason = ? WHERE id = ?",
      ).run(req.user.id, reason, paymentId);
      if (payment.contract_status === "paid") {
        db.prepare(
          "UPDATE contracts SET status = 'open', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        ).run(payment.contract_id);
      }
      if (payment.cycle_status === "paid") {
        db.prepare(
          "UPDATE cycles SET status = 'open', closed_at = NULL WHERE id = ?",
        ).run(payment.cycle_id);
      }
      audit(req.user.id, "payment.reversed", "payment", paymentId, {
        reason,
        contractId: payment.contract_id,
        amount: payment.amount_cents,
      });
      return { id: paymentId, reversed: true };
    });
    res.json(result);
  }),
);

app.get("/api/dashboard", requireAuth, (req, res) => {
  const contracts = db
    .prepare(
      `
    SELECT contracts.*,
      clients.name AS client_name,
      COALESCE((SELECT SUM(principal_cents) FROM payments WHERE contract_id = contracts.id AND reversed_at IS NULL), 0) AS principal_paid,
      COALESCE((SELECT MAX(0, cycles.interest_cents - COALESCE((SELECT SUM(payments.interest_cents) FROM payments WHERE payments.cycle_id = cycles.id AND payments.reversed_at IS NULL), 0)) FROM cycles WHERE cycles.contract_id = contracts.id AND cycles.status = 'open' ORDER BY cycles.cycle_number DESC LIMIT 1), 0) AS interest_due,
      COALESCE((SELECT MAX(0, cycles.fee_cents - COALESCE((SELECT SUM(payments.fee_cents) FROM payments WHERE payments.cycle_id = cycles.id AND payments.reversed_at IS NULL), 0)) FROM cycles WHERE cycles.contract_id = contracts.id AND cycles.status = 'open' ORDER BY cycles.cycle_number DESC LIMIT 1), 0) AS fee_due,
      COALESCE((SELECT COALESCE((SELECT SUM(payments.fee_cents) FROM payments WHERE payments.cycle_id = cycles.id AND payments.reversed_at IS NULL), 0) FROM cycles WHERE cycles.contract_id = contracts.id AND cycles.status = 'open' ORDER BY cycles.cycle_number DESC LIMIT 1), 0) AS fee_paid
    FROM contracts JOIN clients ON clients.id = contracts.client_id WHERE contracts.status = 'open'
    ORDER BY contracts.due_date
  `,
    )
    .all()
    .map((row) => {
      const settings = getSettings();
      const accrued = accruedDailyFee(
        row.due_date,
        currentDate(),
        settings.daily_fee_cents,
        Boolean(settings.daily_fee_enabled),
      );
      const baseFee = row.fee_due + row.fee_paid;
      return {
        ...row,
        fee_due: Math.max(0, Math.max(baseFee, accrued) - row.fee_paid),
        principal_due: Math.max(0, row.principal_cents - row.principal_paid),
      };
    });
  const principal = contracts.reduce((sum, row) => sum + row.principal_due, 0);
  const interest = contracts.reduce((sum, row) => sum + row.interest_due, 0);
  const fees = contracts.reduce((sum, row) => sum + row.fee_due, 0);
  const activities = db
    .prepare(
      `SELECT audit_log.*, users.name AS user_name FROM audit_log LEFT JOIN users ON users.id = audit_log.user_id ORDER BY audit_log.id DESC LIMIT 8`,
    )
    .all();
  const reviewRequired = db
    .prepare(
      "SELECT COUNT(*) AS total FROM contracts WHERE status = 'review_required'",
    )
    .get().total;
  res.json({
    summary: {
      principalCents: principal,
      interestCents: interest,
      feeCents: fees,
      totalCents: principal + interest + fees,
      openContracts: contracts.length,
      reviewRequired,
    },
    contracts: contracts.slice(0, 8),
    activities,
  });
});

app.post(
  "/api/backup",
  requireAuth,
  handle((req, res) => {
    const { fileName } = createConsistentBackup(db, root);
    audit(req.user.id, "backup.created", "system", null, {
      file: fileName,
    });
    res.status(201).json({ ok: true, file: fileName });
  }),
);

const dist = resolve(root, "dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) =>
    req.path.startsWith("/api/")
      ? next()
      : res.sendFile(resolve(dist, "index.html")),
  );
}

app.use("/api", (req, res) =>
  res.status(404).json({ error: "Recurso não encontrado." }),
);

app.use((error, req, res, _next) => {
  const isUploadError = error instanceof multer.MulterError;
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}`, error);
  res.status(isUploadError ? 400 : 500).json({
    error: isUploadError
      ? "A planilha excede o limite de 10 MB ou não pôde ser recebida."
      : "Não foi possível concluir a operação.",
  });
});

const server = app.listen(port, host, () => {
  writeFileSync(
    serverLockPath,
    JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
    { encoding: "utf8", mode: 0o600 },
  );
  console.log(`HelpSystemPro Crédito disponível em http://${host}:${port}`);
  console.log(`Banco local: ${dataDirectory}`);
});

const shutdown = () =>
  server.close(() => {
    try {
      unlinkSync(serverLockPath);
    } catch {}
    db.close();
    process.exit(0);
  });
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
