/* Institutional Funds + Institutional Compliance: clients, mandates,
 * portfolios, fees, reporting, breaches, restrictions, counterparties,
 * client KYB/compliance. Owned by the Institutional-domain wiring pass —
 * edit only this file for that domain. See apiClient.ts / api.ts.
 *
 * Reconciled against the actual src/mock call sites in this domain's pages
 * (institutional/{Clients,Mandates,Portfolios,Fees,Reporting},
 * instcompliance/{Breaches,Restrictions,Counterparties,ClientCompliance})
 * and against apps/core-api's institutional module (InstitutionalController +
 * InstitutionalComplianceController), which return JdbcTemplate
 * `Map<String,Object>` rows keyed by the raw SQL column name (snake_case) —
 * the mock fixtures/types these pages still render against are camelCase, so
 * every read response is deep-mapped here (`toCamel`), same convention as
 * api.compliance.ts.
 *
 * The five Institutional Funds pages are read-only by design — the fixture
 * (src/mock/fixtures/institutional.ts) never exposed a mutation for
 * any of them, and InstitutionalController's own docstring confirms every
 * mutation in this domain belongs to the Compliance side. None of the nine
 * pages currently render any mutation UI (verified: no page imports or calls
 * a write function from src/mock in this domain), so no page JSX needed a
 * write call wired in. The Institutional Compliance mutations ARE real on the
 * backend (PATCH restrictions/breaches, breach notify, counterparty
 * review/screen, client KYB review) and are exported below for accuracy and
 * for whichever page picks them up next — see the wiring report for the
 * gap note. */
import { get, post, ApiError } from "./apiClient";
import type {
  InstitutionalClient, InstitutionalMandate, MandateRestriction, SegregatedPortfolio, FeeSchedule,
  InstitutionalReport, MandateBreach, Counterparty, InstitutionalClientCompliance,
} from "../mock";

/** apiClient.ts (shared, owned by another domain's wiring pass — not edited
 * here) exposes only get/post/del, no PATCH verb. `updateRestriction` and
 * `updateBreach` are real `@PatchMapping` endpoints
 * (InstitutionalComplianceController), so this domain needs its own PATCH
 * primitive rather than sending a POST a `@PatchMapping` would 405 on. Same
 * fetch/cookie/error-envelope conventions as apiClient.ts's `request`. */
const CORE_API_BASE = (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_CORE_API_BASE ?? "http://localhost:8090";

async function patchRequest<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${CORE_API_BASE}${path}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, `Cannot reach CORE API at ${CORE_API_BASE}. Is it running?`);
  }
  const text = await res.text();
  const parsed: unknown = text ? safeJsonParse(text) : null;
  if (!res.ok) {
    const env = (parsed ?? {}) as { error?: string; code?: string; message?: string };
    throw new ApiError(res.status, env.message ?? env.error ?? res.statusText, env.code);
  }
  return parsed as T;
}

function safeJsonParse(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}

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

/** The mock's `InstitutionalMandate.inceptionDate` / `.reviewDue` and
 * `Counterparty.nextReviewDue` / `InstitutionalClientCompliance.nextReviewDue`
 * are typed as plain `string`, using the literal `"—"` sentinel for "no such
 * date" (an unsigned draft mandate, a rejected counterparty with no further
 * review) — every page that reads them checks `=== "—"` rather than a null
 * check. The real columns are nullable `date`, so map null back to that same
 * sentinel here rather than touching the page's render logic. */
function dateOrDash(v: unknown): string {
  return v == null ? "—" : (v as string);
}

function mapMandate(row: unknown): InstitutionalMandate {
  const m = toCamel<InstitutionalMandate>(row);
  m.inceptionDate = dateOrDash(m.inceptionDate);
  m.reviewDue = dateOrDash(m.reviewDue);
  return m;
}

function mapCounterparty(row: unknown): Counterparty {
  const c = toCamel<Counterparty>(row);
  c.nextReviewDue = dateOrDash(c.nextReviewDue);
  return c;
}

function mapClientCompliance(row: unknown): InstitutionalClientCompliance {
  const c = toCamel<InstitutionalClientCompliance>(row);
  c.nextReviewDue = dateOrDash(c.nextReviewDue);
  return c;
}

// ---- Institutional Funds (read-only) ----

export const getInstitutionalClients = () =>
  get<Record<string, unknown>[]>("/api/institutional/clients").then((rows) => rows.map((r) => toCamel<InstitutionalClient>(r)));

export const getInstitutionalMandates = () =>
  get<Record<string, unknown>[]>("/api/institutional/mandates").then((rows) => rows.map(mapMandate));

/** Shared by institutional/Mandates.tsx (Investment Manager) and
 * instcompliance/Restrictions.tsx (Compliance) — the same records, two
 * audiences. `/api/institutional/restrictions` accepts either
 * `institutional_mandates:read` or `institutional_compliance_restrictions:read`
 * (see InstitutionalController), so it is the one endpoint both roles can
 * reach; the compliance-only `/api/institutional-compliance/restrictions`
 * would 403 the Investment Manager. */
export const getMandateRestrictions = () =>
  get<Record<string, unknown>[]>("/api/institutional/restrictions").then((rows) => rows.map((r) => toCamel<MandateRestriction>(r)));

export const getSegregatedPortfolios = () =>
  get<Record<string, unknown>[]>("/api/institutional/portfolios").then((rows) => rows.map((r) => toCamel<SegregatedPortfolio>(r)));

export const getFeeSchedules = () =>
  get<Record<string, unknown>[]>("/api/institutional/fees").then((rows) => rows.map((r) => toCamel<FeeSchedule>(r)));

export const getInstitutionalReports = () =>
  get<Record<string, unknown>[]>("/api/institutional/reporting").then((rows) => rows.map((r) => toCamel<InstitutionalReport>(r)));

// ---- Institutional Compliance ----

/** Not called by any current page (Restrictions.tsx is read-only render),
 * but a real endpoint — see the file docstring. `lastChecked` moves to
 * now() server-side; the caller cannot backdate it. */
export const updateRestriction = (
  id: string,
  body: { currentValue?: string; headroomPct?: number; state?: string; note?: string },
) => patchRequest<Record<string, unknown>>(`/api/institutional-compliance/restrictions/${id}`, body).then((r) => toCamel<MandateRestriction>(r));

export const getMandateBreaches = () =>
  get<Record<string, unknown>[]>("/api/institutional-compliance/breaches").then((rows) => rows.map((r) => toCamel<MandateBreach>(r)));

/** Not called by any current page (Breaches.tsx is read-only render), but a
 * real endpoint — see the file docstring. `status` is validated server-side
 * against the same five values as `BreachStatus`. */
export const updateBreach = (
  id: string,
  body: { status?: string; owner?: string; cureDueBy?: string; note?: string },
) => patchRequest<Record<string, unknown>>(`/api/institutional-compliance/breaches/${id}`, body).then((r) => toCamel<MandateBreach>(r));

/** Refuses a second call with 409 `already_notified` — curing a breach does
 * not discharge the separate client-notification obligation, so the caller
 * must surface that conflict rather than collapse it into a generic error. */
export const notifyBreachClient = (id: string, notifiedAt?: string) =>
  post<Record<string, unknown>>(`/api/institutional-compliance/breaches/${id}/notify`, notifiedAt ? { notifiedAt } : undefined).then((r) =>
    toCamel<MandateBreach>(r),
  );

export const getCounterparties = () =>
  get<Record<string, unknown>[]>("/api/institutional-compliance/counterparties").then((rows) => rows.map(mapCounterparty));

/** Not called by any current page — see the file docstring. `lastReviewedAt`
 * moves to today server-side; the caller supplies the new standing and the
 * next review date. */
export const reviewCounterparty = (
  id: string,
  body: { ddStatus?: string; riskRating?: string; nextReviewDue?: string; note?: string },
) => post<Record<string, unknown>>(`/api/institutional-compliance/counterparties/${id}/review`, body).then(mapCounterparty);

/** Not called by any current page — see the file docstring. `sanctionsScreenedAt`
 * moves to today server-side. */
export const screenCounterparty = (id: string, sanctionsClear: boolean, note?: string) =>
  post<Record<string, unknown>>(`/api/institutional-compliance/counterparties/${id}/screen`, { sanctionsClear, note }).then(mapCounterparty);

export const getInstitutionalClientCompliance = () =>
  get<Record<string, unknown>[]>("/api/institutional-compliance/clients").then((rows) => rows.map(mapClientCompliance));

/** Not called by any current page — see the file docstring. `lastReviewedAt`
 * moves to today server-side; the caller supplies whatever fields the KYB
 * review actually changed (all optional — the endpoint COALESCEs). */
export const reviewClientCompliance = (
  id: string,
  body: {
    kycTier?: string; uboVerified?: boolean; uboCount?: number; sanctionsClear?: boolean; riskRating?: string;
    authorityOnFile?: boolean; nextReviewDue?: string; outstandingItems?: string[];
  },
) => post<Record<string, unknown>>(`/api/institutional-compliance/clients/${id}/review`, body).then(mapClientCompliance);
