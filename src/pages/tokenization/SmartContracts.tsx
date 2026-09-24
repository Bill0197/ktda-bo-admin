import { SMART_CONTRACT_STATUS_LABELS, type SmartContract, type SmartContractStatus } from "../../mock";
import { getSmartContracts } from "../../lib/api";
import { PageHeader, Badge, DataTable, Skeleton, GlassPanel, GlassStat, StatRail, NotePanel, SectionTitle, formatDate, type Column } from "../../ui";
import { FileCode2, ShieldCheck, KeyRound, AlertOctagon } from "lucide-react";
import { useAsyncData } from "../../lib/useAsyncData";

const STATUS_TONE: Record<SmartContractStatus, "success" | "warning" | "neutral"> = {
  active: "success",
  paused: "warning",
  deprecated: "neutral",
};

/** Smart contract management — the register of code that holds or governs
 * fund units on chain.
 *
 * The risk this page exists to make visible is not a bug in any one contract;
 * it is the combination of *upgradeable* and *weakly controlled*. An
 * upgradeable contract whose admin key is a single externally-owned account
 * can be rewritten by whoever holds that key, so `upgradeable` and the key
 * arrangement are read together, never separately. */
export default function SmartContracts() {
  const { data, loading } = useAsyncData(getSmartContracts);
  const rows = data ?? [];

  const singleKeyUpgradeable = rows.filter((c) => c.status !== "deprecated" && c.upgradeable && !c.multisigThreshold);
  const unaudited = rows.filter((c) => c.status !== "deprecated" && c.auditStatus === "not_audited");
  const openFindings = rows.reduce((s, c) => s + c.openFindings, 0);
  const active = rows.filter((c) => c.status === "active").length;

  const columns: Column<SmartContract>[] = [
    { key: "name", header: "Contract", className: "min-w-[220px]", render: (r) => (
      <div>
        <div className="text-text font-medium">{r.name}</div>
        <div className="text-xs text-text-soft mt-0.5 max-w-sm leading-snug line-clamp-2" title={r.purpose}>{r.purpose}</div>
      </div>
    ) },
    // What the code is and where it lives: the standard, then the deployment.
    { key: "address", header: "Standard · address", className: "min-w-[190px]", render: (r) => (
      <div className="text-xs leading-snug">
        <div className="text-text-soft">{r.standard}</div>
        <div className="mt-0.5 tabular text-text-soft truncate max-w-[180px]" title={r.address}>{r.address}</div>
        <div className="text-text-faint whitespace-nowrap">{r.chain} · v{r.version}</div>
      </div>
    ) },
    { key: "status", header: "Status · pending change", className: "min-w-[200px]", render: (r) => (
      <div>
        <Badge tone={STATUS_TONE[r.status]} className="whitespace-nowrap">{SMART_CONTRACT_STATUS_LABELS[r.status]}</Badge>
        {r.pendingChange && <div className="mt-1 text-xs text-text-faint leading-snug line-clamp-2" title={r.pendingChange}>{r.pendingChange}</div>}
      </div>
    ) },
    { key: "control", header: "Upgrade control", render: (r) => {
      if (!r.upgradeable) return <Badge tone="success" className="whitespace-nowrap">Immutable</Badge>;
      return r.multisigThreshold
        ? <div><Badge tone="info" className="whitespace-nowrap">Multisig {r.multisigThreshold}</Badge><div className="text-[11px] text-text-faint mt-1 leading-snug">{r.owner}</div></div>
        : <div><Badge tone="danger" className="whitespace-nowrap">Single key</Badge><div className="text-[11px] text-text-faint mt-1 leading-snug">{r.owner}</div></div>;
    } },
    { key: "audit", header: "Audit", className: "whitespace-nowrap", render: (r) => {
      if (r.auditStatus === "not_audited") return <Badge tone="danger" className="whitespace-nowrap">Not audited</Badge>;
      return (
        <div>
          <Badge tone={r.auditStatus === "clean" ? "success" : "warning"} className="whitespace-nowrap">
            {r.auditStatus === "clean" ? "Clean" : `${r.openFindings} open`}
          </Badge>
          <div className="text-[11px] text-text-faint mt-1 tabular">{r.auditFirm} · {r.auditedAt ? formatDate(r.auditedAt) : "—"}</div>
        </div>
      );
    } },
    { key: "standard", header: "Standard", render: (r) => <span className="text-xs text-text-soft">{r.standard}</span>, hideOnMobile: true, defaultHidden: true },
    { key: "deployed", header: "Deployed", className: "whitespace-nowrap", render: (r) => <span className="tabular text-xs text-text-soft">{formatDate(r.deployedAt)}</span>, hideOnMobile: true, defaultHidden: true },
    { key: "pending", header: "Pending change / note", render: (r) => r.pendingChange
      ? <span className="text-xs text-text-soft max-w-md block leading-relaxed">{r.pendingChange}</span>
      : <span className="text-text-faint">—</span>, hideOnMobile: true, defaultHidden: true },
  ];

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div>
      <PageHeader
        eyebrow="Tokenization Compliance"
        title="Smart contract management"
        subtitle="Which code is live, at which version, who can change it, and when it was last audited."
      />

      <StatRail columns={4} className="mb-5">
        <GlassStat label="Active contracts" value={active} icon={<FileCode2 size={17} />} tone="primary" emphasis={false} hint={`${rows.length} in the register including deprecated`} />
        <GlassStat label="Single-key upgradeable" value={singleKeyUpgradeable.length} icon={<KeyRound size={17} />} tone={singleKeyUpgradeable.length ? "danger" : "success"} hint="rewritable by one credential" />
        <GlassStat label="Unaudited" value={unaudited.length} icon={<AlertOctagon size={17} />} tone={unaudited.length ? "warning" : "success"} hint="live or paused, never independently reviewed" />
        <GlassStat label="Open audit findings" value={openFindings} icon={<ShieldCheck size={17} />} tone={openFindings ? "warning" : "success"} hint="across all audited contracts" />
      </StatRail>

      {singleKeyUpgradeable.length > 0 && (
        <NotePanel tone="danger" className="mb-5" title="Upgradeable code under a single key">
          {singleKeyUpgradeable.map((c) => c.name).join(", ")} can be rewritten by whoever holds one credential.
          That is the same risk the two-signature mint control was built to remove, so it should not be reachable
          through the contract itself. Move the owner to the multisig vault before the contract holds live value.
        </NotePanel>
      )}

      <SectionTitle
        title="Contract register"
        description="Deprecated contracts stay listed. Balances migrate, the audit trail does not — a superseded contract still has to be answerable for what it did while it was live."
      />
      <GlassPanel className="p-1" sheen={false}>
        <DataTable columns={columns} rows={rows} columnPicker emptyLabel="No contracts registered" />
      </GlassPanel>
    </div>
  );
}
