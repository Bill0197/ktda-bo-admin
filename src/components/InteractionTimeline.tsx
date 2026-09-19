import { useState } from "react";
import {
  getInteractions, getCrmOwners, logInteraction, INTERACTION_TYPE_LABELS,
  type InteractionSubject, type InteractionType,
} from "../mock";
import {
  Card, Skeleton, Button, Modal, Field, Input, Textarea, Dropdown, EmptyState,
  useToast, formatDateTime, formatDate,
} from "../ui";
import { Phone, PhoneOutgoing, Mail, Users, StickyNote, Cpu, Lock, ArrowRight } from "lucide-react";
import { useAuth, ADMIN_USERS } from "../lib/auth";
import { useAsyncData } from "../lib/useAsyncData";

const TYPE_ICON: Record<InteractionType, typeof Phone> = {
  call_inbound: Phone,
  call_outbound: PhoneOutgoing,
  email: Mail,
  meeting: Users,
  note: StickyNote,
  system: Cpu,
};

/** The interaction history for one lead, client, opportunity or IFA.
 *
 * TIPPING-OFF CONTROL. Every non-Compliance viewer — Client Services and BD
 * alike — sees that a compliance-flagged interaction exists and who handled it,
 * never its body. The redaction happens at the seam (`visibleInteraction` in
 * the mock layer), not here: a control applied in a component is one the next
 * page forgets. The banner says a redacted row is a redaction and not a blank
 * record, because an unexplained gap invites someone to go and ask why. */
export default function InteractionTimeline({
  subjectType, subjectId,
}: {
  subjectType: InteractionSubject;
  subjectId: string;
}) {
  const { role } = useAuth();
  const toast = useToast();
  // The boundary is Compliance, not one job title.
  const canSeeComplianceDetail = role === "compliance" || role === "mlro" || role === "system_admin";
  const { data: interactions, loading, reload } = useAsyncData(() => getInteractions(subjectType, subjectId, canSeeComplianceDetail));
  const { data: owners } = useAsyncData(getCrmOwners);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    type: "call_outbound" as InteractionType,
    summary: "",
    detail: "",
    outcome: "",
    nextAction: "",
    nextActionDue: "",
  });

  const me = role ? ADMIN_USERS[role].name : "";
  const myId = (owners ?? []).find((o) => o.name === me)?.id ?? null;

  const submit = async () => {
    if (!myId) {
      toast.push("This login has no staff record, so an interaction cannot be attributed to anyone.", "error");
      return;
    }
    setBusy(true);
    try {
      await logInteraction({ subjectType, subjectId, ...form, byId: myId, actor: me });
      toast.push(form.nextAction ? "Logged — the next action is now a task." : "Logged.", "success");
      setOpen(false);
      setForm({ type: "call_outbound", summary: "", detail: "", outcome: "", nextAction: "", nextActionDue: "" });
      reload();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not log that", "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Skeleton className="h-64" />;

  const rows = interactions ?? [];
  const redacted = rows.filter((i) => i.complianceOnly && !canSeeComplianceDetail).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-text-soft max-w-2xl">
          Every call, email and meeting on this relationship — so the next conversation starts from what was already said.
        </p>
        <Button onClick={() => setOpen(true)}>Log interaction</Button>
      </div>

      {redacted > 0 && (
        <Card className="p-3 flex items-start gap-2.5 border-l-4 border-l-warning">
          <Lock size={15} className="text-warning mt-0.5 shrink-0" />
          <p className="text-xs text-text-soft leading-relaxed">
            {redacted} {redacted === 1 ? "entry is" : "entries are"} restricted to Compliance. You can see that
            {redacted === 1 ? " it" : " they"} exist and who handled {redacted === 1 ? "it" : "them"}, not the content —
            refer any customer question about account status to Compliance rather than answering from here.
          </p>
        </Card>
      )}

      {rows.length === 0 ? (
        <EmptyState title="Nothing logged yet" body="Interactions recorded here build the history the next person picks up from." />
      ) : (
        <div className="flex flex-col">
          {rows.map((i, idx) => {
            const Icon = TYPE_ICON[i.type];
            const isRedacted = i.complianceOnly && !canSeeComplianceDetail;
            return (
              <div key={i.id} className="flex gap-3">
                <div className="flex flex-col items-center shrink-0">
                  <span className={`h-8 w-8 rounded-full flex items-center justify-center border ${
                    isRedacted ? "bg-warning-bg text-warning border-transparent" : "bg-surface-sunken text-text-soft border-border"
                  }`}>
                    {isRedacted ? <Lock size={14} /> : <Icon size={14} />}
                  </span>
                  {idx < rows.length - 1 && <span className="w-px flex-1 bg-border my-1" />}
                </div>
                <div className="flex-1 min-w-0 pb-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[13px] font-medium text-text">{i.summary}</span>
                    <span className="text-[11px] text-text-faint tabular shrink-0">{formatDateTime(i.occurredAt)}</span>
                  </div>
                  {i.detail && <p className="text-xs text-text-soft leading-relaxed mt-1">{i.detail}</p>}
                  {i.outcome && <p className="text-xs text-text-soft mt-1">→ {i.outcome}</p>}
                  {i.nextAction && (
                    /* Deliberately not a Badge: badges uppercase their content,
                       and a next action is a sentence, not a status. In caps it
                       became the loudest thing on the row. */
                    <div className="mt-2 inline-flex items-start gap-1.5 rounded-md bg-info-bg/70 border border-info/15 px-2.5 py-1.5 text-xs text-text-soft max-w-xl">
                      <ArrowRight size={13} className="text-info mt-0.5 shrink-0" />
                      <span>
                        {i.nextAction}
                        {i.nextActionDue && <span className="text-text-faint tabular"> · {formatDate(i.nextActionDue)}</span>}
                      </span>
                    </div>
                  )}
                  <div className="text-[11px] text-text-faint mt-1.5">{i.typeLabel} · {i.byName}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Log an interaction">
        <div className="flex flex-col gap-4">
          <Field label="Type">
            <Dropdown
              value={form.type}
              onChange={(v) => setForm({ ...form, type: v as InteractionType })}
              options={Object.entries(INTERACTION_TYPE_LABELS)
                .filter(([k]) => k !== "system")
                .map(([value, label]) => ({ value, label }))}
            />
          </Field>
          <Field label="Summary"><Input value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="One line — what this was" /></Field>
          <Field label="Detail" hint="Never record why an account is restricted here. Compliance reasons stay on the case.">
            <Textarea rows={3} value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} />
          </Field>
          <Field label="Outcome"><Input value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })} placeholder="What was agreed or decided" /></Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Next action" hint="Becomes a task.">
              <Input value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} />
            </Field>
            <Field label="Due" hint="Required if there is a next action.">
              <Input type="date" value={form.nextActionDue} onChange={(e) => setForm({ ...form, nextActionDue: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={busy || !form.summary.trim() || (!!form.nextAction.trim() && !form.nextActionDue)}>
              {busy ? "Logging…" : "Log"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
