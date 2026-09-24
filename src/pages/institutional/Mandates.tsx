import { RESTRICTION_TYPE_LABELS, type InstitutionalMandate, type MandateRestriction } from "../../mock";
import { getInstitutionalMandates, getMandateRestrictions } from "../../lib/api";
import { PageHeader, Badge, DataTable, Skeleton, GlassPanel, GlassStat, StatRail, NotePanel, SectionTitle, Money, InfoTip, formatDate, type Column } from "../../ui";
import { Gavel, ShieldCheck, TriangleAlert, ScanLine } from "lucide-react";
import { useAsyncData } from "../../lib/useAsyncData";

const STATUS_TONE = { active: "success", under_amendment: "warning", terminating: "warning", draft: "neutral" } as const;
const STATUS_LABEL = { active: "Active", under_amendment: "Under amendment", terminating: "Terminating", draft: "Draft — unsigned" } as const;
const STATE_TONE = { within: "success", near: "warning", breach: "danger" } as const;
const STATE_LABEL = { within: "Within", near: "Near limit", breach: "Breach" } as const;

/** Mandates & restrictions — the client-specific rules the book is run under.
 *
 * The `preTradeChecked` column carries most of the meaning. A rule enforced
 * before a trade books cannot be broken by a trade; one measured only after
 * the fact can, and that is precisely how passive breaches arise. Showing it
 * next to the current value makes the difference between "we cannot breach
 * this" and "we would find out tomorrow" visible without opening anything. */
export default function InstitutionalMandates() {
  const { data: mandates, loading } = useAsyncData(getInstitutionalMandates);
  const { data: restrictions } = useAsyncData(getMandateRestrictions);
  const mandateRows = mandates ?? [];
  const restrictionRows = restrictions ?? [];

  const active = mandateRows.filter((m) => m.status === "active");
  const breaching = restrictionRows.filter((r) => r.state === "breach");
  const postTradeOnly = restrictionRows.filter((r) => !r.preTradeChecked);
  const unsigned = mandateRows.filter((m) => m.status === "draft");

  const mandateColumns: Column<InstitutionalMandate>[] = [
    { key: "ref", header: "Agreement", className: "min-w-[200px]", render: (r) => (
      <div>
        <div className="flex items-center gap-1.5 text-text font-medium">
          <span className="tabular whitespace-nowrap">{r.ref}</span>
          {r.note && <InfoTip text={r.note} />}
        </div>
        <div className="mt-0.5 text-xs text-text-faint">{r.clientName}</div>
      </div>
    ) },
    { key: "strategy", header: "Strategy", className: "min-w-[220px]", render: (r) => (
      <div>
        <div className="text-sm text-text-soft leading-snug">{r.strategy}</div>
        <div className="mt-0.5 text-[11px] text-text-faint">vs. {r.benchmark}</div>
      </div>
    ) },
    { key: "aum", header: "AUM", className: "text-right whitespace-nowrap", render: (r) => r.aum > 0
      ? <Money amount={r.aum} currency={r.currency} compact />
      : <span className="text-text-faint text-xs">not funded</span> },
    { key: "status", header: "Status", className: "whitespace-nowrap", render: (r) => <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge> },
    // One agreement lifecycle: when it started, then when it is next reviewed.
    { key: "inception", header: "Inception → review", className: "whitespace-nowrap", render: (r) => (
      <div className="tabular text-xs">
        <div className="text-text-soft">{r.inceptionDate === "—" ? "—" : formatDate(r.inceptionDate)}</div>
        <div className="text-text-faint">review {r.reviewDue === "—" ? "—" : formatDate(r.reviewDue)}</div>
      </div>
    ), hideOnMobile: true },
    { key: "signed", header: "Executed by", render: (r) => <span className="text-xs text-text-soft">{r.signedBy}</span>, hideOnMobile: true, defaultHidden: true },
    { key: "note", header: "Note", render: (r) => r.note
      ? <span className="text-xs text-text-soft max-w-md block leading-relaxed">{r.note}</span>
      : <span className="text-text-faint">—</span>, hideOnMobile: true, defaultHidden: true },
  ];

  const restrictionColumns: Column<MandateRestriction>[] = [
    { key: "client", header: "Client", className: "min-w-[200px]", render: (r) => (
      <div>
        <div className="text-text font-medium">{r.clientName}</div>
        <div className="mt-0.5 text-[11px] text-text-faint tabular">{r.mandateRef}</div>
      </div>
    ) },
    // The rule is the substance; its category is a label for it, not a column of its own.
    { key: "rule", header: "Rule · type", className: "min-w-[240px]", render: (r) => (
      <div>
        <div className="text-sm text-text leading-snug">{r.rule}</div>
        <div className="mt-0.5 text-xs text-text-faint">{RESTRICTION_TYPE_LABELS[r.type]}</div>
      </div>
    ) },
    { key: "values", header: "Current vs. limit", className: "text-right whitespace-nowrap", render: (r) => (
      <div className="tabular text-sm">
        <div className={r.state === "breach" ? "text-danger font-medium" : "text-text"}>{r.currentValue}</div>
        <div className="text-[11px] text-text-faint">limit {r.limitValue}</div>
      </div>
    ) },
    // Where it stands and whether a trade could move it there unchecked.
    { key: "state", header: "State · enforcement", className: "whitespace-nowrap", render: (r) => (
      <div className="flex flex-col items-start gap-1">
        <Badge tone={STATE_TONE[r.state]}>{STATE_LABEL[r.state]}</Badge>
        {r.preTradeChecked
          ? <Badge tone="success">Pre-trade</Badge>
          : <Badge tone="warning">Post-trade only</Badge>}
      </div>
    ) },
  ];

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div>
      <PageHeader
        eyebrow="Institutional Funds"
        title="Mandates & restrictions"
        tooltip="An IMA — Investment Management Agreement — is the contract under which a client appoints the firm. Its restrictions bind us contractually, not just internally."
        subtitle="Each client's agreement and the specific rules the firm runs their portfolio under."
      />

      <StatRail columns={4} className="mb-5">
        <GlassStat label="Active agreements" value={active.length} icon={<Gavel size={17} />} tone="primary" emphasis={false} hint={`${mandateRows.length} on file including drafts`} />
        <GlassStat label="Restrictions monitored" value={restrictionRows.length} icon={<ShieldCheck size={17} />} tone="neutral" emphasis={false} hint="across every client mandate" />
        <GlassStat label="In breach" value={breaching.length} icon={<TriangleAlert size={17} />} tone={breaching.length ? "danger" : "success"} hint="currently through a client's own limit" />
        <GlassStat label="Post-trade only" value={postTradeOnly.length} icon={<ScanLine size={17} />} tone={postTradeOnly.length ? "warning" : "success"} hint="rules a trade could breach before we notice" />
      </StatRail>

      {unsigned.length > 0 && (
        <NotePanel tone="warning" className="mb-5" title="Unsigned agreements">
          {unsigned.map((m) => `${m.ref} — ${m.clientName}`).join("; ")}. A mandate cannot be funded before it is
          executed. Accepting money against a draft IMA leaves the firm managing assets with no agreed terms and no
          agreed restrictions.
        </NotePanel>
      )}

      <SectionTitle title="Agreements" description="A terminating mandate keeps running under its original terms until the termination date — notice does not suspend the restrictions." />
      <GlassPanel className="p-1 mb-6" sheen={false}>
        <DataTable columns={mandateColumns} rows={mandateRows} columnPicker emptyLabel="No agreements" />
      </GlassPanel>

      <SectionTitle
        title="Restrictions"
        description="Pre-trade rules are enforced at booking, so they can only be breached by a system fault. Post-trade rules can be breached by the market alone, which is why duration and liquidity floors dominate the breach register."
      />
      <GlassPanel className="p-1" sheen={false}>
        <DataTable columns={restrictionColumns} rows={restrictionRows} columnPicker emptyLabel="No restrictions" />
      </GlassPanel>
    </div>
  );
}
