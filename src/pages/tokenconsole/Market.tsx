import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Badge, Button, Field, GlassPanel, NotePanel, PageHeader, SectionTitle, Skeleton, Textarea, useToast } from "../../ui";
import { useAuth } from "../../lib/auth";
import { useAsyncData } from "../../lib/useAsyncData";
import { useAction } from "../../lib/tokenConsole/useAction";
import { dateTime, shortId } from "../../lib/tokenConsole/format";
import { omniApi, omniSubjectFor, staffName, type MarketChange, type MarketSettings } from "../../lib/omniApi";
import { baselineOf, describeDifferences, hhmm, valuesOf, type MarketValues } from "../../lib/tokenConsole/market";
import { useOfferingNames } from "../../lib/tokenConsole/offeringNames";
import { ConsoleTable, SourceError, StatusBadge } from "../../components/tokenconsole/ConsoleTable";
import { DetailItem } from "../../components/tokenconsole/DetailItem";
import { ActionModal } from "../../components/tokenconsole/ActionModal";
import { MarketProposalForm } from "../../components/tokenconsole/MarketProposalForm";

/* The dealing hours, weekends, the market halt and the per-bond halts, under
   dual control (BRD FR-ADM-01), from omnichannel. One person proposes the
   setting as it should be; a different person approves it, and only then do
   the quotes and the order check follow it. One proposal waits at a time and
   every proposal stays in the log. Omnichannel enforces both rules; this page
   only avoids offering an Approve that is certain to be refused. */

const LOG_LIMIT = 50;
const NOTE_MAX = 300;

type Decision = { kind: "approve" | "reject"; change: MarketChange };

const DECISION = {
  approve: {
    title: "Approve this change?",
    body: "From now on the quotes and the order check follow it, for every customer.",
    submit: "Approve",
    pending: "Approving…",
    done: "Approved. Dealing now follows the new setting.",
  },
  reject: {
    title: "Reject this change?",
    body: "Nothing changes; the proposal stays in the log as rejected.",
    submit: "Reject",
    pending: "Rejecting…",
    done: "Rejected. The setting is unchanged.",
  },
} as const;

export default function TokenConsoleMarket() {
  const { user } = useAuth();
  const toast = useToast();
  const me = omniSubjectFor(user?.email);
  const overview = useAsyncData(omniApi.marketSettings);
  const log = useAsyncData(() => omniApi.marketChanges(LOG_LIMIT));
  const names = useOfferingNames();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  // Bumped after a proposal, so the form starts again from the setting in force.
  const [formRound, setFormRound] = useState(0);
  const decide = useAction((d: Decision, text?: string) =>
    d.kind === "approve" ? omniApi.approveMarketChange(d.change.id, text) : omniApi.rejectMarketChange(d.change.id, text));

  const reloadAll = () => {
    void overview.reload();
    void log.reload();
  };

  const who = (subject: string | null | undefined) => (subject && subject === me ? `You (${staffName(subject)})` : staffName(subject));

  const settings = overview.data?.settings ?? null;
  const pending = overview.data?.pending ?? null;
  const changes = log.data ?? [];
  const defaults: MarketValues | null = settings?.source === "defaults" ? valuesOf(settings) : null;
  const complete = !!log.data && log.data.length < LOG_LIMIT;

  const startDecision = (d: Decision) => {
    decide.reset();
    setNote("");
    setDecision(d);
  };
  const submitDecision = async () => {
    if (!decision || decide.pending) return;
    const done = await decide.run(decision, note.trim() || undefined);
    // Refused or not, the change may have moved on (someone else decided it).
    reloadAll();
    if (!done) return; // the service's message is on the dialog
    toast.push(DECISION[decision.kind].done);
    setDecision(null);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Baracel Unyt"
        title="Market"
        subtitle="Dealing hours, weekends and halts. A change takes effect only when someone other than the person who proposed it approves it."
        actions={
          <Button size="sm" variant="outline" disabled={overview.loading || log.loading} onClick={reloadAll}>
            <RefreshCw size={14} className={overview.loading ? "animate-spin" : undefined} /> {overview.loading ? "Loading…" : "Refresh"}
          </Button>
        }
      />

      {overview.error && <SourceError what="the market settings" error={overview.error} onRetry={overview.reload} />}
      {!overview.data && overview.loading && !overview.error && (
        <div className="mb-6 grid gap-4 lg:grid-cols-2"><Skeleton className="h-56" /><Skeleton className="h-56" /></div>
      )}

      {settings && (
        <>
          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <CurrentSetting settings={settings} log={changes} logLoaded={!!log.data} nameOf={names.nameOf} who={who} />
            <PendingChange
              settings={settings}
              pending={pending}
              me={me}
              busy={decide.pending}
              nameOf={names.nameOf}
              who={who}
              onDecide={startDecision}
            />
          </div>

          <MarketProposalForm
            // A new setting in force (approved, or new defaults) starts the form again from it.
            key={`${JSON.stringify(valuesOf(settings))}:${formRound}`}
            settings={settings}
            offerings={names.options}
            offeringsLoading={names.loading}
            offeringsError={names.error}
            blocked={pending ? `A change proposed by ${who(pending.proposedBy)} is waiting. Approve or reject it first.` : null}
            onProposed={() => {
              toast.push("Proposed. It waits for a second person to approve it.");
              setFormRound((n) => n + 1);
              reloadAll();
            }}
          />
        </>
      )}

      <ConsoleTable<MarketChange>
        title="Change log"
        description={`Every proposal, newest first${log.data && !complete ? ` (the latest ${LOG_LIMIT})` : ""}. "What changed" compares each with the setting in force when it was proposed.`}
        what="the change log"
        source={log}
        rowId={(c) => c.id}
        emptyLabel="No change has been proposed yet"
        columns={[
          { key: "when", header: "When", className: "whitespace-nowrap", render: (c) => <span className="tabular text-xs text-text-soft">{dateTime(c.proposedAt)}</span> },
          { key: "who", header: "Proposed by", render: (c) => <span className="text-text">{who(c.proposedBy)}</span> },
          { key: "what", header: "What changed", className: "min-w-[220px]", render: (c) => {
            const before = baselineOf(c, changes, defaults, complete);
            return (
              <ul className="space-y-0.5 text-[13px] text-text">
                {!before && <li className="text-xs text-text-faint">The setting it proposed:</li>}
                {describeDifferences(before, valuesOf(c), names.nameOf).map((line) => <li key={line}>{line}</li>)}
              </ul>
            );
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

function HaltedBonds({ ids, nameOf }: { ids: string[]; nameOf: (id: string) => string }) {
  if (ids.length === 0) return <span className="text-text-soft">None</span>;
  return (
    <ul className="space-y-0.5">
      {ids.map((id) => (
        <li key={id}>
          {nameOf(id)}
          {nameOf(id) !== id && <span className="ml-1.5 tabular text-xs text-text-faint">{id}</span>}
        </li>
      ))}
    </ul>
  );
}

function SettingFacts({ values, zone, nameOf }: { values: MarketValues; zone: string; nameOf: (id: string) => string }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      <DetailItem term="Dealing hours"><span className="tabular">{hhmm(values.tradingOpen)}–{hhmm(values.tradingClose)}</span> <span className="text-xs text-text-faint">{zone}</span></DetailItem>
      <DetailItem term="Weekends">{values.weekendsOpen ? "Open" : "Closed"}</DetailItem>
      <DetailItem term="Whole market">
        {values.halted ? <Badge tone="danger">Halted</Badge> : <Badge tone="success">Not halted</Badge>}
      </DetailItem>
      <DetailItem term="Bonds halted on their own"><HaltedBonds ids={values.haltedOfferings} nameOf={nameOf} /></DetailItem>
    </dl>
  );
}

function CurrentSetting({ settings, log, logLoaded, nameOf, who }: {
  settings: MarketSettings;
  log: MarketChange[];
  logLoaded: boolean;
  nameOf: (id: string) => string;
  who: (subject: string | null | undefined) => string;
}) {
  // The setting does not say who approved it; the change it came from does.
  const approved = settings.changeId ? log.find((c) => c.id === settings.changeId) : undefined;
  let source: string;
  if (settings.source === "defaults") source = "Set by defaults: no change has been approved yet.";
  else if (approved?.decidedBy) source = `Approved by ${who(approved.decidedBy)} on ${dateTime(approved.decidedAt)}.`;
  else if (!logLoaded) source = `In force since ${dateTime(settings.since)}.`;
  else source = `Approved change ${shortId(settings.changeId)}, in force since ${dateTime(settings.since)}.`;

  return (
    <GlassPanel className="p-5" data-testid="market-current">
      <SectionTitle title="In force now" description="What the quotes and the order check follow." />
      <SettingFacts values={valuesOf(settings)} zone={settings.zone} nameOf={nameOf} />
      <p className="mt-4 border-t border-border pt-3 text-[12.5px] text-text-soft">{source}</p>
    </GlassPanel>
  );
}

function PendingChange({ settings, pending, me, busy, nameOf, who, onDecide }: {
  settings: MarketSettings;
  pending: MarketChange | null;
  me: string;
  busy: boolean;
  nameOf: (id: string) => string;
  who: (subject: string | null | undefined) => string;
  onDecide: (d: Decision) => void;
}) {
  if (!pending) {
    return (
      <GlassPanel className="p-5" data-testid="market-pending">
        <SectionTitle title="Waiting for approval" />
        <p className="text-sm text-text-soft">Nothing is waiting. A change proposed below waits here until a second person approves it.</p>
      </GlassPanel>
    );
  }
  const mine = pending.proposedBy === me;
  return (
    <GlassPanel className="p-5" data-testid="market-pending">
      <SectionTitle title="Waiting for approval" description={`Proposed by ${who(pending.proposedBy)} on ${dateTime(pending.proposedAt)}.`} />
      <ul className="mb-4 space-y-0.5 text-sm font-medium text-text">
        {describeDifferences(valuesOf(settings), valuesOf(pending), nameOf).map((line) => <li key={line}>{line}</li>)}
      </ul>
      <SettingFacts values={valuesOf(pending)} zone={settings.zone} nameOf={nameOf} />
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
