import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  AlertTriangle,
  DatabaseBackup,
  Eye,
  FileUp,
  FileCheck2,
  HandCoins,
  Handshake,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Menu,
  Plus,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  ShieldCheck,
  Sparkles,
  Users,
  Printer,
  WalletCards,
  X,
} from "lucide-react";
import {
  api,
  Client,
  Contract,
  ContractHistory,
  Dashboard,
  ImportPreview,
  PaymentListItem,
  RenewalListItem,
  CreditAssessment,
  LoanRequest,
  EligiblePaidContract,
  Settings as SystemSettings,
  User,
} from "./api";

type Modal =
  | "client"
  | "clients"
  | "contracts"
  | "payments"
  | "renewals"
  | "receipts"
  | "score"
  | "loanRequests"
  | "contract"
  | "payment"
  | "renegotiate"
  | "history"
  | "import"
  | "review"
  | "settings"
  | "reverse"
  | null;

const money = (cents = 0) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
const dateBr = (date?: string) =>
  date
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
        new Date(`${date}T00:00:00Z`),
      )
    : "—";
const today = () => new Date().toISOString().slice(0, 10);
const toCents = (value: FormDataEntryValue | null) =>
  Math.round(Number(String(value || "0").replace(",", ".")) * 100);

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark">
        <span>H</span>
      </div>
      <div>
        <strong>
          HelpSystem<span>Pro</span>
        </strong>
        <small>CRÉDITO</small>
      </div>
    </div>
  );
}

function Access({
  setupRequired,
  onReady,
}: {
  setupRequired: boolean;
  onReady: (user: User) => void;
}) {
  const [setup, setSetup] = useState(setupRequired);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const email = String(data.get("email"));
      const password = String(data.get("password"));
      if (setup) {
        if (password !== String(data.get("confirmation")))
          throw new Error("As senhas não coincidem.");
        await api.setup({ name: String(data.get("name")), email, password });
        setSetup(false);
      }
      const result = await api.login({ email, password });
      onReady(result.user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha de acesso.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="access-page">
      <section className="access-card">
        <Brand />
        <div className="access-icon">
          <LockKeyhole />
        </div>
        <span className="eyebrow">
          <ShieldCheck size={14} /> AMBIENTE LOCAL PROTEGIDO
        </span>
        <h1>{setup ? "Configure o administrador" : "Bem-vindo de volta"}</h1>
        <p>
          {setup
            ? "Este primeiro acesso cria a conta responsável pelo sistema."
            : "Entre para acessar sua carteira de contratos."}
        </p>
        <form onSubmit={submit}>
          {setup && (
            <label>
              Seu nome
              <input name="name" required maxLength={100} autoComplete="name" />
            </label>
          )}
          <label>
            E-mail
            <input name="email" type="email" required autoComplete="username" />
          </label>
          <label>
            Senha
            <input
              name="password"
              type="password"
              required
              minLength={10}
              autoComplete={setup ? "new-password" : "current-password"}
            />
          </label>
          {setup && (
            <label>
              Confirme a senha
              <input
                name="confirmation"
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
              />
            </label>
          )}
          {error && <div className="form-error">{error}</div>}
          <button className="primary-action access-submit" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" />
            ) : (
              <LockKeyhole size={18} />
            )}
            {setup ? "Criar acesso seguro" : "Entrar no sistema"}
          </button>
        </form>
        <small className="access-foot">
          Os dados ficam armazenados neste computador.
        </small>
      </section>
    </div>
  );
}

function Sidebar({
  open,
  close,
  user,
  onBackup,
  onLogout,
  onNavigate,
}: {
  open: boolean;
  close: () => void;
  user: User;
  onBackup: () => void;
  onLogout: () => void;
  onNavigate: (target: Exclude<Modal, null>) => void;
}) {
  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="sidebar-top">
        <Brand />
        <button className="close-menu" onClick={close}>
          <X size={20} />
        </button>
      </div>
      <nav>
        <p>OPERAÇÃO</p>
        <button className="active">
          <LayoutDashboard size={19} />
          <span>Visão geral</span>
          <i />
        </button>
        <button onClick={() => { onNavigate("clients"); close(); }}>
          <Users size={19} />
          <span>Clientes</span>
        </button>
        <button onClick={() => { onNavigate("contracts"); close(); }}>
          <FileCheck2 size={19} />
          <span>Contratos</span>
        </button>
        <button onClick={() => { onNavigate("payments"); close(); }}>
          <CircleDollarSign size={19} />
          <span>Pagamentos</span>
        </button>
        <button onClick={() => { onNavigate("renewals"); close(); }}>
          <RefreshCw size={19} />
          <span>Renovações</span>
        </button>
        <button onClick={() => { onNavigate("receipts"); close(); }}>
          <ReceiptText size={19} />
          <span>Comprovantes</span>
        </button>
        <button onClick={() => { onNavigate("loanRequests"); close(); }}>
          <Handshake size={19} />
          <span>Solicitações</span>
        </button>
        <p>SEGURANÇA</p>
        <button onClick={onBackup}>
          <DatabaseBackup size={19} />
          <span>Criar backup</span>
        </button>
        <button onClick={onLogout}>
          <LogOut size={19} />
          <span>Sair</span>
        </button>
      </nav>
      <div className="security-card">
        <div>
          <ShieldCheck size={20} />
          <span>Banco de dados local</span>
        </div>
        <p>Histórico auditável e sessão protegida.</p>
      </div>
      <div className="profile">
        <div className="profile-avatar">
          {user.name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <strong>{user.name}</strong>
          <small>Administrador</small>
        </div>
      </div>
    </aside>
  );
}

function Dialog({
  title,
  subtitle,
  close,
  children,
}: {
  title: string;
  subtitle: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <section className="dialog" role="dialog" aria-modal="true">
        <header>
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button onClick={close}>
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function App() {
  const [booting, setBooting] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [history, setHistory] = useState<ContractHistory | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(
    null,
  );
  const [importToken, setImportToken] = useState("");
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [reversePaymentId, setReversePaymentId] = useState<number | null>(null);
  const [editingClientId, setEditingClientId] = useState<number | null>(null);
  const [scoreClientId, setScoreClientId] = useState<number | null>(null);
  const [scoreResult, setScoreResult] = useState<CreditAssessment | null>(null);
  const [paymentList, setPaymentList] = useState<PaymentListItem[]>([]);
  const [renewalList, setRenewalList] = useState<RenewalListItem[]>([]);
  const [loanRequests, setLoanRequests] = useState<LoanRequest[]>([]);
  const [eligiblePaidContracts, setEligiblePaidContracts] = useState<EligiblePaidContract[]>([]);
  const [modal, setModal] = useState<Modal>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3500);
  };
  const navigate = async (target: Exclude<Modal, null>) => {
    setError("");
    if (target === "payments" || target === "receipts") {
      setPaymentList((await api.payments()).payments);
    }
    if (target === "renewals") {
      setRenewalList((await api.renewals()).renewals);
    }
    if (target === "loanRequests") {
      const data = await api.loanRequests();
      setLoanRequests(data.requests);
      setEligiblePaidContracts(data.eligibleContracts);
    }
    setModal(target);
  };
  const loadData = useCallback(async () => {
    const [dash, clientData, contractData, settingsData] = await Promise.all([
      api.dashboard(),
      api.clients(),
      api.contracts(),
      api.settings(),
    ]);
    setDashboard(dash);
    setClients(clientData.clients);
    setContracts(contractData.contracts);
    setSettings(settingsData.settings);
  }, []);

  useEffect(() => {
    api
      .status()
      .then(async (status) => {
        setSetupRequired(status.setupRequired);
        if (status.authenticated) {
          const me = await api.me();
          setUser(me.user);
          await loadData();
        }
      })
      .catch(() => setError("O servidor local não está disponível."))
      .finally(() => setBooting(false));
  }, [loadData]);
  useEffect(() => {
    if (user) loadData().catch((reason) => setError(reason.message));
  }, [user, loadData]);

  async function submitClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(
      new FormData(event.currentTarget),
    ) as Record<string, string>;
    try {
      await api.createClient(data);
      await loadData();
      setModal(null);
      notify("Cliente cadastrado com sucesso.");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Falha ao cadastrar.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submitClientUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingClientId) return;
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    try {
      await api.updateClient(editingClientId, data);
      await loadData();
      setEditingClientId(null);
      notify("Cadastro do cliente atualizado.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao atualizar cliente.");
    } finally {
      setBusy(false);
    }
  }
  async function submitCreditAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!scoreClientId) return;
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await api.assessCredit(scoreClientId, {
        monthlyIncomeCents: toCents(data.get("income")),
        monthlyExpensesCents: toCents(data.get("expenses")),
        existingDebtCents: toCents(data.get("debt")),
        requestedCents: toCents(data.get("requested")),
        employmentMonths: Number(data.get("employmentMonths")),
      });
      setScoreResult(result);
      await loadData();
      notify("Análise interna registrada no histórico do cliente.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao analisar crédito.");
    } finally {
      setBusy(false);
    }
  }
  async function submitContract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await api.createContract({
        clientId: Number(data.get("clientId")),
        principalCents: toCents(data.get("principal")),
        interestRate: Number(String(data.get("rate")).replace(",", ".")) / 100,
        termDays: Number(data.get("termDays")),
        startDate: data.get("startDate"),
        notes: data.get("notes"),
      });
      await loadData();
      setModal(null);
      notify(`Contrato criado. Vencimento em ${dateBr(result.dueDate)}.`);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Falha ao criar contrato.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const contractId = Number(data.get("contractId"));
    const renew = data.get("renew") === "on";
    try {
      const result = await api.pay(contractId, {
        amountCents: toCents(data.get("amount")),
        paymentDate: data.get("paymentDate"),
        method: data.get("method"),
        note: data.get("note"),
        renew,
      });
      await loadData();
      setModal(null);
      notify(
        result.nextDueDate
          ? `Renovado até ${dateBr(result.nextDueDate)}.`
          : result.paid
            ? "Contrato quitado. Uma nova solicitação já pode ser registrada."
            : "Pagamento registrado com sucesso.",
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Falha ao registrar pagamento.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submitLoanRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await api.createLoanRequest({
        sourceContractId: Number(data.get("sourceContractId")),
        requestedCents: toCents(data.get("requested")),
        requestedAt: data.get("requestedAt"),
        preferredWindow: data.get("preferredWindow"),
        purpose: data.get("purpose"),
      });
      const updated = await api.loanRequests();
      setLoanRequests(updated.requests);
      setEligiblePaidContracts(updated.eligibleContracts);
      notify("Nova solicitação registrada e vinculada à quitação.");
      form.reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao registrar solicitação.");
    } finally {
      setBusy(false);
    }
  }
  async function decideLoanRequest(id: number, status: "approved" | "rejected" | "cancelled") {
    try {
      await api.decideLoanRequest(id, { status });
      const updated = await api.loanRequests();
      setLoanRequests(updated.requests);
      setEligiblePaidContracts(updated.eligibleContracts);
      notify(status === "approved" ? "Solicitação aprovada." : "Solicitação atualizada.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao atualizar solicitação.");
    }
  }
  async function submitRenegotiation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const contractId = Number(data.get("contractId"));
    try {
      const result = await api.renegotiate(contractId, {
        amountCents: toCents(data.get("amount")),
        paymentDate: data.get("paymentDate"),
        method: data.get("method"),
        interestRate: Number(String(data.get("rate")).replace(",", ".")) / 100,
        termDays: Number(data.get("termDays")),
        note: data.get("note"),
      });
      await loadData();
      setModal(null);
      notify(
        `Novo contrato #${String(result.newContractId).padStart(4, "0")} criado até ${dateBr(result.newDueDate)}.`,
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Falha ao renegociar.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function openHistory(id: number) {
    setBusy(true);
    setError("");
    try {
      setHistory(await api.history(id));
      setModal("history");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Falha ao carregar histórico.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function printReceipt(id: number) {
    try {
      const { receipt } = await api.receipt(id);
      const escape = (value: unknown) =>
        String(value ?? "").replace(
          /[&<>"']/g,
          (char) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#39;",
            })[char] || char,
        );
      const popup = window.open("", "_blank", "noopener,noreferrer");
      if (!popup)
        throw new Error("Permita a abertura da janela do comprovante.");
      popup.document.body.innerHTML = `<main style="font:16px Arial;max-width:680px;margin:40px auto;padding:30px;border:1px solid #ccc"><h1>HelpSystemPro Crédito</h1><h2>Recibo de pagamento</h2><p><b>Cliente:</b> ${escape(receipt.client_name)}</p><p><b>Contrato:</b> #${escape(receipt.contract_number)}</p><p><b>Data:</b> ${escape(receipt.payment_date)}</p><p><b>Valor recebido:</b> ${money(Number(receipt.amount_cents))}</p><hr><p>Multa: ${money(Number(receipt.fee_cents))}<br>Juros: ${money(Number(receipt.interest_cents))}<br>Principal: ${money(Number(receipt.principal_cents))}</p><p><b>Código de validação:</b> ${escape(receipt.receiptCode)}</p><small>Registro emitido pelo sistema. A validade financeira depende da confirmação do recebimento.</small></main>`;
      popup.document.title = `Recibo ${escape(receipt.receiptCode)}`;
      popup.print();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Falha ao emitir recibo.",
      );
    }
  }
  async function previewImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const file = data.get("file");
    try {
      if (!(file instanceof File) || !file.name)
        throw new Error("Selecione a planilha .xlsx.");
      const result = await api.previewImport(
        file,
        String(data.get("clientName") || ""),
      );
      setImportPreview(result.preview);
      setImportToken(result.token);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Falha ao ler a planilha.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function applyImport() {
    setBusy(true);
    setError("");
    try {
      const result = await api.applyImport(importToken);
      await loadData();
      setModal(null);
      setImportPreview(null);
      setImportToken("");
      notify(
        `${result.importedRows} contratos importados. Registros ambíguos aguardam revisão.`,
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Falha ao importar a planilha.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await api.reviewContract(Number(data.get("contractId")), {
        resolution: String(data.get("resolution")),
        note: String(data.get("note")),
      });
      await loadData();
      setModal(null);
      notify("Revisão registrada na trilha de auditoria.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Falha ao concluir a revisão.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await api.updateSettings({
        defaultInterestRate:
          Number(String(data.get("rate")).replace(",", ".")) / 100,
        defaultTermDays: Number(data.get("termDays")),
        dailyFeeCents: toCents(data.get("dailyFee")),
        dailyFeeEnabled: data.get("dailyFeeEnabled") === "on",
      });
      setSettings(result.settings);
      await loadData();
      setModal(null);
      notify("Parâmetros financeiros atualizados.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Falha ao salvar parâmetros.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submitReversal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reversePaymentId) return;
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await api.reversePayment(reversePaymentId, String(data.get("reason")));
      if (history) setHistory(await api.history(history.contract.id));
      await loadData();
      setModal("history");
      setReversePaymentId(null);
      notify("Pagamento estornado. O registro original foi preservado.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Falha ao estornar pagamento.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    await api.logout();
    setUser(null);
    setDashboard(null);
  }
  async function backup() {
    try {
      const result = await api.backup();
      notify(`Backup criado: ${result.file}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha no backup.");
    }
  }

  const summary = dashboard?.summary ?? {
    principalCents: 0,
    interestCents: 0,
    feeCents: 0,
    totalCents: 0,
    openContracts: 0,
    reviewRequired: 0,
  };
  const dueContracts = dashboard?.contracts ?? [];
  const selectedForPayment = useMemo(
    () => contracts.find((item) => item.status === "open"),
    [contracts],
  );

  if (booting)
    return (
      <div className="boot">
        <Brand />
        <LoaderCircle className="spin" />
        <span>Preparando ambiente seguro...</span>
      </div>
    );
  if (!user) return <Access setupRequired={setupRequired} onReady={setUser} />;

  return (
    <div className="app-shell">
      <Sidebar
        open={menuOpen}
        close={() => setMenuOpen(false)}
        user={user}
        onBackup={backup}
        onLogout={logout}
        onNavigate={(target) => void navigate(target)}
      />
      {menuOpen && (
        <button
          className="overlay"
          onClick={() => setMenuOpen(false)}
          aria-label="Fechar menu"
        />
      )}
      <main>
        <header>
          <button className="menu-button" onClick={() => setMenuOpen(true)}>
            <Menu />
          </button>
          <div className="mobile-brand">
            <Brand />
          </div>
          <div className="search">
            <Search size={18} />
            <input
              aria-label="Buscar"
              placeholder="Buscar cliente ou contrato..."
            />
          </div>
          <div className="header-actions">
            <button className="notification">
              <Bell size={20} />
            </button>
            <button
              className="primary-action"
              onClick={() =>
                clients.length ? setModal("contract") : setModal("client")
              }
            >
              <Plus size={19} />
              Novo empréstimo
            </button>
          </div>
        </header>
        <section className="content">
          <div className="welcome">
            <div>
              <span className="eyebrow">
                <Sparkles size={14} /> OPERAÇÃO EM TEMPO REAL
              </span>
              <h1>Olá, {user.name.split(" ")[0]}.</h1>
              <p>
                Cadastre, acompanhe e registre operações com histórico
                preservado.
              </p>
            </div>
            <div className="reference">
              <Clock3 size={16} />
              <span>Data atual</span>
              <strong>{dateBr(today())}</strong>
            </div>
          </div>
          {error && (
            <div className="global-error">
              <span>{error}</span>
              <button onClick={() => setError("")}>
                <X />
              </button>
            </div>
          )}
          <div className="stats-grid">
            <article className="stat">
              <div className="stat-icon cyan">
                <HandCoins />
              </div>
              <span>Principal em aberto</span>
              <h2>{money(summary.principalCents)}</h2>
              <p>{summary.openContracts} contratos ativos</p>
            </article>
            <article className="stat">
              <div className="stat-icon violet">
                <CircleDollarSign />
              </div>
              <span>Juros do ciclo</span>
              <h2>{money(summary.interestCents)}</h2>
              <p>Calculados sobre o principal</p>
            </article>
            <article className="stat">
              <div className="stat-icon green">
                <WalletCards />
              </div>
              <span>Total a receber</span>
              <h2>{money(summary.totalCents)}</h2>
              <p>
                <CalendarDays size={15} /> Carteira atual
              </p>
            </article>
            <article className="stat">
              <div className="stat-icon orange">
                <Clock3 />
              </div>
              <span>Multas registradas</span>
              <h2>{money(summary.feeCents)}</h2>
              <p>Separadas dos juros</p>
            </article>
          </div>
          <div className="workspace-grid">
            <section className="panel contracts-panel">
              <div className="panel-title">
                <div>
                  <h3>Contratos em aberto</h3>
                  <p>Ordenados pelo próximo vencimento</p>
                </div>
                <button onClick={() => setModal("contract")}>
                  Novo <ChevronRight size={16} />
                </button>
              </div>
              {dueContracts.length === 0 ? (
                <div className="empty">
                  <FileCheck2 />
                  <strong>Nenhum contrato aberto</strong>
                  <span>Cadastre um cliente e crie o primeiro empréstimo.</span>
                  <button
                    onClick={() =>
                      setModal(clients.length ? "contract" : "client")
                    }
                  >
                    Começar agora
                  </button>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>CONTRATO / CLIENTE</th>
                        <th>VENCIMENTO</th>
                        <th>PRINCIPAL</th>
                        <th>JUROS</th>
                        <th>TOTAL DO CICLO</th>
                        <th>HISTÓRICO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dueContracts.map((contract) => (
                        <tr key={contract.id}>
                          <td data-label="Cliente">
                            <div className="client">
                              <span>
                                {contract.client_name.slice(0, 2).toUpperCase()}
                              </span>
                              <div>
                                <strong>{contract.client_name}</strong>
                                <small>
                                  #{contract.legacy_reference || String(contract.id).padStart(4, "0")}
                                </small>
                              </div>
                            </div>
                          </td>
                          <td data-label="Vencimento">
                            <strong>{dateBr(contract.due_date)}</strong>
                          </td>
                          <td data-label="Principal">{money(contract.principal_due)}</td>
                          <td data-label="Juros">{money(contract.interest_due)}</td>
                          <td data-label="Total do ciclo">
                            <strong>
                              {money(
                                contract.principal_due +
                                  contract.interest_due +
                                  contract.fee_due,
                              )}
                            </strong>
                          </td>
                          <td data-label="Histórico">
                            <button
                              className="more"
                              onClick={() => openHistory(contract.id)}
                              aria-label="Ver histórico"
                            >
                              <Eye />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <section className="panel quick-panel">
              <div className="panel-title">
                <div>
                  <h3>Ações rápidas</h3>
                  <p>Operações disponíveis</p>
                </div>
              </div>
              <div className="quick-grid">
                <button onClick={() => setModal("client")}>
                  <span className="q-blue">
                    <Users />
                  </span>
                  <div>
                    <strong>Novo cliente</strong>
                    <small>Cadastro e contato</small>
                  </div>
                  <ChevronRight />
                </button>
                <button
                  disabled={!contracts.some((item) => item.status === "open")}
                  onClick={() => setModal("payment")}
                >
                  <span className="q-green">
                    <CircleDollarSign />
                  </span>
                  <div>
                    <strong>Registrar pagamento</strong>
                    <small>Receber ou renovar</small>
                  </div>
                  <ChevronRight />
                </button>
                <button
                  disabled={!contracts.some((item) => item.status === "open")}
                  onClick={() => setModal("renegotiate")}
                >
                  <span className="q-violet">
                    <Handshake />
                  </span>
                  <div>
                    <strong>Renegociar contrato</strong>
                    <small>Encerra e cria outro vinculado</small>
                  </div>
                  <ChevronRight />
                </button>
                <button onClick={backup}>
                  <span className="q-violet">
                    <DatabaseBackup />
                  </span>
                  <div>
                    <strong>Criar backup</strong>
                    <small>Cópia segura do banco</small>
                  </div>
                  <ChevronRight />
                </button>
                <button onClick={() => setModal("import")}>
                  <span className="q-blue">
                    <FileUp />
                  </span>
                  <div>
                    <strong>Importar planilha</strong>
                    <small>Pré-visualizar antes de gravar</small>
                  </div>
                  <ChevronRight />
                </button>
                <button
                  disabled={summary.reviewRequired === 0}
                  onClick={() => setModal("review")}
                >
                  <span className="q-violet">
                    <AlertTriangle />
                  </span>
                  <div>
                    <strong>Revisar importação</strong>
                    <small>
                      {summary.reviewRequired} contrato(s) pendente(s)
                    </small>
                  </div>
                  <ChevronRight />
                </button>
                <button onClick={() => setModal("settings")}>
                  <span className="q-blue">
                    <SlidersHorizontal />
                  </span>
                  <div>
                    <strong>Parâmetros financeiros</strong>
                    <small>Taxa, prazo e multa diária</small>
                  </div>
                  <ChevronRight />
                </button>
              </div>
            </section>
          </div>
          <div className="bottom-grid">
            <section className="panel health-panel">
              <div className="panel-title">
                <div>
                  <h3>Clientes cadastrados</h3>
                  <p>Base operacional</p>
                </div>
                <button onClick={() => setModal("clients")}>Gerenciar</button>
              </div>
              <div className="metric-focus">
                <Users />
                <div>
                  <strong>{clients.length}</strong>
                  <span>clientes ativos no sistema</span>
                </div>
              </div>
            </section>
            <section className="panel activity-panel">
              <div className="panel-title">
                <div>
                  <h3>Atividade recente</h3>
                  <p>Trilha de auditoria</p>
                </div>
              </div>
              <div className="activity-list">
                {dashboard?.activities.length ? (
                  dashboard.activities.map((activity) => (
                    <div className="activity" key={activity.id}>
                      <span className="blue">
                        <ShieldCheck />
                      </span>
                      <div>
                        <strong>{activity.action}</strong>
                        <p>
                          {activity.user_name || "Sistema"} ·{" "}
                          {activity.entity_type} #{activity.entity_id || "—"}
                        </p>
                      </div>
                      <time>
                        {activity.created_at.slice(0, 16).replace("T", " ")}
                      </time>
                    </div>
                  ))
                ) : (
                  <div className="empty compact">
                    <ShieldCheck />
                    <span>As operações aparecerão aqui.</span>
                  </div>
                )}
              </div>
            </section>
          </div>
          <div className="prototype-note">
            <ShieldCheck size={17} />
            <span>
              <strong>Banco local ativo.</strong> Faça backups regulares antes
              de usar dados importantes.
            </span>
          </div>
        </section>
      </main>
      <nav className="mobile-bottom-nav" aria-label="Navegação principal">
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <LayoutDashboard />
          <span>Início</span>
        </button>
        <button onClick={() => setModal("clients")}>
          <Users />
          <span>Clientes</span>
        </button>
        <button
          className="mobile-new-action"
          onClick={() => setModal(clients.length ? "contract" : "client")}
          aria-label="Novo empréstimo"
        >
          <Plus />
          <span>Novo</span>
        </button>
        <button onClick={() => setModal("import")}>
          <FileUp />
          <span>Importar</span>
        </button>
        <button onClick={() => setMenuOpen(true)}>
          <Menu />
          <span>Mais</span>
        </button>
      </nav>
      {modal === "contracts" && (
        <Dialog title="Contratos" subtitle="Carteira completa, incluindo encerrados e renegociados." close={() => setModal(null)}>
          <div className="history-body">
            <div className="history-list">
              {contracts.length ? contracts.map((contract) => (
                <article key={contract.id}>
                  <div><strong>{contract.client_name} · #{contract.legacy_reference || String(contract.id).padStart(4, "0")}</strong><small>{dateBr(contract.due_date)} · {money(contract.balance_principal_cents)} · {contract.status}</small></div>
                  <button className="receipt-button" onClick={() => openHistory(contract.id)}><Eye />Ver</button>
                </article>
              )) : <div className="empty compact"><FileCheck2 /><span>Nenhum contrato cadastrado.</span></div>}
            </div>
            <div className="dialog-actions"><button onClick={() => setModal(null)}>Fechar</button><button className="primary-action" onClick={() => setModal(clients.length ? "contract" : "client")}><Plus />Novo</button></div>
          </div>
        </Dialog>
      )}
      {modal === "payments" && (
        <Dialog title="Pagamentos" subtitle="Todos os recebimentos e estornos da operação." close={() => setModal(null)}>
          <div className="history-body">
            <div className="history-list">
              {paymentList.length ? paymentList.map((payment) => (
                <article key={payment.id}>
                  <div><strong>{payment.client_name} · {money(payment.amount_cents)}</strong><small>{dateBr(payment.payment_date)} · contrato #{payment.contract_id} · {payment.method}{payment.reversed_at ? " · ESTORNADO" : ""}</small></div>
                  <button className="receipt-button" onClick={() => openHistory(payment.contract_id)}><Eye />Histórico</button>
                </article>
              )) : <div className="empty compact"><CircleDollarSign /><span>Nenhum pagamento registrado.</span></div>}
            </div>
            <div className="dialog-actions"><button onClick={() => setModal(null)}>Fechar</button><button className="primary-action" disabled={!contracts.some((item) => item.status === "open")} onClick={() => setModal("payment")}><Plus />Registrar</button></div>
          </div>
        </Dialog>
      )}
      {modal === "renewals" && (
        <Dialog title="Renovações" subtitle="Ciclos renovados sem apagar o principal ou o histórico." close={() => setModal(null)}>
          <div className="history-body"><div className="history-list">
            {renewalList.length ? renewalList.map((renewal) => (
              <article key={renewal.id}><div><strong>{renewal.client_name} · ciclo {renewal.cycle_number}</strong><small>{dateBr(renewal.start_date)} → {dateBr(renewal.due_date)} · {money(renewal.opening_principal_cents)}</small></div><button className="receipt-button" onClick={() => openHistory(renewal.contract_id)}><Eye />Ver</button></article>
            )) : <div className="empty compact"><RefreshCw /><span>Nenhuma renovação registrada.</span></div>}
          </div><div className="dialog-actions"><button onClick={() => setModal(null)}>Fechar</button></div></div>
        </Dialog>
      )}
      {modal === "receipts" && (
        <Dialog title="Comprovantes" subtitle="Recibos vinculados aos pagamentos confirmados." close={() => setModal(null)}>
          <div className="history-body"><div className="history-list">
            {paymentList.filter((item) => !item.reversed_at).length ? paymentList.filter((item) => !item.reversed_at).map((payment) => (
              <article key={payment.id}><div><strong>{payment.client_name} · {money(payment.amount_cents)}</strong><small>{dateBr(payment.payment_date)} · código {payment.receiptCode}</small></div><button className="receipt-button" onClick={() => printReceipt(payment.id)}><Printer />Emitir</button></article>
            )) : <div className="empty compact"><ReceiptText /><span>Nenhum comprovante disponível.</span></div>}
          </div><div className="dialog-actions"><button onClick={() => setModal(null)}>Fechar</button></div></div>
        </Dialog>
      )}
      {modal === "loanRequests" && (
        <Dialog title="Solicitações de empréstimo" subtitle="Cada solicitação nasce de um contrato individual quitado." close={() => { setModal(null); setError(""); }}>
          <div className="history-body">
            {eligiblePaidContracts.length ? (
              <form className="dialog-form" onSubmit={submitLoanRequest}>
                <div className="form-warning"><CheckCircle2 />Somente contratos quitados e ainda não utilizados aparecem abaixo.</div>
                <label>Quitação que libera a solicitação
                  <select name="sourceContractId" required>
                    {eligiblePaidContracts.map((contract) => <option key={contract.id} value={contract.id}>#{String(contract.id).padStart(4, "0")} · {contract.client_name} · {money(contract.principal_cents)}</option>)}
                  </select>
                </label>
                <div className="form-row">
                  <label>Valor solicitado<input name="requested" inputMode="decimal" required placeholder="Ex.: 1.000,00" /></label>
                  <label>Data da solicitação<input name="requestedAt" type="date" defaultValue={today()} required /></label>
                </div>
                <label>Preferência para pagamento
                  <select name="preferredWindow" defaultValue="flexivel">
                    <option value="dia_15">Dia 15</option>
                    <option value="fim_mes">Final do mês (30 ou 31)</option>
                    <option value="flexivel">Flexível</option>
                  </select>
                </label>
                <label>Finalidade ou observação<input name="purpose" maxLength={500} placeholder="Opcional" /></label>
                {error && <div className="form-error">{error}</div>}
                <div className="dialog-actions"><button className="primary-action" disabled={busy}>{busy && <LoaderCircle className="spin" />}Registrar solicitação</button></div>
              </form>
            ) : <div className="empty compact"><Handshake /><span>Nenhuma quitação disponível para uma nova solicitação.</span></div>}
            <h3>Histórico de solicitações</h3>
            <div className="history-list">
              {loanRequests.length ? loanRequests.map((request) => (
                <article key={request.id}>
                  <div><strong>{request.client_name} · {money(request.requested_cents)}</strong><small>{dateBr(request.requested_at)} · contrato quitado #{request.source_contract_id} · {request.preferred_window === "dia_15" ? "dia 15" : request.preferred_window === "fim_mes" ? "final do mês" : "flexível"} · {request.status}</small></div>
                  {request.status === "pending" && <div className="payment-actions"><button className="receipt-button" onClick={() => void decideLoanRequest(request.id, "approved")}>Aprovar</button><button className="receipt-button" onClick={() => void decideLoanRequest(request.id, "rejected")}>Recusar</button></div>}
                </article>
              )) : <div className="empty compact"><Handshake /><span>Nenhuma solicitação registrada.</span></div>}
            </div>
            <div className="dialog-actions"><button onClick={() => setModal(null)}>Fechar</button></div>
          </div>
        </Dialog>
      )}
      {modal === "clients" && (
        <Dialog
          title="Clientes"
          subtitle="Consulte e corrija cadastros sem alterar contratos."
          close={() => { setModal(null); setEditingClientId(null); setError(""); }}
        >
          {!editingClientId ? (
            <div className="history-body">
              <div className="history-list">
                {clients.map((client) => (
                  <article key={client.id}>
                    <div><strong>{client.name}</strong><small>{client.phone || "Sem telefone"} · {client.contract_count} contrato(s)</small></div>
                    <div className="payment-actions">
                      <button className="receipt-button" onClick={() => { setScoreClientId(client.id); setScoreResult(null); setModal("score"); }}><ShieldCheck />Score</button>
                      <button className="receipt-button" onClick={() => setEditingClientId(client.id)}>Editar</button>
                    </div>
                  </article>
                ))}
              </div>
              <div className="dialog-actions"><button type="button" onClick={() => setModal(null)}>Fechar</button><button className="primary-action" onClick={() => setModal("client")}><Plus />Novo cliente</button></div>
            </div>
          ) : (() => {
            const client = clients.find((item) => item.id === editingClientId);
            if (!client) return null;
            return (
              <form key={client.id} className="dialog-form" onSubmit={submitClientUpdate}>
                <label>Nome completo<input name="name" required maxLength={120} defaultValue={client.name} autoFocus /></label>
                <div className="form-row"><label>CPF ou documento<input name="document" maxLength={30} defaultValue={client.document || ""} /></label><label>Telefone<input name="phone" maxLength={30} defaultValue={client.phone || ""} /></label></div>
                <label>E-mail<input name="email" type="email" maxLength={160} defaultValue={client.email || ""} /></label>
                <label>Observações<textarea name="notes" maxLength={1000} rows={3} defaultValue={client.notes || ""} /></label>
                {error && <div className="form-error">{error}</div>}
                <div className="dialog-actions"><button type="button" onClick={() => setEditingClientId(null)}>Voltar</button><button className="primary-action" disabled={busy}>{busy && <LoaderCircle className="spin" />}Salvar alterações</button></div>
              </form>
            );
          })()}
        </Dialog>
      )}
      {modal === "client" && (
        <Dialog
          title="Novo cliente"
          subtitle="Cadastre somente os dados necessários."
          close={() => {
            setModal(null);
            setError("");
          }}
        >
          <form className="dialog-form" onSubmit={submitClient}>
            <label>
              Nome completo
              <input name="name" required maxLength={120} autoFocus />
            </label>
            <div className="form-row">
              <label>
                CPF ou documento
                <input name="document" maxLength={30} />
              </label>
              <label>
                Telefone
                <input name="phone" maxLength={30} />
              </label>
            </div>
            <label>
              E-mail
              <input name="email" type="email" maxLength={160} />
            </label>
            <label>
              Observações
              <textarea name="notes" maxLength={1000} rows={3} />
            </label>
            {error && <div className="form-error">{error}</div>}
            <div className="dialog-actions">
              <button type="button" onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button className="primary-action" disabled={busy}>
                {busy && <LoaderCircle className="spin" />}Salvar cliente
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {modal === "score" && scoreClientId && (
        <Dialog
          title="Análise interna de crédito"
          subtitle={`${clients.find((item) => item.id === scoreClientId)?.name || "Cliente"} · estimativa explicável, não é consulta a bureau`}
          close={() => { setModal(null); setScoreResult(null); setError(""); }}
        >
          {!scoreResult ? (
            <form className="dialog-form" onSubmit={submitCreditAssessment}>
              <div className="form-warning"><AlertTriangle />Use valores confirmados pelo cliente. O resultado apoia a decisão, mas não aprova crédito automaticamente.</div>
              <div className="form-row"><label>Renda mensal<input name="income" inputMode="decimal" required placeholder="Ex.: 5.000,00" /></label><label>Despesas mensais<input name="expenses" inputMode="decimal" required placeholder="Ex.: 2.000,00" /></label></div>
              <div className="form-row"><label>Parcelas/dívidas mensais<input name="debt" inputMode="decimal" defaultValue="0" /></label><label>Valor solicitado<input name="requested" inputMode="decimal" required /></label></div>
              <label>Há quantos meses possui essa renda?<input name="employmentMonths" type="number" min="0" max="600" required /></label>
              {error && <div className="form-error">{error}</div>}
              <div className="dialog-actions"><button type="button" onClick={() => setModal("clients")}>Cancelar</button><button className="primary-action" disabled={busy}>{busy && <LoaderCircle className="spin" />}Calcular score</button></div>
            </form>
          ) : (
            <div className="history-body">
              <div className="history-summary"><div><span>SCORE INTERNO</span><strong>{scoreResult.score}/1000</strong></div><div><span>RISCO</span><strong>{scoreResult.riskBand.replace("_", " ")}</strong></div><div><span>LIMITE RECOMENDADO</span><strong>{money(scoreResult.recommendedLimitCents)}</strong></div></div>
              <h3>Motivos do resultado</h3><div className="history-list">{scoreResult.reasons.map((reason) => <article key={reason}><div><strong>{reason}</strong></div></article>)}</div>
              <div className="form-warning"><ShieldCheck />Score interno baseado nos dados informados e no histórico desta plataforma. Não representa Serasa, SPC ou garantia de pagamento.</div>
              <div className="dialog-actions"><button onClick={() => { setScoreResult(null); setModal("clients"); }}>Voltar aos clientes</button></div>
            </div>
          )}
        </Dialog>
      )}
      {modal === "contract" && (
        <Dialog
          title="Novo empréstimo"
          subtitle="Confira os valores antes de confirmar."
          close={() => {
            setModal(null);
            setError("");
          }}
        >
          <form className="dialog-form" onSubmit={submitContract}>
            <label>
              Cliente
              <select name="clientId" required autoFocus>
                <option value="">Selecione...</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-row">
              <label>
                Principal (R$)
                <input
                  name="principal"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                />
              </label>
              <label>
                Taxa mensal (%)
                <input
                  name="rate"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={(settings?.default_interest_rate ?? 0.3) * 100}
                  required
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Data do empréstimo
                <input
                  name="startDate"
                  type="date"
                  defaultValue={today()}
                  required
                />
              </label>
              <label>
                Prazo em dias
                <input
                  name="termDays"
                  type="number"
                  min="1"
                  defaultValue={settings?.default_term_days ?? 30}
                  required
                />
              </label>
            </div>
            <label>
              Observações
              <textarea name="notes" maxLength={1000} rows={2} />
            </label>
            {error && <div className="form-error">{error}</div>}
            <div className="dialog-actions">
              <button type="button" onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button className="primary-action" disabled={busy}>
                {busy && <LoaderCircle className="spin" />}Criar contrato
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {modal === "payment" && selectedForPayment && (
        <Dialog
          title="Registrar pagamento"
          subtitle="O sistema aplica em multa, juros e principal, nessa ordem."
          close={() => {
            setModal(null);
            setError("");
          }}
        >
          <form className="dialog-form" onSubmit={submitPayment}>
            <label>
              Contrato
              <select
                name="contractId"
                required
                defaultValue={selectedForPayment.id}
              >
                {contracts
                  .filter((item) => item.status === "open")
                  .map((contract) => (
                    <option key={contract.id} value={contract.id}>
                      #{String(contract.id).padStart(4, "0")} ·{" "}
                      {contract.client_name} · juros{" "}
                      {money(contract.current_interest_cents)}
                    </option>
                  ))}
              </select>
            </label>
            <div className="form-row">
              <label>
                Valor recebido (R$)
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  autoFocus
                />
              </label>
              <label>
                Data do pagamento
                <input
                  name="paymentDate"
                  type="date"
                  defaultValue={today()}
                  required
                />
              </label>
            </div>
            <label>
              Forma de pagamento
              <select name="method">
                <option value="pix">Pix</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="transferencia">Transferência</option>
                <option value="outro">Outro</option>
              </select>
            </label>
            <label className="check-label">
              <input name="renew" type="checkbox" />
              <span>
                <strong>Renovar por mais 30 dias</strong>
                <small>
                  Exige quitação exata dos juros e preserva o principal.
                </small>
              </span>
            </label>
            <label>
              Observação
              <input name="note" maxLength={500} />
            </label>
            {error && <div className="form-error">{error}</div>}
            <div className="dialog-actions">
              <button type="button" onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button className="primary-action" disabled={busy}>
                {busy && <LoaderCircle className="spin" />}Confirmar pagamento
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {modal === "renegotiate" && selectedForPayment && (
        <Dialog
          title="Renegociar contrato"
          subtitle="Quita encargos pendentes, encerra o contrato atual e cria outro vinculado."
          close={() => {
            setModal(null);
            setError("");
          }}
        >
          <form className="dialog-form" onSubmit={submitRenegotiation}>
            <label>
              Contrato atual
              <select
                name="contractId"
                required
                defaultValue={selectedForPayment.id}
              >
                {contracts
                  .filter((item) => item.status === "open")
                  .map((contract) => (
                    <option key={contract.id} value={contract.id}>
                      #{String(contract.id).padStart(4, "0")} ·{" "}
                      {contract.client_name} · saldo principal{" "}
                      {money(contract.balance_principal_cents)}
                    </option>
                  ))}
              </select>
            </label>
            <div className="form-row">
              <label>
                Valor recebido (R$)
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  autoFocus
                />
              </label>
              <label>
                Data do acordo
                <input
                  name="paymentDate"
                  type="date"
                  defaultValue={today()}
                  required
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Nova taxa mensal (%)
                <input
                  name="rate"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={(settings?.default_interest_rate ?? 0.3) * 100}
                  required
                />
              </label>
              <label>
                Novo prazo em dias
                <input
                  name="termDays"
                  type="number"
                  min="1"
                  defaultValue={settings?.default_term_days ?? 30}
                  required
                />
              </label>
            </div>
            <label>
              Forma de pagamento
              <select name="method">
                <option value="pix">Pix</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="transferencia">Transferência</option>
                <option value="outro">Outro</option>
              </select>
            </label>
            <label>
              Motivo e condições do acordo
              <textarea name="note" rows={3} maxLength={1000} required />
            </label>
            <div className="form-warning">
              Juros e multas pendentes não são incorporados silenciosamente ao
              novo principal.
            </div>
            {error && <div className="form-error">{error}</div>}
            <div className="dialog-actions">
              <button type="button" onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button className="primary-action" disabled={busy}>
                {busy && <LoaderCircle className="spin" />}Confirmar
                renegociação
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {modal === "settings" && settings && (
        <Dialog
          title="Parâmetros financeiros"
          subtitle="Valores padrão usados nos novos contratos e no cálculo de atraso."
          close={() => {
            setModal(null);
            setError("");
          }}
        >
          <form className="dialog-form" onSubmit={submitSettings}>
            <div className="form-row">
              <label>
                Taxa mensal padrão (%)
                <input
                  name="rate"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={settings.default_interest_rate * 100}
                  required
                />
              </label>
              <label>
                Prazo padrão (dias)
                <input
                  name="termDays"
                  type="number"
                  min="1"
                  defaultValue={settings.default_term_days}
                  required
                />
              </label>
            </div>
            <label>
              Multa diária por atraso (R$)
              <input
                name="dailyFee"
                type="number"
                min="0"
                step="0.01"
                defaultValue={(settings.daily_fee_cents / 100).toFixed(2)}
                required
              />
            </label>
            <label className="check-label">
              <input
                name="dailyFeeEnabled"
                type="checkbox"
                defaultChecked={Boolean(settings.daily_fee_enabled)}
              />
              <span>
                <strong>Calcular multa diária automaticamente</strong>
                <small>A contagem começa no dia seguinte ao vencimento.</small>
              </span>
            </label>
            <div className="form-warning">
              <AlertTriangle />
              Alterações afetam cálculos futuros e contratos em atraso. Toda
              mudança fica registrada na auditoria.
            </div>
            {error && <div className="form-error">{error}</div>}
            <div className="dialog-actions">
              <button type="button" onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button className="primary-action" disabled={busy}>
                {busy && <LoaderCircle className="spin" />}Salvar parâmetros
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {modal === "review" && (
        <Dialog
          title="Revisar contratos importados"
          subtitle="Resolva registros ambíguos sem apagar o valor original da planilha."
          close={() => {
            setModal(null);
            setError("");
          }}
        >
          <form className="dialog-form" onSubmit={submitReview}>
            <label>
              Contrato pendente
              <select name="contractId" required autoFocus>
                {contracts
                  .filter((contract) => contract.status === "review_required")
                  .map((contract) => (
                    <option key={contract.id} value={contract.id}>
                      Legado #{contract.legacy_reference || contract.id} ·{" "}
                      {contract.client_name} · {money(contract.principal_cents)}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Decisão confirmada
              <select name="resolution" required>
                <option value="open">Continua em aberto</option>
                <option value="paid">Foi quitado</option>
                <option value="archived">
                  Somente histórico / substituído
                </option>
              </select>
            </label>
            <label>
              Justificativa da decisão
              <textarea
                name="note"
                rows={3}
                maxLength={1000}
                required
                placeholder="Explique o que aconteceu com este contrato."
              />
            </label>
            <div className="form-warning">
              <AlertTriangle />
              Se os juros foram pagos e o principal continua devido, escolha
              “Continua em aberto”. Depois registre a renovação correta.
            </div>
            {error && <div className="form-error">{error}</div>}
            <div className="dialog-actions">
              <button type="button" onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button className="primary-action" disabled={busy}>
                {busy && <LoaderCircle className="spin" />}Registrar decisão
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {modal === "import" && (
        <Dialog
          title="Importar planilha existente"
          subtitle="O arquivo é analisado antes de qualquer gravação no banco."
          close={() => {
            setModal(null);
            setImportPreview(null);
            setImportToken("");
            setError("");
          }}
        >
          {!importPreview ? (
            <form className="dialog-form" onSubmit={previewImport}>
              <label>
                Nome do cliente associado à planilha
                <input
                  name="clientName"
                  required
                  maxLength={120}
                  placeholder="Ex.: Cliente da base atual"
                  autoFocus
                />
              </label>
              <label>
                Arquivo Excel
                <input name="file" type="file" accept=".xlsx,.xlsm" required />
              </label>
              <div className="form-warning">
                <AlertTriangle />A planilha atual não possui nomes de clientes.
                Todos os contratos importados serão associados ao nome informado
                acima.
              </div>
              {error && <div className="form-error">{error}</div>}
              <div className="dialog-actions">
                <button type="button" onClick={() => setModal(null)}>
                  Cancelar
                </button>
                <button className="primary-action" disabled={busy}>
                  {busy && <LoaderCircle className="spin" />}Analisar planilha
                </button>
              </div>
            </form>
          ) : (
            <div className="history-body">
              <div className="import-summary">
                <div>
                  <span>Contratos</span>
                  <strong>{importPreview.summary.totalRows}</strong>
                </div>
                <div>
                  <span>Em aberto</span>
                  <strong>{importPreview.summary.openRows}</strong>
                </div>
                <div>
                  <span>Para revisar</span>
                  <strong>{importPreview.summary.reviewRows}</strong>
                </div>
                <div>
                  <span>Avisos</span>
                  <strong>{importPreview.summary.warningCount}</strong>
                </div>
              </div>
              <div className="form-warning">
                <AlertTriangle />
                Registros “Somente juros” ficarão fora dos totais até
                conferência. Contratos pagos sem data serão preservados sem
                inventar uma data de pagamento.
              </div>
              <div className="import-table">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>DATA</th>
                      <th>PRINCIPAL</th>
                      <th>STATUS</th>
                      <th>AVISOS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.rows.map((row) => (
                      <tr key={`${row.sourceRow}-${row.legacyId}`}>
                        <td>{row.legacyId}</td>
                        <td>{dateBr(row.startDate)}</td>
                        <td>{money(row.principalCents)}</td>
                        <td>{row.originalStatus}</td>
                        <td>
                          {row.warnings.length ? row.warnings.join(" ") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {error && <div className="form-error">{error}</div>}
              <div className="dialog-actions">
                <button
                  type="button"
                  onClick={() => {
                    setImportPreview(null);
                    setImportToken("");
                  }}
                >
                  Voltar
                </button>
                <button
                  className="primary-action"
                  disabled={busy}
                  onClick={applyImport}
                >
                  {busy && <LoaderCircle className="spin" />}Confirmar
                  importação
                </button>
              </div>
            </div>
          )}
        </Dialog>
      )}
      {modal === "reverse" && reversePaymentId && (
        <Dialog
          title={`Estornar pagamento #${reversePaymentId}`}
          subtitle="O lançamento original será preservado e desconsiderado dos saldos."
          close={() => {
            setModal("history");
            setReversePaymentId(null);
            setError("");
          }}
        >
          <form className="dialog-form" onSubmit={submitReversal}>
            <label>
              Motivo obrigatório
              <textarea
                name="reason"
                rows={4}
                maxLength={1000}
                required
                autoFocus
                placeholder="Explique por que o pagamento precisa ser estornado."
              />
            </label>
            <div className="form-warning">
              <AlertTriangle />
              Pagamentos que originaram renovação ou renegociação exigem
              correção assistida e serão bloqueados.
            </div>
            {error && <div className="form-error">{error}</div>}
            <div className="dialog-actions">
              <button
                type="button"
                onClick={() => {
                  setModal("history");
                  setReversePaymentId(null);
                }}
              >
                Cancelar
              </button>
              <button className="danger-action" disabled={busy}>
                {busy && <LoaderCircle className="spin" />}Confirmar estorno
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {modal === "history" && history && (
        <Dialog
          title={`Histórico do contrato #${String(history.contract.id).padStart(4, "0")}`}
          subtitle={`${history.contract.client_name} · origem e movimentações preservadas`}
          close={() => {
            setModal(null);
            setHistory(null);
            setError("");
          }}
        >
          <div className="history-body">
            <div className="history-summary">
              <div>
                <span>Principal original</span>
                <strong>{money(history.contract.principal_cents)}</strong>
              </div>
              <div>
                <span>Situação</span>
                <strong>{history.contract.status}</strong>
              </div>
              <div>
                <span>Vencimento</span>
                <strong>{dateBr(history.contract.due_date)}</strong>
              </div>
            </div>
            <h3>Ciclos</h3>
            <div className="history-list">
              {history.cycles.map((cycle) => (
                <article key={cycle.id}>
                  <div>
                    <strong>Ciclo {cycle.cycle_number}</strong>
                    <small>
                      {dateBr(cycle.start_date)} → {dateBr(cycle.due_date)}
                    </small>
                  </div>
                  <div>
                    <strong>
                      {money(
                        cycle.opening_principal_cents +
                          cycle.interest_cents +
                          cycle.fee_cents,
                      )}
                    </strong>
                    <small>{cycle.status}</small>
                  </div>
                </article>
              ))}
            </div>
            <h3>Pagamentos e recibos</h3>
            {history.payments.length ? (
              <div className="history-list">
                {history.payments.map((payment) => (
                  <article key={payment.id}>
                    <div>
                      <strong>{money(payment.amount_cents)}</strong>
                      <small>
                        {dateBr(payment.payment_date)} · {payment.method} ·{" "}
                        {payment.receiptCode}
                        {payment.reversed_at ? " · ESTORNADO" : ""}
                      </small>
                    </div>
                    <div className="payment-actions">
                      <button
                        className="receipt-button"
                        onClick={() => printReceipt(payment.id)}
                      >
                        <Printer />
                        Emitir recibo
                      </button>
                      {!payment.reversed_at && (
                        <button
                          className="reverse-button"
                          onClick={() => {
                            setReversePaymentId(payment.id);
                            setModal("reverse");
                          }}
                        >
                          <RotateCcw />
                          Estornar
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty compact">
                <ReceiptText />
                <span>Nenhum pagamento neste contrato.</span>
              </div>
            )}
            {history.descendants.length > 0 && (
              <>
                <h3>Contratos gerados</h3>
                <div className="history-list">
                  {history.descendants.map((contract) => (
                    <article key={contract.id}>
                      <div>
                        <strong>
                          Contrato #{String(contract.id).padStart(4, "0")}
                        </strong>
                        <small>
                          {contract.status} · vence {dateBr(contract.due_date)}
                        </small>
                      </div>
                      <strong>{money(contract.principal_cents)}</strong>
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>
        </Dialog>
      )}
      {toast && (
        <div className="toast">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;
