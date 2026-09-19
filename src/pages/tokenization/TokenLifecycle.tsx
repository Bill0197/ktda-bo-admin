import { LIFECYCLE_EVENT_LABELS, PRIVILEGED_EVENTS, type LifecycleEvent, type LifecycleEventType } from "../../mock";
import { getLifecycleEvents } from "../../lib/api";
import { PageHeader, Badge, DataTable, Skeleton, GlassPanel, GlassStat, StatRail, NotePanel, SectionTitle, formatDateTime, type Column } from "../../ui";
import { Blocks, KeyRound, Snowflake, TriangleAlert } from "lucide-react";
import { useAsyncData } from "../../lib/useAsyncData";

const TYPE_TONE: Record<LifecycleEventType, "neutral" | "info" | "warning" | "danger" | "success"> = {
  mint: "success",
  transfer: "neutral",
  freeze: "warning",
  unfreeze: "info",
  forced_transfer: "danger",
  burn: "warning",
  recovery: "danger",
  whitelist_add: "info",
  whitelist_remove: "warning",
};

const FLAG_LABEL: Record<NonNullable<LifecycleEvent["flag"]>, string> = {
  unauthorised: "No authority recorded",
  review_pending: "Review pending",
  reconciled_late: "Reconciled late",
};

/** Token lifecycle — everything that has happened to tokens since issuance.
 *
 * The question this page answers is not "what moved" but "what moved that
 * somebody else caused". A holder transferring their own tokens is routine; a
 * freeze, a forced transfer, a burn or a recovery is the platform acting on a
 * holder's property, and each one needs a named authority and a reason on the
 * record. A privileged event missing either is a finding, and the page treats
 * it as one rather than leaving it to be spotted by eye. */
export default function TokenLifecycle() {
  const { data, loading } = useAsyncData(getLifecycleEvents);
  const rows = data ?? [];

  const isPrivileged = (e: LifecycleEvent) => PRIVILEGED_EVENTS.includes(e.type);
  const privileged = rows.filter(isPrivileged);
  const unauthorised = privileged.filter((e) => !e.authorisedBy);
  const frozenUnits = rows.filter((e) => e.type === "freeze").reduce((s, e) => s + e.units, 0)
    - rows.filter((e) => e.type === "unfreeze").reduce((s, e) => s + e.units, 0);
  const flagged = rows.filter((e) => e.flag);

  const columns: Column<LifecycleEvent>[] = [
    { key: "type", header: "Event", className: "whitespace-nowrap", render: (r) => (
      <div>
        <Badge tone={TYPE_TONE[r.type]}>{LIFECYCLE_EVENT_LABELS[r.type]}</Badge>
        <div className="text-[11px] text-text-faint mt-1 tabular">{r.ref}</div>
      </div>
    ) },
    { key: "holder", header: "Holder", render: (r) => (
      <div>
        <div className="text-text font-medium">{r.holder}</div>
        {r.counterparty && <div className="text-xs text-text-faint">→ {r.counterparty}</div>}
      </div>
    ) },
    { key: "units", header: "Units", render: (r) => r.units > 0
      ? <span className="tabular text-text">{r.units.toLocaleString()}</span>
      : <span className="text-text-faint text-xs">n/a</span> },
    { key: "token", header: "Token", render: (r) => <span className="text-xs text-text-soft">{r.tokenSymbol}</span>, hideOnMobile: true },
    { key: "authority", header: "Authority", render: (r) => {
      if (!isPrivileged(r)) return <span className="text-text-faint text-xs">not required</span>;
      return r.authorisedBy
        ? <span className="text-xs text-text-soft">{r.authorisedBy}</span>
        : <Badge tone="danger">Missing</Badge>;
    } },
    { key: "reason", header: "Reason", render: (r) => r.reason
      ? <span className="text-xs text-text-soft max-w-md block leading-relaxed">{r.reason}</span>
      : <span className="text-text-faint">—</span>, hideOnMobile: true },
    { key: "initiatedBy", header: "Initiated by", render: (r) => (
      <div className="text-xs">
        <div className="text-text-soft">{r.initiatedBy}</div>
        <div className="text-text-faint tabular">{formatDateTime(r.at)}</div>
      </div>
    ), hideOnMobile: true },
    { key: "flag", header: "Flag", className: "whitespace-nowrap", render: (r) => r.flag
      ? <Badge tone={r.flag === "unauthorised" ? "danger" : "warning"}>{FLAG_LABEL[r.flag]}</Badge>
      : <span className="text-text-faint">—</span> },
    { key: "tx", header: "Transaction", render: (r) => r.txHash
      ? <span className="tabular text-xs text-text-soft">{r.txHash}</span>
      : <span className="text-text-faint text-xs">off chain</span>, hideOnMobile: true, defaultHidden: true },
  ];

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div>
      <PageHeader
        eyebrow="Tokenization Compliance"
        title="Token lifecycle"
        subtitle="Every transfer, freeze, forced transfer, burn and recovery on the token — and whether the ones that needed an authority actually had one."
      />

      <StatRail columns={4} className="mb-5">
        <GlassStat label="Events recorded" value={rows.length} icon={<Blocks size={17} />} tone="primary" emphasis={false} hint="across both token contracts" />
        <GlassStat label="Privileged actions" value={privileged.length} icon={<KeyRound size={17} />} tone="neutral" emphasis={false} hint="freeze, forced transfer, burn, recovery, delisting" />
        <GlassStat label="Missing authority" value={unauthorised.length} icon={<TriangleAlert size={17} />} tone={unauthorised.length ? "danger" : "success"} hint="privileged actions with no named approver" />
        <GlassStat label="Units currently frozen" value={Math.max(0, frozenUnits).toLocaleString()} icon={<Snowflake size={17} />} tone={frozenUnits > 0 ? "warning" : "neutral"} hint="immobilised pending an investigation" />
      </StatRail>

      {unauthorised.length > 0 && (
        <NotePanel tone="danger" className="mb-5" title={`${unauthorised.length} privileged action${unauthorised.length === 1 ? "" : "s"} with no recorded authority`}>
          {unauthorised.map((e) => e.ref).join(", ")} moved or immobilised someone else's tokens without a named
          approver. Establish who authorised each one and record it, or reverse the action — an unexplained forced
          transfer is indistinguishable from a compromised admin key.
        </NotePanel>
      )}

      <SectionTitle
        title="Lifecycle events"
        description="Holder-initiated transfers need no authority and show none. Everything the platform does to a holder's balance does, and the Authority column is where that record lives."
      />
      <GlassPanel className="p-1" sheen={false}>
        <DataTable columns={columns} rows={rows} columnPicker emptyLabel="No lifecycle events" />
      </GlassPanel>

      {flagged.length > 0 && (
        <p className="text-xs text-text-faint mt-3 max-w-3xl leading-relaxed">
          {flagged.length} event{flagged.length === 1 ? " carries" : "s carry"} a flag. A flag is not itself a breach —
          &ldquo;reconciled late&rdquo; means the chain indexer lagged the off-chain ledger, which is an operational
          matter for the indexer, not a compliance one for the holder.
        </p>
      )}
    </div>
  );
}
