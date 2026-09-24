import { ISSUANCE_STATUS_LABELS, type TokenIssuance, type IssuanceStatus } from "../../mock";
import { getTokenIssuances } from "../../lib/api";
import { PageHeader, Badge, DataTable, Skeleton, GlassPanel, GlassStat, StatRail, NotePanel, SectionTitle, InfoTip, formatDateTime, type Column } from "../../ui";
import { Coins, ShieldAlert, Signature, GitCompareArrows } from "lucide-react";
import { useAsyncData } from "../../lib/useAsyncData";

const STATUS_TONE: Record<IssuanceStatus, "neutral" | "warning" | "info" | "success" | "danger"> = {
  draft: "neutral",
  pending_approval: "warning",
  approved: "info",
  minted: "success",
  rejected: "danger",
};

/** Token issuance — the mint queue and its two hard preconditions.
 *
 * Compliance is not approving a transaction here, it is approving that the
 * chain is about to be told something the off-chain register already says.
 * So the supply variance and the whitelist/jurisdiction clearances are
 * columns, not a detail drawer: a batch that fails either one should be
 * unmissable in the list. */
export default function TokenIssuance() {
  const { data, loading } = useAsyncData(getTokenIssuances);
  const rows = data ?? [];

  const awaitingSignature = rows.filter((r) => r.status === "pending_approval").length;
  const variance = rows.filter((r) => r.status !== "rejected" && r.unitsRequested !== r.unitsOffChain);
  const blocked = rows.filter((r) => r.status !== "minted" && r.status !== "rejected" && (!r.whitelistCleared || !r.jurisdictionCleared));
  const mintedUnits = rows.filter((r) => r.status === "minted").reduce((s, r) => s + r.unitsRequested, 0);

  const columns: Column<TokenIssuance>[] = [
    { key: "ref", header: "Batch", className: "min-w-[200px]", render: (r) => (
      <div>
        <div className="flex items-center gap-1.5 text-text font-medium">
          <span className="tabular whitespace-nowrap">{r.ref}</span>
          {r.note && <InfoTip text={r.note} />}
        </div>
        <div className="mt-0.5 text-xs text-text-faint">{r.subFund} · {r.tokenSymbol} · {r.chain}</div>
      </div>
    ) },
    // The mint count is only meaningful against the register, so the
    // reconciliation result sits directly under the number it qualifies.
    { key: "units", header: "Units · vs. register", className: "text-right whitespace-nowrap", render: (r) => {
      const diff = r.unitsRequested - r.unitsOffChain;
      return (
        <div>
          <div className="tabular text-text">{r.unitsRequested.toLocaleString()}</div>
          <div className="mt-1">
            {diff === 0
              ? <span className="text-xs text-text-faint">reconciled</span>
              : <Badge tone="danger" className="whitespace-nowrap">{diff > 0 ? "+" : ""}{diff.toLocaleString()} units</Badge>}
          </div>
        </div>
      );
    } },
    { key: "checks", header: "Pre-mint checks", className: "whitespace-nowrap", render: (r) => (
      <div className="flex flex-col items-start gap-1">
        <Badge tone={r.whitelistCleared ? "success" : "danger"} className="whitespace-nowrap">{r.whitelistCleared ? "Whitelist ok" : "Whitelist"}</Badge>
        <Badge tone={r.jurisdictionCleared ? "success" : "danger"} className="whitespace-nowrap">{r.jurisdictionCleared ? "Jurisdiction ok" : "Jurisdiction"}</Badge>
      </div>
    ) },
    // Status and signatures both answer "how far through approval is this".
    { key: "status", header: "Status · signatures", className: "min-w-[190px]", render: (r) => {
      const met = r.approvals.length >= r.requiredApprovals;
      const signers = r.approvals.map((a) => a.name).join(", ");
      return (
        <div>
          <Badge tone={STATUS_TONE[r.status]} className="whitespace-nowrap">{ISSUANCE_STATUS_LABELS[r.status]}</Badge>
          <div className="mt-1 text-xs leading-snug">
            <span className={met ? "text-success font-medium tabular whitespace-nowrap" : "text-warning font-medium tabular whitespace-nowrap"}>
              {r.approvals.length} of {r.requiredApprovals} signed
            </span>
            {signers && <div className="text-text-faint mt-0.5">{signers}</div>}
          </div>
        </div>
      );
    } },
    { key: "requestedBy", header: "Requested by", className: "min-w-[150px]", render: (r) => (
      <div className="text-xs leading-snug">
        <div className="text-text-soft">{r.requestedBy}</div>
        <div className="mt-0.5 text-text-faint tabular whitespace-nowrap">{formatDateTime(r.requestedAt)}</div>
      </div>
    ), hideOnMobile: true },
    { key: "chain", header: "Chain", render: (r) => <span className="text-text-soft text-xs">{r.chain}</span>, hideOnMobile: true, defaultHidden: true },
    { key: "tx", header: "Transaction", render: (r) => r.txHash
      ? <span className="tabular text-xs text-text-soft block truncate max-w-[140px]" title={r.txHash}>{r.txHash}</span>
      : <span className="text-text-faint text-xs">—</span>, hideOnMobile: true, defaultHidden: true },
    { key: "note", header: "Note", render: (r) => r.note
      ? <span className="text-xs text-text-soft max-w-md block leading-relaxed">{r.note}</span>
      : <span className="text-text-faint">—</span>, hideOnMobile: true, defaultHidden: true },
  ];

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div>
      <PageHeader
        eyebrow="Tokenization Compliance"
        title="Token issuance"
        tooltip="Minting creates a second, on-chain representation of units that already exist off chain. It never creates value — if the two counts differ, the chain is wrong."
        subtitle="The mint queue for the ERC-3643 security token, and the checks that must clear before a batch reaches the chain."
      />

      <StatRail columns={4} className="mb-5">
        <GlassStat label="Awaiting signature" value={awaitingSignature} icon={<Signature size={17} />} tone={awaitingSignature ? "warning" : "neutral"} hint="two signatures required per batch" />
        <GlassStat label="Supply variance" value={variance.length} icon={<GitCompareArrows size={17} />} tone={variance.length ? "danger" : "success"} hint="batches that do not reconcile to the unit register" />
        <GlassStat label="Blocked on checks" value={blocked.length} icon={<ShieldAlert size={17} />} tone={blocked.length ? "warning" : "success"} hint="whitelist or jurisdiction not cleared" />
        <GlassStat label="Units minted to date" value={mintedUnits.toLocaleString()} icon={<Coins size={17} />} tone="primary" hint="across both token contracts" emphasis={false} />
      </StatRail>

      <NotePanel tone="info" className="mb-5" title="Why two signatures">
        A single compromised credential must never be able to move tokenized units. Every mint instruction carries
        two independent approvals from different functions, and neither the requester's own signature nor a second
        signature from the same department counts toward the pair.
      </NotePanel>

      <SectionTitle
        title="Issuance batches"
        description="A batch is only mintable when the on-chain count equals the off-chain unit register at the same cut, every recipient wallet is whitelisted, and every recipient resolves to a jurisdiction currently open for distribution."
      />
      <GlassPanel className="p-1" sheen={false}>
        <DataTable columns={columns} rows={rows} columnPicker emptyLabel="No issuance batches" />
      </GlassPanel>
    </div>
  );
}
