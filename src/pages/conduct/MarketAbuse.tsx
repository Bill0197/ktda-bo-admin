import { ABUSE_TYPOLOGY_LABELS, CONDUCT_STATUS_LABELS, type MarketAbuseAlert, type ConductStatus } from "../../mock";
import { getMarketAbuseAlerts } from "../../lib/api";
import { PageHeader, Badge, DataTable, Skeleton, GlassPanel, GlassStat, StatRail, NotePanel, SectionTitle, DistributionBars, formatDateTime, formatDate, type Column } from "../../ui";
import { ScanEye, UserRound, Landmark, FileWarning } from "lucide-react";
import { useAsyncData } from "../../lib/useAsyncData";

const STATUS_TONE: Record<ConductStatus, "danger" | "warning" | "info" | "neutral" | "success"> = {
  open: "warning",
  under_review: "info",
  escalated: "danger",
  closed_no_action: "neutral",
  closed_substantiated: "danger",
};

const SEVERITY_TONE = { low: "neutral", medium: "warning", high: "danger" } as const;

const SUBJECT_LABEL = { employee: "Employee", client: "Client", counterparty: "Counterparty" } as const;

/** Market abuse surveillance.
 *
 * Deliberately not folded into the AML alerts board. AML asks whether money is
 * clean; this asks whether someone traded on something they should not have.
 * The subject can be one of our own staff, which is exactly why it needs its
 * own queue — an employee matter routed onto a customer-monitoring board is
 * how conflicts get reviewed by the person they concern. */
export default function MarketAbuse() {
  const { data, loading } = useAsyncData(getMarketAbuseAlerts);
  const rows = data ?? [];

  const live = rows.filter((r) => r.status === "open" || r.status === "under_review" || r.status === "escalated");
  const employeeMatters = live.filter((r) => r.subjectType === "employee");
  const substantiated = rows.filter((r) => r.status === "closed_substantiated");
  const notified = rows.filter((r) => r.reportedToCma);

  const bySubject = (["employee", "client", "counterparty"] as const).map((k) => ({
    label: SUBJECT_LABEL[k],
    value: live.filter((r) => r.subjectType === k).length,
    tone: k === "employee" ? ("danger" as const) : ("primary" as const),
  })).filter((r) => r.value > 0);

  const columns: Column<MarketAbuseAlert>[] = [
    { key: "ref", header: "Reference", render: (r) => (
      <div>
        <div className="text-text font-medium tabular">{r.ref}</div>
        <div className="text-[11px] text-text-faint tabular">{formatDateTime(r.detectedAt)}</div>
      </div>
    ) },
    { key: "typology", header: "Typology", className: "whitespace-nowrap", render: (r) => <Badge tone="info">{ABUSE_TYPOLOGY_LABELS[r.typology]}</Badge> },
    { key: "subject", header: "Subject", render: (r) => (
      <div>
        <div className="text-text font-medium">{r.subject}</div>
        <div className="text-xs text-text-faint">{SUBJECT_LABEL[r.subjectType]} · {r.instrument}</div>
      </div>
    ) },
    { key: "detail", header: "What was seen", render: (r) => <span className="text-xs text-text-soft max-w-lg block leading-relaxed">{r.detail}</span>, hideOnMobile: true },
    { key: "severity", header: "Severity", className: "whitespace-nowrap", render: (r) => <Badge tone={SEVERITY_TONE[r.severity]}>{r.severity}</Badge> },
    { key: "status", header: "Status", className: "whitespace-nowrap", render: (r) => <Badge tone={STATUS_TONE[r.status]}>{CONDUCT_STATUS_LABELS[r.status]}</Badge> },
    { key: "assignee", header: "Assignee", render: (r) => r.assignee
      ? <span className="text-xs text-text-soft">{r.assignee}</span>
      : <Badge tone="warning">Unassigned</Badge>, hideOnMobile: true },
    { key: "cma", header: "Notified", render: (r) => r.reportedToCma
      ? <span className="text-xs text-text-soft tabular">CMA · {formatDate(r.reportedToCma)}</span>
      : <span className="text-text-faint text-xs">—</span>, hideOnMobile: true, defaultHidden: true },
  ];

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div>
      <PageHeader
        eyebrow="Market Conduct"
        title="Market abuse"
        tooltip="Insider dealing, front running, wash trading, manipulation and spoofing — conduct offences under the Capital Markets Act, distinct from money-laundering typologies."
        subtitle="Surveillance over the firm's own order flow and the people around it."
      />

      <StatRail columns={4} className="mb-5">
        <GlassStat label="Live matters" value={live.length} icon={<ScanEye size={17} />} tone={live.length ? "warning" : "success"} hint="open, under review or escalated" />
        <GlassStat label="Employee subjects" value={employeeMatters.length} icon={<UserRound size={17} />} tone={employeeMatters.length ? "danger" : "success"} hint="live matters concerning our own staff" />
        <GlassStat label="Substantiated" value={substantiated.length} icon={<FileWarning size={17} />} tone={substantiated.length ? "danger" : "success"} hint="findings upheld on review" />
        <GlassStat label="Reported to the CMA" value={notified.length} icon={<Landmark size={17} />} tone="neutral" emphasis={false} hint="notifiable matters filed" />
      </StatRail>

      {employeeMatters.length > 0 && (
        <NotePanel tone="warning" className="mb-5" title="Live matters concerning employees">
          {employeeMatters.map((r) => `${r.ref} (${r.subject})`).join(", ")}. An employee matter must not be
          investigated by anyone in that employee's reporting line, and the personal-account dealing register is
          the second half of the evidence — check both before drawing a conclusion.
        </NotePanel>
      )}

      {bySubject.length > 0 && (
        <GlassPanel className="p-5 mb-5">
          <SectionTitle title="Live matters by subject" description="Who the open surveillance work is actually about." />
          <DistributionBars rows={bySubject} />
        </GlassPanel>
      )}

      <SectionTitle
        title="Surveillance alerts"
        description="A closed alert stays on the register. &ldquo;Closed — no action&rdquo; is a finding in its own right and is what makes a repeat pattern by the same subject visible later."
      />
      <GlassPanel className="p-1" sheen={false}>
        <DataTable columns={columns} rows={rows} columnPicker emptyLabel="No surveillance alerts" />
      </GlassPanel>
    </div>
  );
}
