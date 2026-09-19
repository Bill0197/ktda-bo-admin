import { Badge, PageHeader } from "../../ui";
import { tokenConsole } from "../../lib/api";
import { useAsyncData } from "../../lib/useAsyncData";
import { calendarDate, dateTime, label, percent } from "../../lib/tokenConsole/format";
import type { AccrualPolicyResponse, DistributionPolicyResponse, ScheduleResponse } from "../../lib/tokenConsole/types.gen";
import { Code, ConsoleTable, StatusBadge } from "../../components/tokenconsole/ConsoleTable";

/** A policy only acts when it is both approved and active; either alone is
 * inert, so the two are shown as one state rather than two yes/no columns. */
function PolicyState({ approved, active }: { approved?: boolean; active?: boolean }) {
  if (!approved) return <Badge tone="warning" className="whitespace-nowrap">Unapproved</Badge>;
  if (active === false) return <Badge tone="neutral">Inactive</Badge>;
  return <Badge tone="success">In force</Badge>;
}

const scope = (s?: string, ref?: string) => (
  <div>
    <div className="text-text">{label(s)}</div>
    <div className="text-xs text-text-faint">{ref ?? (s === "GLOBAL" ? "all products" : "—")}</div>
  </div>
);

const effective = (from?: string, to?: string) => (
  <span className="tabular text-xs text-text-soft">
    {calendarDate(from)}{to ? ` – ${calendarDate(to)}` : " onward"}
  </span>
);

export default function TokenConsolePolicies() {
  const accrual = useAsyncData(tokenConsole.accrualPolicies);
  const distribution = useAsyncData(tokenConsole.distributionPolicies);
  const schedules = useAsyncData(tokenConsole.schedules);

  return (
    <div>
      <PageHeader
        eyebrow="Tokenization Console"
        title="Accrual & distribution policies"
        subtitle="What the batch runs do when they execute. An unapproved or inactive policy is inert: the run finds nothing to act on."
      />

      <ConsoleTable<AccrualPolicyResponse>
        what="accrual policies"
        source={accrual}
        rowId={(r) => r.policyId}
        title="Accrual policies"
        emptyLabel="No accrual policies"
        columns={[
          { key: "scope", header: "Applies to", render: (r) => scope(r.scope, r.scopeRef) },
          { key: "rate", header: "Rate", render: (r) => (
            <div className="text-xs">
              <div className="text-text">{r.rateSource === "FIXED" ? percent(r.fixedRate) : "From tariff"}</div>
              <div className="text-text-faint">{label(r.method)} · {label(r.dayCount)}</div>
            </div>
          ) },
          { key: "effective", header: "Effective", render: (r) => effective(r.effectiveFrom, r.effectiveTo), hideOnMobile: true },
          { key: "schedule", header: "Schedule", render: (r) => (
            <div className="text-xs">
              <div className="text-text-soft">{r.scheduleEnabled ? <Code>{r.cron}</Code> : "Not scheduled"}</div>
              {r.lastRunAt && <div className="text-text-faint">last {dateTime(r.lastRunAt)} · accrued to {calendarDate(r.lastAccruedTo)}</div>}
            </div>
          ), hideOnMobile: true },
          { key: "state", header: "State", render: (r) => <PolicyState approved={r.approved} active={r.active} /> },
        ]}
      />

      <ConsoleTable<DistributionPolicyResponse>
        what="distribution policies"
        source={distribution}
        rowId={(r) => r.policyId}
        title="Distribution policies"
        emptyLabel="No distribution policies"
        columns={[
          { key: "scope", header: "Applies to", render: (r) => scope(r.scope, r.scopeRef) },
          { key: "mode", header: "Mode", render: (r) => (
            <div className="text-xs">
              <div className="text-text">{label(r.mode)}</div>
              <div className="text-text-faint">withholding {percent(r.whtRate)}</div>
            </div>
          ) },
          { key: "effective", header: "Effective", render: (r) => effective(r.effectiveFrom, r.effectiveTo), hideOnMobile: true },
          { key: "state", header: "State", render: (r) => <PolicyState approved={r.approved} active={r.active} /> },
        ]}
      />

      <ConsoleTable<ScheduleResponse>
        what="schedules"
        source={schedules}
        rowId={(r) => r.scheduleId}
        title="Schedules"
        emptyLabel="No schedules"
        columns={[
          { key: "job", header: "Job", render: (r) => (
            <div>
              <div className="text-text">{label(r.jobType)}</div>
              <div className="text-xs text-text-faint">{r.description ?? ""}</div>
            </div>
          ) },
          { key: "cron", header: "When", render: (r) => (
            <div className="text-xs">
              <Code>{r.cron}</Code>
              <div className="text-text-faint">{r.zone ?? ""}</div>
            </div>
          ) },
          { key: "runs", header: "Last / next", render: (r) => (
            <div className="text-xs tabular text-text-soft">
              <div>{dateTime(r.lastRunAt)} {r.lastStatus && <StatusBadge status={r.lastStatus} />}</div>
              <div className="text-text-faint">next {dateTime(r.nextRunAt)}</div>
            </div>
          ), hideOnMobile: true },
          { key: "enabled", header: "Enabled", render: (r) => <Badge tone={r.enabled ? "success" : "neutral"}>{r.enabled ? "On" : "Off"}</Badge> },
        ]}
      />
    </div>
  );
}
