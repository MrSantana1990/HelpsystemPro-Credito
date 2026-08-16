import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const dataDirectory = process.env.DATA_DIRECTORY
  ? resolve(process.env.DATA_DIRECTORY)
  : resolve(root, 'data')
export const databasePath = resolve(dataDirectory, 'helpsystempro-credito.db')
mkdirSync(dataDirectory, { recursive: true })

export const db = new DatabaseSync(databasePath)
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')

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

  CREATE INDEX IF NOT EXISTS idx_contracts_client ON contracts(client_id);
  CREATE INDEX IF NOT EXISTS idx_contracts_due ON contracts(due_date);
  CREATE INDEX IF NOT EXISTS idx_payments_contract ON payments(contract_id);
  CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
`)

export function transaction(callback) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = callback()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function audit(userId, action, entityType, entityId, details = {}) {
  db.prepare(`
    INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId ?? null, action, entityType, entityId ?? null, JSON.stringify(details))
}
