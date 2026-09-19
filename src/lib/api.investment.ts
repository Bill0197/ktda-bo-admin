/* Investment Management: products, orders, portfolio, holdings, valuations,
 * redemptions, corporate actions, IC approvals (quorum vote), fund mandates.
 * Owned by the Investment-domain wiring pass — edit only this file for that
 * domain. See apiClient.ts / api.ts.
 *
 * apps/core-api's InvestmentController/InvestmentService return JdbcTemplate
 * `Map<String,Object>` rows keyed by the raw SQL column name (snake_case);
 * the mock fixtures/types the nine investment pages still render against are
 * camelCase, so every read response is deep-mapped here (`toCamel`), the
 * same convention api.compliance.ts already established for this repo, plus
 * a few targeted reshapes below for fields the backend genuinely names or
 * shapes differently than the fixture (documented at each mapper). Return
 * types are cast to the same src/mock types (type-only import — no
 * runtime/barrel collision) the pages already import, so no page needs a
 * render-side edit. */
import { get, post } from "./apiClient";
import type {
  InvestmentProduct, InvestmentOrder, PortfolioTrade, BookHolding, ValuationRun, RedemptionRequest,
  CorporateAction, IcApprovalItem, IcVote, InvestmentMandate, MandateLimit,
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

// ---- Products & funds ----

const mapProduct = (row: unknown): InvestmentProduct => toCamel<InvestmentProduct>(row);

export const getInvestmentProducts = () => get<Record<string, unknown>[]>("/api/investment/products").then((rows) => rows.map(mapProduct));

// ---- Orders & subscriptions ----

/** `product` on InvestmentOrder is `investment_orders.product_code` — the
 * fixture names the field for what it shows (the product's short code), the
 * schema names the column for what it is (a foreign key). Renamed here so
 * every existing `r.product` read on Orders.tsx keeps working. */
function mapOrder(row: unknown): InvestmentOrder {
  const c = toCamel<InvestmentOrder & { productCode?: string }>(row);
  c.product = c.productCode ?? c.product;
  return c as InvestmentOrder;
}

export const getInvestmentOrders = () => get<Record<string, unknown>[]>("/api/investment/orders").then((rows) => rows.map(mapOrder));

// ---- Portfolio management (trade blotter) ----

const mapTrade = (row: unknown): PortfolioTrade => toCamel<PortfolioTrade>(row);

export const getPortfolioTrades = () => get<Record<string, unknown>[]>("/api/investment/trades").then((rows) => rows.map(mapTrade));

export type ProposeTradeInput = {
  portfolio: string; instrument: string; isin: string; side: "buy" | "sell"; nominal: number; currency: "KES" | "USD";
  price: number; yieldPct: number; tradeDate: string; settlementDate: string; broker: string; rationale: string; rebookOfId?: string;
};

/** Trades whose |nominal| exceeds the dealer's KES 100m single-trade
 * authority come back with status `ic_pending` and a linked IC approval item
 * created server-side — the 409 `ic_not_approved` on `recordTradeStatus`
 * below is the same rule enforced again on the next transition. */
export const proposeTrade = (input: ProposeTradeInput, _actor?: string) =>
  post<Record<string, unknown>>("/api/investment/trades", input).then(mapTrade);

export const recordTradeStatus = (id: string, status: string, _actor?: string) =>
  post<Record<string, unknown>>(`/api/investment/trades/${id}/status`, { status }).then(mapTrade);

// ---- Holdings & positions ----

const mapHolding = (row: unknown): BookHolding => toCamel<BookHolding>(row);

export const getHoldingsBook = () => get<Record<string, unknown>[]>("/api/investment/holdings").then((rows) => rows.map(mapHolding));

// ---- Valuations & NAV ----

/** `held` is computed server-side (move outside tolerance OR a price never
 * sourced, and not yet published) as its own column rather than re-derived
 * at render time — Valuations.tsx currently re-derives the same two
 * conditions client-side from `movePct`/`tolerancePct`/`pricesSourced`/
 * `pricesTotal`, which still works since those columns are unchanged; `held`
 * is carried through as an extra field for any future call site that wants
 * the server's own answer instead of recomputing it. */
const mapValuationRun = (row: unknown): ValuationRun & { held: boolean } => toCamel<ValuationRun & { held: boolean }>(row);

export const getValuationRuns = () => get<Record<string, unknown>[]>("/api/investment/valuations").then((rows) => rows.map(mapValuationRun));

export type RunValuationInput = {
  portfolio: string; valuationDate: string; currency: "KES" | "USD"; netAssets: number; unitsInIssue: number;
  pricesSourced: number; pricesTotal: number; tolerancePct?: number; note?: string;
};

export const runValuation = (input: RunValuationInput, _actor?: string) =>
  post<Record<string, unknown>>("/api/investment/valuations", input).then(mapValuationRun);

/** Both blocked with 409 `run_held` while the run is outside tolerance or
 * missing a sourced price — the caller must surface `ApiError.code` rather
 * than a generic failure, per the same rule Valuations.tsx's own header note
 * already states in prose. */
export const reviewValuationRun = (id: string, _actor?: string) =>
  post<Record<string, unknown>>(`/api/investment/valuations/${id}/review`).then(mapValuationRun);
export const releaseValuationRun = (id: string, _actor?: string) =>
  post<Record<string, unknown>>(`/api/investment/valuations/${id}/release`).then(mapValuationRun);

// ---- Redemptions ----

/** Same `product_code` -> `product` rename as orders, same reason. */
function mapRedemption(row: unknown): RedemptionRequest {
  const c = toCamel<RedemptionRequest & { productCode?: string }>(row);
  c.product = c.productCode ?? c.product;
  return c as RedemptionRequest;
}

export const getRedemptionRequests = () => get<Record<string, unknown>[]>("/api/investment/redemptions").then((rows) => rows.map(mapRedemption));

export const decideRedemption = (id: string, decision: string, fundedBySale: boolean, note: string | undefined, _actor?: string) =>
  post<Record<string, unknown>>(`/api/investment/redemptions/${id}/decide`, { decision, fundedBySale, note }).then(mapRedemption);

// ---- Corporate actions ----

const mapCorporateAction = (row: unknown): CorporateAction => toCamel<CorporateAction>(row);

export const getCorporateActions = () => get<Record<string, unknown>[]>("/api/investment/corporate-actions").then((rows) => rows.map(mapCorporateAction));

export const decideCorporateAction = (id: string, status: string, electionInstruction: string | undefined, note: string | undefined, _actor?: string) =>
  post<Record<string, unknown>>(`/api/investment/corporate-actions/${id}/decide`, { status, electionInstruction, note }).then(mapCorporateAction);

// ---- Investment Committee approval queue (quorum vote) ----

/** `investment_ic_votes` rows: `member_name` / `voted_at` — mock's `IcVote`
 * is the shorter `member` / `at`, kept from the fixture so IcApprovals.tsx's
 * per-voter rendering (`r.votes.map((v) => \`${v.member} — ${v.vote}\`)`)
 * needs no edit. Dissenting votes ride through untouched — the backend never
 * collapses them, this mapper only renames fields. */
function mapIcVote(row: unknown): IcVote {
  const c = toCamel<{ memberName: string; vote: IcVote["vote"]; votedAt: string; comment?: string }>(row);
  return { member: c.memberName, vote: c.vote, at: c.votedAt, comment: c.comment };
}

function mapIcApproval(row: unknown): IcApprovalItem {
  const c = toCamel<IcApprovalItem & { votes?: unknown[] }>(row);
  c.votes = (c.votes ?? []).map(mapIcVote);
  return c as IcApprovalItem;
}

export const getIcApprovalQueue = () => get<Record<string, unknown>[]>("/api/investment/ic-approvals").then((rows) => rows.map(mapIcApproval));
export const getIcApproval = (id: string) => get<Record<string, unknown>>(`/api/investment/ic-approvals/${id}`).then(mapIcApproval);

export type ProposeIcApprovalInput = {
  kind: string; title: string; detail: string; portfolio: string; amount?: number | null; currency: "KES" | "USD"; quorum?: number; dueBy?: string;
};

export const proposeIcApproval = (input: ProposeIcApprovalInput, _actor?: string) =>
  post<Record<string, unknown>>("/api/investment/ic-approvals", input).then(mapIcApproval);
export const withdrawIcApproval = (id: string, _actor?: string) =>
  post<Record<string, unknown>>(`/api/investment/ic-approvals/${id}/withdraw`).then(mapIcApproval);

/** Gated server-side on `investment_ic_approvals:decide`, which the
 * Investment Manager role deliberately does not hold — the manager proposes,
 * the Committee decides. A manager calling this gets a 403 from apiClient as
 * an `ApiError`; callers must handle/hide rather than crash (there is
 * currently no vote UI on IcApprovals.tsx to wire this into — see the
 * wiring report). One vote per member is enforced server-side (409
 * `already_voted`); voting after quorum is reached is enforced too (409
 * `already_decided`). */
export const castIcVote = (id: string, vote: "for" | "against" | "abstain", comment: string | undefined, _actor?: string) =>
  post<Record<string, unknown>>(`/api/investment/ic-approvals/${id}/vote`, { vote, comment }).then(mapIcApproval);

// ---- Investment mandates (fund level) ----

/** `investment_mandate_limits` names its two value columns `limit_text` /
 * `current_text` (SQL reserves `limit` awkwardly enough to avoid outright);
 * mock's `MandateLimit` is `limit` / `current`. `approved_at/review_due` are
 * nullable dates (e.g. the still-drafting MMF mandate); the fixture models
 * "not yet set" as the literal string `"—"` and Mandates.tsx tests for that
 * exact string (`m.approvedAt === "—" ? "not approved" : formatDate(...)`),
 * so a SQL NULL is coalesced to the same sentinel rather than left null. */
function mapMandateLimit(row: unknown): MandateLimit {
  const c = toCamel<{ label: string; limitText: string; currentText: string; status: MandateLimit["status"] }>(row);
  return { label: c.label, limit: c.limitText, current: c.currentText, status: c.status };
}

function mapMandate(row: unknown): InvestmentMandate {
  const c = toCamel<InvestmentMandate & { limits?: unknown[]; approvedAt?: string | null; reviewDue?: string | null }>(row);
  c.limits = (c.limits ?? []).map(mapMandateLimit);
  c.approvedAt = c.approvedAt ?? "—";
  c.reviewDue = c.reviewDue ?? "—";
  return c as InvestmentMandate;
}

export const getInvestmentMandates = () => get<Record<string, unknown>[]>("/api/investment/mandates").then((rows) => rows.map(mapMandate));
