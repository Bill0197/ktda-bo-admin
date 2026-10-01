import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { BadgeCheck, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import {
  Button, Field, FilterBar, GlassStat, Modal, NotePanel, PageHeader, SearchInput, SectionTitle, SelectFilter,
  StatRail, Textarea, useToast,
} from "../../ui";
import { tokenConsole } from "../../lib/api";
import { useAsyncData } from "../../lib/useAsyncData";
import { dateOf, dateTime, label, shortId } from "../../lib/tokenConsole/format";
import { useAction } from "../../lib/tokenConsole/useAction";
import {
  allReviews, canDecideKyc, classifierOutstanding, currentClassifier, decideKyc, isKycReview, KYC_DECIDER_ROLES, type KycDecision,
} from "../../lib/tokenConsole/kyc";
import { TokApiError } from "../../lib/tokApi";
import { useAuth } from "../../lib/auth";
import type { ComplianceReviewItem, Investor } from "../../lib/tokenConsole/types.gen";
import { Code, ConsoleTable, StatusBadge } from "../../components/tokenconsole/ConsoleTable";
import { DetailItem } from "../../components/tokenconsole/DetailItem";

/* The KYC desk (ported from tokenization-web).
   Onboarding opens a review whenever it cannot clear an applicant itself.
   Until someone decides, the investor sits at UNDER_REVIEW and the investor
   app shows "we're reviewing your application" with investing disabled.
   A decision here writes the register and the review — see lib/tokenConsole/kyc.ts. */

type Row = ComplianceReviewItem & { investor?: Investor; name: string; reference: string };

const STATUS_OPTIONS = [
  { value: "OPEN", label: "Open" },
  { value: "CLEARED", label: "Cleared" },
  { value: "REJECTED", label: "Rejected" },
];

export default function TokenConsoleKyc() {
  const reviews = useAsyncData(allReviews);
  const investors = useAsyncData(tokenConsole.investors);
  const [status, setStatus] = useState("OPEN");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const all = useMemo<Row[]>(() => {
    const byId = new Map((investors.data ?? []).map((i) => [i.investorId ?? "", i]));
    return (reviews.data ?? []).filter(isKycReview).map((review) => {
      const investor = byId.get(review.investorId ?? "");
      return { ...review, investor, name: investor?.displayName ?? "", reference: investor?.externalRef ?? "" };
    });
  }, [reviews.data, investors.data]);

  const term = q.trim().toLowerCase();
  const rows = all
    .filter((r) => status === "all" || r.status === status)
    .filter((r) => !term || r.name.toLowerCase().includes(term) || r.reference.toLowerCase().includes(term) || (r.investorId ?? "").toLowerCase().includes(term))
    // Oldest first: whoever has waited longest is the one to decide next.
    .sort((a, b) => (a.openedAt ?? "").localeCompare(b.openedAt ?? ""));

  const waitingRows = all.filter((r) => r.status === "OPEN");
  const oldest = waitingRows.map((r) => r.openedAt ?? "").filter(Boolean).sort()[0];
  const selectedRow = all.find((r) => r.queueId === selected);
  const loaded = !!reviews.data;

  // One table over two sources: the queue, and the register it names.
  const source = {
    data: reviews.data ? rows : null,
    loading: reviews.loading || investors.loading,
    error: reviews.error ?? investors.error,
    reload: () => Promise.all([reviews.reload(), investors.reload()]).then(() => undefined),
  };

  return (
    <div>
      <PageHeader
        eyebrow="Tokenization Console"
        title="KYC desk"
        subtitle="Applicants waiting on an identity decision. Clearing one lets them invest straight away, so the same decision also records what the register says about them."
      />

      <StatRail className="mb-6">
        <GlassStat label="Awaiting decision" value={loaded ? waitingRows.length : "—"} icon={<ShieldQuestion size={16} />} tone={waitingRows.length ? "warning" : "neutral"} />
        <GlassStat label="Cleared" value={loaded ? all.filter((r) => r.status === "CLEARED").length : "—"} icon={<ShieldCheck size={16} />} tone="success" emphasis={false} />
        <GlassStat label="Rejected" value={loaded ? all.filter((r) => r.status === "REJECTED").length : "—"} icon={<ShieldAlert size={16} />} />
        <GlassStat label="Oldest waiting" value={oldest ? dateOf(oldest) : "—"} hint={waitingRows.length ? "Decide this one first." : "Nothing is waiting."} />
      </StatRail>

      <FilterBar className="mb-3">
        <SearchInput value={q} onChange={setQ} placeholder="Name, reference or investor id…" className="w-72" />
        <SelectFilter value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="Any decision" />
      </FilterBar>

      <ConsoleTable<Row>
        what="the KYC queue"
        source={source}
        rowId={(r) => r.queueId}
        onRowClick={(r) => setSelected(r.queueId ?? null)}
        selectedId={selected}
        description={loaded ? `${rows.length} of ${all.length} KYC items` : undefined}
        title="Queue"
        emptyLabel={status === "OPEN" ? "Nothing is waiting on a KYC decision" : "No KYC items match that"}
        columns={[
          { key: "applicant", header: "Applicant", render: (r) => r.name ? <span className="font-medium text-text">{r.name}</span> : <Code>{shortId(r.investorId)}</Code> },
          { key: "ref", header: "Reference", render: (r) => <Code>{r.reference || "—"}</Code>, hideOnMobile: true },
          { key: "category", header: "Category", render: (r) => label(r.investor?.investorCategory), hideOnMobile: true },
          { key: "lifecycle", header: "Lifecycle", render: (r) => <StatusBadge status={r.investor?.lifecycleStatus} /> },
          { key: "since", header: "Waiting since", render: (r) => <span className="tabular text-xs text-text-soft">{dateTime(r.openedAt)}</span>, hideOnMobile: true },
          { key: "decision", header: "Decision", render: (r) => <StatusBadge status={r.status} /> },
        ]}
      />

      <Modal open={!!selectedRow} onClose={() => setSelected(null)} title={selectedRow?.name || "Applicant"} size="lg">
        {/* Keyed so one applicant's notes and errors never carry to the next. */}
        {selectedRow && (
          <ApplicantPanel
            key={selectedRow.queueId}
            row={selectedRow}
            onDone={() => {
              setSelected(null);
              void reviews.reload();
              void investors.reload();
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function ApplicantPanel({ row, onDone }: { row: Row; onDone: () => void }) {
  const toast = useToast();
  const { user } = useAuth();
  const mayDecide = canDecideKyc(user?.tokRoles);
  const investorId = row.investorId ?? "";
  const detail = useAsyncData(() => tokenConsole.investor(investorId));
  const decide = useAction(async (args: Parameters<typeof decideKyc>[0]) => {
    try {
      return await decideKyc(args);
    } catch (e) {
      // Someone else decided it first: say so and show the queue as it is now.
      if (e instanceof TokApiError && e.status === 409) {
        toast.push(e.message, "warning");
        setDecision(null);
        onDone();
        return undefined;
      }
      throw e;
    }
  });
  const [decision, setDecision] = useState<KycDecision | null>(null);
  const [note, setNote] = useState("");

  const v = detail.data;
  const kyc = currentClassifier(v, "KYC_STATUS");
  const risk = currentClassifier(v, "RISK_TIER");
  const jurisdiction = currentClassifier(v, "JURISDICTION");
  const isOpen = row.status === "OPEN";
  const outstanding = classifierOutstanding(v);
  const name = v?.displayName ?? row.name;

  const submit = async () => {
    if (!decision) return;
    const done = await decide.run({ investorId, queueId: row.queueId, reviewOpen: isOpen, decision, note });
    if (!done) return; // the error is on the confirmation
    toast.push(decision === "verify" ? `${name || "Applicant"} is verified and can invest now.` : `${name || "Applicant"} was rejected.`);
    setDecision(null);
    onDone();
  };

  const start = (d: KycDecision) => {
    setNote("");
    decide.reset();
    setDecision(d);
  };

  return (
    <>
      {detail.error && <NotePanel tone="danger" className="mb-4">{detail.error}</NotePanel>}
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <DetailItem term="Applicant">{v?.displayName ?? row.name ?? "—"}</DetailItem>
        <DetailItem term="Reference"><Code>{v?.externalRef ?? "—"}</Code></DetailItem>
        <DetailItem term="Category">{label(v?.category)}</DetailItem>
        <DetailItem term="Lifecycle"><StatusBadge status={v?.lifecycleStatus} /></DetailItem>
        <DetailItem term="KYC status"><StatusBadge status={kyc?.code} /></DetailItem>
        <DetailItem term="Risk tier">{risk?.name ?? "—"}</DetailItem>
        <DetailItem term="Jurisdiction">{jurisdiction?.name ?? "—"}</DetailItem>
        <DetailItem term="Accounts">{detail.loading && !v ? "…" : (v?.accounts?.length ?? 0)}</DetailItem>
      </dl>

      <div className="mt-6">
        <SectionTitle title="Why this is here" description="The rule that opened the review, in the wording onboarding recorded." />
        <div className="rounded-md border border-border bg-surface-sunken px-4 py-3">
          <p className="text-[13px] text-text">{row.reason ?? "No reason recorded."}</p>
          <p className="mt-1 text-xs text-text-soft">
            Opened {dateTime(row.openedAt)}
            {row.assignedTo ? ` · assigned to ${row.assignedTo}` : ""}
          </p>
          {!isOpen && (
            <p className="mt-2 text-xs text-text-soft">
              {label(row.status)} {dateTime(row.resolvedAt)}
              {row.resolutionNote ? ` — “${row.resolutionNote}”` : ""}
            </p>
          )}
        </div>
        {/* Identity documents stay with onboarding; this API never returns them. */}
        <p className="mt-2 text-xs text-text-soft">
          Identity numbers stay with onboarding and are not exposed here. What is checkable is the screening outcome
          that let the application through, and the register's own classifiers above.
        </p>
      </div>

      {v?.lifecycle?.length ? (
        <div className="mt-6">
          <SectionTitle title="History" description="Every lifecycle move on this investor." />
          <ol className="space-y-2">
            {v.lifecycle.map((e, i) => (
              <li key={`${e.occurredAt}-${i}`} className="flex flex-wrap items-baseline gap-x-2 text-[12.5px]">
                <span className="text-text">{e.fromStatus ? `${label(e.fromStatus)} → ` : ""}{label(e.toStatus)}</span>
                <span className="text-text-soft">{e.reason ?? "—"}</span>
                <span className="ml-auto text-text-faint">{dateTime(e.occurredAt)}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-4">
        {(isOpen || outstanding) && !mayDecide ? (
          <span className="text-[12.5px] text-text-soft">
            Deciding a KYC review needs the {KYC_DECIDER_ROLES.map((r) => label(r)).join(" or ")} role. You can see the queue; someone with that role decides.
          </span>
        ) : isOpen || outstanding ? (
          <>
            <Button size="sm" disabled={decide.pending || !investorId || !v} onClick={() => start("verify")}>
              <BadgeCheck size={14} /> {isOpen ? "Verify and clear" : "Record KYC verified"}
            </Button>
            <Button variant="outline" size="sm" disabled={decide.pending || !investorId || !v} onClick={() => start("reject")}>
              Reject
            </Button>
            {!isOpen && outstanding && (
              <span className="text-[12.5px] text-text-soft">The review is closed, but the register still says {kyc?.name?.toLowerCase()}.</span>
            )}
          </>
        ) : (
          <span className="text-[12.5px] text-text-soft">This one is decided. Nothing is outstanding.</span>
        )}
      </div>

      {decision &&
        // Portalled: BO Admin's Modal is not, and this one opens over another.
        createPortal(
          <ConfirmDecision
            decision={decision}
            name={name}
            clearsReview={isOpen}
            note={note}
            onNote={setNote}
            busy={decide.pending}
            error={decide.error}
            onCancel={() => setDecision(null)}
            onConfirm={() => void submit()}
          />,
          document.body,
        )}
    </>
  );
}


/** Both decisions are irreversible from here — a cleared applicant can start
 *  moving money immediately — so each states its consequence and takes a note
 *  for the audit trail. */
function ConfirmDecision({
  decision, name, clearsReview, note, onNote, busy, error, onCancel, onConfirm,
}: {
  decision: KycDecision;
  name: string;
  clearsReview: boolean;
  note: string;
  onNote: (v: string) => void;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const verifying = decision === "verify";
  const who = name || "this applicant";
  const consequence = verifying
    ? clearsReview
      ? `${who} will be marked verified on the register and cleared for investing straight away.`
      : `The register will record ${who} as verified. Their review is already closed.`
    : clearsReview
      ? `${who} will be marked rejected and will not be able to invest.`
      : `The register will record ${who} as rejected. Their review is already closed.`;
  return (
    <Modal
      open
      onClose={busy ? () => undefined : onCancel}
      size="sm"
      title={verifying ? "Verify this applicant?" : "Reject this applicant?"}
      footer={
        <>
          <Button variant="ghost" size="sm" disabled={busy} onClick={onCancel}>Cancel</Button>
          <Button variant={verifying ? "primary" : "danger"} size="sm" disabled={busy} onClick={onConfirm}>
            {busy ? "Saving…" : verifying ? "Verify applicant" : "Reject applicant"}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-text-soft">{consequence}</p>
      <Field label="Note" hint={clearsReview ? "Kept with the decision on the review." : "Not recorded — the review is already closed."}>
        <Textarea
          rows={3}
          value={note}
          disabled={!clearsReview}
          onChange={(e) => onNote(e.target.value)}
          placeholder={verifying ? "Documents checked against the application." : "Why this was refused."}
        />
      </Field>
      {error && <NotePanel tone="danger" className="mt-3">{error}</NotePanel>}
    </Modal>
  );
}
