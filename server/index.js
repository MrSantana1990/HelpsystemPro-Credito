import express from 'express'
import { existsSync, mkdirSync, copyFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { db, databasePath, dataDirectory, transaction, audit } from './database.js'
import { hashPassword, verifyPassword, createSessionToken, hashToken } from './security.js'
import { addDays, allocate, interestFor } from './finance.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const app = express()
const port = Number(process.env.PORT || 8091)
const host = process.env.HOST || '127.0.0.1'
const sessionHours = Math.max(1, Number(process.env.SESSION_HOURS || 12))
const loginAttempts = new Map()

app.disable('x-powered-by')
app.use(express.json({ limit: '1mb' }))
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  next()
})

function cookieValue(req, name) {
  const match = req.headers.cookie?.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null
}

function currentUser(req) {
  const token = cookieValue(req, 'hsp_session')
  if (!token) return null
  return db.prepare(`
    SELECT users.id, users.name, users.email, users.role
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > datetime('now') AND users.active = 1
  `).get(hashToken(token)) ?? null
}

function requireAuth(req, res, next) {
  const user = currentUser(req)
  if (!user) return res.status(401).json({ error: 'Sessão inválida ou expirada.' })
  req.user = user
  next()
}

function cleanText(value, max = 255, required = false) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (required && !text) throw new Error('Campo obrigatório não informado.')
  if (text.length > max) throw new Error(`Texto excede ${max} caracteres.`)
  return text || null
}

function positiveInteger(value, field) {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${field} deve ser um número inteiro positivo.`)
  return value
}

function handle(handler) {
  return (req, res) => {
    try { handler(req, res) } catch (error) {
      console.error(error)
      res.status(400).json({ error: error instanceof Error ? error.message : 'Operação inválida.' })
    }
  }
}

app.get('/api/status', (req, res) => {
  const setupRequired = db.prepare('SELECT COUNT(*) AS total FROM users').get().total === 0
  res.json({ setupRequired, authenticated: Boolean(currentUser(req)) })
})

app.post('/api/setup', handle((req, res) => {
  if (db.prepare('SELECT COUNT(*) AS total FROM users').get().total > 0) {
    return res.status(409).json({ error: 'O administrador já foi configurado.' })
  }
  const name = cleanText(req.body.name, 100, true)
  const email = cleanText(req.body.email, 160, true)?.toLowerCase()
  const passwordHash = hashPassword(req.body.password)
  const result = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(name, email, passwordHash)
  audit(Number(result.lastInsertRowid), 'setup.completed', 'user', Number(result.lastInsertRowid), { email })
  res.status(201).json({ ok: true })
}))

app.post('/api/login', handle((req, res) => {
  const key = req.ip || 'local'
  const attempt = loginAttempts.get(key) || { count: 0, blockedUntil: 0 }
  if (attempt.blockedUntil > Date.now()) return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' })
  const email = cleanText(req.body.email, 160, true)?.toLowerCase()
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email)
  if (!user || !verifyPassword(String(req.body.password || ''), user.password_hash)) {
    attempt.count += 1
    if (attempt.count >= 5) { attempt.blockedUntil = Date.now() + 5 * 60_000; attempt.count = 0 }
    loginAttempts.set(key, attempt)
    return res.status(401).json({ error: 'E-mail ou senha inválidos.' })
  }
  loginAttempts.delete(key)
  const token = createSessionToken()
  const expires = new Date(Date.now() + sessionHours * 3_600_000).toISOString()
  db.prepare('DELETE FROM sessions WHERE expires_at <= datetime(\'now\')').run()
  db.prepare('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)').run(user.id, hashToken(token), expires)
  audit(user.id, 'auth.login', 'user', user.id)
  res.setHeader('Set-Cookie', `hsp_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionHours * 3600}`)
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } })
}))

app.post('/api/logout', requireAuth, (req, res) => {
  const token = cookieValue(req, 'hsp_session')
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token))
  res.setHeader('Set-Cookie', 'hsp_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0')
  res.json({ ok: true })
})

app.get('/api/me', requireAuth, (req, res) => res.json({ user: req.user }))

app.get('/api/clients', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT clients.*, COUNT(contracts.id) AS contract_count
    FROM clients LEFT JOIN contracts ON contracts.client_id = clients.id
    GROUP BY clients.id ORDER BY clients.name
  `).all()
  res.json({ clients: rows })
})

app.post('/api/clients', requireAuth, handle((req, res) => {
  const name = cleanText(req.body.name, 120, true)
  const result = db.prepare(`INSERT INTO clients (name, document, phone, email, notes) VALUES (?, ?, ?, ?, ?)`)
    .run(name, cleanText(req.body.document, 30), cleanText(req.body.phone, 30), cleanText(req.body.email, 160), cleanText(req.body.notes, 1000))
  audit(req.user.id, 'client.created', 'client', Number(result.lastInsertRowid), { name })
  res.status(201).json({ id: Number(result.lastInsertRowid) })
}))

app.get('/api/contracts', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT contracts.*, clients.name AS client_name,
      COALESCE((SELECT SUM(principal_cents) FROM payments WHERE contract_id = contracts.id), 0) AS principal_paid_cents,
      (SELECT cycle_number FROM cycles WHERE contract_id = contracts.id ORDER BY cycle_number DESC LIMIT 1) AS current_cycle,
      (SELECT interest_cents FROM cycles WHERE contract_id = contracts.id AND status = 'open' ORDER BY cycle_number DESC LIMIT 1) AS current_interest_cents,
      (SELECT fee_cents FROM cycles WHERE contract_id = contracts.id AND status = 'open' ORDER BY cycle_number DESC LIMIT 1) AS current_fee_cents
    FROM contracts JOIN clients ON clients.id = contracts.client_id
    ORDER BY CASE WHEN contracts.status = 'open' THEN 0 ELSE 1 END, contracts.due_date
  `).all().map((row) => ({ ...row, balance_principal_cents: Math.max(0, row.principal_cents - row.principal_paid_cents) }))
  res.json({ contracts: rows })
})

app.post('/api/contracts', requireAuth, handle((req, res) => {
  const clientId = positiveInteger(req.body.clientId, 'Cliente')
  const principal = positiveInteger(req.body.principalCents, 'Principal')
  const rate = Number(req.body.interestRate)
  const term = positiveInteger(req.body.termDays || 30, 'Prazo')
  const startDate = cleanText(req.body.startDate, 10, true)
  if (!db.prepare('SELECT id FROM clients WHERE id = ? AND active = 1').get(clientId)) throw new Error('Cliente não encontrado.')
  const interest = interestFor(principal, rate)
  const dueDate = addDays(startDate, term)
  const id = transaction(() => {
    const contract = db.prepare(`INSERT INTO contracts (client_id, principal_cents, interest_rate, term_days, start_date, due_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(clientId, principal, rate, term, startDate, dueDate, cleanText(req.body.notes, 1000))
    const contractId = Number(contract.lastInsertRowid)
    db.prepare(`INSERT INTO cycles (contract_id, cycle_number, start_date, due_date, opening_principal_cents, interest_cents) VALUES (?, 1, ?, ?, ?, ?)`)
      .run(contractId, startDate, dueDate, principal, interest)
    audit(req.user.id, 'contract.created', 'contract', contractId, { principal, rate, dueDate })
    return contractId
  })
  res.status(201).json({ id, dueDate, interestCents: interest, totalCents: principal + interest })
}))

app.post('/api/contracts/:id/payments', requireAuth, handle((req, res) => {
  const contractId = positiveInteger(Number(req.params.id), 'Contrato')
  const amount = positiveInteger(req.body.amountCents, 'Pagamento')
  const paymentDate = cleanText(req.body.paymentDate, 10, true)
  const renew = req.body.renew === true
  const result = transaction(() => {
    const contract = db.prepare('SELECT * FROM contracts WHERE id = ? AND status = \'open\'').get(contractId)
    if (!contract) throw new Error('Contrato aberto não encontrado.')
    const cycle = db.prepare('SELECT * FROM cycles WHERE contract_id = ? AND status = \'open\' ORDER BY cycle_number DESC LIMIT 1').get(contractId)
    if (!cycle) throw new Error('Ciclo aberto não encontrado.')
    const principalPaid = db.prepare('SELECT COALESCE(SUM(principal_cents), 0) AS total FROM payments WHERE contract_id = ?').get(contractId).total
    const remainingPrincipal = Math.max(0, contract.principal_cents - principalPaid)
    const allocation = allocate(amount, { fee: cycle.fee_cents, interest: cycle.interest_cents, principal: remainingPrincipal })
    if (renew && (allocation.toInterest !== cycle.interest_cents || allocation.toPrincipal > 0 || allocation.toFee !== cycle.fee_cents)) {
      throw new Error('Para renovar, o pagamento deve quitar exatamente multa e juros, preservando o principal.')
    }
    const payment = db.prepare(`INSERT INTO payments (contract_id, cycle_id, amount_cents, fee_cents, interest_cents, principal_cents, unapplied_cents, payment_date, method, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(contractId, cycle.id, amount, allocation.toFee, allocation.toInterest, allocation.toPrincipal, allocation.unapplied, paymentDate, cleanText(req.body.method, 30) || 'pix', cleanText(req.body.note, 500), req.user.id)
    let nextDueDate = null
    if (renew) {
      db.prepare('UPDATE cycles SET status = \'renewed\', closed_at = CURRENT_TIMESTAMP WHERE id = ?').run(cycle.id)
      nextDueDate = addDays(paymentDate, contract.term_days)
      const nextInterest = interestFor(remainingPrincipal, contract.interest_rate)
      db.prepare(`INSERT INTO cycles (contract_id, cycle_number, start_date, due_date, opening_principal_cents, interest_cents) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(contractId, cycle.cycle_number + 1, paymentDate, nextDueDate, remainingPrincipal, nextInterest)
      db.prepare('UPDATE contracts SET due_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(nextDueDate, contractId)
    } else if (allocation.toFee === cycle.fee_cents && allocation.toInterest === cycle.interest_cents) {
      db.prepare('UPDATE cycles SET status = \'paid\', closed_at = CURRENT_TIMESTAMP WHERE id = ?').run(cycle.id)
      if (allocation.toPrincipal === remainingPrincipal) db.prepare('UPDATE contracts SET status = \'paid\', updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(contractId)
    }
    audit(req.user.id, renew ? 'contract.renewed' : 'payment.created', 'contract', contractId, { amount, allocation, nextDueDate })
    return { paymentId: Number(payment.lastInsertRowid), allocation, nextDueDate }
  })
  res.status(201).json(result)
}))

app.get('/api/dashboard', requireAuth, (req, res) => {
  const contracts = db.prepare(`
    SELECT contracts.*,
      clients.name AS client_name,
      COALESCE((SELECT SUM(principal_cents) FROM payments WHERE contract_id = contracts.id), 0) AS principal_paid,
      COALESCE((SELECT interest_cents FROM cycles WHERE contract_id = contracts.id AND status = 'open' ORDER BY cycle_number DESC LIMIT 1), 0) AS interest_due,
      COALESCE((SELECT fee_cents FROM cycles WHERE contract_id = contracts.id AND status = 'open' ORDER BY cycle_number DESC LIMIT 1), 0) AS fee_due
    FROM contracts JOIN clients ON clients.id = contracts.client_id WHERE contracts.status = 'open'
    ORDER BY contracts.due_date
  `).all().map((row) => ({ ...row, principal_due: Math.max(0, row.principal_cents - row.principal_paid) }))
  const principal = contracts.reduce((sum, row) => sum + row.principal_due, 0)
  const interest = contracts.reduce((sum, row) => sum + row.interest_due, 0)
  const fees = contracts.reduce((sum, row) => sum + row.fee_due, 0)
  const activities = db.prepare(`SELECT audit_log.*, users.name AS user_name FROM audit_log LEFT JOIN users ON users.id = audit_log.user_id ORDER BY audit_log.id DESC LIMIT 8`).all()
  res.json({ summary: { principalCents: principal, interestCents: interest, feeCents: fees, totalCents: principal + interest + fees, openContracts: contracts.length }, contracts: contracts.slice(0, 8), activities })
})

app.post('/api/backup', requireAuth, handle((req, res) => {
  const backupDirectory = resolve(root, 'backups')
  mkdirSync(backupDirectory, { recursive: true })
  db.exec('PRAGMA wal_checkpoint(FULL)')
  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
  const destination = resolve(backupDirectory, `helpsystempro-credito-${stamp}.db`)
  copyFileSync(databasePath, destination)
  audit(req.user.id, 'backup.created', 'system', null, { file: destination.split(/[\\/]/).pop() })
  res.status(201).json({ ok: true, file: destination.split(/[\\/]/).pop() })
}))

const dist = resolve(root, 'dist')
if (existsSync(dist)) {
  app.use(express.static(dist))
  app.use((req, res, next) => req.path.startsWith('/api/') ? next() : res.sendFile(resolve(dist, 'index.html')))
}

app.use('/api', (req, res) => res.status(404).json({ error: 'Recurso não encontrado.' }))

app.listen(port, host, () => {
  console.log(`HelpSystemPro Crédito disponível em http://${host}:${port}`)
  console.log(`Banco local: ${dataDirectory}`)
})
