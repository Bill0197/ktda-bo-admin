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
  constructor(status: number, message: string) {
    super(message);
    this.name = "OmniApiError";
    this.status = status;
  }
}

const BASE = `${import.meta.env.VITE_OMNI_BASE ?? "/omni"}/api/operator`;

/** Who is acting, for omnichannel's audit (`reviewedBy`). UAT omnichannel has
 *  no staff login and takes it from X-Dev-Subject; the deployed proxy sets it
 *  from the verified BO Admin session, so this is only what the dev proxy
 *  passes on. */
let actor: string | null = null;
export function setOmniActor(email: string | null) {
  actor = email ? `staff:${email}` : null;
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
  const env = (data && typeof data === "object" ? data : {}) as { error?: string; message?: string; detail?: string };
  return new OmniApiError(res.status, env.detail ?? env.message ?? env.error ?? `Request failed (${res.status}).`);
}

/* Every omnichannel list is paged: `page` from 1, `size` 20 by default and at
 * most 100, the body a plain array, the totals in X-Total-Pages and friends.
 * The compliance screens need whole lists (they join and count them), so
 * this walks the pages. */
const PAGE_SIZE = 100;

async function getAll<T>(path: string): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; ; page++) {
    const res = await send("GET", `${path}${path.includes("?") ? "&" : "?"}page=${page}&size=${PAGE_SIZE}`);
    if (!res.ok) throw await failure(res);
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
  if (!res.ok) {
    const env = (data && typeof data === "object" ? data : {}) as { error?: string; message?: string; detail?: string };
    throw new OmniApiError(res.status, env.detail ?? env.message ?? env.error ?? `Request failed (${res.status}).`);
  }
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
};

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

export type CustomerAction = { id: string; action: string; target: string | null; outcome: number | null; requestId: string | null; occurredAt: string };

export type CustomerQuery = { phone: string } | { email: string } | { investorId: string } | { profileId: string };

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
  /** FAILED needs a note: the customer receives it as a message. 409 when it
   *  is no longer pending (someone else decided). */
  reviewDocument: (id: string, decision: "PASSED" | "FAILED", note?: string) =>
    post<QueuedDocument>(`/onboarding/documents/${encodeURIComponent(id)}/review`, { decision, note }),
};
