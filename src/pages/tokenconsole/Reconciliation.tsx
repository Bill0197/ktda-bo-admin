import { useState } from "react";
import { Badge, Modal, NotePanel, PageHeader } from "../../ui";
import { tokenConsole } from "../../lib/api";
import { useAsyncData } from "../../lib/useAsyncData";
import { money, units } from "../../lib/tokenConsole/format";
import type { ReconciliationResult } from "../../lib/tokenConsole/types.gen";
import { Code, ConsoleTable } from "../../components/tokenconsole/ConsoleTable";
import { DetailItem } from "../../components/tokenconsole/DetailItem";

const num = "tabular text-right whitespace-nowrap";

export default function TokenConsoleReconciliation() {
  const recon = useAsyncData(tokenConsole.reconciliation);
  const rows = recon.data ?? [];
  const broken = rows.filter((r) => r.matched === false);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        eyebrow="Tokenization Console"
        title="Reconciliation"
        subtitle="Does the unit ledger still agree with the general ledger? A difference means units moved without the matching posting, or the reverse. Select a product to re-check it now."
      />
      {broken.length > 0 && (
        <NotePanel tone="danger" className="mb-5" title={`${broken.length} product${broken.length === 1 ? "" : "s"} out of agreement`}>
          {broken.map((r) => r.productId ?? "Unknown product").join(", ")}. Find the unmatched movement before the next
          distribution or NAV run uses these figures.
        </NotePanel>
      )}
      <ConsoleTable<ReconciliationResult>
        what="reconciliation"
        source={recon}
        rowId={(r) => r.productId}
        onRowClick={(r) => setOpen(r.productId ?? null)}
        emptyLabel="Nothing to reconcile: a product needs a linked token class first"
        columns={[
          { key: "product", header: "Product", render: (r) => <Code>{r.productId}</Code> },
          { key: "contracts", header: "Contracts", className: num, render: (r) => units(r.contractCount), hideOnMobile: true },
          { key: "units", header: "Units", className: num, render: (r) => units(r.unitsOutstanding) },
          { key: "ledger", header: "Unit ledger", className: num, render: (r) => money(r.unitLedgerValue) },
          { key: "gl", header: "GL principal", className: num, render: (r) => money(r.glPrincipal) },
          { key: "diff", header: "Difference", className: num, render: (r) => (
            <span className={r.matched === false ? "text-danger" : undefined}>{money(r.difference)}</span>
          ) },
          { key: "result", header: "Result", render: (r) => r.matched === undefined
            ? <span className="text-text-faint">—</span>
            : <div>
                <Badge tone={r.matched ? "success" : "danger"} className="whitespace-nowrap">{r.matched ? "Matched" : "Out"}</Badge>
                {r.note && <div className="text-[11px] text-text-faint mt-1 max-w-xs">{r.note}</div>}
              </div> },
        ]}
      />
      <Modal open={!!open} onClose={() => setOpen(null)} title={`Reconciliation · ${open ?? ""}`} size="md">
        {open && <ProductCheck key={open} productId={open} />}
      </Modal>
    </div>
  );
}

/** One product, checked again on its own — after a fix, without re-running the lot. */
function ProductCheck({ productId }: { productId: string }) {
  const check = useAsyncData(() => tokenConsole.reconciliationFor(productId));
  const r = check.data;
  if (check.error) return <NotePanel tone="danger">{check.error}</NotePanel>;
  if (!r) return <p className="text-sm text-text-soft">Checking…</p>;
  return (
    <>
      <div className="mb-4">
        <Badge tone={r.matched ? "success" : "danger"}>{r.matched ? "Matched" : "Out of agreement"}</Badge>
        {r.note && <p className="mt-2 text-sm text-text-soft">{r.note}</p>}
      </div>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <DetailItem term="Token class"><Code>{r.tokenClassId ?? "—"}</Code></DetailItem>
        <DetailItem term="Contracts">{units(r.contractCount)}</DetailItem>
        <DetailItem term="Units outstanding">{units(r.unitsOutstanding)}</DetailItem>
        <DetailItem term="Price per unit">{money(r.pricePerUnit)}</DetailItem>
        <DetailItem term="Unit ledger value">{money(r.unitLedgerValue)}</DetailItem>
        <DetailItem term="GL principal">{money(r.glPrincipal)}</DetailItem>
        <DetailItem term="Difference"><span className={r.matched ? undefined : "text-danger"}>{money(r.difference)}</span></DetailItem>
      </dl>
    </>
  );
}
