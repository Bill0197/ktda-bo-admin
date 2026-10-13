import { BREACH_STATUS_LABELS, type MandateBreach, type BreachStatus } from "../../mock";
import { getMandateBreaches } from "../../lib/api";
import { PageHeader, Badge, DataTable, Skeleton, GlassPanel, GlassStat, StatRail, NotePanel, SectionTitle, DistributionBars, InfoTip, formatDate, type Column } from "../../ui";
import { ShieldX, Activity, BellRing, CircleCheck } from "lucide-react";
import { useAsyncData } from "../../lib/useAsyncData";

const STATUS_TONE: Record<BreachStatus, "danger" | "warning" | "success" | "info"> = {
  open: "danger",
  remediating: "warning",
  cured: "success",
  escalated: "danger",
  client_notified: "info",
};

/** Mandate breaches — where a client's own restriction has been broken.
 *
 * Two clocks run independently and both are shown: the cure period, and the
 * contractual obligation to notify the client. A breach cured inside the
 * window but never notified is still a contractual failure, and a page that
 * tracked only remediation would report it as closed. */
export default function Breaches() {
  const { data, loading } = useAsyncData(getMandateBreaches);
  const rows = data ?? [];

  const live = rows.filter((r) => r.status !== "cured");
  const active = rows.filter((r) => r.type === "active");
  const passive = rows.filter((r) => r.type === "passive");
  const unnotified = live.filter((r) => !r.clientNotifiedAt);
  const cured = rows.filter((r) => r.status === "cured").length;

  const byCause = [
    { label: "Passive — market or flow", value: passive.length, tone: "primary" as const },
    { label: "Active — caused by a trade", value: active.length, tone: "danger" as const },
  ].filter((r) => r.value > 0);

  const columns: Column<MandateBreach>[] = [
    { key: "ref", header: "Reference · detected", render: (r) => (
      <div className="whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-text font-medium tabular">
          {r.ref}
          {r.note && <span className="whitespace-normal"><InfoTip text={r.note} /></span>}
        </div>
        <div className="mt-0.5 text-xs text-text-faint tabular">{formatDate(r.detectedAt)}</div>
      </div>
    ) },
    { key: "client", header: "Client", className: "min-w-[150px]", render: (r) => (
      <div>
        <div className="text-text font-medium">{r.clientName}</div>
        <div className="mt-0.5 text-xs text-text-faint tabular">{r.mandateRef}</div>
      </div>
    ) },
    { key: "rule", header: "Rule broken", className: "min-w-[220px]", render: (r) => (
      <div>
        <div className="text-xs text-text-soft leading-relaxed line-clamp-2" title={r.rule}>{r.rule}</div>
        <div className="text-xs text-text-faint mt-0.5 tabular line-clamp-1" title={r.magnitude}>{r.magnitude}</div>
      </div>
    ) },
    { key: "status", header: "Status · cause", className: "whitespace-nowrap", render: (r) => (
      <div>
        <Badge tone={STATUS_TONE[r.status]}>{BREACH_STATUS_LABELS[r.status]}</Badge>
        <div className="mt-1"><Badge tone={r.type === "active" ? "danger" : "warning"}>{r.type === "active" ? "Active" : "Passive"}</Badge></div>
      </div>
    ) },
    // The two clocks sit together so a cured-but-never-notified breach reads as unfinished.
    { key: "cure", header: "Cure · notified", className: "whitespace-nowrap", render: (r) => (
      <div className="text-xs">
        <div className="tabular text-text-soft">cure by {formatDate(r.cureDueBy)}</div>
        <div className="mt-1">
          {r.clientNotifiedAt
            ? <span className="tabular text-text-faint">notified {formatDate(r.clientNotifiedAt)}</span>
            : <Badge tone={r.status === "cured" ? "neutral" : "warning"}>Not notified</Badge>}
        </div>
      </div>
    ) },
    { key: "owner", header: "Owner", className: "min-w-[90px]", render: (r) => <span className="text-xs text-text-soft">{r.owner}</span>, hideOnMobile: true },
    { key: "note", header: "Note", className: "min-w-[240px]", render: (r) => r.note
      ? <span className="text-xs text-text-soft leading-relaxed line-clamp-2" title={r.note}>{r.note}</span>
      : <span className="text-text-faint">—</span>, hideOnMobile: true, defaultHidden: true },
  ];

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div>
      <PageHeader
        eyebrow="Institutional Investment Compliance"
        title="Mandate breaches"
        tooltip="An active breach is caused by a trade — somebody did something. A passive breach is caused by market movement or a client flow with no trade at all; the cure period differs accordingly."
        subtitle="Where a client's own investment restriction has been broken, and the two clocks that start when it is."
      />

      <StatRail columns={4} className="mb-5">
        <GlassStat label="Live breaches" value={live.length} icon={<ShieldX size={17} />} tone={live.length ? "danger" : "success"} hint="not yet cured" />
        <GlassStat label="Active breaches" value={active.length} icon={<Activity size={17} />} tone={active.length ? "warning" : "success"} hint="caused by a trade — a control failed" />
        <GlassStat label="Awaiting client notice" value={unnotified.length} icon={<BellRing size={17} />} tone={unnotified.length ? "warning" : "success"} hint="live breaches the client has not been told about" />
        <GlassStat label="Cured" value={cured} icon={<CircleCheck size={17} />} tone="neutral" emphasis={false} hint="resolved inside the cure period" />
      </StatRail>

      {unnotified.length > 0 && (
        <NotePanel tone="warning" className="mb-5" title="Notification is a separate obligation from remediation">
          {unnotified.map((r) => `${r.ref} — ${r.clientName}`).join("; ")}. Curing a breach quietly does not discharge
          the duty to tell the client it happened. The notification clock runs from detection, not from resolution.
        </NotePanel>
      )}

      {byCause.length > 0 && (
        <GlassPanel className="p-5 mb-5">
          <SectionTitle title="Breaches by cause" description="A book with only passive breaches has working pre-trade controls. Active breaches mean something got past them." />
          <DistributionBars rows={byCause} />
        </GlassPanel>
      )}

      <SectionTitle
        title="Breach register"
        description="Near misses caught by a pre-trade check are logged as cured breaches with no exposure taken. Counting them is how you tell a control that is working from one that is never tested."
      />
      <GlassPanel className="p-1" sheen={false}>
        <DataTable newest={(r) => r.detectedAt} columns={columns} rows={rows} columnPicker emptyLabel="No breaches on the register" />
      </GlassPanel>
    </div>
  );
}
