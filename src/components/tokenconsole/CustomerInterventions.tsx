import { useState } from "react";
import { Badge, Button, DataTable, Field, NotePanel, SectionTitle, Textarea, useToast } from "../../ui";
import { omniApi, type Intervention } from "../../lib/omniApi";
import { INTERVENTION_LABEL as ACTION_LABEL, whoIs } from "../../lib/tokenConsole/interventions";
import { useAction } from "../../lib/tokenConsole/useAction";
import { dateTime, label } from "../../lib/tokenConsole/format";
import { ActionModal } from "./ActionModal";
import { StatusBadge } from "./ConsoleTable";

/* Reinstating and closing a customer under dual control (BRD FR-ADM-03): one
   staff member proposes, a different one approves and only then does the
   profile move. Omnichannel enforces both rules; these only avoid offering
   an Approve that is certain to be refused (same identity comparison as the
   Market page: the subject omnichannel records, `staff:<email>`). */

const NOTE_MAX = 300;

const DECISION = {
  approve: {
    title: "Approve this?",
    body: (i: Intervention) => i.action === "CLOSE"
      ? "The app profile is closed now, for good, and the customer is told. The investor on the engine is offboarded separately."
      : "The suspension is lifted now and the customer is told.",
    submit: "Approve", pending: "Approving…", done: "Approved. The profile has been updated.", tone: "primary" as const,
  },
  reject: {
    title: "Reject this?",
    body: () => "Nothing changes on the profile; the proposal stays in the log as rejected.",
    submit: "Reject", pending: "Rejecting…", done: "Rejected. The profile is unchanged.", tone: "danger" as const,
  },
};

/** Approve (not for the proposer) and Reject on one pending proposal, each
 *  with an optional note. `onSettled` runs after every answer, refused or
 *  not: the proposal may have been decided by someone else meanwhile. */
export function DecisionButtons({ intervention, me, onSettled }: {
  intervention: Intervention;
  me: string;
  onSettled: (decided: Intervention | null) => void;
}) {
  const toast = useToast();
  const [kind, setKind] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const decide = useAction((k: "approve" | "reject", text?: string) =>
    k === "approve" ? omniApi.approveIntervention(intervention.id, text) : omniApi.rejectIntervention(intervention.id, text));
  const mine = intervention.proposedBy === me;

  const start = (k: "approve" | "reject") => { decide.reset(); setNote(""); setKind(k); };
  const submit = async () => {
    if (!kind || decide.pending) return;
    const done = await decide.run(kind, note.trim() || undefined);
    onSettled(done ?? null);
    if (!done) return; // the service's message is on the dialog
    toast.push(DECISION[kind].done);
    setKind(null);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2" data-testid={`decide-${intervention.id}`}>
        {mine ? (
          <span className="text-[12.5px] text-text-soft" data-testid="second-person">Waiting for a second person</span>
        ) : (
          <Button size="sm" disabled={decide.pending} onClick={() => start("approve")}>Approve</Button>
        )}
        <Button size="sm" variant="outline" disabled={decide.pending} onClick={() => start("reject")}>Reject</Button>
      </div>
      {kind && (
        <ActionModal
          title={DECISION[kind].title}
          description={DECISION[kind].body(intervention)}
          submitLabel={DECISION[kind].submit}
          pendingLabel={DECISION[kind].pending}
          tone={DECISION[kind].tone}
          pending={decide.pending}
          error={decide.error}
          onSubmit={() => void submit()}
          onClose={() => setKind(null)}
          size="sm"
        >
          <Field label="Note" hint={`Optional. Kept with the decision. ${note.length}/${NOTE_MAX}`}>
            <Textarea rows={3} value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </ActionModal>
      )}
    </>
  );
}

/** One customer's proposals: the one waiting, with its decision, and the log. */
export function CustomerInterventions({ items, error, onRetry, me, allowed, onSettled }: {
  items: Intervention[] | null;
  /** Whether this staff member may decide (same gate as the account actions). */
  allowed: boolean;
  error: string | null;
  onRetry: () => void;
  me: string;
  onSettled: (decided: Intervention | null) => void;
}) {
  if (error) {
    return (
      <NotePanel tone="danger" title="Could not load the reinstate and close proposals">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>{error} Until they load, no new proposal can be made here.</span>
          <Button size="sm" variant="outline" onClick={onRetry}>Retry</Button>
        </div>
      </NotePanel>
    );
  }
  if (!items) return null;
  const pending = items.find((i) => i.status === "PENDING") ?? null;
  const decided = items.filter((i) => i !== pending);

  return (
    <div className="flex flex-col gap-4" data-testid="customer-interventions">
      {pending && (
        <NotePanel tone="warning" title={`${ACTION_LABEL[pending.action] ?? label(pending.action)} proposed, waiting for approval`}>
          <div className="flex flex-wrap items-start justify-between gap-3" data-testid="pending-intervention">
            <div>
              <div>Proposed by {whoIs(pending.proposedBy, me)} on {dateTime(pending.proposedAt)}.</div>
              {pending.note && <div className="mt-1"><span className="text-text-faint">Note: </span>{pending.note}</div>}
            </div>
            {allowed && <DecisionButtons intervention={pending} me={me} onSettled={onSettled} />}
          </div>
        </NotePanel>
      )}
      {decided.length > 0 && (
        <div>
          <SectionTitle title="Reinstate and close proposals" description="Newest first. Each was proposed by one person and decided by another." />
          <DataTable<Intervention>
            rows={decided}
            columns={[
              { key: "when", header: "Proposed", className: "whitespace-nowrap", render: (i) => <span className="tabular text-xs text-text-soft">{dateTime(i.proposedAt)}</span> },
              { key: "action", header: "Action", render: (i) => <Badge tone={i.action === "CLOSE" ? "danger" : "info"}>{ACTION_LABEL[i.action] ?? label(i.action)}</Badge> },
              { key: "by", header: "Proposed by", render: (i) => whoIs(i.proposedBy, me) },
              { key: "decision", header: "Decision", className: "whitespace-nowrap", render: (i) => (
                <div>
                  <StatusBadge status={i.status} />
                  {i.decidedBy && <div className="mt-1 text-xs text-text-faint">{whoIs(i.decidedBy, me)} · {dateTime(i.decidedAt)}</div>}
                </div>
              ) },
              { key: "notes", header: "Notes", hideOnMobile: true, render: (i) => (
                <div className="space-y-1 text-xs text-text-soft">
                  {i.note && <div><span className="text-text-faint">Proposal: </span>{i.note}</div>}
                  {i.decisionNote && <div><span className="text-text-faint">Decision: </span>{i.decisionNote}</div>}
                  {!i.note && !i.decisionNote && <span className="text-text-faint">—</span>}
                </div>
              ) },
            ]}
          />
        </div>
      )}
    </div>
  );
}
