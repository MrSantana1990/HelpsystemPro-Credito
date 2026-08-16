export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}
export interface Client {
  id: number;
  name: string;
  document?: string;
  phone?: string;
  email?: string;
  notes?: string;
  birth_date?: string;
  occupation?: string;
  address?: string;
  preferred_payment_window?: string;
  credit_analysis_consent_at?: string;
  contract_count: number;
  credit_score?: number;
  risk_band?: string;
  recommended_limit_cents?: number;
  behavior_score?: number;
  behavior_risk_band?: string;
  behavior_limit_cents?: number;
}
export interface Contract {
  id: number;
  client_id: number;
  client_name: string;
  principal_cents: number;
  interest_rate: number;
  term_days: number;
  start_date: string;
  due_date: string;
  status: string;
  balance_principal_cents: number;
  current_interest_cents: number;
  current_fee_cents: number;
  current_cycle: number;
  legacy_reference?: string;
}
export interface Dashboard {
  summary: {
    principalCents: number;
    interestCents: number;
    feeCents: number;
    totalCents: number;
    openContracts: number;
    reviewRequired: number;
  };
  contracts: Array<
    Contract & { principal_due: number; interest_due: number; fee_due: number }
  >;
  activities: Array<{
    id: number;
    action: string;
    entity_type: string;
    entity_id?: number;
    user_name?: string;
    created_at: string;
  }>;
}
export interface ContractHistory {
  contract: Contract & { client_document?: string };
  cycles: Array<{
    id: number;
    cycle_number: number;
    start_date: string;
    due_date: string;
    opening_principal_cents: number;
    interest_cents: number;
    fee_cents: number;
    status: string;
  }>;
  payments: Array<{
    id: number;
    amount_cents: number;
    fee_cents: number;
    interest_cents: number;
    principal_cents: number;
    payment_date: string;
    method: string;
    receiptCode: string;
    reversed_at?: string;
    reversal_reason?: string;
  }>;
  descendants: Array<{
    id: number;
    status: string;
    principal_cents: number;
    start_date: string;
    due_date: string;
  }>;
}
export interface ImportPreview {
  fileName: string;
  sheetName: string;
  clientName: string;
  summary: {
    totalRows: number;
    openRows: number;
    paidRows: number;
    renegotiatedRows: number;
    reviewRows: number;
    warningCount: number;
  };
  rows: Array<{
    sourceRow: number;
    legacyId: string;
    startDate: string;
    dueDate: string;
    principalCents: number;
    interestCents: number;
    originalStatus: string;
    normalizedStatus: string;
    warnings: string[];
  }>;
}
export interface Settings {
  default_interest_rate: number;
  default_term_days: number;
  daily_fee_cents: number;
  daily_fee_enabled: number;
}
export interface PaymentListItem {
  id: number;
  contract_id: number;
  client_name: string;
  amount_cents: number;
  fee_cents: number;
  interest_cents: number;
  principal_cents: number;
  payment_date: string;
  method: string;
  receiptCode: string;
  reversed_at?: string;
}
export interface RenewalListItem {
  id: number;
  contract_id: number;
  client_name: string;
  cycle_number: number;
  start_date: string;
  due_date: string;
  opening_principal_cents: number;
  interest_cents: number;
  status: string;
}
export interface CreditAssessment {
  id: number;
  score: number;
  recommendedLimitCents: number;
  riskBand: string;
  reasons: string[];
}
export interface RiskProfile {
  behavior: {
    score: number;
    riskBand: string;
    recommendedLimitCents: number;
    reasons: string[];
    factors: Record<string, number>;
  };
  financial: null | {
    score: number;
    recommended_limit_cents: number;
    risk_band: string;
    reasons: string[];
    created_at: string;
  };
  disclaimer: string;
}
export interface LoanRequest {
  id: number;
  client_id: number;
  client_name: string;
  source_contract_id: number;
  requested_cents: number;
  requested_at: string;
  preferred_window: "dia_15" | "fim_mes" | "flexivel";
  purpose?: string;
  status: "pending" | "approved" | "rejected" | "contracted" | "cancelled";
  decision_note?: string;
}
export interface EligiblePaidContract {
  id: number;
  client_id: number;
  client_name: string;
  principal_cents: number;
  paid_at: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(payload.error || "Não foi possível concluir a operação.");
  return payload as T;
}

export const api = {
  status: () =>
    request<{ setupRequired: boolean; authenticated: boolean }>("/status"),
  setup: (data: { name: string; email: string; password: string }) =>
    request("/setup", { method: "POST", body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    request<{ user: User }>("/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  logout: () => request("/logout", { method: "POST" }),
  me: () => request<{ user: User }>("/me"),
  settings: () => request<{ settings: Settings }>("/settings"),
  updateSettings: (data: object) =>
    request<{ settings: Settings }>("/settings", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  dashboard: () => request<Dashboard>("/dashboard"),
  clients: () => request<{ clients: Client[] }>("/clients"),
  createClient: (data: object) =>
    request<{ id: number }>("/clients", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateClient: (id: number, data: object) =>
    request<{ id: number; updated: boolean }>(`/clients/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  contracts: () => request<{ contracts: Contract[] }>("/contracts"),
  payments: () => request<{ payments: PaymentListItem[] }>("/payments"),
  renewals: () => request<{ renewals: RenewalListItem[] }>("/renewals"),
  loanRequests: () => request<{ requests: LoanRequest[]; eligibleContracts: EligiblePaidContract[] }>("/loan-requests"),
  createLoanRequest: (data: object) =>
    request<{ id: number; status: string }>("/loan-requests", { method: "POST", body: JSON.stringify(data) }),
  decideLoanRequest: (id: number, data: object) =>
    request<{ id: number; status: string }>(`/loan-requests/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  assessCredit: (id: number, data: object) =>
    request<CreditAssessment>(`/clients/${id}/credit-assessments`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  riskProfile: (id: number) => request<RiskProfile>(`/clients/${id}/risk-profile`),
  createContract: (data: object) =>
    request<{
      id: number;
      dueDate: string;
      interestCents: number;
      totalCents: number;
    }>("/contracts", { method: "POST", body: JSON.stringify(data) }),
  pay: (id: number, data: object) =>
    request<{ nextDueDate: string | null; paid: boolean }>(`/contracts/${id}/payments`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  renegotiate: (id: number, data: object) =>
    request<{
      newContractId: number;
      newPrincipalCents: number;
      newDueDate: string;
    }>(`/contracts/${id}/renegotiate`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  history: (id: number) => request<ContractHistory>(`/contracts/${id}/history`),
  receipt: (id: number) =>
    request<{ receipt: Record<string, string | number> }>(
      `/payments/${id}/receipt`,
    ),
  reviewContract: (id: number, data: { resolution: string; note: string }) =>
    request<{ id: number; status: string }>(`/contracts/${id}/review`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  reversePayment: (id: number, reason: string) =>
    request<{ id: number; reversed: boolean }>(`/payments/${id}/reverse`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  backup: () => request<{ file: string }>("/backup", { method: "POST" }),
  previewImport: async (file: File, clientName: string) => {
    const form = new FormData();
    form.append("file", file);
    form.append("clientName", clientName);
    const response = await fetch("/api/import/preview", {
      method: "POST",
      body: form,
      credentials: "same-origin",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(payload.error || "Não foi possível ler a planilha.");
    return payload as { token: string; preview: ImportPreview };
  },
  applyImport: (token: string) =>
    request<{ importedRows: number; batchId: number }>("/import/apply", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
};
