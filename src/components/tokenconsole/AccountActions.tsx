import { useState } from "react";
import { Button, Field, Modal, NotePanel, Textarea, useToast } from "../../ui";
import { omniApi, type CustomerSummary } from "../../lib/omniApi";
import { useAction } from "../../lib/tokenConsole/useAction";

type Kind = "suspend" | "reinstate" | "close";

const WORDS: Record<Kind, { title: string; button: string; body: string; done: string; tone: "danger" | "primary" }> = {
  suspend: {
    title: "Suspend this customer",
    button: "Suspend",
    body: "They can still sign in and look, but every money call is refused until you reinstate them. The app tells them to contact Support.",
    done: "Customer suspended.",
    tone: "danger",
  },
  reinstate: {
    title: "Reinstate this customer",
    button: "Reinstate",
    body: "Lifts the suspension. The customer is told.",
    done: "Customer reinstated.",
    tone: "primary",
  },
  close: {
    title: "Close this customer's app profile",
    button: "Close profile",
    body: "Closes the app profile for good, normally from the customer's own closure request. This does not offboard the investor on the engine: do that separately from the Investors page.",
    done: "Profile closed.",
    tone: "danger",
  },
};

const RUN: Record<Kind, (profileId: string, note?: string) => Promise<CustomerSummary>> = {
  suspend: omniApi.suspendCustomer,
  reinstate: omniApi.reinstateCustomer,
  close: omniApi.closeCustomer,
};

/** What staff can do to a customer's app profile: suspend, reinstate or
 *  close. Each is audited by omnichannel against the staff member signed in,
 *  and takes an optional note for the trail. Only what the profile's status
 *  allows is offered; the service still answers 409 for a race. */
export function AccountActions({ summary, allowed, onChanged }: {
  summary: CustomerSummary;
  /** Whether this staff member may act (the service is the authority). */
  allowed: boolean;
  onChanged: (next: CustomerSummary) => void;
}) {
  const toast = useToast();
  const [kind, setKind] = useState<Kind | null>(null);
  const [note, setNote] = useState("");
  const act = useAction((k: Kind, id: string, n?: string) => RUN[k](id, n));

  if (!allowed) return null;
  const offered: Kind[] = [
    ...(summary.status === "ACTIVE" ? (["suspend"] as const) : []),
    ...(summary.status === "SUSPENDED" ? (["reinstate"] as const) : []),
    ...(summary.status !== "CLOSED" ? (["close"] as const) : []),
  ];
  if (offered.length === 0) return null;

  const open = (k: Kind) => { setNote(""); act.reset(); setKind(k); };
  const confirm = async () => {
    if (!kind) return;
    const next = await act.run(kind, summary.profileId, note.trim() || undefined);
    if (!next) return;
    toast.push(WORDS[kind].done);
    setKind(null);
    onChanged(next);
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
              <Field label="Note" hint="Optional. Kept in the audit trail.">
                <Textarea rows={3} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
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
