import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bell, CalendarDays, CheckCircle2, ChevronRight, CircleDollarSign, Clock3,
  DatabaseBackup, FileCheck2, HandCoins, LayoutDashboard, LoaderCircle, LockKeyhole,
  LogOut, Menu, Plus, ReceiptText, RefreshCw, Search, ShieldCheck, Sparkles, Users,
  WalletCards, X,
} from 'lucide-react'
import { api, Client, Contract, Dashboard, User } from './api'

type Modal = 'client' | 'contract' | 'payment' | null

const money = (cents = 0) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
const dateBr = (date?: string) => date ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)) : '—'
const today = () => new Date().toISOString().slice(0, 10)
const toCents = (value: FormDataEntryValue | null) => Math.round(Number(String(value || '0').replace(',', '.')) * 100)

function Brand() {
  return <div className="brand"><div className="brand-mark"><span>H</span></div><div><strong>HelpSystem<span>Pro</span></strong><small>CRÉDITO</small></div></div>
}

function Access({ setupRequired, onReady }: { setupRequired: boolean; onReady: (user: User) => void }) {
  const [setup, setSetup] = useState(setupRequired)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    const data = new FormData(event.currentTarget)
    try {
      const email = String(data.get('email'))
      const password = String(data.get('password'))
      if (setup) {
        if (password !== String(data.get('confirmation'))) throw new Error('As senhas não coincidem.')
        await api.setup({ name: String(data.get('name')), email, password })
        setSetup(false)
      }
      const result = await api.login({ email, password })
      onReady(result.user)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha de acesso.') }
    finally { setBusy(false) }
  }

  return <div className="access-page"><section className="access-card"><Brand /><div className="access-icon"><LockKeyhole /></div><span className="eyebrow"><ShieldCheck size={14} /> AMBIENTE LOCAL PROTEGIDO</span><h1>{setup ? 'Configure o administrador' : 'Bem-vindo de volta'}</h1><p>{setup ? 'Este primeiro acesso cria a conta responsável pelo sistema.' : 'Entre para acessar sua carteira de contratos.'}</p><form onSubmit={submit}>{setup && <label>Seu nome<input name="name" required maxLength={100} autoComplete="name" /></label>}<label>E-mail<input name="email" type="email" required autoComplete="username" /></label><label>Senha<input name="password" type="password" required minLength={10} autoComplete={setup ? 'new-password' : 'current-password'} /></label>{setup && <label>Confirme a senha<input name="confirmation" type="password" required minLength={10} autoComplete="new-password" /></label>}{error && <div className="form-error">{error}</div>}<button className="primary-action access-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <LockKeyhole size={18} />}{setup ? 'Criar acesso seguro' : 'Entrar no sistema'}</button></form><small className="access-foot">Os dados ficam armazenados neste computador.</small></section></div>
}

function Sidebar({ open, close, user, onBackup, onLogout }: { open: boolean; close: () => void; user: User; onBackup: () => void; onLogout: () => void }) {
  return <aside className={`sidebar ${open ? 'open' : ''}`}><div className="sidebar-top"><Brand /><button className="close-menu" onClick={close}><X size={20} /></button></div><nav><p>OPERAÇÃO</p><button className="active"><LayoutDashboard size={19} /><span>Visão geral</span><i /></button><button><Users size={19} /><span>Clientes</span></button><button><FileCheck2 size={19} /><span>Contratos</span></button><button><CircleDollarSign size={19} /><span>Pagamentos</span></button><button><RefreshCw size={19} /><span>Renovações</span></button><button><ReceiptText size={19} /><span>Comprovantes</span></button><p>SEGURANÇA</p><button onClick={onBackup}><DatabaseBackup size={19} /><span>Criar backup</span></button><button onClick={onLogout}><LogOut size={19} /><span>Sair</span></button></nav><div className="security-card"><div><ShieldCheck size={20} /><span>Banco de dados local</span></div><p>Histórico auditável e sessão protegida.</p></div><div className="profile"><div className="profile-avatar">{user.name.slice(0, 2).toUpperCase()}</div><div><strong>{user.name}</strong><small>Administrador</small></div></div></aside>
}

function Dialog({ title, subtitle, close, children }: { title: string; subtitle: string; close: () => void; children: React.ReactNode }) {
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && close()}><section className="dialog" role="dialog" aria-modal="true"><header><div><h2>{title}</h2><p>{subtitle}</p></div><button onClick={close}><X /></button></header>{children}</section></div>
}

function App() {
  const [booting, setBooting] = useState(true)
  const [setupRequired, setSetupRequired] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [modal, setModal] = useState<Modal>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 3500) }
  const loadData = useCallback(async () => {
    const [dash, clientData, contractData] = await Promise.all([api.dashboard(), api.clients(), api.contracts()])
    setDashboard(dash); setClients(clientData.clients); setContracts(contractData.contracts)
  }, [])

  useEffect(() => { api.status().then(async (status) => { setSetupRequired(status.setupRequired); if (status.authenticated) { const me = await api.me(); setUser(me.user); await loadData() } }).catch(() => setError('O servidor local não está disponível.')).finally(() => setBooting(false)) }, [loadData])
  useEffect(() => { if (user) loadData().catch((reason) => setError(reason.message)) }, [user, loadData])

  async function submitClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); const data = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>
    try { await api.createClient(data); await loadData(); setModal(null); notify('Cliente cadastrado com sucesso.') } catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha ao cadastrar.') } finally { setBusy(false) }
  }
  async function submitContract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); const data = new FormData(event.currentTarget)
    try { const result = await api.createContract({ clientId: Number(data.get('clientId')), principalCents: toCents(data.get('principal')), interestRate: Number(String(data.get('rate')).replace(',', '.')) / 100, termDays: Number(data.get('termDays')), startDate: data.get('startDate'), notes: data.get('notes') }); await loadData(); setModal(null); notify(`Contrato criado. Vencimento em ${dateBr(result.dueDate)}.`) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha ao criar contrato.') } finally { setBusy(false) }
  }
  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); const data = new FormData(event.currentTarget); const contractId = Number(data.get('contractId')); const renew = data.get('renew') === 'on'
    try { const result = await api.pay(contractId, { amountCents: toCents(data.get('amount')), paymentDate: data.get('paymentDate'), method: data.get('method'), note: data.get('note'), renew }); await loadData(); setModal(null); notify(result.nextDueDate ? `Renovado até ${dateBr(result.nextDueDate)}.` : 'Pagamento registrado com sucesso.') } catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha ao registrar pagamento.') } finally { setBusy(false) }
  }
  async function logout() { await api.logout(); setUser(null); setDashboard(null) }
  async function backup() { try { const result = await api.backup(); notify(`Backup criado: ${result.file}`) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha no backup.') } }

  const summary = dashboard?.summary ?? { principalCents: 0, interestCents: 0, feeCents: 0, totalCents: 0, openContracts: 0 }
  const dueContracts = dashboard?.contracts ?? []
  const selectedForPayment = useMemo(() => contracts.find((item) => item.status === 'open'), [contracts])

  if (booting) return <div className="boot"><Brand /><LoaderCircle className="spin" /><span>Preparando ambiente seguro...</span></div>
  if (!user) return <Access setupRequired={setupRequired} onReady={setUser} />

  return <div className="app-shell"><Sidebar open={menuOpen} close={() => setMenuOpen(false)} user={user} onBackup={backup} onLogout={logout} />{menuOpen && <button className="overlay" onClick={() => setMenuOpen(false)} aria-label="Fechar menu" />}<main><header><button className="menu-button" onClick={() => setMenuOpen(true)}><Menu /></button><div className="mobile-brand"><Brand /></div><div className="search"><Search size={18} /><input aria-label="Buscar" placeholder="Buscar cliente ou contrato..." /></div><div className="header-actions"><button className="notification"><Bell size={20} /></button><button className="primary-action" onClick={() => clients.length ? setModal('contract') : setModal('client')}><Plus size={19} />Novo empréstimo</button></div></header><section className="content"><div className="welcome"><div><span className="eyebrow"><Sparkles size={14} /> OPERAÇÃO EM TEMPO REAL</span><h1>Olá, {user.name.split(' ')[0]}.</h1><p>Cadastre, acompanhe e registre operações com histórico preservado.</p></div><div className="reference"><Clock3 size={16} /><span>Data atual</span><strong>{dateBr(today())}</strong></div></div>{error && <div className="global-error"><span>{error}</span><button onClick={() => setError('')}><X /></button></div>}<div className="stats-grid"><article className="stat"><div className="stat-icon cyan"><HandCoins /></div><span>Principal em aberto</span><h2>{money(summary.principalCents)}</h2><p>{summary.openContracts} contratos ativos</p></article><article className="stat"><div className="stat-icon violet"><CircleDollarSign /></div><span>Juros do ciclo</span><h2>{money(summary.interestCents)}</h2><p>Calculados sobre o principal</p></article><article className="stat"><div className="stat-icon green"><WalletCards /></div><span>Total a receber</span><h2>{money(summary.totalCents)}</h2><p><CalendarDays size={15} /> Carteira atual</p></article><article className="stat"><div className="stat-icon orange"><Clock3 /></div><span>Multas registradas</span><h2>{money(summary.feeCents)}</h2><p>Separadas dos juros</p></article></div><div className="workspace-grid"><section className="panel contracts-panel"><div className="panel-title"><div><h3>Contratos em aberto</h3><p>Ordenados pelo próximo vencimento</p></div><button onClick={() => setModal('contract')}>Novo <ChevronRight size={16} /></button></div>{dueContracts.length === 0 ? <div className="empty"><FileCheck2 /><strong>Nenhum contrato aberto</strong><span>Cadastre um cliente e crie o primeiro empréstimo.</span><button onClick={() => setModal(clients.length ? 'contract' : 'client')}>Começar agora</button></div> : <div className="table-wrap"><table><thead><tr><th>CONTRATO / CLIENTE</th><th>VENCIMENTO</th><th>PRINCIPAL</th><th>JUROS</th><th>TOTAL DO CICLO</th></tr></thead><tbody>{dueContracts.map((contract) => <tr key={contract.id}><td><div className="client"><span>{contract.client_name.slice(0, 2).toUpperCase()}</span><div><strong>{contract.client_name}</strong><small>#{String(contract.id).padStart(4, '0')}</small></div></div></td><td><strong>{dateBr(contract.due_date)}</strong></td><td>{money(contract.principal_due)}</td><td>{money(contract.interest_due)}</td><td><strong>{money(contract.principal_due + contract.interest_due + contract.fee_due)}</strong></td></tr>)}</tbody></table></div>}</section><section className="panel quick-panel"><div className="panel-title"><div><h3>Ações rápidas</h3><p>Operações disponíveis</p></div></div><div className="quick-grid"><button onClick={() => setModal('client')}><span className="q-blue"><Users /></span><div><strong>Novo cliente</strong><small>Cadastro e contato</small></div><ChevronRight /></button><button disabled={!contracts.some((item) => item.status === 'open')} onClick={() => setModal('payment')}><span className="q-green"><CircleDollarSign /></span><div><strong>Registrar pagamento</strong><small>Receber ou renovar</small></div><ChevronRight /></button><button onClick={backup}><span className="q-violet"><DatabaseBackup /></span><div><strong>Criar backup</strong><small>Cópia segura do banco</small></div><ChevronRight /></button></div></section></div><div className="bottom-grid"><section className="panel health-panel"><div className="panel-title"><div><h3>Clientes cadastrados</h3><p>Base operacional</p></div><button onClick={() => setModal('client')}>Adicionar</button></div><div className="metric-focus"><Users /><div><strong>{clients.length}</strong><span>clientes ativos no sistema</span></div></div></section><section className="panel activity-panel"><div className="panel-title"><div><h3>Atividade recente</h3><p>Trilha de auditoria</p></div></div><div className="activity-list">{dashboard?.activities.length ? dashboard.activities.map((activity) => <div className="activity" key={activity.id}><span className="blue"><ShieldCheck /></span><div><strong>{activity.action}</strong><p>{activity.user_name || 'Sistema'} · {activity.entity_type} #{activity.entity_id || '—'}</p></div><time>{activity.created_at.slice(0, 16).replace('T', ' ')}</time></div>) : <div className="empty compact"><ShieldCheck /><span>As operações aparecerão aqui.</span></div>}</div></section></div><div className="prototype-note"><ShieldCheck size={17} /><span><strong>Banco local ativo.</strong> Faça backups regulares antes de usar dados importantes.</span></div></section></main>{modal === 'client' && <Dialog title="Novo cliente" subtitle="Cadastre somente os dados necessários." close={() => { setModal(null); setError('') }}><form className="dialog-form" onSubmit={submitClient}><label>Nome completo<input name="name" required maxLength={120} autoFocus /></label><div className="form-row"><label>CPF ou documento<input name="document" maxLength={30} /></label><label>Telefone<input name="phone" maxLength={30} /></label></div><label>E-mail<input name="email" type="email" maxLength={160} /></label><label>Observações<textarea name="notes" maxLength={1000} rows={3} /></label>{error && <div className="form-error">{error}</div>}<div className="dialog-actions"><button type="button" onClick={() => setModal(null)}>Cancelar</button><button className="primary-action" disabled={busy}>{busy && <LoaderCircle className="spin" />}Salvar cliente</button></div></form></Dialog>}{modal === 'contract' && <Dialog title="Novo empréstimo" subtitle="Confira os valores antes de confirmar." close={() => { setModal(null); setError('') }}><form className="dialog-form" onSubmit={submitContract}><label>Cliente<select name="clientId" required autoFocus><option value="">Selecione...</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><div className="form-row"><label>Principal (R$)<input name="principal" type="number" min="0.01" step="0.01" required /></label><label>Taxa mensal (%)<input name="rate" type="number" min="0" step="0.01" defaultValue="30" required /></label></div><div className="form-row"><label>Data do empréstimo<input name="startDate" type="date" defaultValue={today()} required /></label><label>Prazo em dias<input name="termDays" type="number" min="1" defaultValue="30" required /></label></div><label>Observações<textarea name="notes" maxLength={1000} rows={2} /></label>{error && <div className="form-error">{error}</div>}<div className="dialog-actions"><button type="button" onClick={() => setModal(null)}>Cancelar</button><button className="primary-action" disabled={busy}>{busy && <LoaderCircle className="spin" />}Criar contrato</button></div></form></Dialog>}{modal === 'payment' && selectedForPayment && <Dialog title="Registrar pagamento" subtitle="O sistema aplica em multa, juros e principal, nessa ordem." close={() => { setModal(null); setError('') }}><form className="dialog-form" onSubmit={submitPayment}><label>Contrato<select name="contractId" required defaultValue={selectedForPayment.id}>{contracts.filter((item) => item.status === 'open').map((contract) => <option key={contract.id} value={contract.id}>#{String(contract.id).padStart(4, '0')} · {contract.client_name} · juros {money(contract.current_interest_cents)}</option>)}</select></label><div className="form-row"><label>Valor recebido (R$)<input name="amount" type="number" min="0.01" step="0.01" required autoFocus /></label><label>Data do pagamento<input name="paymentDate" type="date" defaultValue={today()} required /></label></div><label>Forma de pagamento<select name="method"><option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="transferencia">Transferência</option><option value="outro">Outro</option></select></label><label className="check-label"><input name="renew" type="checkbox" /><span><strong>Renovar por mais 30 dias</strong><small>Exige quitação exata dos juros e preserva o principal.</small></span></label><label>Observação<input name="note" maxLength={500} /></label>{error && <div className="form-error">{error}</div>}<div className="dialog-actions"><button type="button" onClick={() => setModal(null)}>Cancelar</button><button className="primary-action" disabled={busy}>{busy && <LoaderCircle className="spin" />}Confirmar pagamento</button></div></form></Dialog>}{toast && <div className="toast"><CheckCircle2 size={18} />{toast}</div>}</div>
}

export default App
