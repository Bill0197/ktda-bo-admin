import { getCampaigns, getLeadsWithCampaign } from "../lib/api";
import { PageHeader, Badge, DataTable, Skeleton, Money, GlassPanel, GlassStat, StatRail, SectionTitle, formatDate, type Column } from "../ui";
import { Megaphone, Users, TrendingUp } from "lucide-react";
import { useAsyncData } from "../lib/useAsyncData";

type CampaignRow = Awaited<ReturnType<typeof getCampaigns>>[number];
type LeadRow = Awaited<ReturnType<typeof getLeadsWithCampaign>>[number];

/** Source attribution. `Lead.source` was free text, so "which channel actually
 * converts" was never answerable — a campaign id on both the enquiry and the
 * lead makes it a join instead of a guess.
 *
 * Two numbers are deliberately nullable rather than zero: a channel with no
 * attributable spend (the IFA programme pays through trailing commission) is
 * not free, and cost-per-conversion with no conversions is undefined, not KES 0. */
export default function Campaigns() {
  const { data: campaigns, loading } = useAsyncData(getCampaigns);
  const { data: leads } = useAsyncData(getLeadsWithCampaign);

  const rows = campaigns ?? [];
  const totalSpend = rows.reduce((s, c) => s + (c.spendKes ?? 0), 0);
  const totalLeads = rows.reduce((s, c) => s + c.leads, 0);
  const totalConverted = rows.reduce((s, c) => s + c.converted, 0);

  const columns: Column<CampaignRow>[] = [
    { key: "name", header: "Campaign", render: (r) => (
      <div>
        <div className="text-text font-medium">{r.name}</div>
        <div className="text-xs text-text-faint">{r.channel}</div>
      </div>
    ) },
    { key: "period", header: "Running", render: (r) => (
      <span className="tabular text-xs text-text-soft">
        {formatDate(r.startedAt)} → {r.endedAt ? formatDate(r.endedAt) : "open"}
      </span>
    ), hideOnMobile: true },
    { key: "status", header: "Status", className: "whitespace-nowrap", render: (r) => (
      <Badge tone={r.endedAt ? "neutral" : "success"}>{r.endedAt ? "Ended" : "Live"}</Badge>
    ) },
    { key: "spend", header: "Spend", render: (r) => r.spendKes === null
      ? <span className="text-text-faint text-xs">not attributable</span>
      : <Money amount={r.spendKes} currency="KES" compact /> },
    { key: "enquiries", header: "Enquiries", render: (r) => <span className="tabular">{r.enquiries}</span>, hideOnMobile: true },
    { key: "leads", header: "Leads", render: (r) => <span className="tabular">{r.leads}</span> },
    { key: "converted", header: "Converted", render: (r) => <span className="tabular">{r.converted}</span> },
    { key: "rate", header: "Conversion", render: (r) => r.conversionPct === null
      ? <span className="text-text-faint text-xs">no leads yet</span>
      : <span className="tabular text-text font-medium">{r.conversionPct}%</span> },
    { key: "cpc", header: "Cost per conversion", render: (r) => r.costPerConversion === null
      ? <span className="text-text-faint text-xs">{r.spendKes === null ? "no attributable spend" : "no conversions yet"}</span>
      : <Money amount={r.costPerConversion} currency="KES" />, hideOnMobile: true },
    { key: "note", header: "Note", render: (r) => r.note
      ? <span className="text-xs text-text-soft max-w-sm block">{r.note}</span>
      : <span className="text-text-faint">—</span>, hideOnMobile: true, defaultHidden: true },
  ];

  const leadColumns: Column<LeadRow>[] = [
    { key: "name", header: "Lead", render: (r) => <span className="text-text font-medium">{r.name}</span> },
    { key: "campaign", header: "Attributed to", className: "whitespace-nowrap", render: (r) => r.campaignName
      ? <span className="text-text-soft">{r.campaignName}</span>
      : <Badge tone="warning">Unattributed</Badge> },
    { key: "source", header: "Recorded source", render: (r) => <span className="text-xs text-text-faint">{r.source}</span>, hideOnMobile: true },
    { key: "stage", header: "Stage", render: (r) => <Badge tone={r.stage === "converted" ? "success" : r.stage === "lost" ? "danger" : "info"}>{r.stage.replace("_", " ")}</Badge> },
    { key: "channel", header: "Delivery channel", render: (r) => <span className="text-text-soft">{r.deliveryChannel}</span>, hideOnMobile: true },
    { key: "created", header: "Created", render: (r) => <span className="tabular text-xs">{formatDate(r.createdAt)}</span>, hideOnMobile: true },
  ];

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div>
      <PageHeader
        title="Campaigns & attribution"
        tooltip="Attribution links an enquiry and the lead it became back to the campaign that produced it, so acquisition cost per converted client is a calculation rather than an estimate."
        subtitle="Where enquiries come from, and which channels actually turn into funded accounts."
      />

      <StatRail columns={3} className="mb-5">
        <GlassStat
          label="Attributable spend"
          value={<Money amount={totalSpend} currency="KES" compact />}
          icon={<Megaphone size={17} />}
          tone="accent"
          hint="excludes commission-funded channels"
        />
        <GlassStat label="Attributed leads" value={totalLeads} icon={<Users size={17} />} tone="primary" hint="leads traceable to a named campaign" />
        <GlassStat
          label="Blended conversion"
          value={totalLeads ? `${Math.round((totalConverted / totalLeads) * 100)}%` : "—"}
          icon={<TrendingUp size={17} />}
          tone="neutral"
          hint={`${totalConverted} of ${totalLeads} attributed leads`}
        />
      </StatRail>

      <GlassPanel className="p-1 mb-6" sheen={false}><DataTable columns={columns} rows={rows} columnPicker /></GlassPanel>

      <SectionTitle
        title="Lead attribution"
        description="A lead with no campaign is not an error — walk-ins and word of mouth genuinely have no campaign. It is only a problem when a paid channel's leads land here unattributed, because that spend then looks like it produced nothing."
      />
      <GlassPanel className="p-1" sheen={false}><DataTable columns={leadColumns} rows={leads ?? []} columnPicker /></GlassPanel>
    </div>
  );
}
