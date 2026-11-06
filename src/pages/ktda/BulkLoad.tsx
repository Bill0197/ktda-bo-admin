import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Download, FileUp, Info, Play, XCircle } from "lucide-react";
import { Badge, Button, Field, GlassPanel, NotePanel, PageHeader, ProgressBar, SectionTitle, Skeleton, StatCard } from "../../ui";
import { useAsyncData } from "../../lib/useAsyncData";
import { useAction } from "../../lib/tokenConsole/useAction";
import { dateTime, money, units } from "../../lib/tokenConsole/format";
import { tokenConsole } from "../../lib/api.tokenConsole";
import {
  BULK_COLUMNS, MAX_PAYMENT_KES, bulkLoads, summariseCsv,
  type BulkFlow, type BulkReconciliation, type BulkRun, type FileSummary,
} from "../../lib/api.bulkLoad";
import { ConsoleTable, SourceError, StatusBadge } from "../../components/tokenconsole/ConsoleTable";
import { JOURNEY, NOT_AVAILABLE, OPENED_BY, SAMPLE_FILES, stepFor, templateCsv, templateName } from "../../lib/journeyContract";

/* Bulk onboarding and bulk payment for an institution's farmers (section 1A of
   the KTDA handoff). The institution is not a choice: omnichannel scopes every
   operator call to the one this back office is configured for (the proxy sets
   it), and lists only that one. Four steps: the institution, the file, Process (upload,
   start, then a poll about once a second while RUNNING), and the result with
   the reconciliation, read once when the run ends. Payments open only once an
   onboarding run has completed for the institution; omnichannel refuses a
   payment upload before then (409) and that message is shown as it comes.

   The same page runs the farmer journey's steps (journeyContract.ts): step 1
   registers farmers (REGISTRATION), step 2 simulates their own onboarding and
   opens the wallets (ACTIVATION), step 3 is Payment runs (PAYMENT). Step 2
   opens once a registration run has completed. A flow this environment's
   omnichannel does not have yet says so; it never falls back to ONBOARDING. */

const POLL_MS = 1000;

const COPY: Record<BulkFlow, { title: string; subtitle: string; processed: string; other: { label: string; to: string } }> = {
  ONBOARDING: {
    title: "Bulk onboarding",
    subtitle: "Today's one-step onboarding: each farmer in the file gets a phone and PIN login, a profile and an empty KES wallet at once.",
    processed: "Wallets created",
    other: { label: "Farmer journey", to: "/journey" },
  },
  REGISTRATION: {
    title: "Register farmers",
    subtitle: "Step 1: upload grower numbers with basic details. This creates each farmer's record only: no wallet and no PIN.",
    processed: stepFor("REGISTRATION")!.processed,
    other: { label: "Farmer journey", to: "/journey" },
  },
  ACTIVATION: {
    title: "Farmer onboarding (simulated)",
    subtitle: "Step 2: in real life each farmer finishes onboarding in the app or on the web. This file stands in for them, and opens each farmer's KES wallet.",
    processed: stepFor("ACTIVATION")!.processed,
    other: { label: "Farmer journey", to: "/journey" },
  },
  PAYMENT: {
    title: "Bulk payments",
    subtitle: "Step 3: upload a payment file to credit farmers' wallets. Re-uploading a file is safe: each payment_ref is applied once.",
    processed: stepFor("PAYMENT")!.processed,
    other: { label: "Farmer journey", to: "/journey" },
  },
};

/** Why the page cannot name its institution, from omnichannel's list of the
 *  caller's own (one entry when scoping works). */
function institutionProblem(count: number): string | null {
  if (count === 1) return null;
  if (count === 0) return "Omnichannel did not name an institution for this back office, so no file can be loaded.";
  return `Omnichannel listed ${count} institutions instead of this back office's own, so it is not separating institutions yet. No file can be loaded until it does.`;
}

export default function BulkLoad({ flow }: { flow: BulkFlow }) {
  const copy = COPY[flow];
  const own = useAsyncData(() => bulkLoads.ownInstitution());
  // The engine's names, for an institution omnichannel has no name for yet.
  const engine = useAsyncData(() => tokenConsole.institutions());
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<FileSummary | null>(null);
  const [run, setRunState] = useState<BulkRun | null>(null);
  /** When the run was last read, for the throughput of a run still going. */
  const [seenAt, setSeenAt] = useState(0);
  const setRun = (r: BulkRun | null) => {
    setRunState(r);
    setSeenAt(Date.now());
  };
  /** Process was accepted, so the run is moving and worth polling. */
  const [started, setStarted] = useState(false);
  /** The file's total, kept with the run it was sent in. */
  const [expectedTotal, setExpectedTotal] = useState<number | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [pollTick, setPollTick] = useState(0);
  const [recon, setRecon] = useState<BulkReconciliation | null>(null);
  const [reconError, setReconError] = useState<string | null>(null);
  const [reconTick, setReconTick] = useState(0);
  const [fileInputKey, setFileInputKey] = useState(0);

  const mine = useMemo(() => own.data ?? [], [own.data]);
  const problem = own.data ? institutionProblem(mine.length) : null;
  const institutionId = !problem ? mine[0]?.id ?? "" : "";
  const nameOf = (id: string | null | undefined) =>
    (id && mine.find((i) => i.id === id)?.name) || (engine.data ?? []).find((i) => i.institutionId === id)?.name || null;

  const history = useAsyncData(() => bulkLoads.recent());
  const gate = useAsyncData(async () => (flow === "PAYMENT" && institutionId ? bulkLoads.onboardingStatus(institutionId) : null));
  const { reload: reloadGate } = gate;
  useEffect(() => {
    if (flow === "PAYMENT") void reloadGate();
  }, [flow, institutionId, reloadGate]);

  // Step 2's gate: a completed run of the step before it, from the recent runs
  // (omnichannel has no status endpoint for it; it refuses the upload anyway).
  const opener = flow === "ACTIVATION" ? OPENED_BY.ACTIVATION! : null;
  const openerDone = !!opener && (history.data ?? []).some(
    (r) => r.flow === opener && r.status === "COMPLETED" && (!institutionId || r.institutionId === institutionId),
  );
  const stepGate = opener ? { loading: history.loading && !history.data, error: history.error, open: openerDone, reload: history.reload } : null;
  const paymentsClosed = (flow === "PAYMENT" && gate.data?.onboardingCompleted !== true) || (!!stepGate && !stepGate.open);
  const busy = !!run && run.status === "RUNNING";

  // Poll while the run is moving; each answer schedules the next.
  useEffect(() => {
    if (!run || !started || run.status !== "RUNNING" || pollError) return;
    let stopped = false;
    const timer = setTimeout(async () => {
      try {
        const next = await bulkLoads.run(run.runId);
        if (!stopped) {
          setRunState(next);
          setSeenAt(Date.now());
        }
      } catch (e) {
        if (!stopped) setPollError(e instanceof Error ? e.message : "Could not read the run.");
      }
    }, POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [run, started, pollError, pollTick]);

  // Once the run ends: the reconciliation, once, and fresh history and gate.
  const finishedId = run && run.status !== "RUNNING" ? run.runId : null;
  useEffect(() => {
    if (!finishedId) return;
    let stopped = false;
    setReconError(null);
    bulkLoads.reconciliation(finishedId, flow === "PAYMENT" ? expectedTotal : null).then(
      (r) => { if (!stopped) setRecon(r); },
      (e) => { if (!stopped) setReconError(e instanceof Error ? e.message : "Could not read the reconciliation."); },
    );
    void history.reload();
    return () => {
      stopped = true;
    };
    // history.reload is stable; expectedTotal belongs to the run it was sent with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishedId, reconTick]);

  const upload = useAction(async () => {
    if (!file || !institutionId) throw new Error("Choose the file first.");
    return bulkLoads.upload(flow, institutionId, file, nameOf(institutionId));
  });
  const process = useAction((runId: string) => bulkLoads.process(runId));

  const pickFile = async (f: File | null) => {
    setFile(f);
    setSummary(null);
    upload.reset();
    if (f) setSummary(summariseCsv(flow, await f.text()));
  };

  const startProcess = async (runId: string) => {
    const r = await process.run(runId);
    if (!r) return;
    setRun(r);
    setStarted(true);
  };

  const onProcess = async () => {
    setRecon(null);
    setReconError(null);
    setPollError(null);
    setStarted(false);
    const staged = await upload.run();
    if (!staged) return;
    setRun(staged);
    setExpectedTotal(summary?.total ?? null);
    void history.reload();
    await startProcess(staged.runId);
  };

  const startAgain = () => {
    setRun(null);
    setStarted(false);
    setRecon(null);
    setReconError(null);
    setPollError(null);
    setExpectedTotal(null);
    setFile(null);
    setSummary(null);
    setFileInputKey((k) => k + 1);
    upload.reset();
    process.reset();
  };

  /** A run from the history, reopened (a page reload mid-run, say). */
  const open = (r: BulkRun) => {
    startAgain();
    setRun(r);
    setStarted(true);
  };

  const canProcess = !!institutionId && !!file && !!summary && !summary.problem && !paymentsClosed && !busy
    && !upload.pending && !process.pending;
  const myRuns = (history.data ?? []).filter((r) => r.flow === flow && (!institutionId || r.institutionId === institutionId));

  return (
    <div>
      <PageHeader
        eyebrow={flow !== "ONBOARDING" ? `Farmer journey · step ${stepFor(flow)!.n} of ${JOURNEY.length}` : "KTDA"}
        title={copy.title}
        subtitle={copy.subtitle}
        actions={
          <Link to={copy.other.to} className="text-sm font-medium text-primary-600 hover:text-primary-700">{copy.other.label} →</Link>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Step n={1} title="Institution">
          {own.error ? (
            <SourceError what="this back office's institution" error={own.error} onRetry={own.reload} className="" />
          ) : own.loading && !own.data ? (
            <Skeleton className="h-11" />
          ) : problem ? (
            <div data-testid="institution-problem"><NotePanel tone="danger">{problem}</NotePanel></div>
          ) : (
            <div data-testid="institution">
              <div className="text-[15px] font-semibold text-text">{nameOf(institutionId) ?? "Unnamed institution"}</div>
              <div className="mt-0.5 font-mono text-[11.5px] text-text-faint">{institutionId}</div>
              <p className="mt-2 text-[12.5px] text-text-soft">Set for this back office. Every run here is for this institution.</p>
            </div>
          )}
          {flow === "PAYMENT" && institutionId && <PaymentGate gate={gate} />}
          {stepGate && institutionId && <ActivationGate gate={stepGate} />}
        </Step>

        <Step n={2} title="File">
          <p className="mb-3 text-[12.5px] text-text-soft">
            A CSV with a header row: <code className="tabular text-text">{BULK_COLUMNS[flow].join(",")}</code>
            {flow === "PAYMENT" && <>. Each amount_kes under KES {MAX_PAYMENT_KES.toLocaleString()}, to 2 decimals</>}.
          </p>
          <FileHelp flow={flow} />
          <Field label="CSV file">
            <input
              key={fileInputKey}
              type="file"
              accept=".csv,text/csv"
              aria-label="CSV file"
              disabled={busy || paymentsClosed}
              onChange={(e) => void pickFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-text-soft file:mr-3 file:h-9 file:rounded-md file:border file:border-border file:bg-surface-sunken file:px-3 file:text-sm file:text-text disabled:opacity-50"
            />
          </Field>
          {file && summary && (
            <div className="mt-3 text-[12.5px]" data-testid="file-summary">
              {summary.problem ? (
                <p role="alert" className="text-danger">{summary.problem}</p>
              ) : (
                <p className="text-text-soft">
                  <span className="font-medium text-text">{file.name}</span>: {units(summary.rows)} row{summary.rows === 1 ? "" : "s"}
                  {summary.total != null && <>, total {money(summary.total, "KES")}</>}
                </p>
              )}
              {summary.warnings.map((w) => <p key={w} className="mt-1 text-warning">{w}</p>)}
            </div>
          )}
        </Step>
      </div>

      <Step n={3} title="Process" className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={!canProcess} onClick={() => void onProcess()}>
            <Play size={14} /> {upload.pending ? "Uploading…" : process.pending ? "Starting…" : busy && started ? "Processing…" : "Process"}
          </Button>
          {run && !busy && <Button variant="outline" onClick={startAgain}><FileUp size={14} /> Start another</Button>}
          {run && <span className="tabular text-xs text-text-faint">Run {run.runId}</span>}
        </div>
        {upload.error === NOT_AVAILABLE ? (
          <div data-testid="not-available" className="mt-3">
            <NotePanel tone="info" title="Not available on this environment yet">{NOT_AVAILABLE.replace(/^Not available on this environment yet: /, "")}</NotePanel>
          </div>
        ) : upload.error && <p role="alert" className="mt-3 text-[13px] text-danger">{upload.error}</p>}
        {process.error && run && (
          <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 text-[13px] text-danger">
            <span>The file was uploaded but could not be started: {process.error}</span>
            <Button size="sm" variant="outline" onClick={() => void startProcess(run.runId)}>Try again</Button>
          </div>
        )}
        {pollError && (
          <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 text-[13px] text-danger">
            <span>Lost track of the run: {pollError}</span>
            <Button size="sm" variant="outline" onClick={() => { setPollError(null); setPollTick((t) => t + 1); }}>Resume</Button>
          </div>
        )}
        {run && <Progress run={run} seenAt={seenAt} processedLabel={copy.processed} />}
      </Step>

      {run && run.status !== "RUNNING" && (
        <Step n={4} title="Result" className="mb-6">
          <Outcome run={run} />
          {reconError ? (
            <SourceError what="the reconciliation" error={reconError} onRetry={() => setReconTick((t) => t + 1)} className="mt-4" />
          ) : recon ? (
            <ReconPanel recon={recon} institutionName={recon.institutionName ?? nameOf(recon.institutionId)} />
          ) : (
            <Skeleton className="mt-4 h-32" />
          )}
        </Step>
      )}

      <ConsoleTable<BulkRun>
        title="Recent runs"
        description={`${copy.title} runs for ${nameOf(institutionId) ?? "this institution"}, newest first. Open one to see its result.`}
        what="the recent runs"
        source={history}
        rows={myRuns}
        newest={(r) => r.startedAt}
        rowId={(r) => r.runId}
        onRowClick={(r) => open(r)}
        selectedId={run?.runId ?? null}
        emptyLabel="No runs yet"
        columns={[
          { key: "when", header: "Started", className: "whitespace-nowrap", render: (r) => <span className="tabular text-xs text-text-soft">{dateTime(r.startedAt)}</span> },
          { key: "file", header: "File", render: (r) => <span className="text-[13px] text-text break-all">{r.sourceName}</span> },
          { key: "rows", header: "Rows", render: (r) => <span className="tabular text-[13px]">{units(r.totalRows)}</span> },
          { key: "done", header: "Done / skipped / failed", hideOnMobile: true, render: (r) => <span className="tabular text-xs text-text-soft">{units(r.processedCount)} / {units(r.skippedCount)} / {units(r.failureCount)}</span> },
          ...(flow === "PAYMENT"
            ? [{ key: "amount", header: "Credited", render: (r: BulkRun) => <span className="tabular text-[13px]">{money(r.totalAmount, r.currency)}</span> }]
            : []),
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
        ]}
      />
    </div>
  );
}

function Step({ n, title, className, children }: { n: number; title: string; className?: string; children: ReactNode }) {
  return (
    <GlassPanel className={`p-5 ${className ?? ""}`} data-testid={`step-${n}`}>
      <SectionTitle title={`${n}. ${title}`} />
      {children}
    </GlassPanel>
  );
}

function PaymentGate({ gate }: { gate: { data: { onboardingCompleted: boolean } | null; loading: boolean; error: string | null; reload: () => Promise<void> } }) {
  if (gate.error) return <SourceError what="whether onboarding has completed" error={gate.error} onRetry={gate.reload} className="mt-3" />;
  if (gate.loading || !gate.data) return <Skeleton className="mt-3 h-10" />;
  if (gate.data.onboardingCompleted) {
    return <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-success"><CheckCircle2 size={14} /> Onboarding has completed. Payments are open.</p>;
  }
  return (
    <NotePanel tone="warning" className="mt-3" title="Payments are closed">
      No onboarding run has completed for this institution yet, so no farmer has a wallet to credit.
      Run <Link className="font-medium text-primary-600 hover:text-primary-700" to="/journey/activate">step 2, farmer onboarding</Link> first
      (on this environment today: <Link className="font-medium text-primary-600 hover:text-primary-700" to="/bulk/onboarding">bulk onboarding</Link>).
    </NotePanel>
  );
}

function ActivationGate({ gate }: { gate: { loading: boolean; error: string | null; open: boolean; reload: () => Promise<void> } }) {
  if (gate.error) return <SourceError what="whether a registration run has completed" error={gate.error} onRetry={gate.reload} className="mt-3" />;
  if (gate.loading) return <Skeleton className="mt-3 h-10" />;
  if (gate.open) {
    return <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-success"><CheckCircle2 size={14} /> A registration run has completed. This step is open.</p>;
  }
  return (
    <NotePanel tone="warning" className="mt-3" title="Step 2 is closed">
      No registration run has completed for this institution yet, so there is no farmer to onboard.
      Run <Link className="font-medium text-primary-600 hover:text-primary-700" to="/journey/register">step 1, register farmers</Link> first.
    </NotePanel>
  );
}

/** The flow's header-only template, and the demo's matching sample file. */
function FileHelp({ flow }: { flow: BulkFlow }) {
  const sample = SAMPLE_FILES[flow];
  const link = "inline-flex items-center gap-1.5 text-[12.5px] font-medium text-primary-600 hover:text-primary-700";
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
      <a className={link} href={`data:text/csv;charset=utf-8,${encodeURIComponent(templateCsv(flow))}`} download={templateName(flow)}>
        <Download size={13} /> Download template
      </a>
      {sample && (
        <a className={link} href={`${import.meta.env.BASE_URL}${sample}`} download>
          <Info size={13} /> Sample file (five test farmers)
        </a>
      )}
    </div>
  );
}

function Progress({ run, seenAt, processedLabel }: { run: BulkRun; seenAt: number; processedLabel: string }) {
  const done = run.processedCount + run.skippedCount + run.failureCount;
  const end = run.completedAt ? Date.parse(run.completedAt) : seenAt;
  const seconds = Math.max(0, (end - Date.parse(run.startedAt)) / 1000);
  const rate = seconds >= 1 ? Math.round(done / seconds) : null;
  const pct = run.totalRows > 0 ? (done / run.totalRows) * 100 : run.status === "RUNNING" ? 0 : 100;
  const tone = run.status === "FAILED" ? "danger" : run.status === "PARTIAL" ? "warning" : "primary";
  return (
    <div className="mt-5" data-testid="run-progress">
      <div className="mb-2 flex items-center justify-between gap-3 text-[12.5px] text-text-soft">
        <span className="flex items-center gap-2"><StatusBadge status={run.status} /> {units(done)} of {units(run.totalRows)} rows</span>
        <span className="tabular">{Math.floor(pct)}%</span>
      </div>
      <ProgressBar value={pct} tone={tone} />
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Rows read" value={units(run.totalRows)} />
        <StatCard label={processedLabel} value={units(run.processedCount)} />
        <StatCard label="Skipped" value={units(run.skippedCount)} hint="Already applied" />
        <StatCard label="Failed" value={units(run.failureCount)} />
        <StatCard label="Throughput" value={rate == null ? "—" : `${units(rate)}/s`} hint={run.flow === "PAYMENT" ? money(run.totalAmount, run.currency) : undefined} />
      </div>
    </div>
  );
}

/** COMPLETED green, PARTIAL amber, FAILED red; the message always on the last two. */
function Outcome({ run }: { run: BulkRun }) {
  if (run.status === "COMPLETED") {
    return (
      <NotePanel tone="success" title="Completed">
        Every row was applied or had been already.{run.message ? ` ${run.message}` : ""}
      </NotePanel>
    );
  }
  const partial = run.status === "PARTIAL";
  return (
    <NotePanel tone={partial ? "warning" : "danger"} title={partial ? "Partly completed: some rows failed" : "Failed"}>
      <span className="whitespace-pre-wrap" data-testid="run-message">{run.message ?? "The service gave no reason."}</span>
    </NotePanel>
  );
}

function ReconPanel({ recon, institutionName }: { recon: BulkReconciliation; institutionName: string | null }) {
  const payment = recon.flow === "PAYMENT";
  return (
    <div className="mt-4 rounded-[var(--radius-lg)] border border-border p-4" data-testid="recon-panel">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text">Reconciliation</h3>
        <div className="flex flex-wrap gap-2">
          <Check ok={recon.doubleEntryBalanced} yes="Double entry balanced" no="Double entry not balanced" />
          {payment && recon.matchesExpected !== null && (
            <Check ok={recon.matchesExpected} yes="Matches the file total" no="Does not match the file total" />
          )}
        </div>
      </div>
      <dl className="grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
        <Row k="Institution" v={institutionName ?? recon.institutionId} />
        <Row k="Wallets held" v={units(recon.walletCount)} />
        <Row k="Processed" v={units(recon.processedCount)} />
        <Row k="Skipped" v={units(recon.skippedCount)} />
        <Row k="Failed" v={units(recon.failureCount)} />
        {payment && (
          <>
            <Row k="Credited by this run" v={money(recon.creditedTotal, "KES")} />
            <Row k="File total" v={recon.expectedTotal == null ? "Not checked" : money(recon.expectedTotal, "KES")} />
            <Row k="Deposit debits" v={money(recon.depositDebitTotal, "KES")} />
            <Row k="Deposit credits" v={money(recon.depositCreditTotal, "KES")} />
          </>
        )}
      </dl>
    </div>
  );
}

function Check({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return (
    <Badge tone={ok ? "success" : "danger"}>
      {ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />} {ok ? yes : no}
    </Badge>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/60 py-1.5">
      <dt className="text-text-soft">{k}</dt>
      <dd className="tabular text-right text-text">{v}</dd>
    </div>
  );
}
