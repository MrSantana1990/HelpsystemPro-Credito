import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, FileCheck2, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { api, OnboardingInfo } from "./api";

const toCents = (value: FormDataEntryValue | null) => Math.round(Number(String(value || "0").replace(",", ".")) * 100);

export function OnboardingPage({ token }: { token: string }) {
  const [info, setInfo] = useState<OnboardingInfo | null>(null);
  const [incomeType, setIncomeType] = useState("clt");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { api.onboardingInfo(token).then(setInfo).catch((reason) => setError(reason.message)); }, [token]);
  const help: Record<string, string> = {
    clt: "Holerite do mês atual. Se ainda não foi emitido, envie o mês anterior; competência e data serão conferidas.",
    autonomo: "Extrato bancário ou comprovante recente da movimentação da atividade.",
    beneficio: "Extrato ou demonstrativo recente do benefício.",
    empresario: "Extrato da empresa, DAS/MEI ou comprovante recente de faturamento.",
    outro: "Documento recente que comprove a origem e a regularidade da renda.",
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    form.set("declaredIncomeCents", String(toCents(form.get("declaredIncome"))));
    form.set("consent", String(form.get("consent") === "on"));
    try { await api.submitOnboarding(token, form); setDone(true); window.scrollTo({ top: 0, behavior: "smooth" }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Falha no envio."); }
    finally { setBusy(false); }
  }
  if (done) return <main className="onboarding-page"><section className="onboarding-card onboarding-success"><CheckCircle2 /><h1>Cadastro enviado</h1><p>Os dados e documentos foram recebidos para análise. Isso não significa aprovação automática de empréstimo.</p></section></main>;
  return <main className="onboarding-page"><section className="onboarding-card">
    <header className="onboarding-hero"><div className="onboarding-logo">H</div><div><span>CONVITE SEGURO</span><h1>Cadastro para análise</h1><p>{info ? `Enviado por ${info.partnerName}` : "Validando seu convite..."}</p></div><LockKeyhole /></header>
    {error && !info ? <div className="form-error onboarding-error">{error}</div> : <>
      <div className="privacy-note"><ShieldCheck />Seus documentos serão criptografados e acessíveis apenas pelo responsável autorizado.</div>
      <form className="dialog-form onboarding-form" onSubmit={submit}>
        <h2>Seus dados</h2>
        <label>Nome completo<input name="name" autoComplete="name" required maxLength={120} /></label>
        <div className="form-row"><label>CPF<input name="document" inputMode="numeric" required maxLength={14} /></label><label>WhatsApp<input name="phone" type="tel" autoComplete="tel" required maxLength={20} /></label></div>
        <div className="form-row"><label>Data de nascimento<input name="birthDate" type="date" required /></label><label>Profissão ou atividade<input name="occupation" required maxLength={120} /></label></div>
        <label>Endereço completo<input name="address" autoComplete="street-address" required maxLength={300} /></label>
        <h2>Renda e pagamento</h2>
        <div className="form-row"><label>Origem da renda<select name="incomeType" value={incomeType} onChange={(e) => setIncomeType(e.target.value)} required><option value="clt">CLT</option><option value="autonomo">Autônomo</option><option value="beneficio">Benefício/aposentadoria</option><option value="empresario">Empresário/MEI</option><option value="outro">Outra</option></select></label><label>Remuneração mensal (R$)<input name="declaredIncome" inputMode="decimal" required /></label></div>
        <label>Melhor data para pagamento<select name="preferredPaymentWindow"><option value="dia_15">Dia 15</option><option value="fim_mes">Final do mês</option><option value="flexivel">A combinar</option></select></label>
        <h2>Documentos obrigatórios</h2>
        <label><FileCheck2 />RG ou CNH<input name="identity" type="file" accept="application/pdf,image/jpeg,image/png" required /></label>
        <label><FileCheck2 />Comprovante de endereço<input name="addressProof" type="file" accept="application/pdf,image/jpeg,image/png" required /></label>
        <label><FileCheck2 />Comprovante de renda<small>{help[incomeType]}</small><input name="incomeProof" type="file" accept="application/pdf,image/jpeg,image/png" required /></label>
        <label className="check-label"><input name="consent" type="checkbox" required /><span><strong>Autorizo a análise dos dados enviados</strong><small>Declaro que as informações são verdadeiras e estou ciente do uso para avaliação cadastral e de risco.</small></span></label>
        {error && <div className="form-error">{error}</div>}
        <button className="primary-action onboarding-submit" disabled={busy || !info}>{busy ? <LoaderCircle className="spin" /> : <ShieldCheck />}Enviar cadastro com segurança</button>
      </form>
    </>}</section></main>;
}
