import { useState } from "react";
import { Play } from "lucide-react";
import { Button, Field, GlassPanel, Input, PageHeader, useToast } from "../../ui";
import { tokenConsole } from "../../lib/api";
import { useAsyncData } from "../../lib/useAsyncData";
import { calendarDate, label, money, units } from "../../lib/tokenConsole/format";
import { useAction } from "../../lib/tokenConsole/useAction";
import type { NavSnapshotView, Product } from "../../lib/tokenConsole/types.gen";
import { Code, ConsoleTable, StatusBadge } from "../../components/tokenconsole/ConsoleTable";
import { ActionModal, todayIso } from "../../components/tokenconsole/ActionModal";

type Row = Product & { navPerUnit: number | null | undefined };

/* A product's price per unit, struck by the NAV run from its sub-fund's
   backing and appreciation. A product the run hasn't reached yet has no NAV —
   shown as "not struck", never as zero. */
export default function TokenConsoleNav() {
  const toast = useToast();
  const products = useAsyncData<Row[]>(async () => {
    const list = await tokenConsole.products();
    // One call per product; a product with no NAV answers null, not an error.
    return Promise.all(list.map(async (p) => ({ ...p, navPerUnit: p.productId ? (await tokenConsole.nav(p.productId)).navPerUnit : null })));
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  // Bumped by each NAV run so the history panel re-reads what it just struck.
  const [runs, setRuns] = useState(0);
  const active = selected ?? products.data?.find((p) => p.navPerUnit != null)?.productId ?? products.data?.[0]?.productId ?? null;

  return (
    <div>
      <PageHeader
        eyebrow="Baracel Unyt"
        title="NAV"
        subtitle="Net asset value per unit, per product. Select a product for its history."
        actions={<Button size="sm" onClick={() => setRunning(true)}><Play size={14} /> Run NAV</Button>}
      />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ConsoleTable<Row>
          className=""
          title="Products"
          what="NAV by product"
          source={products}
          rowId={(r) => r.productId}
          selectedId={active}
          onRowClick={(r) => setSelected(r.productId ?? null)}
          emptyLabel="No products"
          columns={[
            { key: "product", header: "Product", render: (r) => (
              <div>
                <Code>{r.productId}</Code>
                <div className="text-sm text-text">{r.name ?? "—"}</div>
              </div>
            ) },
            { key: "nav", header: "NAV / unit", className: "tabular text-right whitespace-nowrap", render: (r) =>
              r.navPerUnit == null ? <span className="text-xs text-text-faint">Not struck</span> : money(r.navPerUnit, r.currency) },
          ]}
        />
        <GlassPanel className="p-4" sheen={false}>
          {active ? <History key={`${active}-${runs}`} productId={active} currency={products.data?.find((p) => p.productId === active)?.currency} />
            : <p className="py-6 text-center text-[13px] text-text-soft">No product selected.</p>}
        </GlassPanel>
      </div>
      {running && (
        <RunNavModal
          onClose={() => setRunning(false)}
          onDone={(message) => {
            setRunning(false);
            toast.push(message);
            void products.reload();
            setRuns((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

function History({ productId, currency }: { productId: string; currency?: string }) {
  const history = useAsyncData(() => tokenConsole.navHistory(productId));
  const rows = [...(history.data ?? [])].sort((a, b) => (b.asOf ?? "").localeCompare(a.asOf ?? ""));
  return (
    <ConsoleTable<NavSnapshotView>
      className=""
      title={`History · ${productId}`}
      description="Every NAV struck for this product, newest first."
      what="NAV history"
      source={history}
      rows={rows}
      rowId={(r) => r.navId}
      emptyLabel="No NAV struck for this product yet — run NAV to strike one"
      columns={[
        { key: "asOf", header: "As of", render: (r) => <span className="tabular text-xs">{calendarDate(r.asOf)}</span> },
        { key: "nav", header: "NAV / unit", className: "tabular text-right", render: (r) => money(r.navPerUnit, currency) },
        { key: "units", header: "Units", className: "tabular text-right", render: (r) => units(r.unitsOutstanding), hideOnMobile: true },
        { key: "net", header: "Net assets", className: "tabular text-right", render: (r) => money(r.netAssets, currency), hideOnMobile: true },
        { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
      ]}
    />
  );
}

function RunNavModal({ onClose, onDone }: { onClose: () => void; onDone: (message: string) => void }) {
  const [asOf, setAsOf] = useState(todayIso());
  const run = useAction(tokenConsole.runNav);
  const submit = async () => {
    const r = await run.run(asOf || undefined);
    if (!r) return;
    onDone(`NAV run ${label(r.status).toLowerCase()} for ${r.productCount ?? 0} products${r.failureCount ? `, ${r.failureCount} failed` : ""}${r.message ? ` — ${r.message}` : "."}`);
  };
  return (
    <ActionModal
      title="Run NAV"
      description="Strikes a NAV for every product as of the date. A product whose price can't be computed is reported as a failure, not given a guessed price."
      submitLabel="Run NAV"
      pendingLabel="Running…"
      pending={run.pending}
      error={run.error}
      onSubmit={() => void submit()}
      onClose={onClose}
    >
      <Field label="As of" hint="Blank uses today on the service.">
        <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
      </Field>
    </ActionModal>
  );
}
