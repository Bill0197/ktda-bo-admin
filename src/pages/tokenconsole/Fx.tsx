import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Badge, Button, Field, GlassPanel, NotePanel, PageHeader, SectionTitle, Select, Skeleton, Textarea, useToast } from "../../ui";
import { useAuth } from "../../lib/auth";
import { useAsyncData } from "../../lib/useAsyncData";
import { useAction } from "../../lib/tokenConsole/useAction";
import { dateTime, shortId } from "../../lib/tokenConsole/format";
import { omniApi, omniSubjectFor, staffName, type FxBookEntry, type FxChange, type FxSettings } from "../../lib/omniApi";
import { describeChange, NOTE_MAX, rateState, ratesOf } from "../../lib/tokenConsole/fx";
import { ConsoleTable, SourceError, StatusBadge } from "../../components/tokenconsole/ConsoleTable";
import { DetailItem } from "../../components/tokenconsole/DetailItem";
import { ActionModal } from "../../components/tokenconsole/ActionModal";
import { FxProposalForm } from "../../components/tokenconsole/FxProposalForm";

/* The rate customers convert KES and USD at (BRD FR-WAL-04), under dual control,
   from omnichannel. Finance proposes the morning's mid rate (and the margin, the
   limits, a pause); a different person approves it, and only then are customers'
   quotes priced by it. One proposal waits at a time and every proposal stays in
   the log. The book lists customers' quotes and conversions. Omnichannel enforces
   every rule; this page only avoids offering an Approve certain to be refused. */

const LOG_LIMIT = 50;
const BOOK_SIZE = 25;
const BOOK_STATUSES = ["", "CONVERTED", "FAILED", "CONVERTING", "QUOTED", "EXPIRED"];

type Decision = { kind: "approve" | "reject"; change: FxChange };

const DECISION = {
  approve: {
    title: "Approve this rate?",
    body: "From now on every customer's conversion quote is priced by it.",
    submit: "Approve",
    pending: "Approving…",
    done: "Approved. Customers' quotes now use the new setting.",
  },
  reject: {
    title: "Reject this change?",
    body: "Nothing changes; the proposal stays in the log as rejected.",
    submit: "Reject",
    pending: "Rejecting…",
    done: "Rejected. The setting is unchanged.",
  },
} as const;

const rate = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(v);
const amount = (v: number | null | undefined, ccy: string) =>
  v === null || v === undefined ? "No limit" : `${ccy} ${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)}`;

export default function TokenConsoleFx() {
  const { user } = useAuth();
  const toast = useToast();
  const me = omniSubjectFor(user?.email);
  const overview = useAsyncData(omniApi.fxSettings);
  const log = useAsyncData(() => omniApi.fxChanges(LOG_LIMIT));
  const [bookPage, setBookPage] = useState(1);
  const [bookStatus, setBookStatus] = useState("");
  const book = useAsyncData(() => omniApi.fxBook(bookPage, BOOK_SIZE, bookStatus || undefined));
  // A new page or filter reads the book again (the first read is the hook's own).
  const firstBook = useRef(true);
  const reloadBook = book.reload;
  useEffect(() => {
    if (firstBook.current) { firstBook.current = false; return; }
    void reloadBook();
  }, [bookPage, bookStatus, reloadBook]);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [formRound, setFormRound] = useState(0);
  const decide = useAction((d: Decision, text?: string) =>
    d.kind === "approve" ? omniApi.approveFxChange(d.change.id, text) : omniApi.rejectFxChange(d.change.id, text));

  const reloadAll = () => {
    void overview.reload();
    void log.reload();
    void book.reload();
  };
  const who = (subject: string | null | undefined) => (subject && subject === me ? `You (${staffName(subject)})` : staffName(subject));

  const settings = overview.data?.settings ?? null;
  const pending = overview.data?.pending ?? null;
  const changes = log.data ?? [];

  const startDecision = (d: Decision) => {
    decide.reset();
    setNote("");
    setDecision(d);
  };
  const submitDecision = async () => {
    if (!decision || decide.pending) return;
    const done = await decide.run(decision, note.trim() || undefined);
    // Refused or not, the change may have moved on (someone else decided it).
    void overview.reload();
    void log.reload();
    if (!done) return; // the service's message is on the dialog
    toast.push(DECISION[decision.kind].done);
    setDecision(null);
    setFormRound((n) => n + 1);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Baracel Unyt"
        title="FX rates"
        subtitle="The rate customers convert between KES and USD at. A new rate is used only once someone other than the person who proposed it approves it."
        actions={
          <Button size="sm" variant="outline" disabled={overview.loading || log.loading} onClick={reloadAll}>
            <RefreshCw size={14} className={overview.loading ? "animate-spin" : undefined} /> {overview.loading ? "Loading…" : "Refresh"}
          </Button>
        }
      />

      {overview.error && <SourceError what="the FX settings" error={overview.error} onRetry={overview.reload} />}
      {!overview.data && overview.loading && !overview.error && (
        <div className="mb-6 grid gap-4 lg:grid-cols-2"><Skeleton className="h-56" /><Skeleton className="h-56" /></div>
      )}

      {settings && (
        <>
          <RateNotice settings={settings} />
          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <CurrentRate settings={settings} who={who} />
            <PendingRate settings={settings} pending={pending} me={me} busy={decide.pending} who={who} onDecide={startDecision} />
          </div>
          <FxProposalForm
            key={`${settings.changeId ?? "defaults"}:${formRound}`}
            settings={settings}
            blocked={pending ? `A change proposed by ${who(pending.proposedBy)} is waiting. Approve or reject it first.` : null}
            onProposed={() => {
              toast.push("Proposed. It waits for a second person to approve it.");
              setFormRound((n) => n + 1);
              void overview.reload();
              void log.reload();
            }}
          />
        </>
      )}

      <ConsoleTable<FxChange>
        title="Change log"
        description={`Every proposal, newest first${log.data && log.data.length >= LOG_LIMIT ? ` (the latest ${LOG_LIMIT})` : ""}. "What changed" compares each with the proposal before it.`}
        what="the change log"
        source={log}
        rowId={(c) => c.id}
        emptyLabel="No rate has been proposed yet"
        columns={[
          { key: "when", header: "When", className: "whitespace-nowrap", render: (c) => <span className="tabular text-xs text-text-soft">{dateTime(c.proposedAt)}</span> },
          { key: "who", header: "Proposed by", render: (c) => <span className="text-text">{who(c.proposedBy)}</span> },
          { key: "what", header: "What changed", className: "min-w-[220px]", render: (c) => {
            // By id: the table hands each row a copy, so the same object is not in the list.
            const i = changes.findIndex((x) => x.id === c.id);
            const before = i >= 0 && i + 1 < changes.length ? changes[i + 1] : null;
            return <ul className="space-y-0.5 text-[13px] text-text">{describeChange(before, c).map((l) => <li key={l}>{l}</li>)}</ul>;
          } },
          { key: "decision", header: "Decision", className: "whitespace-nowrap", render: (c) => (
            <div>
              <StatusBadge status={c.status} />
              {c.decidedBy && <div className="mt-1 text-xs text-text-faint">{who(c.decidedBy)} · {dateTime(c.decidedAt)}</div>}
            </div>
          ) },
          { key: "notes", header: "Notes", className: "min-w-[180px]", hideOnMobile: true, render: (c) => (
            <div className="space-y-1 text-xs text-text-soft">
              {c.note && <div><span className="text-text-faint">Proposal: </span>{c.note}</div>}
              {c.decisionNote && <div><span className="text-text-faint">Decision: </span>{c.decisionNote}</div>}
              {!c.note && !c.decisionNote && <span className="text-text-faint">—</span>}
            </div>
          ) },
        ]}
      />

      <ConsoleTable<FxBookEntry>
        title="Conversions"
        description="Customers' quotes and conversions, newest first."
        what="the conversions"
        source={{ data: book.data?.items ?? null, loading: book.loading, error: book.error, reload: book.reload }}
        rowId={(e) => e.quote.id}
        emptyLabel={bookStatus ? "No conversions with this status" : "No customer has asked for a rate yet"}
        actions={
          <Select aria-label="Status" value={bookStatus} onChange={(e) => { setBookStatus(e.target.value); setBookPage(1); }}>
            {BOOK_STATUSES.map((s) => <option key={s} value={s}>{s ? s.charAt(0) + s.slice(1).toLowerCase() : "All statuses"}</option>)}
          </Select>
        }
        columns={[
          { key: "when", header: "When", className: "whitespace-nowrap", render: (e) => <span className="tabular text-xs text-text-soft">{dateTime(e.quote.createdAt)}</span> },
          { key: "what", header: "Conversion", className: "whitespace-nowrap", render: (e) => (
            <span className="tabular text-text">{amount(e.quote.sellAmount, e.quote.from)} → {amount(e.quote.buyAmount, e.quote.to)}</span>
          ) },
          { key: "rate", header: "Rate", className: "tabular text-right whitespace-nowrap", render: (e) => rate(e.quote.rate) },
          { key: "status", header: "Status", render: (e) => (
            <div>
              <StatusBadge status={e.quote.status} />
              {e.quote.failureReason && <div className="mt-1 max-w-[240px] text-xs text-danger">{e.quote.failureReason}</div>}
            </div>
          ) },
          { key: "ref", header: "Reference", hideOnMobile: true, render: (e) => <span className="tabular text-xs text-text-soft">{e.quote.reference ?? shortId(e.quote.id)}</span> },
          { key: "customer", header: "Investor", hideOnMobile: true, render: (e) => <span className="tabular text-xs text-text-soft">{e.investorId ? shortId(e.investorId) : shortId(e.profileId)}</span> },
        ]}
      />
      {book.data && book.data.pages > 1 && (
        <div className="-mt-3 mb-6 flex items-center justify-end gap-2 text-sm text-text-soft">
          <Button size="sm" variant="outline" disabled={bookPage <= 1 || book.loading} onClick={() => setBookPage((p) => p - 1)}>Newer</Button>
          <span className="tabular">Page {book.data.page} of {book.data.pages}</span>
          <Button size="sm" variant="outline" disabled={bookPage >= book.data.pages || book.loading} onClick={() => setBookPage((p) => p + 1)}>Older</Button>
        </div>
      )}

      {decision && (
        <ActionModal
          title={DECISION[decision.kind].title}
          description={DECISION[decision.kind].body}
          submitLabel={DECISION[decision.kind].submit}
          pendingLabel={DECISION[decision.kind].pending}
          tone={decision.kind === "reject" ? "danger" : "primary"}
          pending={decide.pending}
          error={decide.error}
          onSubmit={() => void submitDecision()}
          onClose={() => setDecision(null)}
          size="sm"
        >
          <Field label="Note" hint={`Optional. Kept with the decision in the log. ${note.length}/${NOTE_MAX}`}>
            <Textarea rows={3} value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </ActionModal>
      )}
    </div>
  );
}

/** Says when customers cannot convert, or soon will not be able to. */
function RateNotice({ settings }: { settings: FxSettings }) {
  const state = rateState(settings);
  if (settings.suspended) {
    return <NotePanel tone="danger" className="mb-5" title="Conversion is paused">Customers are told conversion is paused and are given no quote.</NotePanel>;
  }
  if (state === "none") {
    return <NotePanel tone="danger" className="mb-5" title="No rate is set">Customers cannot convert until a rate is proposed and approved.</NotePanel>;
  }
  if (state === "expired") {
    return <NotePanel tone="danger" className="mb-5" title="The rate has run out">It ran out on {dateTime(settings.rateValidUntil)}. Customers cannot convert until a new rate is approved.</NotePanel>;
  }
  if (state === "expiring") {
    return <NotePanel tone="warning" className="mb-5" title="The rate runs out soon">It is good until {dateTime(settings.rateValidUntil)}. Propose the next one in time for a second person to approve it.</NotePanel>;
  }
  return null;
}

function RateFacts({ values, base, quote }: { values: Pick<FxSettings, "midRate" | "rateValidUntil" | "marginPct" | "marginFloorPct" | "quoteTtlSeconds" | "minAmount" | "perConversion" | "perDay" | "suspended">; base: string; quote: string }) {
  const r = values.midRate === null ? null : ratesOf(values.midRate, values.marginPct);
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      <DetailItem term={`Mid rate (${quote} per ${base})`}><span className="tabular">{rate(values.midRate)}</span></DetailItem>
      <DetailItem term="Good until">{values.rateValidUntil ? dateTime(values.rateValidUntil) : "—"}</DetailItem>
      <DetailItem term={`Customers buying ${base} pay`}><span className="tabular">{r ? `${quote} ${rate(r.buy)}` : "—"}</span></DetailItem>
      <DetailItem term={`Customers selling ${base} get`}><span className="tabular">{r ? `${quote} ${rate(r.sell)}` : "—"}</span></DetailItem>
      <DetailItem term="Margin">{values.marginPct}% <span className="text-xs text-text-faint">(floor {values.marginFloorPct}%)</span></DetailItem>
      <DetailItem term="A quote holds">{values.quoteTtlSeconds} seconds</DetailItem>
      <DetailItem term="Minimum">{amount(values.minAmount, quote)}</DetailItem>
      <DetailItem term="Per conversion / per day">{amount(values.perConversion, quote)} / {amount(values.perDay, quote)}</DetailItem>
      <DetailItem term="Conversion">{values.suspended ? <Badge tone="danger">Paused</Badge> : <Badge tone="success">Open</Badge>}</DetailItem>
    </dl>
  );
}

function CurrentRate({ settings, who }: { settings: FxSettings; who: (s: string | null | undefined) => string }) {
  let source: string;
  if (settings.source === "defaults") source = "Set by defaults: no change has been approved yet.";
  else if (settings.decidedBy) source = `Approved by ${who(settings.decidedBy)} on ${dateTime(settings.since)}.`;
  else source = `Approved change ${shortId(settings.changeId)}, in force since ${dateTime(settings.since)}.`;
  return (
    <GlassPanel className="p-5" data-testid="fx-current">
      <SectionTitle title="In force now" description="What customers' quotes are priced by." />
      <RateFacts values={settings} base={settings.base} quote={settings.quote} />
      <div className="mt-4 border-t border-border pt-3 text-[12.5px] text-text-soft">
        <p>{source}{settings.rateSource ? ` Source: ${settings.rateSource.replace(/_/g, " ").toLowerCase()}.` : ""}</p>
        {settings.source !== "defaults" && settings.decisionNote && (
          <p className="mt-1"><span className="text-text-faint">Approval note: </span>{settings.decisionNote}</p>
        )}
      </div>
    </GlassPanel>
  );
}

function PendingRate({ settings, pending, me, busy, who, onDecide }: {
  settings: FxSettings;
  pending: FxChange | null;
  me: string;
  busy: boolean;
  who: (s: string | null | undefined) => string;
  onDecide: (d: Decision) => void;
}) {
  if (!pending) {
    return (
      <GlassPanel className="p-5" data-testid="fx-pending">
        <SectionTitle title="Waiting for approval" />
        <p className="text-sm text-text-soft">Nothing is waiting. A rate proposed below waits here until a second person approves it.</p>
      </GlassPanel>
    );
  }
  const mine = pending.proposedBy === me;
  return (
    <GlassPanel className="p-5" data-testid="fx-pending">
      <SectionTitle title="Waiting for approval" description={`Proposed by ${who(pending.proposedBy)} on ${dateTime(pending.proposedAt)}.`} />
      <ul className="mb-4 space-y-0.5 text-sm font-medium text-text">
        {describeChange(settings, pending).map((line) => <li key={line}>{line}</li>)}
      </ul>
      <RateFacts values={pending} base={settings.base} quote={settings.quote} />
      {pending.note && <NotePanel className="mt-4" title="Note">{pending.note}</NotePanel>}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {mine ? (
          <span className="mr-auto text-[12.5px] text-text-soft" data-testid="second-person">
            Waiting for a second person: you proposed this, so someone else approves it.
          </span>
        ) : (
          <Button size="sm" disabled={busy} onClick={() => onDecide({ kind: "approve", change: pending })}>Approve</Button>
        )}
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onDecide({ kind: "reject", change: pending })}>Reject</Button>
      </div>
    </GlassPanel>
  );
}
