import { getCampaigns, getLeadsWithCampaign } from "../lib/api";
import { PageHeader, Badge, DataTable, Skeleton, Money, GlassPanel, GlassStat, StatRail, SectionTitle, InfoTip, formatDate, type Column } from "../ui";
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
    { key: "name", header: "Campaign", className: "min-w-[220px]", render: (r) => (
      <div>
        {/* Inline, not flex: long names wrap and the tip should follow the last word. */}
        <div className="text-text font-medium">
          {r.name}
          {r.note && <span className="ml-1.5 inline-flex align-middle"><InfoTip text={r.note} /></span>}
        </div>
        <div className="mt-0.5 text-xs text-text-faint">{r.channel}</div>
      </div>
    ) },
    // Live/ended and the window it ran over are one fact.
    { key: "status", header: "Status · running", className: "whitespace-nowrap", render: (r) => (
      <div>
        <Badge tone={r.endedAt ? "neutral" : "success"}>{r.endedAt ? "Ended" : "Live"}</Badge>
        <div className="mt-1 tabular text-xs text-text-soft">
          {formatDate(r.startedAt)} → {r.endedAt ? formatDate(r.endedAt) : "open"}
        </div>
      </div>
    ) },
    { key: "period", header: "Running", className: "whitespace-nowrap", render: (r) => (
      <span className="tabular text-xs text-text-soft">
        {formatDate(r.startedAt)} → {r.endedAt ? formatDate(r.endedAt) : "open"}
      </span>
    ), hideOnMobile: true, defaultHidden: true },
    // The funnel reads left to right: enquiries → leads → converted, then the rate.
    { key: "leads", header: "Leads", className: "text-right whitespace-nowrap", render: (r) => (
      <div>
        <div className="tabular text-text">{r.leads}</div>
        <div className="text-xs text-text-faint">from <span className="tabular">{r.enquiries}</span> {r.enquiries === 1 ? "enquiry" : "enquiries"}</div>
      </div>
    ) },
    { key: "enquiries", header: "Enquiries", className: "text-right whitespace-nowrap", render: (r) => <span className="tabular">{r.enquiries}</span>, hideOnMobile: true, defaultHidden: true },
    { key: "rate", header: "Conversion", className: "text-right whitespace-nowrap", render: (r) => (
      <div>
        {r.conversionPct === null
          ? <div className="text-text-faint text-xs">no leads yet</div>
          : <div className="tabular text-text font-medium">{r.conversionPct}%</div>}
        <div className="text-xs text-text-faint"><span className="tabular">{r.converted}</span> converted</div>
      </div>
    ) },
    { key: "converted", header: "Converted", className: "text-right whitespace-nowrap", render: (r) => <span className="tabular">{r.converted}</span>, hideOnMobile: true, defaultHidden: true },
    { key: "spend", header: "Spend · per conversion", className: "text-right whitespace-nowrap", render: (r) => (
      <div>
        {r.spendKes === null
          ? <div className="text-text-faint text-xs">not attributable</div>
          : <div className="text-text"><Money amount={r.spendKes} currency="KES" compact /></div>}
        {/* With no attributable spend the first line already says why there is no cost per conversion. */}
        {r.spendKes !== null && (
          <div className="text-xs text-text-faint">
            {r.costPerConversion === null
              ? "no conversions yet"
              : <><Money amount={r.costPerConversion} currency="KES" compact /> per conversion</>}
          </div>
        )}
      </div>
    ) },
    { key: "cpc", header: "Cost per conversion", className: "text-right whitespace-nowrap", render: (r) => r.costPerConversion === null
      ? <span className="text-text-faint text-xs">{r.spendKes === null ? "no attributable spend" : "no conversions yet"}</span>
      : <Money amount={r.costPerConversion} currency="KES" />, hideOnMobile: true, defaultHidden: true },
    { key: "note", header: "Note", render: (r) => r.note
      ? <span className="text-xs text-text-soft max-w-sm block">{r.note}</span>
      : <span className="text-text-faint">—</span>, hideOnMobile: true, defaultHidden: true },
  ];

  const leadColumns: Column<LeadRow>[] = [
    { key: "name", header: "Lead", className: "whitespace-nowrap", render: (r) => <span className="text-text font-medium">{r.name}</span> },
    // What the lead record says it came from sits under the campaign it is attributed to.
    { key: "campaign", header: "Attributed to · recorded source", className: "min-w-[240px]", render: (r) => (
      <div>
        {r.campaignName
          ? <div className="text-text-soft">{r.campaignName}</div>
          : <Badge tone="warning" className="whitespace-nowrap">Unattributed</Badge>}
        <div className="mt-0.5 text-xs text-text-faint">{r.source}</div>
      </div>
    ) },
    { key: "source", header: "Recorded source", render: (r) => <span className="text-xs text-text-faint">{r.source}</span>, hideOnMobile: true, defaultHidden: true },
    { key: "stage", header: "Stage", className: "whitespace-nowrap", render: (r) => <Badge tone={r.stage === "converted" ? "success" : r.stage === "lost" ? "danger" : "info"} className="whitespace-nowrap">{r.stage.replace("_", " ")}</Badge> },
    { key: "channel", header: "Delivery channel", className: "whitespace-nowrap", render: (r) => <span className="text-text-soft">{r.deliveryChannel}</span>, hideOnMobile: true },
    { key: "created", header: "Created", className: "whitespace-nowrap", render: (r) => <span className="tabular text-xs text-text-soft">{formatDate(r.createdAt)}</span>, hideOnMobile: true },
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

      <GlassPanel className="p-1 mb-6" sheen={false}><DataTable newest={(r) => r.startedAt} columns={columns} rows={rows} columnPicker /></GlassPanel>

      <SectionTitle
        title="Lead attribution"
        description="A lead with no campaign is not an error — walk-ins and word of mouth genuinely have no campaign. It is only a problem when a paid channel's leads land here unattributed, because that spend then looks like it produced nothing."
      />
      <GlassPanel className="p-1" sheen={false}><DataTable newest={(r) => r.createdAt} columns={leadColumns} rows={leads ?? []} columnPicker /></GlassPanel>
    </div>
  );
}
