import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  HandCoins,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
  X,
} from 'lucide-react'
import { useState } from 'react'

const contracts = [
  { id: '#0017', client: 'Cliente demonstração A', avatar: 'CA', due: '04 set. 2026', principal: 'R$ 800,00', total: 'R$ 1.040,00', days: '20 dias', tone: 'warning' },
  { id: '#0016', client: 'Cliente demonstração B', avatar: 'CB', due: '13 set. 2026', principal: 'R$ 500,00', total: 'R$ 650,00', days: '29 dias', tone: 'safe' },
]

const activities = [
  { icon: RefreshCw, title: 'Contrato renovado', text: 'Juros recebidos e novo ciclo de 30 dias criado', time: 'Hoje, 14:32', color: 'violet' },
  { icon: ReceiptText, title: 'Comprovante emitido', text: 'Recibo vinculado ao contrato #0015', time: 'Hoje, 11:08', color: 'blue' },
  { icon: CheckCircle2, title: 'Pagamento confirmado', text: 'R$ 280,00 conferidos com sucesso', time: 'Ontem, 18:45', color: 'green' },
]

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark"><span>H</span></div>
      <div><strong>HelpSystem<span>Pro</span></strong><small>CRÉDITO</small></div>
    </div>
  )
}

function Sidebar({ open, close }: { open: boolean; close: () => void }) {
  const items = [
    [LayoutDashboard, 'Visão geral', true],
    [Users, 'Clientes', false],
    [FileCheck2, 'Contratos', false],
    [CircleDollarSign, 'Pagamentos', false],
    [RefreshCw, 'Renovações', false],
    [ReceiptText, 'Comprovantes', false],
    [Bell, 'Avisos e cobranças', false],
  ] as const

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-top"><Brand /><button className="close-menu" onClick={close}><X size={20} /></button></div>
      <nav>
        <p>OPERAÇÃO</p>
        {items.map(([Icon, label, active]) => (
          <button className={active ? 'active' : ''} key={label}><Icon size={19} /><span>{label}</span>{active && <i />}</button>
        ))}
        <p>GESTÃO</p>
        <button><CalendarDays size={19} /><span>Agenda financeira</span></button>
        <button><WalletCards size={19} /><span>Relatórios</span></button>
        <button><ShieldCheck size={19} /><span>Auditoria</span></button>
      </nav>
      <div className="security-card">
        <div><ShieldCheck size={20} /><span>Ambiente protegido</span></div>
        <p>Histórico auditável e dados preservados.</p>
      </div>
      <div className="profile"><div className="profile-avatar">RS</div><div><strong>Rodolfo Santana</strong><small>Administrador</small></div><MoreHorizontal size={18} /></div>
    </aside>
  )
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [toast, setToast] = useState('')

  const demoAction = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }

  return (
    <div className="app-shell">
      <Sidebar open={menuOpen} close={() => setMenuOpen(false)} />
      {menuOpen && <button className="overlay" onClick={() => setMenuOpen(false)} aria-label="Fechar menu" />}
      <main>
        <header>
          <button className="menu-button" onClick={() => setMenuOpen(true)}><Menu /></button>
          <div className="mobile-brand"><Brand /></div>
          <div className="search"><Search size={18} /><input aria-label="Buscar" placeholder="Buscar cliente, contrato ou comprovante..." /><kbd>⌘ K</kbd></div>
          <div className="header-actions"><button className="notification"><Bell size={20} /><span /></button><button className="primary-action" onClick={() => demoAction('Fluxo de novo empréstimo será aberto aqui.')}><Plus size={19} />Novo empréstimo</button></div>
        </header>

        <section className="content">
          <div className="welcome">
            <div><span className="eyebrow"><Sparkles size={14} /> VISÃO EXECUTIVA</span><h1>Boa tarde, Rodolfo.</h1><p>Seu portfólio está saudável. Veja o que precisa da sua atenção hoje.</p></div>
            <div className="reference"><Clock3 size={16} /><span>Referência</span><strong>15 ago. 2026</strong></div>
          </div>

          <div className="stats-grid">
            <article className="stat main-stat"><div className="stat-icon cyan"><HandCoins /></div><span>Principal em aberto</span><h2>R$ 1.300,00</h2><p><ArrowUpRight size={15} /> 2 contratos ativos</p><div className="mini-chart"><i/><i/><i/><i/><i/><i/><i/><i/></div></article>
            <article className="stat"><div className="stat-icon violet"><CircleDollarSign /></div><span>Juros previstos</span><h2>R$ 390,00</h2><p className="positive"><ArrowUpRight size={15} /> 30% no ciclo atual</p></article>
            <article className="stat"><div className="stat-icon green"><WalletCards /></div><span>Total a receber</span><h2>R$ 1.690,00</h2><p className="muted"><CalendarDays size={15} /> Próximos 30 dias</p></article>
            <article className="stat"><div className="stat-icon orange"><Clock3 /></div><span>Vencido</span><h2>R$ 0,00</h2><p className="positive"><CheckCircle2 size={15} /> Nenhum em atraso</p></article>
          </div>

          <div className="workspace-grid">
            <section className="panel contracts-panel">
              <div className="panel-title"><div><h3>Próximos vencimentos</h3><p>Contratos que exigem acompanhamento</p></div><button>Ver todos <ChevronRight size={16} /></button></div>
              <div className="table-wrap"><table><thead><tr><th>CONTRATO / CLIENTE</th><th>VENCIMENTO</th><th>PRINCIPAL</th><th>TOTAL</th><th>SITUAÇÃO</th><th /></tr></thead><tbody>{contracts.map((contract) => <tr key={contract.id}><td><div className="client"><span>{contract.avatar}</span><div><strong>{contract.client}</strong><small>{contract.id}</small></div></div></td><td><strong>{contract.due}</strong><small className="cell-sub">em {contract.days}</small></td><td>{contract.principal}</td><td><strong>{contract.total}</strong></td><td><span className={`status ${contract.tone}`}><i />Em aberto</span></td><td><button className="more"><MoreHorizontal /></button></td></tr>)}</tbody></table></div>
            </section>

            <section className="panel quick-panel">
              <div className="panel-title"><div><h3>Ações rápidas</h3><p>Registre uma operação</p></div></div>
              <div className="quick-grid">
                <button onClick={() => demoAction('Pagamento: valor → aplicação → confirmação.')}><span className="q-green"><ArrowDownRight /></span><div><strong>Registrar pagamento</strong><small>Juros, parcial ou quitação</small></div><ChevronRight /></button>
                <button onClick={() => demoAction('Renovação: juros pagos e novo ciclo vinculado.')}><span className="q-violet"><RefreshCw /></span><div><strong>Renovar por 30 dias</strong><small>Preserva todo o histórico</small></div><ChevronRight /></button>
                <button onClick={() => demoAction('Comprovante auditável com código de validação.')}><span className="q-blue"><ReceiptText /></span><div><strong>Emitir comprovante</strong><small>PDF e validação digital</small></div><ChevronRight /></button>
              </div>
            </section>
          </div>

          <div className="bottom-grid">
            <section className="panel health-panel"><div className="panel-title"><div><h3>Saúde da carteira</h3><p>Distribuição do saldo atual</p></div><button>Últimos 30 dias⌄</button></div><div className="health-content"><div className="donut"><div><strong>100%</strong><span>em dia</span></div></div><div className="legend"><div><span><i className="green-dot" />Em dia</span><strong>R$ 1.690,00</strong></div><div><span><i className="yellow-dot" />A vencer em 7 dias</span><strong>R$ 0,00</strong></div><div><span><i className="red-dot" />Em atraso</span><strong>R$ 0,00</strong></div></div></div></section>
            <section className="panel activity-panel"><div className="panel-title"><div><h3>Atividade recente</h3><p>Registro operacional auditável</p></div><button>Histórico <ChevronRight size={16} /></button></div><div className="activity-list">{activities.map(({ icon: Icon, title, text, time, color }) => <div className="activity" key={title}><span className={color}><Icon /></span><div><strong>{title}</strong><p>{text}</p></div><time>{time}</time></div>)}</div></section>
          </div>

          <div className="prototype-note"><ShieldCheck size={17} /><span><strong>Protótipo demonstrativo.</strong> Valores fictícios inspirados na estrutura operacional, sem dados pessoais de clientes.</span></div>
        </section>
      </main>
      {toast && <div className="toast"><CheckCircle2 size={18} />{toast}</div>}
    </div>
  )
}

export default App

