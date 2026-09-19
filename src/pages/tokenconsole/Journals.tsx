import { useMemo, useState } from "react";
import { DataTable, Modal, PageHeader, SearchInput } from "../../ui";
import { tokenConsole } from "../../lib/api";
import { useAsyncData } from "../../lib/useAsyncData";
import { calendarDate, dateTime, money } from "../../lib/tokenConsole/format";
import type { LedgerEntryView } from "../../lib/tokenConsole/types.gen";
import { Code, ConsoleTable, StatusBadge } from "../../components/tokenconsole/ConsoleTable";

const num = "tabular text-right whitespace-nowrap";

/** The lines are the entry: a journal row without them is only a headline.
 * The service returns one amount and a side per line, split here into the
 * debit and credit columns an accountant reads. */
function LinesModal({ entry, onClose }: { entry: LedgerEntryView | null; onClose: () => void }) {
  const lines = (entry?.lines ?? []).map((l, i) => ({ ...l, id: `${i}` }));
  const ccy = entry?.currency;
  return (
    <Modal open={entry !== null} onClose={onClose} title={entry?.eventType ?? "Journal entry"} size="lg">
      {entry && (
        <div className="mb-4 grid gap-1 text-sm text-text-soft">
          {entry.description && <p className="text-text">{entry.description}</p>}
          <p>
            <span className="tabular">{calendarDate(entry.valueDate)}</span> value date · posted{" "}
            <span className="tabular">{dateTime(entry.postedAt)}</span> · <StatusBadge status={entry.status} />
          </p>
        </div>
      )}
      <DataTable
        rows={lines}
        emptyLabel="This entry has no lines"
        columns={[
          { key: "account", header: "Account", render: (l) => (
            <div>
              <Code>{l.accountCode}</Code>
              <div className="text-xs text-text-soft">{l.accountName ?? "—"}</div>
            </div>
          ) },
          { key: "debit", header: "Debit", className: num, render: (l) => (l.side === "DEBIT" ? money(l.amount, ccy) : "—") },
          { key: "credit", header: "Credit", className: num, render: (l) => (l.side === "CREDIT" ? money(l.amount, ccy) : "—") },
        ]}
      />
    </Modal>
  );
}

export default function TokenConsoleJournals() {
  const journals = useAsyncData(tokenConsole.journals);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<LedgerEntryView | null>(null);
  const term = q.trim().toLowerCase();

  const rows = useMemo(
    () => (journals.data ?? []).filter((j) =>
      !term
      || (j.description ?? "").toLowerCase().includes(term)
      || (j.eventType ?? "").toLowerCase().includes(term)
      || (j.productId ?? "").toLowerCase().includes(term)),
    [journals.data, term],
  );

  return (
    <div>
      <PageHeader eyebrow="Tokenization Console" title="Journals" subtitle="Every posting to the books. Select an entry for the debits and credits it is made of." />
      <ConsoleTable<LedgerEntryView>
        what="journal entries"
        source={journals}
        rows={rows}
        rowId={(r) => r.journalId}
        title="Entries"
        actions={<SearchInput value={q} onChange={setQ} placeholder="Event, description or product…" className="w-64" />}
        emptyLabel={term ? "No entry matches that" : "Nothing posted yet"}
        onRowClick={setOpen}
        columns={[
          { key: "event", header: "Event", render: (r) => (
            <div>
              <div className="text-text font-medium">{r.eventType ?? "—"}</div>
              <div className="text-xs text-text-soft mt-0.5 max-w-sm leading-snug">{r.description ?? ""}</div>
            </div>
          ) },
          { key: "product", header: "Product", render: (r) => <Code>{r.productId}</Code>, hideOnMobile: true },
          { key: "amount", header: "Amount", className: num, render: (r) => money(r.amount, r.currency) },
          { key: "posted", header: "Posted", render: (r) => <span className="tabular text-xs text-text-soft">{dateTime(r.postedAt)}</span>, hideOnMobile: true },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
        ]}
      />
      <LinesModal entry={open} onClose={() => setOpen(null)} />
    </div>
  );
}
