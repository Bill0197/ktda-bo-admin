/* Omnichannel's staff (operator) endpoints — the only part of omnichannel a
 * back office uses. Omnichannel owns the customer's identity and channels, not
 * their records, so most of what BO Admin *shows* comes from the tokenization
 * service (tokApi.ts). The reads that are omnichannel's own: for compliance,
 * the applications the population-registry check flagged and the selfie and
 * ID photos (the queue waiting for a decision, and every photo one customer
 * sent); for support, one customer's standing, money, messages and activity.
 *
 * Same-origin `/omni/*` (Vite proxy / functions/omni / nginx), which forwards
 * only these calls and only for a caller with a live BO Admin session. */

export class OmniApiError extends Error {
  readonly status: number;
  /** The request field omnichannel blamed (a 400 on `haltedOfferings`, say). */
  readonly field: string | null;
  /** Omnichannel's stable error code (`CHANGE_PENDING`, …), when it sent one. */
  readonly code: string | null;
  constructor(status: number, message: string, field: string | null = null, code: string | null = null) {
    super(message);
    this.name = "OmniApiError";
    this.status = status;
    this.field = field;
    this.code = code;
  }
}

/** A 401 from omnichannel or the proxy in front of it: the BO Admin session
 *  has ended, or the call did not say who is acting (the market and payment
 *  decisions refuse to act for nobody). Either way signing in again fixes it;
 *  the raw message ("No authenticated subject") would not tell anyone that. */
const SIGN_IN_AGAIN = "Omnichannel could not tell who you are, so nothing was done. Please sign out, sign in again and retry.";

/** The error for a failed response, from omnichannel's envelope
 *  ({message, code, field}) or the proxies' ({error}). */
function errorFrom(status: number, data: unknown): OmniApiError {
  const env = (data && typeof data === "object" ? data : {}) as {
    error?: string; message?: string; detail?: string; field?: string; code?: string;
  };
  const message = status === 401 ? SIGN_IN_AGAIN : env.detail ?? env.message ?? env.error ?? `Request failed (${status}).`;
  return new OmniApiError(status, message, env.field ?? null, env.code ?? null);
}

const BASE = `${import.meta.env.VITE_OMNI_BASE ?? "/omni"}/api/operator`;

/** Who is acting, for omnichannel's audit (`reviewedBy`). UAT omnichannel has
 *  no staff login and takes it from X-Dev-Subject; the deployed proxy sets it
 *  from the verified BO Admin session, so this is only what the dev proxy
 *  passes on. */
let actor: string | null = null;
export function setOmniActor(email: string | null) {
  actor = email ? omniSubjectFor(email) : null;
}

/** What omnichannel records when a call carries no X-Dev-Subject. */
const NO_SUBJECT = "dev-operator";

/** The subject omnichannel records for this staff member: the same value
 *  sent as X-Dev-Subject here and set by functions/omni from the session.
 *  Compare a record's `proposedBy` / `decidedBy` with this, never with the
 *  bare email. */
export function omniSubjectFor(email: string | null | undefined): string {
  return email ? `staff:${email}` : NO_SUBJECT;
}

/** A recorded subject as a person reads it: the email without `staff:`. */
export function staffName(subject: string | null | undefined): string {
  if (!subject) return "—";
  return subject.startsWith("staff:") ? subject.slice("staff:".length) : subject;
}

async function send(method: "GET" | "POST", path: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (actor) headers["X-Dev-Subject"] = actor;
  try {
    return await fetch(`${BASE}${path}`, {
      method,
      credentials: "include",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new OmniApiError(0, "Cannot reach the omnichannel service. Check your connection and try again.");
  }
}

async function failure(res: Response): Promise<OmniApiError> {
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return errorFrom(res.status, data);
}

/* Every omnichannel list is paged: `page` from 1, `size` 20 by default and at
 * most 100, the body a plain array, the totals in X-Total-Pages and friends.
 * The compliance screens need whole lists (they join and count them), so
 * this walks the pages. */
const PAGE_SIZE = 100;

async function getAll<T>(path: string, onPage?: (res: Response) => void): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; ; page++) {
    const res = await send("GET", `${path}${path.includes("?") ? "&" : "?"}page=${page}&size=${PAGE_SIZE}`);
    if (!res.ok) throw await failure(res);
    onPage?.(res);
    const items = (await res.json()) as T[];
    all.push(...items);
    // No header means a service (or proxy) that does not page: it sent the whole list.
    const pages = Number(res.headers.get("X-Total-Pages"));
    if (!res.headers.has("X-Total-Pages") || !Number.isFinite(pages) || page >= pages || items.length < PAGE_SIZE) return all;
  }
}

/** One page of a list, and how many pages there are. */
export type Page<T> = { items: T[]; page: number; pages: number; total: number };

async function getPage<T>(path: string, page: number, size: number): Promise<Page<T>> {
  const res = await send("GET", `${path}${path.includes("?") ? "&" : "?"}page=${page}&size=${size}`);
  if (!res.ok) throw await failure(res);
  const items = (await res.json()) as T[];
  const num = (name: string, fallback: number) => {
    const v = Number(res.headers.get(name));
    return res.headers.has(name) && Number.isFinite(v) ? v : fallback;
  };
  // Without the headers (a service that does not page) this is the whole list.
  return { items, page, pages: num("X-Total-Pages", page), total: num("X-Total-Count", items.length) };
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await send("POST", path, body);
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) throw errorFrom(res.status, data);
  return data as T;
}

/** The tokenization product, as omnichannel names it; `externalRef` is the
 *  accounting investor id. */
const PRODUCT = "TOKENIZATION";

export type LinkCode = { id: string; product: string; externalRef: string; code: string; expiresAt: string };
export type SentNotification = { id: string; type: string; delivery: string };
export type InvestorStanding = { investorId: string; legalName: string; kycStatus: string };

export type IdentityResult = "MATCH" | "MISMATCH" | "UNCHECKED";

/** An application as compliance sees it, with the population-registry result.
 *  `identityMismatches` names the fields that differ ("name", …); the
 *  customer never sees it. `externalRef` is the accounting investor id. */
export type CheckedApplication = {
  id: string;
  profileId: string;
  fullName: string;
  dateOfBirth: string;
  nationality: string;
  identityResult: IdentityResult;
  identityMismatches: string[] | null;
  identitySource: string | null;
  identityCheckedAt: string | null;
  screeningClear: boolean;
  product: string;
  externalRef: string;
  submittedAt: string;
  /** When they were last re-screened after onboarding; null until the first
   *  refresh. */
  rescreenedAt?: string | null;
  /** What the last re-screen said; null until the first refresh. */
  rescreenClear?: boolean | null;
  rescreenReference?: string | null;
};

/** What one re-screening sweep did. */
export type RescreenResult = { screened: number; hits: number };

/** A support request on the desk: the customer's ticket with their name. */
export type DeskTicket = {
  id: string;
  /** What the customer quotes: `SR-` and six characters. */
  reference: string;
  profileId: string;
  customer: string | null;
  category: string;
  subject: string;
  description: string;
  status: "NEW" | "ACKNOWLEDGED" | "INVESTIGATING" | "RESOLVED" | "CLOSED" | string;
  assignedTo: string | null;
  submittedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  updatedAt: string | null;
};

/** The subject omnichannel gives a customer's own closure request. */
export const CLOSURE_SUBJECT = "Account closure request";

export type DocumentType = "SELFIE" | "ID_FRONT" | "ID_BACK";

/** A selfie or ID photo: waiting for compliance, or decided. */
export type QueuedDocument = {
  id: string;
  profileId: string;
  type: DocumentType;
  contentType: string;
  sizeBytes: number;
  status: "PENDING_REVIEW" | "PASSED" | "FAILED";
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  uploadedAt: string;
};

export type ContactView = {
  id: string;
  type: "MOBILE" | "EMAIL" | "WHATSAPP" | string;
  value: string;
  verified: boolean;
  primary: boolean;
  createdAt: string;
};

export type ProductLinkView = { id: string; product: string; externalRef: string; status: string; linkedAt: string };

/** One customer as support sees them: profile, contacts in full, product
 *  links and the live standing in the product, and whether push reaches them. */
export type CustomerSummary = {
  profileId: string;
  displayName: string | null;
  legalName: string | null;
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "CLOSED" | string;
  registeredAt: string;
  contacts: ContactView[];
  links: ProductLinkView[];
  account: { linked: boolean; investorId: string | null; legalName: string | null; kycStatus: string; canInvest: boolean } | null;
  activeDevices: number;
  pushEnabled: boolean;
};

/** A reinstatement or closure proposed under dual control (BRD FR-ADM-03).
 *  `customer` is the profile's display name; `profileStatus` its standing
 *  now, so a decided row shows whether it took effect. */
export type Intervention = {
  id: string;
  profileId: string;
  customer: string | null;
  action: "REINSTATE" | "CLOSE" | string;
  note: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  proposedBy: string;
  proposedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  profileStatus: CustomerSummary["status"] | null;
};

/** M-Pesa payments and payouts (`MPESA`) merged with the product's own
 *  movements (`PRODUCT`), newest first. `direction` is from the customer's
 *  side: OUT is money leaving them. */
export type TimelineEntry = {
  occurredAt: string;
  source: "MPESA" | "PRODUCT" | string;
  kind: string;
  label: string;
  direction: "IN" | "OUT" | string;
  amount: number | null;
  currency: string | null;
  status: string | null;
  reference: string | null;
  detail: string | null;
};

/** One M-Pesa payment or payout in the list across customers: a timeline
 *  entry with whose it is. `customer` is null only for a profile that has
 *  since been removed. */
export type CustomerTransactionEntry = TimelineEntry & { id: string; profileId: string; customer: string | null };

/** What the Transactions page asks for; every part is optional. `from` is
 *  inclusive and `to` exclusive, both ISO instants. */
export type TransactionQuery = { status?: string; kind?: string; from?: string; to?: string; q?: string };

export type TransactionTotal = { count: number; amount: number };
/** The matching payments added up, one entry per currency. */
export type TransactionTotals = { currency: string; collected: TransactionTotal; paidOut: TransactionTotal; failed: TransactionTotal; pending: TransactionTotal };

function transactionParams(query: TransactionQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

/** A body that is not the list asked for: an older omnichannel answers 404,
 *  but a proxy that does not know the path may hand back the app's own page. */
async function listOf<T>(res: Response): Promise<T[]> {
  const data: unknown = await res.json().catch(() => null);
  if (!Array.isArray(data)) throw new OmniApiError(404, "This list is not available on this server yet.");
  return data as T[];
}

export type SentMessage = {
  id: string;
  type: string;
  title: string;
  body: string;
  reference: string | null;
  /** Whether the push went out; the inbox always has the message. */
  delivery: "PENDING" | "SENT" | "NO_DEVICE" | "FAILED" | "MUTED" | string;
  readAt: string | null;
  createdAt: string;
};

/** What the relay deals by now (BRD FR-ADM-01). `source` "defaults" means no
 *  change has been approved yet and the environment's values apply;
 *  "change" means the approved change `changeId`, in force `since`, approved
 *  by `decidedBy`. */
export type MarketSettings = {
  tradingOpen: string;
  tradingClose: string;
  zone: string;
  weekendsOpen: boolean;
  halted: boolean;
  /** Offering ids halted on their own. */
  haltedOfferings: string[];
  source: "defaults" | "change" | string;
  changeId: string | null;
  since: string | null;
  /** Who approved the change in force, and their note; null on the defaults. */
  decidedBy?: string | null;
  decisionNote?: string | null;
};

/** One proposed market-settings change: the whole setting as it would be
 *  after it, and who proposed and decided it. */
export type MarketChange = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  tradingOpen: string;
  tradingClose: string;
  weekendsOpen: boolean;
  halted: boolean;
  haltedOfferings: string[];
  note: string | null;
  proposedBy: string;
  proposedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
};

export type MarketOverview = { settings: MarketSettings; pending: MarketChange | null };

/** A proposal: a field left out keeps its current value. Times are HH:mm. */
export type MarketProposal = {
  tradingOpen?: string;
  tradingClose?: string;
  weekendsOpen?: boolean;
  halted?: boolean;
  haltedOfferings?: string[];
  note?: string;
};

/** A payment as omnichannel holds it (M-Pesa, or a bank transfer). */
export type PaymentView = {
  id: string;
  direction: "IN" | "OUT" | string;
  status: "PENDING" | "PAID" | "SENT" | "FAILED" | string;
  method: string;
  phone: string | null;
  amount: number;
  currency: string;
  reference: string | null;
  providerRef: string | null;
  failureReason: string | null;
  createdAt: string;
  completedAt: string | null;
};

/** Something on the payments side that needs a person (BRD FR-STL-05):
 *  a payout the provider refused, or a reported transfer still unmatched
 *  after the wait. `why` is written to be read. */
export type PaymentIssue = {
  profileId: string;
  payment: PaymentView;
  kind: "PAYOUT_FAILED" | "TRANSFER_WAITING" | string;
  why: string;
};

/** The whole queue; `truncated` when omnichannel cut a kind at its cap, so
 *  the queue holds more than `items`. */
export type PaymentIssueList = { items: PaymentIssue[]; truncated: boolean };

export type CustomerAction = { id: string; action: string; target: string | null; outcome: number | null; requestId: string | null; occurredAt: string };

export type CustomerQuery = { phone: string } | { email: string } | { investorId: string } | { profileId: string };

async function getOne<T>(path: string): Promise<T> {
  const res = await send("GET", path);
  if (!res.ok) throw await failure(res);
  return (await res.json()) as T;
}

const marketChangePath = (id: string) => `/market/settings/changes/${encodeURIComponent(id)}`;
const paymentPath = (id: string) => `/payments/${encodeURIComponent(id)}`;
const interventionPath = (id: string) => `/customers/interventions/${encodeURIComponent(id)}`;

/** Omnichannel lists applications by registry result only, so this reads
 *  each result until one matches. */
async function findApplication(match: (a: CheckedApplication) => boolean): Promise<CheckedApplication | null> {
  const results: IdentityResult[] = ["MISMATCH", "UNCHECKED", "MATCH"];
  for (const result of results) {
    const found = (await omniApi.applications(result)).find((a) => a.product === PRODUCT && match(a));
    if (found) return found;
  }
  return null;
}

const customerPath = (id: string) => `/customers/${encodeURIComponent(id)}`;

export const omniApi = {
  /** A one-time code the investor enters in the app to link this record to
   *  their profile. */
  issueLinkCode: (investorId: string) =>
    post<LinkCode>("/link-codes", { product: PRODUCT, externalRef: investorId }),
  /** 404 when no app profile is linked to the record yet. */
  notifyInvestor: (investorId: string, title: string, body: string) =>
    post<SentNotification>("/notifications", { product: PRODUCT, externalRef: investorId, title, body }),
  setKycStatus: (investorId: string, kycStatus: "VERIFIED" | "PENDING" | "REJECTED") =>
    post<InvestorStanding>(`/investors/${encodeURIComponent(investorId)}/kyc-status`, { kycStatus }),

  /** Applications by registry result; omnichannel's default is MISMATCH. */
  applications: (identityResult: IdentityResult = "MISMATCH") =>
    getAll<CheckedApplication>(`/onboarding/applications?identityResult=${identityResult}`),
  /** The app application behind an accounting investor, whatever the registry
   *  said; null when they never applied through the app (staff onboarded). */
  applicationFor: (investorId: string) => findApplication((a) => a.externalRef === investorId),
  /** The app application one profile made, whatever the registry said; null
   *  when they have not applied. */
  applicationOfProfile: (profileId: string) => findApplication((a) => a.profileId === profileId),
  /** Photos waiting for a decision, oldest first. */
  pendingDocuments: () => getAll<QueuedDocument>("/onboarding/documents"),
  /** Every accepted photo, across customers, newest first. */
  acceptedDocuments: () => getAll<QueuedDocument>("/onboarding/documents?status=PASSED"),
  /** Every photo one app profile sent, decided ones included, newest first. */
  customerDocuments: (profileId: string) =>
    getAll<QueuedDocument>(`/onboarding/documents?profileId=${encodeURIComponent(profileId)}`),
  /** The image itself. Each view is audited (DOCUMENT_VIEWED), so screens load
   *  it only when someone opens that applicant. */
  documentImage: async (id: string): Promise<Blob> => {
    const res = await send("GET", `/onboarding/documents/${encodeURIComponent(id)}/content`);
    if (!res.ok) throw await failure(res);
    return res.blob();
  },
  /** Customers by a verified phone (international format), a verified email,
   *  their investor id or their profile id; empty when nothing matches. */
  findCustomers: (q: CustomerQuery) => {
    const [key, value] = Object.entries(q)[0];
    return getAll<CustomerSummary>(`/customers?${key}=${encodeURIComponent(value)}`);
  },
  customer: async (profileId: string): Promise<CustomerSummary> => {
    const res = await send("GET", customerPath(profileId));
    if (!res.ok) throw await failure(res);
    return (await res.json()) as CustomerSummary;
  },
  customerTimeline: (profileId: string, page: number, size = 20) =>
    getPage<TimelineEntry>(`${customerPath(profileId)}/timeline`, page, size),
  customerMessages: (profileId: string, page: number, size = 20) =>
    getPage<SentMessage>(`${customerPath(profileId)}/messages`, page, size),
  customerActivity: (profileId: string, page: number, size = 20) =>
    getPage<CustomerAction>(`${customerPath(profileId)}/activity`, page, size),
  /** Every customer's M-Pesa payments and payouts, newest first. 404 when
   *  omnichannel (or the proxy in front of it) predates the list. */
  transactions: async (query: TransactionQuery, page: number, size = 50): Promise<Page<CustomerTransactionEntry>> => {
    const qs = transactionParams(query);
    const res = await send("GET", `/transactions?${qs ? `${qs}&` : ""}page=${page}&size=${size}`);
    if (!res.ok) throw await failure(res);
    const items = await listOf<CustomerTransactionEntry>(res);
    const num = (name: string, fallback: number) => {
      const v = Number(res.headers.get(name));
      return res.headers.has(name) && Number.isFinite(v) ? v : fallback;
    };
    return { items, page, pages: num("X-Total-Pages", page), total: num("X-Total-Count", items.length) };
  },
  /** The same payments added up per currency; empty when nothing matches. */
  transactionTotals: async (query: TransactionQuery): Promise<TransactionTotals[]> => {
    const qs = transactionParams(query);
    const res = await send("GET", `/transactions/summary${qs ? `?${qs}` : ""}`);
    if (!res.ok) throw await failure(res);
    return listOf<TransactionTotals>(res);
  },
  /** Stops the profile acting; every money call answers 409 until it is
   *  reinstated. 409 unless the profile is active. Audited. */
  suspendCustomer: (profileId: string, note?: string) =>
    post<CustomerSummary>(`${customerPath(profileId)}/suspend`, note ? { note } : {}),
  /** Proposes lifting a suspension (BRD FR-ADM-03): 202 with the proposal,
   *  PENDING; the profile is unchanged until someone else approves. 409
   *  unless suspended, or CHANGE_PENDING while another proposal waits. */
  proposeReinstate: (profileId: string, note?: string) =>
    post<Intervention>(`${customerPath(profileId)}/reinstate`, note ? { note } : {}),
  /** Proposes closing the app profile for good, normally from the
   *  customer's own closure request: 202 PENDING until someone else
   *  approves. The investor is offboarded on the engine separately. 409 when
   *  already closed, or CHANGE_PENDING while another proposal waits. */
  proposeClose: (profileId: string, note?: string) =>
    post<Intervention>(`${customerPath(profileId)}/close`, note ? { note } : {}),
  /** One customer's proposals, newest first, every page (the service pages
   *  this list; an older one that does not sends it whole). */
  customerInterventions: (profileId: string) => getAll<Intervention>(`${customerPath(profileId)}/interventions`),
  /** The queue waiting for a second person (oldest first), or the whole
   *  log (`ALL`, newest first), a page at a time. */
  interventions: (status: "PENDING" | "ALL", page: number, size = 20) =>
    getPage<Intervention>(`/customers/interventions?status=${status}`, page, size),
  /** Carried out now: the profile moves and the customer is told. 409
   *  SECOND_APPROVER_REQUIRED for the proposer, CHANGE_DECIDED once decided. */
  approveIntervention: (id: string, note?: string) =>
    post<Intervention>(`${interventionPath(id)}/approve`, note ? { note } : {}),
  /** Turned down by anyone, the proposer included; nothing changes. */
  rejectIntervention: (id: string, note?: string) =>
    post<Intervention>(`${interventionPath(id)}/reject`, note ? { note } : {}),
  /** Customers a nightly re-screening referred, latest first; each is back
   *  under review on the engine. 404 where omnichannel predates it. */
  screeningHits: (page: number, size = 20) =>
    getPage<CheckedApplication>("/onboarding/applications/screening-hits", page, size),
  /** Runs the re-screening sweep now instead of at night. */
  rescreen: () => post<RescreenResult>("/onboarding/applications/rescreen", {}),
  /** One customer's support requests in every status, latest updated first. */
  customerTickets: (profileId: string, page: number, size = 20) =>
    getPage<DeskTicket>(`/support/tickets?profileId=${encodeURIComponent(profileId)}`, page, size),
  /** The queue of requests: everything not closed, longest waiting first,
   *  narrowed to what `q` finds in the reference and the subject. */
  tickets: (q: string, page: number, size = 20) =>
    getPage<DeskTicket>(`/support/tickets?q=${encodeURIComponent(q)}`, page, size),
  /** What the relay deals by now, and the change waiting for a decision. */
  marketSettings: () => getOne<MarketOverview>("/market/settings"),
  /** The market-settings change log, newest first; omnichannel caps `limit`
   *  at 200 and does not page it. */
  marketChanges: async (limit = 50): Promise<MarketChange[]> => {
    const res = await send("GET", `/market/settings/changes?limit=${limit}`);
    if (!res.ok) throw await failure(res);
    return listOf<MarketChange>(res);
  },
  /** Waits as PENDING until someone else approves it. 409 CHANGE_PENDING while
   *  another waits; 400 on a bad time or a close not after the open. */
  proposeMarketChange: (proposal: MarketProposal) => post<MarketChange>("/market/settings/changes", proposal),
  /** 409 SECOND_APPROVER_REQUIRED for the proposer; CHANGE_DECIDED when gone. */
  approveMarketChange: (id: string, note?: string) =>
    post<MarketChange>(`${marketChangePath(id)}/approve`, note ? { note } : {}),
  /** Anyone may reject, the proposer included. */
  rejectMarketChange: (id: string, note?: string) =>
    post<MarketChange>(`${marketChangePath(id)}/reject`, note ? { note } : {}),
  /** Refused payouts and transfers unmatched after the wait, oldest first,
   *  every page. Omnichannel lists at most 500 of each kind and says so with
   *  `X-Truncated: true`; without the header (older omnichannel too) the
   *  list is taken as whole. */
  paymentIssues: async (): Promise<PaymentIssueList> => {
    let truncated = false;
    const items = await getAll<PaymentIssue>("/payments/issues", (res) => {
      if (res.headers.get("X-Truncated")?.trim().toLowerCase() === "true") truncated = true;
    });
    return { items, truncated };
  },
  /** A failed payout sent again to the same phone; 201 with the new payment.
   *  409 for anything else or when already handled. */
  retryPayout: (id: string) => post<PaymentView>(`${paymentPath(id)}/retry`, {}),
  /** A failed payout paid another way; the note is required. 409 for a
   *  transfer (match or mark it unmatched instead) or when already handled. */
  resolvePayment: (id: string, note: string) => post<PaymentView>(`${paymentPath(id)}/resolve`, { note }),
  /** The transfer arrived: PAID with the bank's reference, balance credited. */
  matchTransfer: (id: string, bankReference: string) => post<PaymentView>(`${paymentPath(id)}/match`, { bankReference }),
  /** The transfer never came: FAILED with the reason the customer reads. */
  markTransferUnmatched: (id: string, reason: string) => post<PaymentView>(`${paymentPath(id)}/unmatched`, { reason }),
  /** FAILED needs a note: the customer receives it as a message. 409 when it
   *  is no longer pending (someone else decided). */
  reviewDocument: (id: string, decision: "PASSED" | "FAILED", note?: string) =>
    post<QueuedDocument>(`/onboarding/documents/${encodeURIComponent(id)}/review`, { decision, note }),
};
