/* Omnichannel's staff (operator) endpoints — the only part of omnichannel a
 * back office uses. Omnichannel owns the customer's identity and channels, not
 * their records, so most of what BO Admin *shows* comes from the tokenization
 * service (tokApi.ts). Two reads are omnichannel's own, for compliance: the
 * applications the population-registry check flagged, and the selfie and ID
 * photos (the queue waiting for a decision, and every photo one customer sent).
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
  applicationFor: async (investorId: string): Promise<CheckedApplication | null> => {
    const results: IdentityResult[] = ["MISMATCH", "UNCHECKED", "MATCH"];
    for (const result of results) {
      const found = (await omniApi.applications(result)).find((a) => a.product === PRODUCT && a.externalRef === investorId);
      if (found) return found;
    }
    return null;
  },
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
  /** FAILED needs a note: the customer receives it as a message. 409 when it
   *  is no longer pending (someone else decided). */
  reviewDocument: (id: string, decision: "PASSED" | "FAILED", note?: string) =>
    post<QueuedDocument>(`/onboarding/documents/${encodeURIComponent(id)}/review`, { decision, note }),
};
