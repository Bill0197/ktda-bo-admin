import { useMemo } from "react";
import { Badge, GlassStat, NotePanel, PageHeader, StatRail } from "../../ui";
import { Scale } from "lucide-react";
import { tokenConsole } from "../../lib/api";
import { useAsyncData } from "../../lib/useAsyncData";
import { booksByCurrency, outOfBalance } from "../../lib/tokenConsole/books";
import { label, money } from "../../lib/tokenConsole/format";
import type { GlBalanceRow, TrialBalanceLine } from "../../lib/tokenConsole/types.gen";
import { Code, ConsoleTable } from "../../components/tokenconsole/ConsoleTable";

const num = "tabular text-right whitespace-nowrap";

/** Totals and the balance check are per currency: see booksByCurrency. The
 * console this page came from added KES and USD into one figure. */
export default function TokenConsoleTrialBalance() {
  const tb = useAsyncData(tokenConsole.trialBalance);
  const gl = useAsyncData(tokenConsole.glBalances);
  const books = useMemo(() => booksByCurrency(tb.data ?? []), [tb.data]);
  const unbalanced = books.filter(outOfBalance);

  return (
    <div>
      <PageHeader eyebrow="Baracel Unyt" title="Trial balance" subtitle="Every GL account with its debits, credits and net position." />

      {books.length > 0 && (
        <StatRail columns={books.length >= 4 ? 4 : books.length === 3 ? 3 : 2} className="mb-5">
          {books.map((b) => (
            <GlassStat
              key={b.currency || "none"}
              label={`${b.currency || "No currency"} books`}
              value={outOfBalance(b) ? `Out by ${money(b.balance)}` : "Balanced"}
              icon={<Scale size={17} />}
              tone={outOfBalance(b) ? "danger" : "success"}
              hint={`${b.accounts} accounts · Dr ${money(b.debit)} · Cr ${money(b.credit)}`}
            />
          ))}
        </StatRail>
      )}

      {unbalanced.length > 0 && (
        <NotePanel tone="danger" className="mb-5" title="Investigate before posting more">
          Debits and credits do not agree in {unbalanced.map((b) => b.currency || "an account with no currency").join(" and ")}.
          Every posting is a balanced pair, so something was written that should not have been.
        </NotePanel>
      )}

      <ConsoleTable<TrialBalanceLine>
        what="the trial balance"
        source={tb}
        rowId={(r) => r.glAccountId}
        title="Accounts"
        emptyLabel="No accounts yet"
        columns={[
          { key: "account", header: "Account", render: (r) => (
            <div>
              <Code>{r.accountCode}</Code>
              <div className="text-sm text-text">{r.accountName ?? "—"}</div>
            </div>
          ) },
          { key: "ccy", header: "Ccy", render: (r) => r.currency ?? "—" },
          { key: "debit", header: "Debit", className: num, render: (r) => money(r.totalDebit) },
          { key: "credit", header: "Credit", className: num, render: (r) => money(r.totalCredit) },
          { key: "balance", header: "Balance", className: num, render: (r) => money(r.balance) },
        ]}
      />

      <ConsoleTable<GlBalanceRow>
        what="GL balances"
        source={gl}
        rowId={(r) => r.glAccountId}
        title="GL balances"
        description="The same accounts as the ledger holds them, with the owner each one is kept for."
        emptyLabel="No balances"
        columns={[
          { key: "account", header: "Account", render: (r) => (
            <div>
              <Code>{r.accountCode ?? r.glAccountId}</Code>
              <div className="text-sm text-text">{r.accountName ?? "—"}</div>
            </div>
          ) },
          { key: "type", header: "Type", render: (r) => r.accountType ? <Badge tone="neutral">{label(r.accountType)}</Badge> : "—", hideOnMobile: true },
          { key: "owner", header: "Owner", render: (r) => <span className="text-xs text-text-soft">{r.ownerLabel ?? r.ownerType ?? "—"}</span>, hideOnMobile: true },
          { key: "ccy", header: "Ccy", render: (r) => r.currency ?? "—" },
          { key: "balance", header: "Balance", className: num, render: (r) => money(r.balance) },
        ]}
      />
    </div>
  );
}
