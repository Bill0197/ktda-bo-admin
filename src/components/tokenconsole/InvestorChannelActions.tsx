import { useState } from "react";
import { Button, Field, Input, Modal, NotePanel, Textarea, useToast } from "../../ui";
import { omniApi, type LinkCode } from "../../lib/omniApi";
import { dateTime } from "../../lib/tokenConsole/format";
import { useAction } from "../../lib/tokenConsole/useAction";
import type { Investor } from "../../lib/tokenConsole/types.gen";

/** What staff can do for an investor through omnichannel, the customer-channel
 * service: hand them a code that links this record to their app profile, or
 * send a message to that app. Keyed by the tokenization investor id. */
export function InvestorChannelActions({ investor, onClose }: { investor: Investor; onClose: () => void }) {
  const toast = useToast();
  const id = investor.investorId ?? "";
  const who = investor.displayName ?? investor.externalRef ?? "this farmer";
  const issue = useAction(omniApi.issueLinkCode);
  const notify = useAction(omniApi.notifyInvestor);
  const [code, setCode] = useState<LinkCode | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const issueCode = async () => {
    const issued = await issue.run(id);
    if (issued) setCode(issued);
  };

  const send = async () => {
    const sent = await notify.run(id, title.trim(), body.trim());
    if (!sent) return;
    toast.push(`Message sent to ${who}'s app.`);
    setTitle("");
    setBody("");
  };

  // Omnichannel answers 404 when no app profile is linked to the record yet.
  const notLinked = notify.error && /no profile is linked/i.test(notify.error);

  return (
    <Modal open onClose={onClose} title={`App channel · ${who}`} size="lg">
      <section>
        <h3 className="text-[13px] font-semibold text-text">Link code</h3>
        <p className="mt-1 mb-3 text-sm text-text-soft">
          A one-time code the farmer enters in the app to connect it to this record. Read it to them on a verified call.
        </p>
        {code ? (
          <div className="rounded-md border border-border bg-surface-sunken px-4 py-3">
            <div className="font-mono text-2xl tracking-[0.2em] text-text">{code.code}</div>
            <div className="mt-1 text-xs text-text-soft">Expires {dateTime(code.expiresAt)}</div>
          </div>
        ) : (
          <Button size="sm" disabled={!id || issue.pending} onClick={() => void issueCode()}>
            {issue.pending ? "Issuing…" : "Issue link code"}
          </Button>
        )}
        {issue.error && <NotePanel tone="danger" className="mt-3">{issue.error}</NotePanel>}
      </section>

      <section className="mt-6 border-t border-border pt-5">
        <h3 className="text-[13px] font-semibold text-text">Send a message</h3>
        <p className="mt-1 mb-3 text-sm text-text-soft">Delivered to the farmer's app inbox. Only works once the app is linked.</p>
        <div className="grid gap-3">
          <Field label="Title" required>
            <Input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Your statement is ready" />
          </Field>
          <Field label="Message" required hint={`${body.length}/500`}>
            <Textarea rows={3} value={body} maxLength={500} onChange={(e) => setBody(e.target.value)} />
          </Field>
        </div>
        <div className="mt-3 flex justify-end">
          <Button size="sm" disabled={!id || !title.trim() || !body.trim() || notify.pending} onClick={() => void send()}>
            {notify.pending ? "Sending…" : "Send message"}
          </Button>
        </div>
        {notify.error && (
          <NotePanel tone={notLinked ? "warning" : "danger"} className="mt-3">
            {notLinked ? `${who} hasn't linked the app yet. Issue a link code first.` : notify.error}
          </NotePanel>
        )}
      </section>
    </Modal>
  );
}
