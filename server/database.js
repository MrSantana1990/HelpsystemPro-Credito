import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const dataDirectory = process.env.DATA_DIRECTORY
  ? resolve(process.env.DATA_DIRECTORY)
  : resolve(root, "data");
export const databasePath = resolve(dataDirectory, "helpsystempro-credito.db");
mkdirSync(dataDirectory, { recursive: true });

export const db = new DatabaseSync(databasePath);
db.exec(
  "PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;",
);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    default_interest_rate REAL NOT NULL DEFAULT 0.3,
    default_term_days INTEGER NOT NULL DEFAULT 30,
    daily_fee_cents INTEGER NOT NULL DEFAULT 2000,
    daily_fee_enabled INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    document TEXT,
    phone TEXT,
    email TEXT,
    notes TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS partners (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    phone TEXT,
    notes TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS contracts (
    id INTEGER PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    parent_contract_id INTEGER REFERENCES contracts(id),
    principal_cents INTEGER NOT NULL CHECK(principal_cents >= 0),
    interest_rate REAL NOT NULL CHECK(interest_rate >= 0),
    term_days INTEGER NOT NULL DEFAULT 30 CHECK(term_days > 0),
    start_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cycles (
    id INTEGER PRIMARY KEY,
    contract_id INTEGER NOT NULL REFERENCES contracts(id),
    cycle_number INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    opening_principal_cents INTEGER NOT NULL,
    interest_cents INTEGER NOT NULL,
    fee_cents INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'open',
    closed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(contract_id, cycle_number)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY,
    contract_id INTEGER NOT NULL REFERENCES contracts(id),
    cycle_id INTEGER REFERENCES cycles(id),
    amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
    fee_cents INTEGER NOT NULL DEFAULT 0,
    interest_cents INTEGER NOT NULL DEFAULT 0,
    principal_cents INTEGER NOT NULL DEFAULT 0,
    unapplied_cents INTEGER NOT NULL DEFAULT 0,
    payment_date TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'pix',
    note TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS import_batches (
    id INTEGER PRIMARY KEY,
    file_hash TEXT NOT NULL UNIQUE,
    file_name TEXT NOT NULL,
    source_sheet TEXT NOT NULL,
    row_count INTEGER NOT NULL,
    imported_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS legacy_import_rows (
    id INTEGER PRIMARY KEY,
    batch_id INTEGER NOT NULL REFERENCES import_batches(id),
    source_row INTEGER NOT NULL,
    legacy_reference TEXT,
    normalized_status TEXT,
    raw_json TEXT NOT NULL,
    contract_id INTEGER REFERENCES contracts(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS credit_assessments (
    id INTEGER PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    monthly_income_cents INTEGER NOT NULL CHECK(monthly_income_cents > 0),
    monthly_expenses_cents INTEGER NOT NULL DEFAULT 0 CHECK(monthly_expenses_cents >= 0),
    existing_debt_cents INTEGER NOT NULL DEFAULT 0 CHECK(existing_debt_cents >= 0),
    requested_cents INTEGER NOT NULL CHECK(requested_cents > 0),
    employment_months INTEGER NOT NULL DEFAULT 0 CHECK(employment_months >= 0),
    score INTEGER NOT NULL CHECK(score BETWEEN 0 AND 1000),
    recommended_limit_cents INTEGER NOT NULL CHECK(recommended_limit_cents >= 0),
    risk_band TEXT NOT NULL,
    reasons_json TEXT NOT NULL,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS loan_requests (
    id INTEGER PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    source_contract_id INTEGER NOT NULL UNIQUE REFERENCES contracts(id),
    requested_cents INTEGER NOT NULL CHECK(requested_cents > 0),
    requested_at TEXT NOT NULL,
    preferred_window TEXT NOT NULL CHECK(preferred_window IN ('dia_15', 'fim_mes', 'flexivel')),
    purpose TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'contracted', 'cancelled')),
    decision_note TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    decided_by INTEGER REFERENCES users(id),
    decided_at TEXT,
    created_contract_id INTEGER REFERENCES contracts(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS client_documents (
    id INTEGER PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    document_type TEXT NOT NULL CHECK(document_type IN ('identidade', 'endereco', 'renda', 'outro')),
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL CHECK(size_bytes > 0),
    encrypted_data BLOB NOT NULL,
    iv BLOB NOT NULL,
    auth_tag BLOB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'verified', 'rejected')),
    review_note TEXT,
    expires_on TEXT,
    uploaded_by INTEGER NOT NULL REFERENCES users(id),
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS onboarding_invites (
    id INTEGER PRIMARY KEY,
    partner_id INTEGER NOT NULL REFERENCES partners(id),
    token_hash TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'submitted', 'expired', 'cancelled')),
    expires_at TEXT NOT NULL,
    client_id INTEGER REFERENCES clients(id),
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    submitted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS client_access_links (
    id INTEGER PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    token_hash TEXT NOT NULL UNIQUE,
    active INTEGER NOT NULL DEFAULT 1,
    expires_at TEXT NOT NULL,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS contract_action_requests (
    id INTEGER PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    contract_id INTEGER NOT NULL REFERENCES contracts(id),
    action_type TEXT NOT NULL CHECK(action_type IN ('payoff', 'interest_renewal', 'renegotiation')),
    note TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected', 'completed', 'cancelled')),
    decision_note TEXT,
    decided_by INTEGER REFERENCES users(id),
    decided_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_contracts_client ON contracts(client_id);
  CREATE INDEX IF NOT EXISTS idx_contracts_due ON contracts(due_date);
  CREATE INDEX IF NOT EXISTS idx_payments_contract ON payments(contract_id);
  CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
  CREATE INDEX IF NOT EXISTS idx_credit_assessments_client ON credit_assessments(client_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_loan_requests_status ON loan_requests(status, requested_at);
  CREATE INDEX IF NOT EXISTS idx_client_documents_client ON client_documents(client_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_onboarding_invites_status ON onboarding_invites(status, expires_at);
  CREATE INDEX IF NOT EXISTS idx_client_access_links_client ON client_access_links(client_id, active, expires_at);
  CREATE INDEX IF NOT EXISTS idx_contract_action_requests_status ON contract_action_requests(status, created_at);
`);
db.prepare("INSERT OR IGNORE INTO settings (id) VALUES (1)").run();
db.prepare("INSERT OR IGNORE INTO partners (name, notes) VALUES ('Rodrigo', 'Credor principal da carteira original.')").run();

const clientColumns = db
  .prepare("PRAGMA table_info(clients)")
  .all()
  .map((column) => column.name);
for (const [name, definition] of [
  ["birth_date", "TEXT"],
  ["occupation", "TEXT"],
  ["address", "TEXT"],
  ["preferred_payment_window", "TEXT"],
  ["credit_analysis_consent_at", "TEXT"],
  ["income_type", "TEXT"],
  ["declared_income_cents", "INTEGER"],
]) {
  if (!clientColumns.includes(name)) db.exec(`ALTER TABLE clients ADD COLUMN ${name} ${definition}`);
}

const contractColumns = db
  .prepare("PRAGMA table_info(contracts)")
  .all()
  .map((column) => column.name);
if (!contractColumns.includes("legacy_reference")) {
  db.exec("ALTER TABLE contracts ADD COLUMN legacy_reference TEXT");
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_contracts_legacy_reference ON contracts(legacy_reference)",
  );
}
if (!contractColumns.includes("partner_id")) {
  db.exec("ALTER TABLE contracts ADD COLUMN partner_id INTEGER REFERENCES partners(id)");
  db.exec("UPDATE contracts SET partner_id = (SELECT id FROM partners WHERE name = 'Rodrigo' LIMIT 1) WHERE partner_id IS NULL");
  db.exec("CREATE INDEX IF NOT EXISTS idx_contracts_partner ON contracts(partner_id)");
}

const paymentColumns = db
  .prepare("PRAGMA table_info(payments)")
  .all()
  .map((column) => column.name);
if (!paymentColumns.includes("reversed_at")) {
  db.exec("ALTER TABLE payments ADD COLUMN reversed_at TEXT");
  db.exec(
    "ALTER TABLE payments ADD COLUMN reversed_by INTEGER REFERENCES users(id)",
  );
  db.exec("ALTER TABLE payments ADD COLUMN reversal_reason TEXT");
}

export function transaction(callback) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = callback();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function audit(userId, action, entityType, entityId, details = {}) {
  db.prepare(
    `
    INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
    VALUES (?, ?, ?, ?, ?)
  `,
  ).run(
    userId ?? null,
    action,
    entityType,
    entityId ?? null,
    JSON.stringify(details),
  );
}
