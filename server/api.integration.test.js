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
      ...(options.body ? { "Content-Type": "application/json" } : {}),
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
          notes: "Cadastro revisado no teste de integração.",
        }),
      }),
    ).toMatchObject({ id: client.id, updated: true });
    expect((await request("/clients")).clients[0]).toMatchObject({
      name: "Cliente Integração Atualizado",
      phone: "11999990000",
    });
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

    const settings = await request("/settings");
    expect(settings.settings).toMatchObject({
      default_interest_rate: 0.3,
      default_term_days: 30,
      daily_fee_cents: 2_000,
      daily_fee_enabled: 1,
    });
    expect((await request("/payments")).payments.length).toBeGreaterThan(0);
    expect((await request("/renewals")).renewals.length).toBeGreaterThan(0);
  });
});
