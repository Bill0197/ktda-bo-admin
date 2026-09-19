/* Tokenization Compliance (issuance/lifecycle/smart-contracts boards) +
 * Market Conduct (market abuse, conflicts, employee trading). Owned by the
 * Tokenization/Conduct-domain wiring pass — edit only this file for that
 * domain. See apiClient.ts / api.ts.
 *
 * apps/core-api's TokenizationService/ConductService return raw JdbcTemplate
 * `Map<String,Object>` rows keyed by the SQL column name (snake_case); the
 * mock fixtures/types these pages still render against are camelCase, so
 * every read response is deep-mapped here (`toCamel`), same convention as
 * api.compliance.ts. Return types are cast to the same src/mock types
 * (type-only import) the pages already import, so no page needs a
 * render-side edit.
 *
 * Two reshapes beyond plain camelCasing:
 *   - TokenIssuance.subFund: the DB stores `sub_fund_code`
 *     (KES_FIXED_INCOME / USD_EUROBOND, an FK into sub_funds) — the pages
 *     render the same display label the mock fixture used, so it is mapped
 *     back here rather than showing the raw code.
 *   - LifecycleEvent.at: the DB column is `occurred_at`; the mock type (and
 *     TokenLifecycle.tsx) reads the timestamp as `at`.
 * Every other field name matches 1:1 after camelCasing — verified against
 * V10__tokenization_conduct_domain.sql column-by-column. */
import { get, post } from "./apiClient";
import type {
  TokenIssuance, LifecycleEvent, SmartContract, MarketAbuseAlert, ConflictDeclaration, EmployeeTrade,
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

// ---- Token issuance ----

/** sub_fund_code -> the display label the mock fixture (and TokenIssuance.tsx's
 * `r.subFund`) used. Mirrors TokenizationSeeder's own `subFundCode(label)`
 * reverse mapping. */
const SUB_FUND_LABEL: Record<string, string> = {
  KES_FIXED_INCOME: "KES Fixed Income",
  USD_EUROBOND: "USD Eurobond",
};

function mapIssuance(row: unknown): TokenIssuance {
  const c = toCamel<TokenIssuance & { subFundCode?: string }>(row);
  c.subFund = SUB_FUND_LABEL[c.subFundCode ?? ""] ?? c.subFundCode ?? "";
  return c as TokenIssuance;
}

export const getTokenIssuances = () =>
  get<Record<string, unknown>[]>("/api/tokenization/issuances").then((rows) => rows.map(mapIssuance));
export const getTokenIssuance = (id: string) => get<Record<string, unknown>>(`/api/tokenization/issuances/${id}`).then(mapIssuance);

/** Records one signature. A second DISTINCT signer auto-flips the batch to
 * `approved`; a duplicate/self-approval or an uncleared whitelist/
 * jurisdiction condition 409s with a `rule_rejected` code and a human
 * reason in `ApiError.message` — surface that message, not a generic
 * "approval failed", if this is ever wired to a page action. */
export const approveTokenIssuance = (id: string) => post<Record<string, unknown>>(`/api/tokenization/issuances/${id}/approvals`).then(mapIssuance);
export const rejectTokenIssuance = (id: string, note?: string) =>
  post<Record<string, unknown>>(`/api/tokenization/issuances/${id}/reject`, { note }).then(mapIssuance);

// ---- Token lifecycle ----

function mapLifecycleEvent(row: unknown): LifecycleEvent {
  const c = toCamel<LifecycleEvent & { occurredAt?: string }>(row);
  c.at = c.occurredAt as string;
  return c as LifecycleEvent;
}

export const getLifecycleEvents = () =>
  get<Record<string, unknown>[]>("/api/tokenization/lifecycle-events").then((rows) => rows.map(mapLifecycleEvent));

/** Only works once per event and only for a privileged event type (freeze,
 * forced_transfer, burn, recovery, whitelist_remove) — an already-authorised
 * event or a non-privileged one 409s. `authorisedBy` is required and
 * non-blank. */
export const authorizeLifecycleEvent = (id: string, authorisedBy: string, reason?: string) =>
  post<Record<string, unknown>>(`/api/tokenization/lifecycle-events/${id}/authorize`, { authorisedBy, reason }).then(mapLifecycleEvent);

// ---- Smart contracts ----

export const getSmartContracts = () =>
  get<Record<string, unknown>[]>("/api/tokenization/smart-contracts").then((rows) => rows.map((r) => toCamel<SmartContract>(r)));

// ---- Market abuse ----

export const getMarketAbuseAlerts = () =>
  get<Record<string, unknown>[]>("/api/market-conduct/market-abuse-alerts").then((rows) => rows.map((r) => toCamel<MarketAbuseAlert>(r)));

export const assignMarketAbuseAlert = (id: string, assignee: string) =>
  post<Record<string, unknown>>(`/api/market-conduct/market-abuse-alerts/${id}/assign`, { assignee }).then((r) => toCamel<MarketAbuseAlert>(r));
export const setMarketAbuseStatus = (id: string, status: string) =>
  post<Record<string, unknown>>(`/api/market-conduct/market-abuse-alerts/${id}/status`, { status }).then((r) => toCamel<MarketAbuseAlert>(r));
/** Only a `closed_substantiated` matter is notifiable — reporting any other
 * status 409s. */
export const reportMarketAbuseToCma = (id: string, reportedToCma?: string) =>
  post<Record<string, unknown>>(`/api/market-conduct/market-abuse-alerts/${id}/report-to-cma`, reportedToCma ? { reportedToCma } : undefined).then((r) =>
    toCamel<MarketAbuseAlert>(r),
  );

// ---- Conflicts of interest ----

/** value_kes is a nullable numeric column (only meaningful for
 * gift_hospitality declarations); after toCamel a SQL NULL comes back as
 * `null`, but ConflictsOfInterest.tsx checks `r.valueKes === undefined` to
 * decide whether to render "n/a" vs a Money amount — so null is normalised
 * to undefined here rather than leaving it to fail that strict check. */
function mapConflict(row: unknown): ConflictDeclaration {
  const c = toCamel<ConflictDeclaration>(row);
  c.valueKes = c.valueKes ?? undefined;
  return c;
}

export const getConflictDeclarations = () =>
  get<Record<string, unknown>[]>("/api/market-conduct/conflicts").then((rows) => rows.map(mapConflict));

/** `status: 'declared'` is refused (it is the un-reviewed starting state,
 * not a decision) and a gift/hospitality declaration above the KES 25,000
 * threshold cannot be reviewed as 'approved_with_controls' — both 409. */
export const reviewConflict = (id: string, status: string, mitigation?: string, reviewDue?: string) =>
  post<Record<string, unknown>>(`/api/market-conduct/conflicts/${id}/review`, { status, mitigation, reviewDue }).then(mapConflict);

// ---- Employee (personal account) dealing ----

export const getEmployeeTrades = () =>
  get<Record<string, unknown>[]>("/api/market-conduct/employee-trades").then((rows) => rows.map((r) => toCamel<EmployeeTrade>(r)));

/** Decides a pre-clearance request only — never touches `executedAt`, since
 * an approved-but-unexecuted request is not a breach. Refuses (409) a
 * request that has already been decided (pre_clearance is no longer
 * 'pending'), or a decision other than 'approved'/'declined'. */
export const decideEmployeeTrade = (id: string, decision: "approved" | "declined", note?: string) =>
  post<Record<string, unknown>>(`/api/market-conduct/employee-trades/${id}/decide`, { decision, note }).then((r) => toCamel<EmployeeTrade>(r));
