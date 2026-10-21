import { useState } from "react";
import { Button, Field, Modal, NotePanel, Textarea, useToast } from "../../ui";
import { omniApi, type CustomerSummary, type Intervention } from "../../lib/omniApi";
import { useAction } from "../../lib/tokenConsole/useAction";

type Kind = "suspend" | "reinstate" | "close";

const NOTE_MAX = 300;

const WORDS: Record<Kind, { title: string; button: string; body: string; done: string; tone: "danger" | "primary" }> = {
  suspend: {
    title: "Suspend this customer",
    button: "Suspend",
    body: "Takes effect now. They can still sign in and look, but every money call is refused until a reinstatement is approved. The app tells them to contact Support.",
    done: "Customer suspended.",
    tone: "danger",
  },
  reinstate: {
    title: "Propose reinstating this customer",
    button: "Propose reinstate",
    body: "Nothing changes yet: the suspension is lifted only when a different staff member approves. The customer is told then.",
    done: "Reinstatement proposed. It waits for a second person to approve it.",
    tone: "primary",
  },
  close: {
    title: "Propose closing this customer's app profile",
    button: "Propose close",
    body: "Nothing changes yet: the profile is closed for good only when a different staff member approves, normally from the customer's own closure request. This does not offboard the investor on the engine: do that separately from the Investors page.",
    done: "Closure proposed. It waits for a second person to approve it.",
    tone: "danger",
  },
};

/** What staff can do to a customer's app profile: suspend at once (the safe
 *  direction), or propose a reinstatement or a closure, which a different
 *  person approves (BRD FR-ADM-03). Each is audited by omnichannel against
 *  the staff member signed in, with an optional note. Only what the
 *  profile's status allows is offered; the service still answers 409 for a
 *  race, and that message is shown as it came. */
export function AccountActions({ summary, allowed, pending, onChanged, onProposed }: {
  summary: CustomerSummary;
  /** Whether this staff member may act (the service is the authority). */
  allowed: boolean;
  /** The proposal waiting on this customer; undefined while it is read. */
  pending: Intervention | null | undefined;
  /** Suspend answers with the profile as it now is. */
  onChanged: (next: CustomerSummary) => void;
  /** A reinstatement or closure was proposed. */
  onProposed: (proposal: Intervention) => void;
}) {
  const toast = useToast();
  const [kind, setKind] = useState<Kind | null>(null);
  const [note, setNote] = useState("");
  const act = useAction(async (k: Kind, id: string, n?: string): Promise<{ summary?: CustomerSummary; proposal?: Intervention }> =>
    k === "suspend" ? { summary: await omniApi.suspendCustomer(id, n) }
    : { proposal: await (k === "reinstate" ? omniApi.proposeReinstate : omniApi.proposeClose)(id, n) });

  if (!allowed) return null;
  // One proposal waits per customer: while one does, it is decided below
  // before another is made. Suspend is not a proposal and stays.
  const canPropose = pending === null;
  const offered: Kind[] = [
    ...(summary.status === "ACTIVE" ? (["suspend"] as const) : []),
    ...(summary.status === "SUSPENDED" && canPropose ? (["reinstate"] as const) : []),
    ...(summary.status !== "CLOSED" && canPropose ? (["close"] as const) : []),
  ];
  if (offered.length === 0) return null;

  const open = (k: Kind) => { setNote(""); act.reset(); setKind(k); };
  const confirm = async () => {
    if (!kind || act.pending) return;
    const done = await act.run(kind, summary.profileId, note.trim() || undefined);
    if (!done) return;
    toast.push(WORDS[kind].done);
    setKind(null);
    if (done.summary) onChanged(done.summary);
    if (done.proposal) onProposed(done.proposal);
  };
  const w = kind ? WORDS[kind] : null;

  return (
    <>
      <div className="flex flex-wrap gap-2" data-testid="account-actions">
        {offered.map((k) => (
          <Button key={k} size="sm" variant={k === "reinstate" ? "primary" : "outline"} onClick={() => open(k)}>
            {WORDS[k].button}
          </Button>
        ))}
      </div>
      <Modal open={kind !== null} onClose={() => !act.pending && setKind(null)} title={w?.title}>
        {w && (
          <>
            <p className="text-sm text-text-soft">{w.body}</p>
            <div className="mt-4">
              <Field label="Note" hint={`Optional. Kept in the audit trail${kind === "suspend" ? "" : " and shown to the approver"}. ${note.length}/${NOTE_MAX}`}>
                <Textarea rows={3} value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} />
              </Field>
            </div>
            {act.error && <NotePanel tone="danger" className="mt-3">{act.error}</NotePanel>}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" disabled={act.pending} onClick={() => setKind(null)}>Cancel</Button>
              <Button variant={w.tone === "danger" ? "danger" : "primary"} disabled={act.pending} onClick={() => void confirm()}>
                {act.pending ? "Working…" : w.button}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
