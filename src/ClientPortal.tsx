import { FormEvent, useCallback, useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, FileCheck2, HandCoins, LoaderCircle, LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";
import { api, ClientPortalData } from "./api";

const money = (cents = 0) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const dateBr = (date?: string) => date ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`)) : "—";
const toCents = (value: FormDataEntryValue | null) => Math.round(Number(String(value || "0").replace(",", ".")) * 100);

export function ClientPortal({ token }: { token: string }) {
  const [data, setData] = useState<ClientPortalData | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const load = useCallback(() => api.clientPortal(token).then(setData).catch((reason) => setError(reason.message)), [token]);
  useEffect(() => { void load(); }, [load]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      await api.clientPortalLoanRequest(token, { sourceContractId: Number(form.get("sourceContractId")), requestedCents: toCents(form.get("requested")), preferredWindow: form.get("preferredWindow"), purpose: form.get("purpose") });
      setSuccess("Solicitação enviada para análise do credor."); setRequesting(false); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha na solicitação."); }
    finally { setBusy(false); }
  }
  async function requestAction(contractId: number, actionType: "payoff" | "interest_renewal" | "renegotiation") {
    const labels = { payoff: "quitação", interest_renewal: "pagamento de juros e renovação", renegotiation: "renegociação" };
    if (!window.confirm(`Enviar solicitação de ${labels[actionType]} ao credor?`)) return;
    setBusy(true); setError("");
    try { await api.clientPortalActionRequest(token, { contractId, actionType }); setSuccess(`Solicitação de ${labels[actionType]} enviada.`); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Falha na solicitação."); }
    finally { setBusy(false); }
  }
  if (!data) return <main className="client-portal"><section className="client-loading">{error ? <><LockKeyhole /><h1>Acesso indisponível</h1><p>{error}</p></> : <LoaderCircle className="spin" />}</section></main>;
  const open = data.contracts.filter((contract) => contract.status === "open");
  const total = open.reduce((sum, contract) => sum + contract.balance_principal_cents + contract.current_interest_cents, 0);
  return <main className="client-portal">
    <header className="client-header"><div className="client-brand"><span>H</span><div><strong>HelpSystemPro</strong><small>ÁREA DO CLIENTE</small></div></div><ShieldCheck /></header>
    <div className="client-content"><section className="client-welcome"><span>ACESSO SEGURO</span><h1>Olá, {data.client.name.split(" ")[0]}.</h1><p>Acompanhe seus contratos e solicitações em um só lugar.</p></section>
      <section className="client-balance"><div><small>TOTAL ATUAL EM ABERTO</small><strong>{money(total)}</strong><span>{open.length} contrato(s) ativo(s)</span></div><HandCoins /></section>
      {success && <div className="client-success"><CheckCircle2 />{success}</div>}
      <h2>Meus contratos</h2>
      <section className="client-contracts">{data.contracts.map((contract) => <article key={contract.id}>
        <div className="client-contract-top"><span>CONTRATO #{String(contract.id).padStart(4, "0")}</span><b className={`client-status ${contract.status}`}>{contract.status === "open" ? "Em aberto" : contract.status === "paid" ? "Quitado" : "Encerrado"}</b></div>
        <strong>{money(contract.status === "open" ? contract.balance_principal_cents + contract.current_interest_cents : contract.principal_cents)}</strong>
        <div className="client-contract-meta"><span><CalendarDays />Vence {dateBr(contract.due_date)}</span><span><RefreshCw />Juros {(contract.interest_rate * 100).toFixed(0)}%</span></div>
        {contract.status === "open" && <><p>Principal {money(contract.balance_principal_cents)} · juros do ciclo {money(contract.current_interest_cents)}</p><div className="client-contract-actions"><button disabled={busy} onClick={() => void requestAction(contract.id, "payoff")}>Solicitar quitação</button><button disabled={busy} onClick={() => void requestAction(contract.id, "interest_renewal")}>Pagar juros</button><button disabled={busy} onClick={() => void requestAction(contract.id, "renegotiation")}>Renegociar</button></div></>}
      </article>)}</section>
      {!data.contracts.length && <section className="client-empty"><FileCheck2 /><p>Nenhum contrato cadastrado.</p></section>}
      <div className="client-section-title"><div><h2>Solicitações</h2><p>Um novo pedido pode ser feito após a quitação de um contrato.</p></div>{data.eligibleContracts.length > 0 && <button onClick={() => setRequesting(true)}>Solicitar novo</button>}</div>
      <section className="client-requests">{data.requests.map((request) => <article key={request.id}><div><strong>{money(request.requested_cents)}</strong><small>{dateBr(request.requested_at)} · contrato quitado #{request.source_contract_id}</small></div><span>{request.status === "pending" ? "Em análise" : request.status}</span></article>)}</section>
      {data.actionRequests.length > 0 && <><h2>Pedidos sobre contratos</h2><section className="client-requests">{data.actionRequests.map((request) => <article key={request.id}><div><strong>{request.action_type === "payoff" ? "Quitação" : request.action_type === "interest_renewal" ? "Juros e renovação" : "Renegociação"}</strong><small>Contrato #{request.contract_id} · {dateBr(request.created_at)}</small></div><span>{request.status === "pending" ? "Em análise" : request.status}</span></article>)}</section></>}
      {requesting && <section className="client-request-box"><form onSubmit={submit}><h2>Nova solicitação</h2><label>Contrato quitado<select name="sourceContractId" required>{data.eligibleContracts.map((contract) => <option key={contract.id} value={contract.id}>#{contract.id} · {money(contract.principal_cents)}</option>)}</select></label><label>Valor desejado (R$)<input name="requested" inputMode="decimal" required /></label><label>Preferência de vencimento<select name="preferredWindow" defaultValue={data.client.preferredPaymentWindow || "flexivel"}><option value="dia_15">Dia 15</option><option value="fim_mes">Final do mês</option><option value="flexivel">A combinar</option></select></label><label>Finalidade, se desejar<textarea name="purpose" rows={2} maxLength={500} /></label>{error && <div className="form-error">{error}</div>}<div><button type="button" onClick={() => setRequesting(false)}>Cancelar</button><button className="client-primary" disabled={busy}>{busy && <LoaderCircle className="spin" />}Enviar solicitação</button></div></form></section>}
      <footer><LockKeyhole />Link pessoal. Não compartilhe com terceiros.</footer>
    </div>
    <nav className="client-nav"><a href="#"><HandCoins />Início</a><a href="#"><FileCheck2 />Contratos</a><a href="#"><Clock3 />Solicitações</a></nav>
  </main>;
}
