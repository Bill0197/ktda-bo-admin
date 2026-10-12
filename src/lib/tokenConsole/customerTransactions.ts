import { omniApi, type CheckedApplication, type IdentityResult, type TimelineEntry } from "../omniApi";

/* Every customer's payments and movements as one list. Omnichannel has no
 * such list: it serves one customer's timeline at a time, and names its
 * customers only through the applications the KYC desk reads. So this reads
 * those applications for who the customers are, then each one's timeline, a
 * few at a time, and merges them newest first.
 *
 * Two limits follow, and the page says both: a customer staff onboarded and
 * linked by code never applied in the app, so is not listed; and omnichannel
 * audits each timeline read against the person signed in, so one load is one
 * audited lookup per customer. */

export type CustomerTransaction = TimelineEntry & {
  /** Unique across the merged list. */
  id: string;
  profileId: string;
  customer: string;
};

export type TransactionsProgress = { customers: number; done: number };

export type TransactionsLoad = {
  rows: CustomerTransaction[];
  customers: number;
  /** Customers whose timeline could not be read; their rows are missing. */
  failed: number;
  /** Customers with more history than one read holds; only their latest
   *  [PER_CUSTOMER] entries are here. */
  truncated: number;
};

/** The most a single timeline read returns, and so the most per customer. */
export const PER_CUSTOMER = 100;
const CONCURRENCY = 12;
const RESULTS: IdentityResult[] = ["MATCH", "MISMATCH", "UNCHECKED"];

/** One entry per app profile: someone who applied twice is one customer. */
function customersOf(applications: CheckedApplication[]): { profileId: string; name: string }[] {
  const byProfile = new Map<string, string>();
  for (const a of applications) {
    if (a.profileId && !byProfile.has(a.profileId)) byProfile.set(a.profileId, a.fullName?.trim() || "Unnamed customer");
  }
  return [...byProfile].map(([profileId, name]) => ({ profileId, name }));
}

export async function loadCustomerTransactions(
  onProgress: (p: TransactionsProgress) => void,
  isCancelled: () => boolean = () => false,
): Promise<TransactionsLoad> {
  const lists = await Promise.all(RESULTS.map((r) => omniApi.applications(r)));
  const customers = customersOf(lists.flat());
  const rows: CustomerTransaction[] = [];
  let done = 0;
  let failed = 0;
  let truncated = 0;
  let next = 0;
  onProgress({ customers: customers.length, done });

  const worker = async () => {
    while (next < customers.length && !isCancelled()) {
      const c = customers[next++];
      try {
        const page = await omniApi.customerTimeline(c.profileId, 1, PER_CUSTOMER);
        if (page.pages > 1) truncated++;
        page.items.forEach((t, i) => rows.push({ ...t, id: `${c.profileId}:${i}`, profileId: c.profileId, customer: c.name }));
      } catch {
        // One customer failing must not lose everyone else's rows.
        failed++;
      }
      done++;
      if (!isCancelled()) onProgress({ customers: customers.length, done });
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, customers.length) }, worker));

  rows.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0));
  return { rows, customers: customers.length, failed, truncated };
}

/** Amounts added up per currency, so shillings and dollars never mix. */
export function totalsByCurrency(rows: CustomerTransaction[]): { currency: string; amount: number }[] {
  const sums = new Map<string, number>();
  for (const r of rows) {
    if (r.amount === null || r.amount === undefined) continue;
    const currency = r.currency ?? "KES";
    sums.set(currency, (sums.get(currency) ?? 0) + r.amount);
  }
  return [...sums].map(([currency, amount]) => ({ currency, amount }));
}
