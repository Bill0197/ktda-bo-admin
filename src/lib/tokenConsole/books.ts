import type { TrialBalanceLine } from "./types.gen";

export type CurrencyBook = { currency: string; accounts: number; debit: number; credit: number; balance: number };

/** Trial balance totals per currency. Each currency's books must balance on
 * their own: a KES and a USD figure added together is not a number anyone
 * can act on, and a break in one could hide behind an offsetting break in
 * the other. */
export function booksByCurrency(lines: TrialBalanceLine[]): CurrencyBook[] {
  const books = new Map<string, CurrencyBook>();
  for (const l of lines) {
    const currency = l.currency ?? "";
    const b = books.get(currency) ?? { currency, accounts: 0, debit: 0, credit: 0, balance: 0 };
    b.accounts += 1;
    b.debit += l.totalDebit ?? 0;
    b.credit += l.totalCredit ?? 0;
    b.balance += l.balance ?? 0;
    books.set(currency, b);
  }
  return [...books.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

/** Compared against a cent rather than zero: these amounts have been through
 * pro-rata division, and half a cent of rounding is not a broken ledger. */
export const outOfBalance = (b: CurrencyBook) => Math.abs(b.balance) >= 0.01;
