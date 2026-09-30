import { useEffect, useMemo, useState } from "react";
import { CircleAlert, ClipboardCheck, Hourglass, UserCheck } from "lucide-react";
import {
  Button, Field, FilterBar, GlassStat, Modal, NotePanel, PageHeader, SearchInput, SectionTitle, SelectFilter,
  StatRail, Textarea, useToast,
} from "../../ui";
import { tokenConsole } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useAsyncData } from "../../lib/useAsyncData";
import { dateOf, dateTime, label } from "../../lib/tokenConsole/format";
import { useAction } from "../../lib/tokenConsole/useAction";
import { invalidateList } from "../../lib/tokenConsole/sharedList";
import { PENDING_CHANGES_KEY } from "../../lib/tokenConsole/usePendingChanges";
import {
  CHANGE_TYPE_LABEL, CHECKER_ROLES, canCheck, isMaker, subjectOf, type ConfigChange,
} from "../../lib/tokenConsole/configChanges";
import { Code, ConsoleTable, StatusBadge } from "../../components/tokenconsole/ConsoleTable";
import { DetailItem } from "../../components/tokenconsole/DetailItem";
import { ActionModal } from "../../components/tokenconsole/ActionModal";

/* The maker-checker queue for configuration. Products (new, activate,
   deactivate, limits, coupon tariff), tariff domains, types and rates, service
   packages and their items, schemes and their account templates, and an
   institution's default tariff domain are staged from their own screens and
   land here; each takes effect only when a different ADMIN or ACCOUNTANT
   approves it. The engine enforces both rules — the page only avoids offering
   a button that is certain to be refused. */

/** The shared lists an approval can add to (see entityRegistry.ts). */
const DECIDED_LISTS = [
  "tok:product", "tok:tariffValue", "tok:tariffType", "tok:tariffDomain",
  "tok:servicePackage", "tok:scheme", "tok:institution",
];

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Awaiting approval" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "FAILED", label: "Failed on apply" },
];

export default function TokenConsoleChanges() {
  const { user } = useAuth();
  // All statuses in one read: the counts above the table need every one.
  const changes = useAsyncData(() => tokenConsole.configChanges());
  const [status, setStatus] = useState("PENDING");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const all = useMemo(() => changes.data ?? [], [changes.data]);
  const checker = canCheck(user?.tokRoles);
  const pending = all.filter((c) => c.status === "PENDING");
  const mine = pending.filter((c) => isMaker(c, user?.email));
  const decidable = checker ? pending.length - mine.length : 0;
  const oldest = pending.map((c) => c.madeAt ?? "").filter(Boolean).sort()[0];
  const failed = all.filter((c) => c.status === "FAILED").length;
  const loaded = !!changes.data;

  const term = q.trim().toLowerCase();
  const rows = all
    .filter((c) => status === "all" || c.status === status)
    .filter((c) => !term || [c.summary, subjectOf(c), c.maker, c.checker, CHANGE_TYPE_LABEL[c.changeType]]
      .some((v) => (v ?? "").toLowerCase().includes(term)))
    // Waiting ones oldest first — whoever has waited longest is decided next;
    // decided ones newest first, like any history.
    .sort((a, b) => status === "PENDING"
      ? (a.madeAt ?? "").localeCompare(b.madeAt ?? "")
      : (b.decidedAt ?? b.madeAt ?? "").localeCompare(a.decidedAt ?? a.madeAt ?? ""));

  const selectedRow = all.find((c) => c.requestId === selected);

  return (
    <div>
      <PageHeader
        eyebrow="Tokenization Console"
        title="Change approvals"
        subtitle="Configuration changes waiting on a second person. A change takes effect only when someone other than the person who made it approves it."
      />

      <StatRail className="mb-6">
        <GlassStat label="Awaiting approval" value={loaded ? pending.length : "—"} icon={<Hourglass size={16} />} tone={pending.length ? "warning" : "neutral"} />
        <GlassStat
          label="You can decide"
          value={loaded ? decidable : "—"}
          icon={<UserCheck size={16} />}
          emphasis={false}
          hint={checker ? (mine.length ? `${mine.length} of the waiting ones are yours, so someone else decides those.` : undefined) : `Approving needs ${CHECKER_ROLES.join(" or ")}.`}
        />
        <GlassStat label="Oldest waiting" value={oldest ? dateOf(oldest) : "—"} icon={<ClipboardCheck size={16} />} hint={pending.length ? "Decide this one first." : "Nothing is waiting."} />
        <GlassStat label="Failed on apply" value={loaded ? failed : "—"} icon={<CircleAlert size={16} />} tone={failed ? "danger" : "neutral"} emphasis={false} hint="Approved, but the engine refused it. Nothing was applied." />
      </StatRail>

      <FilterBar className="mb-3">
        <SearchInput value={q} onChange={setQ} placeholder="Change, product or person…" className="w-72" />
        <SelectFilter value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="Any status" />
      </FilterBar>

      <ConsoleTable<ConfigChange>
        what="the change queue"
        source={changes}
        rows={rows}
        rowId={(c) => c.requestId}
        onRowClick={(c) => setSelected(c.requestId)}
        selectedId={selected}
        title="Changes"
        description={loaded ? `${rows.length} of ${all.length}` : undefined}
        emptyLabel={status === "PENDING" ? "Nothing is waiting on approval" : "No changes match that"}
        columns={[
          { key: "change", header: "Change", className: "min-w-[260px]", render: (c) => (
            <div>
              <div className="font-medium text-text">{c.summary || CHANGE_TYPE_LABEL[c.changeType] || label(c.changeType)}</div>
              <div className="mt-0.5 text-xs text-text-faint">
                {CHANGE_TYPE_LABEL[c.changeType] ?? label(c.changeType)}
                {subjectOf(c) ? <> · <span className="tabular">{subjectOf(c)}</span></> : null}
              </div>
            </div>
          ) },
          { key: "maker", header: "Made by", className: "whitespace-nowrap", render: (c) => (
            <div>
              <div className="text-text">{isMaker(c, user?.email) ? "You" : (c.maker ?? "—")}</div>
              <div className="mt-0.5 tabular text-xs text-text-faint">{dateTime(c.madeAt)}</div>
            </div>
          ), hideOnMobile: true },
          { key: "status", header: "Status · decided by", className: "whitespace-nowrap", render: (c) => (
            <div>
              <StatusBadge status={c.status} />
              <div className="mt-1 text-xs text-text-faint">
                {c.status === "PENDING"
                  ? (isMaker(c, user?.email) ? "Needs someone else" : checker ? "You can decide" : "Needs a checker")
                  : c.checker ? `${c.checker} · ${dateOf(c.decidedAt)}` : dateOf(c.decidedAt)}
              </div>
            </div>
          ) },
        ]}
      />

      <Modal open={!!selectedRow} onClose={() => setSelected(null)} title={selectedRow?.summary || "Change request"} size="lg">
        {/* Keyed so one request's note and error never carry to the next. */}
        {selectedRow && (
          <ChangePanel
            key={selectedRow.requestId}
            change={selectedRow}
            email={user?.email}
            checker={checker}
            onDecided={() => {
              setSelected(null);
              void changes.reload();
              // Every staging screen shows what is still waiting — and an
              // approved record now exists in its pickers.
              invalidateList(PENDING_CHANGES_KEY);
              for (const key of DECIDED_LISTS) invalidateList(key);
            }}
            onRefused={() => {
              void changes.reload();
              invalidateList(PENDING_CHANGES_KEY);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

const CLOSED_NOTE: Partial<Record<ConfigChange["status"], string>> = {
  APPROVED: "This change was approved and applied.",
  REJECTED: "This change was rejected.",
  CANCELLED: "This request was withdrawn by its maker.",
  FAILED: "This change was approved, but the engine refused to apply it.",
};

type Decision = "approve" | "reject" | "cancel";

const DECISION: Record<Decision, { title: string; submit: string; pending: string; tone: "primary" | "danger"; done: string }> = {
  approve: { title: "Approve this change?", submit: "Approve and apply", pending: "Applying…", tone: "primary", done: "Approved and applied." },
  reject: { title: "Reject this change?", submit: "Reject", pending: "Rejecting…", tone: "danger", done: "Rejected. Nothing was applied." },
  cancel: { title: "Withdraw your request?", submit: "Withdraw", pending: "Withdrawing…", tone: "danger", done: "Request withdrawn." },
};

function ChangePanel({ change, email, checker, onDecided, onRefused }: {
  change: ConfigChange;
  email: string | undefined;
  checker: boolean;
  onDecided: () => void;
  /** The engine refused the decision — the request may have moved (e.g. to FAILED), so the list is re-read. */
  onRefused: () => void;
}) {
  const toast = useToast();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const act = useAction(async (d: Decision, text: string) => {
    const trimmed = text.trim();
    if (d === "approve") return tokenConsole.approveChange(change.requestId, trimmed || undefined);
    if (d === "reject") return tokenConsole.rejectChange(change.requestId, trimmed);
    return tokenConsole.cancelChange(change.requestId);
  });

  const mine = isMaker(change, email);
  const pending = change.status === "PENDING";
  // A refused approval can move the request on (to FAILED): once it is no longer
  // pending there is nothing left to confirm, and the panel shows why.
  useEffect(() => {
    if (!pending) setDecision(null);
  }, [pending]);
  const entries = payloadEntries(change.payload);

  const start = (d: Decision) => {
    act.reset();
    setNote("");
    setDecision(d);
  };
  const submit = async () => {
    if (!decision) return;
    const done = await act.run(decision, note);
    if (!done) {
      onRefused();
      return; // the engine's message is on the confirmation
    }
    toast.push(DECISION[decision].done);
    setDecision(null);
    onDecided();
  };

  const consequence: Record<Decision, string> = {
    approve: "The engine applies it now, exactly as shown. If it no longer fits (say the product already exists), it is refused, marked failed, and nothing changes.",
    reject: "It will not be applied. The maker sees your note.",
    cancel: "It leaves the queue unapplied. To change it, withdraw it and make it again.",
  };

  return (
    <>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
        <DetailItem term="Change">{CHANGE_TYPE_LABEL[change.changeType] ?? label(change.changeType)}</DetailItem>
        <DetailItem term="Applies to"><Code>{subjectOf(change) ?? "—"}</Code></DetailItem>
        <DetailItem term="Status"><StatusBadge status={change.status} /></DetailItem>
        <DetailItem term="Made by">{mine ? `You (${change.maker})` : (change.maker ?? "—")}</DetailItem>
        <DetailItem term="Made">{dateTime(change.madeAt)}</DetailItem>
        <DetailItem term="Decided by">{change.checker ?? "—"}</DetailItem>
        {change.decidedAt && <DetailItem term="Decided">{dateTime(change.decidedAt)}</DetailItem>}
        {change.appliedAt && <DetailItem term="Applied">{dateTime(change.appliedAt)}</DetailItem>}
      </dl>

      {change.decisionNote && (
        <NotePanel tone={change.status === "REJECTED" ? "warning" : "info"} className="mt-4" title="Decision note">{change.decisionNote}</NotePanel>
      )}
      {change.error && (
        <NotePanel tone="danger" className="mt-4" title="The engine refused to apply it">{change.error}</NotePanel>
      )}

      <div className="mt-6">
        <SectionTitle
          title={pending ? "What will be applied" : "What was submitted"}
          description="The request exactly as the maker sent it. Approval replays it through the same rules as a direct change."
        />
        {entries.length ? (
          <dl className="grid gap-x-6 gap-y-2 rounded-md border border-border bg-surface-sunken px-4 py-3 sm:grid-cols-2">
            {entries.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-[11px] uppercase tracking-wide text-text-faint">{fieldName(k)}</dt>
                <dd className="break-words text-[13px] text-text"><span className="tabular">{v}</span></dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-text-soft">No details were recorded with this request.</p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-4">
        {!pending ? (
          <span className="text-[12.5px] text-text-soft">{CLOSED_NOTE[change.status] ?? "This request is closed."} Nothing further can be done with it.</span>
        ) : mine ? (
          <>
            <span className="mr-auto text-[12.5px] text-text-soft">You made this change, so someone else has to approve it.</span>
            <Button size="sm" variant="outline" disabled={act.pending} onClick={() => start("cancel")}>Withdraw request</Button>
          </>
        ) : checker ? (
          <>
            <Button size="sm" disabled={act.pending} onClick={() => start("approve")}>Approve</Button>
            <Button size="sm" variant="outline" disabled={act.pending} onClick={() => start("reject")}>Reject</Button>
          </>
        ) : (
          <span className="text-[12.5px] text-text-soft">Only {CHECKER_ROLES.join(" or ")} can approve or reject changes.</span>
        )}
      </div>

      {decision && (
        <ActionModal
          title={DECISION[decision].title}
          description={consequence[decision]}
          submitLabel={DECISION[decision].submit}
          pendingLabel={DECISION[decision].pending}
          tone={DECISION[decision].tone}
          problem={decision === "reject" && !note.trim() ? "Say why it is rejected." : undefined}
          showProblem={false}
          pending={act.pending}
          error={act.error}
          onSubmit={() => void submit()}
          onClose={() => setDecision(null)}
          size="sm"
        >
          {decision !== "cancel" && (
            <Field label="Note" required={decision === "reject"} hint={decision === "reject" ? "Required. The maker sees it." : "Optional. Kept with the approval."}>
              <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={decision === "reject" ? "Why this should not go ahead." : ""} />
            </Field>
          )}
        </ActionModal>
      )}
    </>
  );
}

/** The payload as label/value pairs, empty fields left out. */
function payloadEntries(payload: ConfigChange["payload"]): [string, string][] {
  if (!payload || typeof payload !== "object") return [];
  return Object.entries(payload)
    .filter(([, v]) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => [k, payloadValue(v)]);
}

/** One value as text. A nested record (a new scheme's templates, say) reads as
 *  "Account role: PRINCIPAL, Scope: PER_CONTRACT", empty fields left out. */
function payloadValue(v: unknown): string {
  if (v === null || typeof v !== "object") return String(v);
  // Plain lists read "A, B"; records need a stronger break between them.
  if (Array.isArray(v)) return v.map(payloadValue).join(v.some((x) => x !== null && typeof x === "object") ? "; " : ", ");
  return Object.entries(v)
    .filter(([, x]) => x !== null && x !== undefined && x !== "")
    .map(([k, x]) => `${fieldName(k)}: ${payloadValue(x)}`)
    .join(", ");
}

/** "tariffDomainId" -> "Tariff domain ID": payload keys are the request's camelCase fields. */
function fieldName(key: string): string {
  const words = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().split(" ").map((w) => (w === "id" ? "ID" : w));
  return words.join(" ").replace(/^./, (c) => c.toUpperCase());
}
