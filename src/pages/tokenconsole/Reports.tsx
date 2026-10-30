import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Download, RefreshCw } from "lucide-react";
import { Button, Field, GlassPanel, Input, PageHeader, SectionTitle, useToast } from "../../ui";
import { useAsyncData } from "../../lib/useAsyncData";
import { useAction } from "../../lib/tokenConsole/useAction";
import { dateTime } from "../../lib/tokenConsole/format";
import { OmniApiError, omniApi, type ReportName, type ReportingRun } from "../../lib/omniApi";
import { periodProblem, reachable, reportingToday, saveDownload, shiftDay, MAX_REPORT_DAYS } from "../../lib/tokenConsole/reporting";
import { ConsoleTable, SourceError, StatusBadge } from "../../components/tokenconsole/ConsoleTable";
import { CustomerFilter, type ChosenCustomer } from "../../components/tokenconsole/CustomerFilter";
import { ReportingUnavailable } from "../../components/tokenconsole/ReportingUnavailable";

/* The regulatory and AML reports (BRD FR-RPT-02) as CSV, from the reporting
   service through omnichannel, which audits every download against the staff
   member. The service reads a replica of the live databases, so a report never
   loads them. Each download is logged by the service, so the list below is
   what was produced lately, by anyone. */

/** Runs read to find the latest reports among them (the service caps it at 500). */
const RUN_LIMIT = 200;
const RECENT_REPORTS = 20;

export default function TokenConsoleReports() {
  const toast = useToast();
  const today = reportingToday();
  const runs = useAsyncData(() => reachable(omniApi.reportingRuns(RUN_LIMIT)));
  const [customer, setCustomer] = useState<ChosenCustomer | null>(null);
  const [from, setFrom] = useState(shiftDay(today, -30));
  const [to, setTo] = useState(today);
  const [asOf, setAsOf] = useState(shiftDay(today, -1));

  const unavailable = runs.data?.unavailable ?? null;
  const reports = (runs.data?.data ?? []).filter((r) => r.kind === "REPORT").slice(0, RECENT_REPORTS);
  const blocked = unavailable ? "Reporting is not available." : null;
  const period = periodProblem(from, to);
  const who = customer?.profileId;

  const downloaded = (name: string) => {
    toast.push(`${name} downloaded.`);
    void runs.reload();
  };

  return (
    <div>
      <PageHeader
        eyebrow="Baracel Unyt"
        title="Reports"
        subtitle="Transactions, holdings, token supply and suspicious activity as CSV files. Every download is recorded against you."
        actions={
          <Button size="sm" variant="outline" disabled={runs.loading} onClick={() => void runs.reload()}>
            <RefreshCw size={14} className={runs.loading ? "animate-spin" : undefined} /> {runs.loading ? "Loading…" : "Refresh"}
          </Button>
        }
      />

      {unavailable && <ReportingUnavailable reason={unavailable} onRetry={() => void runs.reload()} />}

      <GlassPanel className="mb-6 p-5">
        <SectionTitle
          title="Period and customer"
          description={`Used by the reports that take them. A period is at most ${MAX_REPORT_DAYS} days; days are counted in Nairobi time, both ends included.`}
        />
        <div className="grid gap-4 md:grid-cols-[repeat(2,minmax(0,11rem))_minmax(0,1fr)]">
          <Field label="From" error={period ?? undefined}>
            <Input type="date" value={from} max={to || today} onChange={(e) => setFrom(e.target.value)} invalid={!!period} />
          </Field>
          <Field label="To">
            <Input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} invalid={!!period} />
          </Field>
          <Field label="Customer (optional)" group>
            <CustomerFilter value={customer} onChange={setCustomer} />
          </Field>
        </div>
      </GlassPanel>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <ReportCard
          name="transactions"
          title="Transactions"
          description="Payments, withdrawals, orders and fund orders in the period, newest first."
          scope={customer ? `${customer.name}, ${from} to ${to}` : `Everyone, ${from} to ${to}`}
          problem={blocked ?? period}
          params={{ from, to, customer: who }}
          onDone={() => downloaded("Transactions")}
        />
        <ReportCard
          name="holdings"
          title="Holdings"
          description="Each investor's holdings at the end of one day, with their value, from that day's snapshot."
          scope={customer ? `${customer.name}, end of ${asOf}` : `Everyone, end of ${asOf}`}
          problem={blocked ?? (asOf ? null : "Pick the day.")}
          params={{ asOf, customer: who }}
          onDone={() => downloaded("Holdings")}
          missing={
            <>
              No holdings snapshot was taken for {asOf}. The end-of-day job takes one each night at 23:59; for another day, take one
              under <Link className="font-medium text-primary-600 hover:text-primary-700" to="/token-console/surveillance">Surveillance → Runs</Link>.
            </>
          }
        >
          <Field label="As of the end of">
            <Input type="date" value={asOf} max={today} onChange={(e) => setAsOf(e.target.value)} />
          </Field>
        </ReportCard>
        <ReportCard
          name="token-supply"
          title="Token supply"
          description="Per offering: units issued, held and still available, and how many investors hold it."
          scope="Every offering, as of now"
          problem={blocked}
          params={{}}
          onDone={() => downloaded("Token supply")}
        />
        <ReportCard
          name="suspicious-activity"
          title="Suspicious activity"
          description="The surveillance alerts raised in the period, in every status, with how each was closed."
          scope={customer ? `${customer.name}, ${from} to ${to}` : `Everyone, ${from} to ${to}`}
          problem={blocked ?? period}
          params={{ from, to, subjectId: who }}
          onDone={() => downloaded("Suspicious activity")}
        />
      </div>

      {runs.error && <SourceError what="the recent reports" error={runs.error} onRetry={runs.reload} />}
      {!runs.error && !unavailable && (
        <ConsoleTable<ReportingRun>
          title="Recently produced"
          description={`The latest ${RECENT_REPORTS} reports anyone downloaded, newest first.`}
          what="the recent reports"
          source={{ data: runs.data ? reports : null, loading: runs.loading, error: null, reload: runs.reload }}
          rowId={(r) => r.id}
          emptyLabel="No report has been produced yet"
          columns={[
            { key: "when", header: "When", className: "whitespace-nowrap", render: (r) => <span className="tabular text-xs text-text-soft">{dateTime(r.started_at)}</span> },
            { key: "report", header: "Report", render: (r) => <span className="tabular text-[13px] text-text break-all">{r.subject ?? "—"}</span> },
            { key: "rows", header: "Result", hideOnMobile: true, render: (r) => <span className="text-xs text-text-soft">{r.detail ?? "—"}</span> },
            { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          ]}
        />
      )}
    </div>
  );
}

function ReportCard({ name, title, description, scope, problem, params, onDone, missing, children }: {
  name: ReportName;
  title: string;
  description: string;
  /** What the file will hold, in words. */
  scope: string;
  /** Why it cannot be downloaded now; null when it can. */
  problem: string | null;
  params: Record<string, string | undefined>;
  onDone: () => void;
  /** What to say on a 404 (no snapshot for the day). */
  missing?: ReactNode;
  children?: ReactNode;
}) {
  const [notFound, setNotFound] = useState(false);
  const download = useAction(async () => {
    setNotFound(false);
    try {
      return await omniApi.report(name, params);
    } catch (e) {
      if (missing && e instanceof OmniApiError && e.status === 404) setNotFound(true);
      throw e;
    }
  });

  const run = async () => {
    const file = await download.run();
    if (!file) return;
    saveDownload(file);
    onDone();
  };

  return (
    <GlassPanel className="flex flex-col p-5" data-testid={`report-${name}`}>
      <SectionTitle title={title} description={description} />
      {children && <div className="mb-3 max-w-[14rem]">{children}</div>}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <span className="min-w-0 text-[12.5px] text-text-soft">{scope}</span>
        <Button size="sm" disabled={!!problem || download.pending} onClick={() => void run()}>
          <Download size={14} /> {download.pending ? "Preparing…" : "Download CSV"}
        </Button>
      </div>
      {download.error && (
        <p role="alert" className="mt-2 text-[12.5px] text-danger">{notFound ? missing : download.error}</p>
      )}
    </GlassPanel>
  );
}
