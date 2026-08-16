import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dataDirectory = mkdtempSync(join(tmpdir(), "helpsystempro-credito-"));
const port = 18_000 + Math.floor(Math.random() * 1_000);
const base = `http://127.0.0.1:${port}/api`;
let server;
let cookie = "";

async function waitForServer() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/status`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error("Servidor de teste não iniciou no prazo esperado.");
}

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      ...(typeof options.body === "string" ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...options.headers,
    },
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const payload = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${payload.error}`);
  return payload;
}

beforeAll(async () => {
  server = spawn(process.execPath, ["server/index.js"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      DATA_DIRECTORY: dataDirectory,
      APP_ENCRYPTION_KEY: "a".repeat(64),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForServer();
});

afterAll(async () => {
  if (server && !server.killed) {
    server.kill("SIGTERM");
    await new Promise((resolvePromise) => server.once("exit", resolvePromise));
  }
  rmSync(dataDirectory, { recursive: true, force: true });
});

describe("API operacional", () => {
  it("executa configuração, pagamentos parciais, renovação, recibo e renegociação", async () => {
    await request("/setup", {
      method: "POST",
      body: JSON.stringify({
        name: "Administrador",
        email: "admin@teste.local",
        password: "SenhaTeste#2026",
      }),
    });
    await request("/login", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@teste.local",
        password: "SenhaTeste#2026",
      }),
    });
    const client = await request("/clients", {
      method: "POST",
      body: JSON.stringify({ name: "Cliente Integração" }),
    });
    expect(
      await request(`/clients/${client.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: "Cliente Integração Atualizado",
          phone: "11999990000",
          document: "12345678900",
          email: "cliente@teste.local",
          occupation: "Profissional autônomo",
          preferredPaymentWindow: "dia_15",
          creditAnalysisConsent: true,
          notes: "Cadastro revisado no teste de integração.",
        }),
      }),
    ).toMatchObject({ id: client.id, updated: true });
    expect((await request("/clients")).clients[0]).toMatchObject({
      name: "Cliente Integração Atualizado",
      phone: "11999990000",
      occupation: "Profissional autônomo",
      preferred_payment_window: "dia_15",
    });
    const initialRisk = await request(`/clients/${client.id}/risk-profile`);
    expect(initialRisk.behavior).toMatchObject({ score: expect.any(Number), riskBand: expect.any(String) });
    expect(initialRisk.disclaimer).toContain("revisão humana");
    const documentForm = new FormData();
    documentForm.append("documentType", "identidade");
    documentForm.append("file", new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])], { type: "image/png" }), "identidade.png");
    const uploadedDocument = await request(`/clients/${client.id}/documents`, { method: "POST", body: documentForm });
    expect(uploadedDocument).toMatchObject({ status: "pending" });
    expect(await request(`/client-documents/${uploadedDocument.id}`, { method: "PATCH", body: JSON.stringify({ status: "verified" }) })).toMatchObject({ status: "verified" });
    expect((await request(`/clients/${client.id}/documents`)).documents[0]).toMatchObject({ document_type: "identidade", status: "verified" });
    const assessment = await request(`/clients/${client.id}/credit-assessments`, {
      method: "POST",
      body: JSON.stringify({
        monthlyIncomeCents: 500_000,
        monthlyExpensesCents: 180_000,
        existingDebtCents: 20_000,
        requestedCents: 100_000,
        employmentMonths: 36,
      }),
    });
    expect(assessment).toMatchObject({ riskBand: "moderado" });
    expect(assessment.recommendedLimitCents).toBeGreaterThan(0);

    const contract = await request("/contracts", {
      method: "POST",
      body: JSON.stringify({
        clientId: client.id,
        principalCents: 100_000,
        interestRate: 0.3,
        termDays: 30,
        startDate: "2026-08-15",
      }),
    });
    expect(contract).toMatchObject({
      dueDate: "2026-09-14",
      interestCents: 30_000,
      totalCents: 130_000,
    });
    await request(`/contracts/${contract.id}/payments`, {
      method: "POST",
      body: JSON.stringify({
        amountCents: 10_000,
        paymentDate: "2026-09-01",
        method: "pix",
        renew: false,
      }),
    });
    expect((await request("/dashboard")).summary.interestCents).toBe(20_000);
    const renewal = await request(`/contracts/${contract.id}/payments`, {
      method: "POST",
      body: JSON.stringify({
        amountCents: 20_000,
        paymentDate: "2026-09-14",
        method: "pix",
        renew: true,
      }),
    });
    expect(renewal.nextDueDate).toBe("2026-10-14");

    const history = await request(`/contracts/${contract.id}/history`);
    expect(history.cycles).toHaveLength(2);
    expect(history.payments).toHaveLength(2);
    const receipt = await request(
      `/payments/${history.payments[0].id}/receipt`,
    );
    expect(receipt.receipt.receiptCode).toMatch(/^[A-F0-9]{12}$/);
    await expect(
      request(`/payments/${history.payments[1].id}/reverse`, {
        method: "POST",
        body: JSON.stringify({ reason: "Tentativa bloqueada pelo teste." }),
      }),
    ).rejects.toThrow("correção assistida");
    const partialCurrentCycle = await request(
      `/contracts/${contract.id}/payments`,
      {
        method: "POST",
        body: JSON.stringify({
          amountCents: 5_000,
          paymentDate: "2026-09-20",
          method: "pix",
          renew: false,
        }),
      },
    );
    expect(
      await request(`/payments/${partialCurrentCycle.paymentId}/reverse`, {
        method: "POST",
        body: JSON.stringify({ reason: "Lançamento duplicado em teste." }),
      }),
    ).toMatchObject({ reversed: true });
    const afterReversal = await request(`/contracts/${contract.id}/history`);
    expect(afterReversal.payments.at(-1).reversed_at).toBeTruthy();

    const second = await request("/contracts", {
      method: "POST",
      body: JSON.stringify({
        clientId: client.id,
        principalCents: 50_000,
        interestRate: 0.3,
        termDays: 30,
        startDate: "2026-08-20",
      }),
    });
    const renegotiated = await request(`/contracts/${second.id}/renegotiate`, {
      method: "POST",
      body: JSON.stringify({
        amountCents: 15_000,
        paymentDate: "2026-09-19",
        method: "pix",
        interestRate: 0.25,
        termDays: 30,
        note: "Novo acordo confirmado no teste.",
      }),
    });
    expect(renegotiated).toMatchObject({
      newPrincipalCents: 50_000,
      newInterestCents: 12_500,
      newDueDate: "2026-10-19",
    });
    const originalHistory = await request(`/contracts/${second.id}/history`);
    expect(originalHistory.descendants[0].id).toBe(renegotiated.newContractId);

    const overdue = await request("/contracts", {
      method: "POST",
      body: JSON.stringify({
        clientId: client.id,
        principalCents: 100_000,
        interestRate: 0.3,
        termDays: 30,
        startDate: "2026-01-01",
      }),
    });
    const overdueRenewal = await request(`/contracts/${overdue.id}/payments`, {
      method: "POST",
      body: JSON.stringify({
        amountCents: 36_000,
        paymentDate: "2026-02-03",
        method: "pix",
        renew: true,
      }),
    });
    expect(overdueRenewal.allocation).toMatchObject({
      toFee: 6_000,
      toInterest: 30_000,
      toPrincipal: 0,
    });
    const alerts = await request("/alerts");
    expect(alerts.summary.overdue).toBeGreaterThan(0);
    expect(alerts.alerts).toEqual(expect.arrayContaining([expect.objectContaining({ contract_id: overdue.id, urgency: "overdue", whatsapp_url: expect.stringContaining("wa.me/5511999990000") })]));

    const settings = await request("/settings");
    expect(settings.settings).toMatchObject({
      default_interest_rate: 0.3,
      default_term_days: 30,
      daily_fee_cents: 2_000,
      daily_fee_enabled: 1,
    });
    expect((await request("/payments")).payments.length).toBeGreaterThan(0);
    expect((await request("/renewals")).renewals.length).toBeGreaterThan(0);
    const partnerSummary = (await request("/partners/summary")).partners[0];
    expect(partnerSummary).toMatchObject({ name: "Rodrigo", contract_count: expect.any(Number) });
    expect(partnerSummary.capital_deployed_cents).toBeGreaterThan(0);
    expect(partnerSummary.interest_received_cents).toBeGreaterThan(0);
    const invite = await request(`/partners/${partnerSummary.id}/invites`, {
      method: "POST",
      body: JSON.stringify({ phone: "11988887777" }),
    });
    expect(invite.whatsappUrl).toContain("wa.me/5511988887777");
    const inviteToken = new URL(invite.publicUrl).pathname.split("/").pop();
    expect(await request(`/onboarding/${inviteToken}`)).toMatchObject({ partnerName: "Rodrigo" });
    const onboardingForm = new FormData();
    onboardingForm.set("name", "Cliente convidado");
    onboardingForm.set("document", "98765432100");
    onboardingForm.set("phone", "11988887777");
    onboardingForm.set("birthDate", "1990-01-10");
    onboardingForm.set("occupation", "Analista");
    onboardingForm.set("address", "Rua do Teste, 100");
    onboardingForm.set("preferredPaymentWindow", "dia_15");
    onboardingForm.set("incomeType", "clt");
    onboardingForm.set("declaredIncomeCents", "350000");
    onboardingForm.set("employerName", "Empresa Teste Ltda");
    onboardingForm.set("employmentStartDate", "2024-02-01");
    onboardingForm.set("incomeReferenceMonth", "2026-08");
    onboardingForm.set("consent", "true");
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    onboardingForm.set("identity", new Blob([png], { type: "image/png" }), "cnh.png");
    onboardingForm.set("addressProof", new Blob([png], { type: "image/png" }), "endereco.png");
    onboardingForm.set("incomeProof", new Blob([png], { type: "image/png" }), "holerite.png");
    const submitted = await request(`/onboarding/${inviteToken}`, { method: "POST", body: onboardingForm });
    expect(submitted).toMatchObject({ status: "submitted" });
    expect((await request(`/clients/${submitted.clientId}/documents`)).documents).toHaveLength(3);
    expect((await request("/clients")).clients.find((item) => item.id === submitted.clientId)).toMatchObject({ partner_names: "Rodrigo", income_type: "clt" });
    const secondPartner = await request("/partners", { method: "POST", body: JSON.stringify({ name: "Parceiro Integração", phone: "11977776666" }) });
    expect((await request("/partners")).partners).toEqual(expect.arrayContaining([expect.objectContaining({ id: secondPartner.id, name: "Parceiro Integração" })]));
    const partnerContract = await request("/contracts", { method: "POST", body: JSON.stringify({ clientId: submitted.clientId, partnerId: secondPartner.id, principalCents: 30_000, interestRate: 0.2, termDays: 30, startDate: "2026-08-16" }) });
    expect((await request("/contracts")).contracts.find((item) => item.id === partnerContract.id)).toMatchObject({ partner_id: secondPartner.id, partner_name: "Parceiro Integração" });
    const clientAccess = await request(`/clients/${client.id}/access-link`, { method: "POST" });
    expect(clientAccess.publicUrl).toContain("/cliente/");
    expect(clientAccess.whatsappUrl).toContain("wa.me/5511999990000");
    const clientToken = new URL(clientAccess.publicUrl).pathname.split("/").pop();
    const clientPortal = await request(`/client-portal/${clientToken}`);
    expect(clientPortal.client).toMatchObject({ id: client.id, name: "Cliente Integração Atualizado" });
    expect(clientPortal.contracts.length).toBeGreaterThan(0);
    const actionRequest = await request(`/client-portal/${clientToken}/action-requests`, {
      method: "POST",
      body: JSON.stringify({ contractId: overdue.id, actionType: "interest_renewal" }),
    });
    expect(actionRequest).toMatchObject({ status: "pending" });
    const actionRequestList = await request("/action-requests");
    expect(actionRequestList.requests[0]).toMatchObject({ id: actionRequest.id, client_name: "Cliente Integração Atualizado", action_type: "interest_renewal" });
    expect(await request(`/action-requests/${actionRequest.id}`, { method: "PATCH", body: JSON.stringify({ status: "accepted" }) })).toMatchObject({ status: "accepted" });

    const paidForNewRequest = await request("/contracts", {
      method: "POST",
      body: JSON.stringify({
        clientId: client.id,
        principalCents: 20_000,
        interestRate: 0.3,
        termDays: 30,
        startDate: "2026-10-01",
      }),
    });
    const payoff = await request(`/contracts/${paidForNewRequest.id}/payments`, {
      method: "POST",
      body: JSON.stringify({
        amountCents: 26_000,
        paymentDate: "2026-10-31",
        method: "pix",
        renew: false,
      }),
    });
    expect(payoff.paid).toBe(true);
    expect((await request("/loan-requests")).eligibleContracts).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: paidForNewRequest.id })]),
    );
    const loanRequest = await request("/loan-requests", {
      method: "POST",
      body: JSON.stringify({
        sourceContractId: paidForNewRequest.id,
        requestedCents: 50_000,
        requestedAt: "2026-11-15",
        preferredWindow: "dia_15",
        purpose: "Nova necessidade após quitação individual.",
      }),
    });
    expect(loanRequest).toMatchObject({ status: "pending" });
    expect(await request(`/loan-requests/${loanRequest.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "approved", decisionNote: "Histórico conferido." }),
    })).toMatchObject({ status: "approved" });
    const requestList = await request("/loan-requests");
    expect(requestList.requests[0]).toMatchObject({
      source_contract_id: paidForNewRequest.id,
      preferred_window: "dia_15",
      status: "approved",
    });
    expect(requestList.eligibleContracts.some((item) => item.id === paidForNewRequest.id)).toBe(false);
  });
});
