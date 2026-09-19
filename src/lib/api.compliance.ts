/* Clients / Compliance / KYC / Cases / Alerts / Complaints — owned by the
 * compliance-domain wiring pass. Edit only this file for that domain; see
 * apiClient.ts for the shared fetch primitive and api.ts for the barrel
 * that re-exports every domain file for pages to import from.
 *
 * Reconciled against the actual src/mock call sites in this domain's pages
 * (Clients, ClientDetail, KycQueue/Periodic/Dynamic + their detail pages,
 * Screening, Cases, CaseDetail, AmlAlerts, FraudAlerts, FraudCases,
 * Complaints) and against apps/core-api's compliance module controllers,
 * which return JdbcTemplate `Map<String,Object>` rows keyed by the raw SQL
 * column name (snake_case) — the mock fixtures/types this domain's pages
 * still render against are camelCase, so every read response is deep-mapped
 * here (`toCamel`) rather than touched at any page call site. Return types
 * are cast to the same src/mock types (type-only import — no runtime/barrel
 * collision) the pages already import, so no page needs a render-side edit. */
import { get, post } from "./apiClient";
import type {
  ClientRow, ClientComplianceProfile, ClientDocument, UboRecord, ScreeningResult, Wallet, RiskFactorDef,
  ComplianceCase, CaseNote, CaseEvidence, Complaint, AmlAlert, TokenHolding, AuditEvent,
} from "../mock";

// ---- snake_case (JdbcTemplate rows) -> camelCase (mock-shaped) ----

function toCamelKey(k: string): string {
  return k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

function toCamel<T = unknown>(v: unknown): T {
  if (Array.isArray(v)) return v.map((x) => toCamel(x)) as T;
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[toCamelKey(k)] = toCamel(val);
    return out as T;
  }
  return v as T;
}

/** jsonb columns (screening `resolution`, complaint `history`) can come back
 * from JdbcTemplate as a JSON-encoded string rather than a parsed object,
 * depending on the driver's jsonb handling — accept either so the page's
 * existing `.resolution.outcome` / `.history.map(...)` reads keep working. */
function parseJsonish<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return v as T;
}

function mapScreening(row: unknown): ScreeningResult {
  const c = toCamel<ScreeningResult & { resolution: unknown }>(row);
  c.resolution = parseJsonish(c.resolution, null) ?? undefined;
  return c as ScreeningResult;
}

/** case_notes.by_name — mock's `CaseNote.by` is the shorter name; keep both
 * so nothing downstream that reads `byName` breaks either. */
function mapCaseNote(row: unknown): CaseNote {
  const c = toCamel<CaseNote & { byName?: string }>(row);
  c.by = c.byName ?? c.by;
  return c as CaseNote;
}

/** compliance_cases carries the SAR fields as flat sar_* columns; the mock
 * (and every case page) reads them as a nested `case.sar` object that is
 * only present once a case has actually been escalated. */
function mapCaseRow(row: unknown): ComplianceCase {
  const c = toCamel<
    ComplianceCase & {
      sarEscalatedAt?: string; sarEscalatedBy?: string; sarMlroDecision?: "file_str" | "no_filing";
      sarStrReference?: string; sarDecidedAt?: string;
    }
  >(row);
  const hasSar = c.sarEscalatedAt != null || c.sarMlroDecision != null || c.sarStrReference != null || c.sarDecidedAt != null;
  c.sar = hasSar
    ? {
        escalatedAt: c.sarEscalatedAt as string,
        escalatedBy: c.sarEscalatedBy as string,
        mlroDecision: c.sarMlroDecision,
        strReference: c.sarStrReference,
        decidedAt: c.sarDecidedAt,
      }
    : undefined;
  c.notes ??= [];
  c.evidence ??= [];
  c.linkedAlertIds ??= [];
  return c as ComplianceCase;
}

function mapComplaint(row: unknown): Complaint {
  const c = toCamel<Complaint>(row);
  c.history = parseJsonish(c.history, [] as Complaint["history"]);
  return c;
}

// ---- Clients ----

export const getClients = () => get<Record<string, unknown>[]>("/api/clients").then((rows) => rows.map((r) => toCamel<ClientRow>(r)));
export const getClient = (id: string) => get<Record<string, unknown>>(`/api/clients/${id}`).then((r) => toCamel<ClientRow>(r));
export const setClientOwner = (id: string, ownerId: string, _actor?: string, reason?: string) => post(`/api/clients/${id}/owner`, { ownerId, reason });
export const setClientSegment = (id: string, segment: string, _actor?: string, reason?: string) => post(`/api/clients/${id}/segment`, { segment, reason });
export const setClientSuspended = (id: string, suspended: boolean, _actor?: string, reason?: string) => post(`/api/clients/${id}/suspend`, { suspended, reason });

// ---- Client 360 / compliance profile ----

export type ClientComplianceDetail = {
  client: ClientRow;
  profile: ClientComplianceProfile;
  documents: ClientDocument[];
  ubos: UboRecord[];
  screenings: ScreeningResult[];
  cases: ComplianceCase[];
  alerts: AmlAlert[];
  wallet?: Wallet;
  /** Real from ComplianceService#clientComplianceDetail, but genuinely and
   * permanently `[]` pre-tokenization-launch (Phase 2, ~Q1 2027 per
   * CLAUDE.md) — no token registry exists yet, so there is nothing to query.
   * Not a wiring gap; the backend documents the same thing at its source. */
  holdings: TokenHolding[];
  /** Real — the client-scoped slice of the hash-chained audit trail
   * (`ComplianceRepository#auditEventsFor`), filtered to rows this client
   * was the direct subject of. */
  auditEvents: AuditEvent[];
};

export const getClientComplianceDetail = async (id: string): Promise<ClientComplianceDetail> => {
  const raw = await get<Record<string, unknown>>(`/api/clients/${id}/compliance`);
  const d = toCamel<Record<string, unknown>>(raw);
  const wallet = d.wallet as Record<string, unknown> | undefined;
  return {
    client: d.client as ClientRow,
    profile: d.profile as ClientComplianceProfile,
    documents: ((d.documents as unknown[]) ?? []) as ClientDocument[],
    ubos: ((d.ubos as unknown[]) ?? []) as UboRecord[],
    screenings: ((d.screenings as unknown[]) ?? []).map(mapScreening),
    cases: ((d.cases as unknown[]) ?? []).map(mapCaseRow),
    alerts: ((d.alerts as unknown[]) ?? []) as AmlAlert[],
    wallet: wallet && Object.keys(wallet).length > 0 ? (wallet as Wallet) : undefined,
    holdings: ((d.holdings as unknown[]) ?? []) as TokenHolding[],
    auditEvents: ((d.auditEvents as unknown[]) ?? []) as AuditEvent[],
  };
};

export const getActivationBlockers = (clientId: string) => get<string[]>(`/api/compliance/clients/${clientId}/activation-blockers`);

export const getComplianceProfiles = () =>
  get<Record<string, unknown>[]>("/api/compliance/profiles").then((rows) => rows.map((r) => toCamel<ClientComplianceProfile>(r)));

export const submitActivation = (clientId: string, _actor?: string) => post(`/api/compliance/clients/${clientId}/activation`);
/** "Request re-capture" — reverts kyc_status from pending_review back to
 * in_progress so the client can resubmit documents. `_decision`/`_actor` are
 * kept for call-site compatibility with the retired mock signature
 * (`decideKycApplication(clientId, "recapture", actor)`); the real endpoint
 * (`POST /api/compliance/clients/{id}/recapture`) only ever performs this one
 * action, so there is nothing left for `_decision` to select between. */
export const decideKycApplication = (clientId: string, _decision?: string, _actor?: string) =>
  post<Record<string, unknown>>(`/api/compliance/clients/${clientId}/recapture`).then((r) => toCamel<ClientRow>(r));
export const completeEdd = (clientId: string, _actor?: string, note?: string) => post(`/api/compliance/clients/${clientId}/edd-complete`, { note });
export const markKycRefreshed = (clientId: string, _actor?: string, _note?: string) => post(`/api/compliance/clients/${clientId}/kyc-refresh`);

export const setDocumentStatus = (docId: string, status: string, _actor?: string, note?: string) =>
  post<Record<string, unknown>>(`/api/compliance/documents/${docId}/status`, { status, note }).then((r) => toCamel<ClientDocument>(r));
export const setUboStatus = (uboId: string, status: string, _actor?: string) =>
  post<Record<string, unknown>>(`/api/compliance/ubo/${uboId}/status`, { status }).then((r) => toCamel<UboRecord>(r));
export const setRiskRating = (clientId: string, rating: string, factors: string[], _actor?: string) =>
  post(`/api/compliance/clients/${clientId}/risk-rating`, { rating, factors });

// ---- Screening ----

export const getScreeningResults = () => get<Record<string, unknown>[]>("/api/compliance/screening").then((rows) => rows.map(mapScreening));
export const runScreening = (clientId: string, trigger = "on_demand", _actor?: string) =>
  post<Record<string, unknown>>(`/api/compliance/clients/${clientId}/screening`, { trigger }).then(mapScreening);
export const runEodScreening = (_actor?: string) => post<{ screened: number; matches: number }>("/api/compliance/screening/eod");
export const resolveScreeningMatch = (id: string, outcome: string, note: string, _actor?: string) =>
  post<Record<string, unknown>>(`/api/compliance/screening/${id}/resolve`, { outcome, note }).then(mapScreening);

// ---- Wallets ----

export const setWalletStatus = (walletId: string, status: string, _actor?: string, reason?: string) => post(`/api/compliance/wallets/${walletId}/status`, { status, reason });
export const setWalletRestrictions = (walletId: string, restrictions: string[], _actor?: string) => post(`/api/compliance/wallets/${walletId}/restrictions`, { restrictions });

// ---- Risk factor catalogue ----

export const getRiskFactors = () => get<Record<string, unknown>[]>("/api/compliance/risk-factors").then((rows) => rows.map((r) => toCamel<RiskFactorDef>(r)));
export const addRiskFactor = (label: string, description: string, _actor?: string) =>
  post<Record<string, unknown>>("/api/compliance/risk-factors", { label, description }).then((r) => toCamel<RiskFactorDef>(r));
export const setRiskFactorEnabled = (id: string, enabled: boolean, _actor?: string) => post(`/api/compliance/risk-factors/${id}/enabled`, { enabled });

// ---- Cases ----

/** `role` (mock used it to hide SAR-restricted cases from non-Compliance/MLRO
 * roles at the seam) has no server-side equivalent on CasesController yet —
 * it gates the endpoint itself via @rbac.has('cases:read'|'fraud_cases:read')
 * but does not row-filter SAR cases by role. Accepted for call-site
 * compatibility and otherwise unused; flagged in the wiring report. */
export const getComplianceCases = (_role?: string) => get<Record<string, unknown>[]>("/api/cases").then((rows) => rows.map(mapCaseRow));

export const getComplianceCase = async (id: string, _role?: string): Promise<ComplianceCase> => {
  const r = await get<{ case: Record<string, unknown>; notes: Record<string, unknown>[]; evidence: Record<string, unknown>[] }>(`/api/cases/${id}`);
  const c = mapCaseRow(r.case);
  c.notes = (r.notes ?? []).map(mapCaseNote);
  c.evidence = (r.evidence ?? []).map((e) => toCamel<CaseEvidence>(e));
  return c;
};

export const createCase = (
  input: { type: string; clientId?: string; clientName: string; title: string; summary: string; severity: string },
  _actor?: string,
  _actorRole?: string,
) => post<Record<string, unknown>>("/api/cases", input).then(mapCaseRow);

export const addCaseNote = (id: string, text: string, kind = "note", _actor?: string, _actorRole?: string) => post(`/api/cases/${id}/notes`, { text, kind });
export const addCaseEvidence = (id: string, evidence: { label: string; type: string; ref?: string }, _actor?: string) => post(`/api/cases/${id}/evidence`, evidence);
export const assignCase = (id: string, assignee: string, _actor?: string) => post<Record<string, unknown>>(`/api/cases/${id}/assign`, { assignee }).then(mapCaseRow);
export const setCaseStatus = (id: string, status: string, _actor?: string, _actorRole?: string) =>
  post<Record<string, unknown>>(`/api/cases/${id}/status`, { status }).then(mapCaseRow);
export const recordMlroDecision = (id: string, decision: "file_str" | "no_filing", _actor?: string, note?: string) =>
  post<Record<string, unknown>>(`/api/cases/${id}/mlro-decision`, { decision, note }).then(mapCaseRow);

/** Sets the SAR escalation fields and adds an escalation note — the case
 * stays in whatever status it's in (usually `investigating`); the MLRO
 * decision panel is what actually moves it to a terminal status. */
export const escalateToMlro = (id: string, _actor?: string, note?: string) =>
  post<Record<string, unknown>>(`/api/cases/${id}/escalate`, { note }).then(mapCaseRow);

/** Case closure is genuinely maker-checker gated server-side (SOP: a second
 * pair of eyes) — this PROPOSES the closure into the `approvals` queue
 * rather than closing the case. The case moves to `pending_approval`
 * immediately; a different Compliance user has to decide the approval
 * before the case actually reaches `closed_cleared`. The response is the
 * created approval row, not the case — callers reload the case afterwards
 * rather than reading this return value. */
export const closeCase = (id: string, rationale: string, _actor?: string, _actorRole?: string) =>
  post<Record<string, unknown>>(`/api/cases/${id}/close`, { rationale }).then((r) => toCamel<Record<string, unknown>>(r));

// ---- Alerts ----

export const getAmlAlerts = () => get<Record<string, unknown>[]>("/api/aml-alerts").then((rows) => rows.map((r) => toCamel<AmlAlert>(r)));
export const getFraudAlerts = () => get<Record<string, unknown>[]>("/api/fraud-alerts").then((rows) => rows.map((r) => toCamel<AmlAlert>(r)));
export const assignAmlAlert = (id: string, assignee: string, _actor?: string) => post<Record<string, unknown>>(`/api/aml-alerts/${id}/assign`, { assignee }).then((r) => toCamel<AmlAlert>(r));
export const assignFraudAlert = (id: string, assignee: string, _actor?: string) => post<Record<string, unknown>>(`/api/fraud-alerts/${id}/assign`, { assignee }).then((r) => toCamel<AmlAlert>(r));

// ---- Complaints ----

export const getComplaints = () => get<Record<string, unknown>[]>("/api/complaints").then((rows) => rows.map(mapComplaint));
export const updateComplaint = (id: string, patch: { status?: string; assignee?: string; resolution?: string; note?: string }, _actor?: string) =>
  post<Record<string, unknown>>(`/api/complaints/${id}`, patch).then(mapComplaint);
