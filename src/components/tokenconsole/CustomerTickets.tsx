import { useEffect, useState } from "react";
import { Badge, DataTable, NotePanel } from "../../ui";
import { CLOSURE_SUBJECT, omniApi, type DeskTicket } from "../../lib/omniApi";
import { dateTime, label } from "../../lib/tokenConsole/format";
import { Code } from "./ConsoleTable";

const TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  NEW: "warning", ACKNOWLEDGED: "warning", INVESTIGATING: "warning", RESOLVED: "success", CLOSED: "neutral",
};

/** One customer's support requests, in every status. Their own account
 *  closure request is called out: closing the profile is a decision made
 *  from the actions above, after exit screening and settlement. */
export function CustomerTickets({ profileId }: { profileId: string }) {
  const [rows, setRows] = useState<DeskTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    omniApi.customerTickets(profileId, 1, 50).then(
      (p) => { if (!stale) setRows(p.items); },
      (e: unknown) => { if (!stale) setError(e instanceof Error ? e.message : "Requests could not be loaded."); },
    );
    return () => { stale = true; };
  }, [profileId]);

  if (error) return <NotePanel tone="danger">{error}</NotePanel>;
  if (!rows) return <p className="text-sm text-text-soft">Loading…</p>;
  const closure = rows.find((t) => t.subject === CLOSURE_SUBJECT && t.status !== "CLOSED");
  return (
    <div className="flex flex-col gap-3">
      {closure && (
        <NotePanel tone="warning" title="Account closure requested">
          {closure.reference} was raised {dateTime(closure.submittedAt)}. Close the profile above once exit screening
          and settlement are done, then offboard the investor on the engine.
        </NotePanel>
      )}
      <DataTable
        paged={false}
        rows={rows}
        emptyLabel="No support requests"
        columns={[
          { key: "when", header: "Raised", className: "whitespace-nowrap", render: (t) => <span className="tabular text-xs text-text-soft">{dateTime(t.submittedAt)}</span> },
          { key: "ref", header: "Reference", className: "whitespace-nowrap", render: (t) => <Code>{t.reference}</Code> },
          { key: "subject", header: "Request", render: (t) => (
            <div>
              <div className="font-medium text-text">{t.subject}</div>
              <div className="text-xs text-text-soft">{label(t.category)}</div>
            </div>
          ) },
          { key: "status", header: "Status", className: "whitespace-nowrap", render: (t) => <Badge tone={TONE[t.status] ?? "neutral"}>{label(t.status)}</Badge> },
        ]}
      />
    </div>
  );
}
