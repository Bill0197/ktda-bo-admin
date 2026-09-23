/* Omnichannel's staff (operator) endpoints — the only part of omnichannel a
 * back office uses. Omnichannel owns the customer's identity and channels, not
 * their records: it has no staff login and no staff read APIs, so everything
 * BO Admin *shows* comes from the tokenization service (tokApi.ts). These are
 * actions on top of an investor record, keyed by that record's id.
 *
 * Same-origin `/omni/*` (Vite proxy / functions/omni), which forwards only
 * these three POSTs and only for a caller with a live BO Admin session. */

export class OmniApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "OmniApiError";
    this.status = status;
  }
}

const BASE = `${import.meta.env.VITE_OMNI_BASE ?? "/omni"}/api/operator`;

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new OmniApiError(0, "Cannot reach the omnichannel service. Check your connection and try again.");
  }
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
};
