import { useMemo, useState } from "react";
import { Button, DataTable, Field, NotePanel, Select, Textarea, useToast } from "../../ui";
import { tokenConsole } from "../../lib/api";
import { useAsyncData } from "../../lib/useAsyncData";
import { dateTime, label, money, units } from "../../lib/tokenConsole/format";
import { useAction } from "../../lib/tokenConsole/useAction";
import { currentClassifier } from "../../lib/tokenConsole/kyc";
import { Code, StatusBadge } from "./ConsoleTable";
import { DetailItem } from "./DetailItem";
import { ActionModal } from "./ActionModal";
import { InvestorPhotos } from "./CustomerPhotos";

type Lifecycle = "suspend" | "reactivate" | "offboard";
const LIFECYCLE: Record<Lifecycle, { title: string; body: string; label: string; ok: string; danger: boolean }> = {
  suspend: { title: "Suspend this investor?", body: "They can no longer subscribe, redeem or withdraw until reactivated.", label: "Suspend", ok: "Investor suspended.", danger: true },
  reactivate: { title: "Reactivate this investor?", body: "Lifts the suspension; they can transact again.", label: "Reactivate", ok: "Investor reactivated.", danger: false },
  offboard: {
    title: "Offboard this investor?",
    body: "Offboarding is terminal: no new accounts, and withdrawals stop applying. Settle their holdings first.",
    label: "Offboard", ok: "Investor offboarded.", danger: true,
  },
};

/** Everything the register holds on one investor: standing, holdings and cash,
 *  unit movements per product, the photos they sent from the app, and the
 *  lifecycle decisions staff can take. */
export function InvestorPanel({ investorId, onChanged }: { investorId: string; onChanged: () => void }) {
  const toast = useToast();
  const detail = useAsyncData(() => tokenConsole.investor(investorId));
  const balances = useAsyncData(() => tokenConsole.investorBalances(investorId));
  const act = useAction(async (kind: Lifecycle, note: string) => {
    const body = { note: note.trim() || undefined };
    if (kind === "suspend") return tokenConsole.suspendInvestor(investorId, body);
    if (kind === "reactivate") return tokenConsole.reactivateInvestor(investorId, body);
    return tokenConsole.offboardInvestor(investorId, body);
  });
  const [confirm, setConfirm] = useState<Lifecycle | null>(null);
  const [note, setNote] = useState("");

  const v = detail.data;
  const b = balances.data;
  const status = v?.lifecycleStatus;
  const products = useMemo(() => {
    const ids = new Set<string>();
    for (const a of v?.accounts ?? []) if (a.productId) ids.add(a.productId);
    for (const u of b?.units ?? []) if (u.productId) ids.add(u.productId);
    return [...ids];
  }, [v, b]);
  const [product, setProduct] = useState("");
  const activeProduct = product || products[0] || "";

  const run = async () => {
    if (!confirm) return;
    const done = await act.run(confirm, note);
    if (!done) return;
    toast.push(LIFECYCLE[confirm].ok);
    setConfirm(null);
    void detail.reload();
    onChanged();
  };
  const ask = (k: Lifecycle) => { act.reset(); setNote(""); setConfirm(k); };

  const unitRows = (b?.units ?? []).map((u, i) => ({ ...u, id: `${u.offeringId ?? i}-${u.source ?? ""}` }));
  const cashRows = (b?.ledgerCash ?? []).map((c, i) => ({ ...c, id: `${c.accountCode ?? i}-${c.currency ?? ""}` }));

  return (
    <>
      {(detail.error || balances.error) && <NotePanel tone="danger" className="mb-4">{detail.error ?? balances.error}</NotePanel>}
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3 mb-5">
        <DetailItem term="Reference"><Code>{v?.externalRef}</Code></DetailItem>
        <DetailItem term="Category">{label(v?.category)}</DetailItem>
        <DetailItem term="Lifecycle"><StatusBadge status={status} /></DetailItem>
        <DetailItem term="KYC status"><StatusBadge status={currentClassifier(v, "KYC_STATUS")?.code} /></DetailItem>
        <DetailItem term="Risk tier">{currentClassifier(v, "RISK_TIER")?.name ?? "—"}</DetailItem>
        <DetailItem term="Jurisdiction">{currentClassifier(v, "JURISDICTION")?.name ?? "—"}</DetailItem>
        <DetailItem term="Units value">{money(b?.totalUnitValue)}</DetailItem>
        <DetailItem term="Net cash in the books">{money(b?.netLedgerCash)}</DetailItem>
        <DetailItem term="Wallet">
          {b?.walletReachable === false ? <span className="text-xs text-text-faint">Unreachable</span>
            : (b?.walletCash ?? []).length ? (b?.walletCash ?? []).map((w) => money(w.available, w.currency)).join(" · ") : "—"}
        </DetailItem>
      </dl>

      <h3 className="mb-2 text-[13px] font-semibold text-text">Holdings</h3>
      <DataTable
        rows={unitRows}
        emptyLabel={balances.loading ? "Loading…" : "Holds no units"}
        columns={[
          { key: "product", header: "Product", render: (u) => <Code>{u.productId}</Code> },
          { key: "offering", header: "Offering", render: (u) => <Code>{u.offeringId}</Code>, hideOnMobile: true },
          { key: "qty", header: "Units", className: "tabular text-right", render: (u) => units(u.quantity) },
          { key: "value", header: "Value", className: "tabular text-right", render: (u) => money(u.value, u.currency) },
        ]}
      />

      <h3 className="mt-5 mb-2 text-[13px] font-semibold text-text">Cash in the books</h3>
      <DataTable
        rows={cashRows}
        emptyLabel={balances.loading ? "Loading…" : "No cash accounts"}
        columns={[
          { key: "account", header: "Account", render: (c) => (
            <div>
              <Code>{c.accountCode}</Code>
              <div className="text-xs text-text-soft">{c.accountName ?? "—"}</div>
            </div>
          ) },
          { key: "owed", header: "", render: (c) => <span className="text-xs text-text-faint">{c.owedToInvestor ? "Owed to them" : "Owed by them"}</span>, hideOnMobile: true },
          { key: "bal", header: "Balance", className: "tabular text-right", render: (c) => money(c.balance, c.currency) },
        ]}
      />

      <div className="mt-5 mb-2 flex flex-wrap items-end justify-between gap-3">
        <h3 className="text-[13px] font-semibold text-text">Unit movements</h3>
        {products.length > 1 && (
          <Field label="Product">
            <Select value={activeProduct} onChange={(e) => setProduct(e.target.value)}>
              {products.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </Field>
        )}
      </div>
      {activeProduct
        ? <Movements key={activeProduct} investorId={investorId} product={activeProduct} />
        : <p className="text-sm text-text-soft">No product to show movements for.</p>}

      <h3 className="mt-5 mb-2 text-[13px] font-semibold text-text">Identity photos</h3>
      <InvestorPhotos investorId={investorId} />

      <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
        {status === "SUSPENDED"
          ? <Button size="sm" onClick={() => ask("reactivate")}>Reactivate</Button>
          : <Button size="sm" variant="outline" disabled={!v || status === "OFFBOARDED"} onClick={() => ask("suspend")}>Suspend</Button>}
        <Button size="sm" variant="ghost" disabled={!v || status === "OFFBOARDED"} onClick={() => ask("offboard")}>Offboard</Button>
        {status === "OFFBOARDED" && <span className="self-center text-[12.5px] text-text-soft">Offboarded — nothing further can be done.</span>}
      </div>
      {confirm && (
        <ActionModal
          title={LIFECYCLE[confirm].title}
          description={LIFECYCLE[confirm].body}
          submitLabel={LIFECYCLE[confirm].label}
          tone={LIFECYCLE[confirm].danger ? "danger" : "primary"}
          pending={act.pending}
          error={act.error}
          onSubmit={() => void run()}
          onClose={() => setConfirm(null)}
        >
          <Field label="Note" hint="Kept on their lifecycle history.">
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </ActionModal>
      )}
    </>
  );
}

function Movements({ investorId, product }: { investorId: string; product: string }) {
  const moves = useAsyncData(() => tokenConsole.unitMovements(investorId, product));
  const rows = [...(moves.data ?? [])]
    .sort((a, b) => (b.occurredAt ?? "").localeCompare(a.occurredAt ?? ""))
    .map((m, i) => ({ ...m, id: `${m.occurredAt ?? ""}-${i}` }));
  if (moves.error) return <NotePanel tone="danger">{moves.error}</NotePanel>;
  return (
    <DataTable
      rows={rows}
      emptyLabel={moves.loading ? "Loading…" : "No unit movements"}
      columns={[
        { key: "when", header: "When", render: (m) => <span className="tabular text-xs text-text-soft">{dateTime(m.occurredAt)}</span> },
        { key: "type", header: "Movement", render: (m) => label(m.type) },
        { key: "qty", header: "Units", className: "tabular text-right", render: (m) => units(m.quantity) },
        { key: "price", header: "Price", className: "tabular text-right", render: (m) => money(m.pricePerUnit, m.currency), hideOnMobile: true },
        { key: "cp", header: "Counterparty", render: (m) => <Code>{m.counterpartyRef ?? "—"}</Code>, hideOnMobile: true },
      ]}
    />
  );
}
