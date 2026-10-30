import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, Play, RefreshCw, UserCheck } from "lucide-react";
import { Badge, Button, Field, Input, Modal, NotePanel, PageHeader, Tabs, Textarea, useToast } from "../../ui";
import { useAuth } from "../../lib/auth";
import { useAsyncData } from "../../lib/useAsyncData";
import { useAction } from "../../lib/tokenConsole/useAction";
import { calendarDate, dateTime, label, shortId } from "../../lib/tokenConsole/format";
import { omniApi, omniSubjectFor, staffName, type AlertStatus, type ReportingRun, type SurveillanceAlert } from "../../lib/omniApi";
import {
  ALERT_STATUS_TONE, CLOSE_NOTE_MAX, RULE_HINT, RULE_LABEL, RUN_KIND_LABEL, SEVERITY_TONE, reachable, reportingToday,
} from "../../lib/tokenConsole/reporting";
import { ConsoleTable, StatusBadge } from "../../components/tokenconsole/ConsoleTable";
import { DetailItem } from "../../components/tokenconsole/DetailItem";
import { ActionModal } from "../../components/tokenconsole/ActionModal";
import { ReportingUnavailable } from "../../components/tokenconsole/ReportingUnavailable";

/* Market surveillance (BRD FR-ADM-02), from the reporting service through
   omnichannel. Three rules run over each day at 23:59 Nairobi (cap structuring,
   abnormal volume, wash trading) and raise an alert once per customer, rule and
   day. Staff take an alert, look into it and close it with what they found;
   every view and decision is audited. The runs below are the end-of-day job's
   log, with the same two steps by hand for catching up a missed day. */

const ALERT_LIMIT = 200;
const RUN_LIMIT = 50;

type Filter = AlertStatus | "ALL";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "OPEN", label: "Open" },
  { key: "ASSIGNED", label: "Assigned" },
  { key: "CLOSED", label: "Closed" },
  { key: "ALL", label: "All" },
];
const EMPTY: Record<Filter, string> = {
  OPEN: "No open alerts",
  ASSIGNED: "No alert is assigned",
  CLOSED: "No alert has been closed yet",
  ALL: "No alert has been raised yet",
};

type ManualRun = "snapshot" | "rules";
const MANUAL: Record<ManualRun, { title: string; body: string; field: string; submit: string; pending: string }> = {
  snapshot: {
    title: "Take a holdings snapshot",
    body: "Records every investor's holdings at the end of the day, priced at each offering's price. Taking it again replaces that day's snapshot.",
    field: "As of the end of",
    submit: "Take snapshot",
    pending: "Taking…",
  },
  rules: {
    title: "Run the surveillance rules",
    body: "Checks the day for cap structuring, abnormal volume and wash trading. An alert already raised for the day is not raised again.",
    field: "Day",
    submit: "Run rules",
    pending: "Running…",
  },
};

export default function TokenConsoleSurveillance() {
  const { user } = useAuth();
  const toast = useToast();
  const me = omniSubjectFor(user?.email);
  const [filter, setFilter] = useState<Filter>("OPEN");
  const alerts = useAsyncData(() => reachable(omniApi.alerts(filter === "ALL" ? undefined : filter, ALERT_LIMIT)));
  const runs = useAsyncData(() => reachable(omniApi.reportingRuns(RUN_LIMIT)));
  // The alert open in the panel, kept as the service last returned it: once
  // assigned or closed it may leave the filtered queue, and the panel stays.
  const [selected, setSelected] = useState<SurveillanceAlert | null>(null);
  const [manual, setManual] = useState<ManualRun | null>(null);

  // A new filter reads the queue again (the first read is the hook's own).
  const first = useRef(true);
  const reloadAlerts = alerts.reload;
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    void reloadAlerts();
  }, [filter, reloadAlerts]);

  const unavailable = alerts.data?.unavailable ?? runs.data?.unavailable ?? null;
  const list = alerts.data?.data ?? null;
  const who = (subject: string | null | undefined) => (subject && subject === me ? `You (${staffName(subject)})` : staffName(subject));
  const reloadAll = () => {
    void alerts.reload();
    void runs.reload();
  };

  return (
    <div>
      <PageHeader
        eyebrow="Baracel Unyt"
        title="Surveillance"
        subtitle="Alerts the end-of-day rules raised on customers' payments and orders. Take one, look into it, and close it with what you found."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={!!unavailable} onClick={() => setManual("snapshot")}>
              <Camera size={14} /> Snapshot now
            </Button>
            <Button size="sm" variant="outline" disabled={!!unavailable} onClick={() => setManual("rules")}>
              <Play size={14} /> Run rules now
            </Button>
            <Button size="sm" variant="outline" disabled={alerts.loading || runs.loading} onClick={reloadAll}>
              <RefreshCw size={14} className={alerts.loading ? "animate-spin" : undefined} /> {alerts.loading ? "Loading…" : "Refresh"}
            </Button>
          </div>
        }
      />

      {unavailable && <ReportingUnavailable reason={unavailable} onRetry={reloadAll} />}

      {!unavailable && (
        <>
          <ConsoleTable<SurveillanceAlert>
            title="Alert queue"
            description={list && list.length >= ALERT_LIMIT ? `The latest ${ALERT_LIMIT}, newest first.` : "Newest first. Open an alert to see what tripped it."}
            actions={<Tabs tabs={FILTERS} active={filter} onChange={(k) => setFilter(k as Filter)} />}
            what="the alert queue"
            source={{ data: list, loading: alerts.loading, error: alerts.error, reload: alerts.reload }}
            rowId={(a) => a.id}
            onRowClick={(a) => setSelected(list?.find((x) => x.id === a.id) ?? null)}
            selectedId={selected?.id ?? null}
            emptyLabel={EMPTY[filter]}
            columns={[
              { key: "raised", header: "Raised", className: "whitespace-nowrap", render: (a) => (
                <div>
                  <div className="tabular text-xs text-text-soft">{dateTime(a.created_at)}</div>
                  <div className="mt-0.5 text-xs text-text-faint">For {calendarDate(a.period_date)}</div>
                </div>
              ) },
              { key: "rule", header: "Rule", className: "whitespace-nowrap", render: (a) => (
                <div>
                  <div className="font-medium text-text">{RULE_LABEL[a.rule] ?? label(a.rule)}</div>
                  <Badge tone={SEVERITY_TONE[a.severity] ?? "neutral"} className="mt-1">{label(a.severity)}</Badge>
                </div>
              ) },
              { key: "summary", header: "What happened", className: "min-w-[260px]", render: (a) => <span className="text-[13px] text-text">{a.summary}</span> },
              { key: "customer", header: "Customer", hideOnMobile: true, render: (a) => <span className="tabular text-xs text-text-soft">{shortId(a.subject_id)}</span> },
              { key: "status", header: "Status", className: "whitespace-nowrap", render: (a) => (
                <div>
                  <Badge tone={ALERT_STATUS_TONE[a.status] ?? "neutral"}>{label(a.status)}</Badge>
                  {a.status === "ASSIGNED" && <div className="mt-1 text-xs text-text-faint">{who(a.assigned_to)}</div>}
                  {a.status === "CLOSED" && <div className="mt-1 text-xs text-text-faint">{who(a.closed_by)}</div>}
                </div>
              ) },
            ]}
          />

          <ConsoleTable<ReportingRun>
            title="Runs"
            description="Snapshots, rule runs and report downloads, newest first. The end-of-day job takes the snapshot and runs the rules each night at 23:59 Nairobi."
            what="the runs"
            source={{ data: runs.data?.data ?? null, loading: runs.loading, error: runs.error, reload: runs.reload }}
            rowId={(r) => r.id}
            emptyLabel="Nothing has run yet"
            columns={[
              { key: "started", header: "Started", className: "whitespace-nowrap", render: (r) => <span className="tabular text-xs text-text-soft">{dateTime(r.started_at)}</span> },
              { key: "kind", header: "Run", className: "whitespace-nowrap", render: (r) => <span className="text-text">{RUN_KIND_LABEL[r.kind] ?? label(r.kind)}</span> },
              { key: "subject", header: "Of", render: (r) => <span className="tabular text-xs text-text-soft break-all">{r.subject ?? "—"}</span> },
              { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
              { key: "detail", header: "Result", hideOnMobile: true, className: "min-w-[180px]", render: (r) => (
                <span className={r.status === "FAILED" ? "text-xs text-danger" : "text-xs text-text-soft"}>{r.detail ?? "—"}</span>
              ) },
            ]}
          />
        </>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? RULE_LABEL[selected.rule] ?? label(selected.rule) : "Alert"} size="lg">
        {/* Keyed so one alert's note and error never carry to the next. */}
        {selected && (
          <AlertPanel
            key={selected.id}
            alert={selected}
            me={me}
            who={who}
            onChanged={(updated, message) => {
              if (message) toast.push(message);
              // Only into the panel still showing that alert, never reopening a closed one.
              const show = (fresh: SurveillanceAlert) => setSelected((cur) => (cur && cur.id === fresh.id ? fresh : cur));
              if (updated) show(updated);
              // Refused (say someone else closed it first): show where it stands now.
              else void omniApi.alert(selected.id).then(show, () => undefined);
              void alerts.reload();
            }}
          />
        )}
      </Modal>

      {manual && (
        <ManualRunModal
          kind={manual}
          onClose={() => setManual(null)}
          onDone={(message) => {
            toast.push(message);
            setManual(null);
            reloadAll();
          }}
        />
      )}
    </div>
  );
}

function AlertPanel({ alert, me, who, onChanged }: {
  alert: SurveillanceAlert;
  me: string;
  who: (s: string | null | undefined) => string;
  /** The alert moved (`updated`), or a refusal means it may have; the queue is read again. */
  onChanged: (updated: SurveillanceAlert | undefined, message?: string) => void;
}) {
  const customer = useAsyncData(() => omniApi.customer(alert.subject_id));
  const [closing, setClosing] = useState(false);
  const [note, setNote] = useState("");
  const assign = useAction(() => omniApi.assignAlert(alert.id));
  const close = useAction((text?: string) => omniApi.closeAlert(alert.id, text));

  const closed = alert.status === "CLOSED";
  const mine = alert.assigned_to === me;
  const name = customer.data ? customer.data.legalName ?? customer.data.displayName : null;

  const takeIt = async () => {
    const done = await assign.run();
    onChanged(done, done ? "Assigned to you." : undefined);
  };
  const submitClose = async () => {
    if (close.pending) return;
    const done = await close.run(note.trim() || undefined);
    onChanged(done, done ? "Alert closed." : undefined);
    if (done) setClosing(false);
  };

  return (
    <div data-testid="alert-panel">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={SEVERITY_TONE[alert.severity] ?? "neutral"}>{label(alert.severity)} severity</Badge>
        <Badge tone={ALERT_STATUS_TONE[alert.status] ?? "neutral"}>{label(alert.status)}</Badge>
      </div>
      <p className="mb-1 text-[15px] font-medium text-text">{alert.summary}</p>
      <p className="mb-4 text-[12.5px] text-text-soft">{RULE_HINT[alert.rule] ?? "Raised by a surveillance rule."}</p>

      {alert.details && <NotePanel className="mb-4" title="What tripped it">{alert.details}</NotePanel>}

      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <DetailItem term="Customer">
          {customer.loading ? (
            <span className="text-text-faint">Loading…</span>
          ) : (
            <>
              <Link className="font-medium text-primary-600 hover:text-primary-700" to={`/token-console/customers?id=${encodeURIComponent(alert.subject_id)}`}>
                {name ?? `Profile ${shortId(alert.subject_id)}`}
              </Link>
              {customer.error && <div className="mt-0.5 text-xs text-text-faint">The name could not be read: {customer.error}</div>}
            </>
          )}
        </DetailItem>
        <DetailItem term="Profile id"><span className="tabular text-xs break-all">{alert.subject_id}</span></DetailItem>
        <DetailItem term="Day checked">{calendarDate(alert.period_date)}</DetailItem>
        <DetailItem term="Raised">{dateTime(alert.created_at)}</DetailItem>
        {alert.offering_id && <DetailItem term="Offering"><span className="tabular">{alert.offering_id}</span></DetailItem>}
        <DetailItem term="Assigned to">{alert.assigned_to ? who(alert.assigned_to) : "Nobody yet"}</DetailItem>
        {closed && <DetailItem term="Closed">{who(alert.closed_by)} · {dateTime(alert.closed_at)}</DetailItem>}
      </dl>

      {closed && alert.close_note && <NotePanel className="mt-4" title="What was found">{alert.close_note}</NotePanel>}

      {!closed && (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {!mine && (
            <Button size="sm" variant={alert.assigned_to ? "outline" : "primary"} disabled={assign.pending || close.pending} onClick={() => void takeIt()}>
              <UserCheck size={14} /> {assign.pending ? "Assigning…" : alert.assigned_to ? "Take it over" : "Assign to me"}
            </Button>
          )}
          <Button size="sm" variant={mine ? "primary" : "outline"} disabled={assign.pending || close.pending} onClick={() => { close.reset(); setClosing(true); }}>
            Close with a note
          </Button>
          {mine && <span className="text-[12.5px] text-text-soft">Assigned to you.</span>}
        </div>
      )}
      {assign.error && <p role="alert" className="mt-2 text-[12.5px] text-danger">{assign.error}</p>}

      {closing && (
        <ActionModal
          title="Close this alert?"
          description="It leaves the queue and stays in the suspicious-activity report with your note."
          submitLabel="Close alert"
          pendingLabel="Closing…"
          pending={close.pending}
          error={close.error}
          onSubmit={() => void submitClose()}
          onClose={() => setClosing(false)}
          size="sm"
        >
          <Field label="What was found" hint={`Optional, but the report is only as good as this note. ${note.length}/${CLOSE_NOTE_MAX}`}>
            <Textarea rows={4} value={note} maxLength={CLOSE_NOTE_MAX} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </ActionModal>
      )}
    </div>
  );
}

function ManualRunModal({ kind, onClose, onDone }: { kind: ManualRun; onClose: () => void; onDone: (message: string) => void }) {
  const today = reportingToday();
  const [day, setDay] = useState(today);
  const copy = MANUAL[kind];
  const act = useAction(async (d: string) => {
    if (kind === "snapshot") {
      const r = await omniApi.runSnapshot(d);
      return `Snapshot for ${r.asOf} taken: ${r.rows} ${r.rows === 1 ? "holding" : "holdings"}.`;
    }
    const r = await omniApi.runSurveillance(d);
    return `Rules run over ${r.day}: ${r.newAlerts === 0 ? "no new alerts" : `${r.newAlerts} new ${r.newAlerts === 1 ? "alert" : "alerts"}`}.`;
  });
  const problem = !day ? "Pick the day." : day > today ? "Pick today or an earlier day." : undefined;

  const submit = async () => {
    if (problem || act.pending) return;
    const message = await act.run(day);
    if (message) onDone(message);
  };

  return (
    <ActionModal
      title={copy.title}
      description={copy.body}
      submitLabel={copy.submit}
      pendingLabel={copy.pending}
      problem={problem}
      pending={act.pending}
      error={act.error}
      onSubmit={() => void submit()}
      onClose={onClose}
      size="sm"
    >
      <Field label={copy.field}>
        <Input type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} />
      </Field>
    </ActionModal>
  );
}
