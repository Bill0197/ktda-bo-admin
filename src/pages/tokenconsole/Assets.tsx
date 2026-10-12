import { useState } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { Badge, Button, Modal, NotePanel, PageHeader, useToast } from "../../ui";
import { tokenConsole } from "../../lib/api";
import { useAsyncData } from "../../lib/useAsyncData";
import { dateTime, label, money, percent, shortId } from "../../lib/tokenConsole/format";
import { invalidateList } from "../../lib/tokenConsole/sharedList";
import { useAction } from "../../lib/tokenConsole/useAction";
import type { AssetResponse } from "../../lib/tokenConsole/types.gen";
import type { AssetBackingRowActual } from "../../lib/tokenConsole/spec-deviations";
import { Code, ConsoleTable, StatusBadge } from "../../components/tokenconsole/ConsoleTable";
import { DetailItem } from "../../components/tokenconsole/DetailItem";
import { ActionModal } from "../../components/tokenconsole/ActionModal";
import { EntityCreateFlow } from "../../components/tokenconsole/EntityCreate";

/* What the offerings are backed by. A new asset starts as a draft and must be
   approved before an offering can claim against it; retiring one ends it. The
   backing table shows how much of each asset's value offerings have claimed. */
export default function TokenConsoleAssets() {
  const toast = useToast();
  const assets = useAsyncData(() => tokenConsole.assets());
  const backing = useAsyncData(tokenConsole.assetBacking);
  const [open, setOpen] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);

  const refresh = () => {
    void assets.reload();
    void backing.reload();
    invalidateList("tok:asset");
  };

  return (
    <div>
      <PageHeader
        eyebrow="Baracel Unyt"
        title="Assets"
        subtitle="The assets offerings are backed by, and how much of each has been claimed. A new asset needs approval before it can back anything."
        actions={<Button size="sm" onClick={() => setRegistering(true)}><Plus size={14} /> Register asset</Button>}
      />
      <ConsoleTable<AssetResponse>
        title="Register"
        what="assets"
        source={assets}
        rowId={(r) => r.assetId}
        onRowClick={(r) => setOpen(r.assetId ?? null)}
        emptyLabel="No assets registered"
        columns={[
          { key: "name", header: "Asset", render: (r) => (
            <div>
              <div className="font-medium text-text">{r.name ?? "—"}</div>
              <Code>{shortId(r.assetId)}</Code>
            </div>
          ) },
          { key: "class", header: "Class", render: (r) => label(r.assetClass), hideOnMobile: true },
          { key: "value", header: "Valuation", className: "tabular text-right", render: (r) => money(r.valuationAmount, r.currency) },
          { key: "rate", header: "Appreciation", className: "tabular text-right", render: (r) => percent(r.appreciationRate), hideOnMobile: true },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
        ]}
      />
      <ConsoleTable<AssetBackingRowActual>
        title="Backing"
        description="Offering claims against each asset's valuation. Over-subscribed means claims exceed the value behind them."
        what="asset backing"
        source={backing}
        rowId={(r) => r.assetId}
        emptyLabel="No asset backs an offering yet"
        columns={[
          { key: "name", header: "Asset", render: (r) => r.name ?? "—" },
          { key: "value", header: "Valuation", className: "tabular text-right", render: (r) => money(r.valuation, r.currency) },
          { key: "claims", header: "Claimed", className: "tabular text-right", render: (r) => money(r.claims, r.currency) },
          { key: "headroom", header: "Headroom", className: "tabular text-right", render: (r) => money(r.headroom, r.currency), hideOnMobile: true },
          { key: "use", header: "Used", className: "tabular text-right", render: (r) => percent(r.utilization) },
          { key: "flag", header: "", render: (r) => (r.overSubscribed ? <Badge tone="danger">Over-subscribed</Badge> : null) },
        ]}
      />
      <Modal open={!!open} onClose={() => setOpen(null)} title="Asset" size="md">
        {open && <AssetPanel key={open} assetId={open} onChanged={refresh} />}
      </Modal>
      {registering &&
        createPortal(
          <EntityCreateFlow
            entityKey="asset"
            originLabel="Assets"
            onCreated={(id) => {
              toast.push("Registered as a draft — approve it before it can back an offering.");
              refresh();
              setOpen(id);
            }}
            onClose={() => setRegistering(false)}
          />,
          document.body,
        )}
    </div>
  );
}

function AssetPanel({ assetId, onChanged }: { assetId: string; onChanged: () => void }) {
  const toast = useToast();
  const asset = useAsyncData(() => tokenConsole.asset(assetId));
  const act = useAction((kind: "approve" | "retire") => (kind === "approve" ? tokenConsole.approveAsset(assetId) : tokenConsole.retireAsset(assetId)));
  const [confirm, setConfirm] = useState<"approve" | "retire" | null>(null);
  const a = asset.data;

  const run = async () => {
    if (!confirm) return;
    const done = await act.run(confirm);
    if (!done) return;
    toast.push(confirm === "approve" ? "Asset approved." : "Asset retired.");
    setConfirm(null);
    void asset.reload();
    onChanged();
  };

  return (
    <>
      {asset.error && <NotePanel tone="danger" className="mb-4">{asset.error}</NotePanel>}
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <DetailItem term="Name">{a?.name ?? "—"}</DetailItem>
        <DetailItem term="Status"><StatusBadge status={a?.status} /></DetailItem>
        <DetailItem term="Class">{label(a?.assetClass)}</DetailItem>
        <DetailItem term="Currency">{a?.currency ?? "—"}</DetailItem>
        <DetailItem term="Valuation">{money(a?.valuationAmount, a?.currency)}</DetailItem>
        <DetailItem term="Appreciation">{percent(a?.appreciationRate)}</DetailItem>
        <DetailItem term="Created">{dateTime(a?.createdAt)}</DetailItem>
        <DetailItem term="Updated">{dateTime(a?.updatedAt)}</DetailItem>
      </dl>
      {a?.description && <p className="mt-4 text-sm text-text-soft">{a.description}</p>}
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {a?.status === "DRAFT" && <Button size="sm" onClick={() => { act.reset(); setConfirm("approve"); }}>Approve</Button>}
        {a && a.status !== "RETIRED" && (
          <Button size="sm" variant="ghost" onClick={() => { act.reset(); setConfirm("retire"); }}>Retire</Button>
        )}
        {a?.status === "RETIRED" && <span className="text-[12.5px] text-text-soft">Retired — it backs nothing new.</span>}
      </div>
      {confirm && (
        <ActionModal
          size="sm"
          title={confirm === "approve" ? "Approve this asset?" : "Retire this asset?"}
          description={confirm === "approve"
            ? "Offerings can then be created against it."
            : "It stops backing new offerings. Retiring is terminal."}
          submitLabel={confirm === "approve" ? "Approve" : "Retire"}
          tone={confirm === "approve" ? "primary" : "danger"}
          pending={act.pending}
          error={act.error}
          onSubmit={() => void run()}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  );
}
