import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, Tag } from "lucide-react";
import { Badge, Button, Field, Input, NotePanel, PageHeader, useToast } from "../../ui";
import { useAsyncData } from "../../lib/useAsyncData";
import { useAction } from "../../lib/tokenConsole/useAction";
import { tokenConsole } from "../../lib/api.tokenConsole";
import { dateTime, money, percent } from "../../lib/tokenConsole/format";
import { pendingFor, type ConfigChange } from "../../lib/tokenConsole/configChanges";
import { MAX_SPREAD_PCT, midOf, previewOf, priceProblem, spreadPctOf, type BondTerms, type MarketQuote } from "../../lib/tokenConsole/prices";
import { useOfferingNames } from "../../lib/tokenConsole/offeringNames";
import { ConsoleTable, SourceError, StatusBadge } from "../../components/tokenconsole/ConsoleTable";
import { ActionModal } from "../../components/tokenconsole/ActionModal";

/* The buy and sell price investors see for each bond, and the desk's way to
   set it (BOND_PRICE_SET, maker-checker). One person proposes a mid and a
   spread; once someone else approves it in Change approvals, the engine's next
   pricing run (within a minute) quotes it, and the apps show it on their next
   refresh. Afterwards the price moves only a little around the desk's. */

type Row = {
  offeringId: string;
  productId: string;
  name: string;
  currency: string;
  quote: MarketQuote | null;
  terms: BondTerms;
  pending: ConfigChange | null;
};

/** Numbers to the precision a bond price is quoted in. */
const price = (v: number | null | undefined, ccy?: string | null) =>
  v == null ? "—" : `${ccy ? `${ccy} ` : ""}${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(v)}`;

export default function TokenConsolePrices() {
  const toast = useToast();
  const terms = useAsyncData(tokenConsole.bondTerms);
  const quotes = useAsyncData(tokenConsole.quotes);
  const offerings = useAsyncData(tokenConsole.offerings);
  const pending = useAsyncData(() => tokenConsole.configChanges("PENDING"));
  const { nameOf } = useOfferingNames();
  const [editing, setEditing] = useState<Row | null>(null);
  const [mid, setMid] = useState("");
  const [spread, setSpread] = useState("");
  const [touched, setTouched] = useState(false);
  const stage = useAction((r: Row, m: number, s: number) =>
    tokenConsole.stageChange("BOND_PRICE_SET", { productId: r.productId, midPrice: m, quoteSpread: s / 100 }));

  const reloadAll = () => {
    void terms.reload();
    void quotes.reload();
    void offerings.reload();
    void pending.reload();
  };

  // Every open offering of a product with bond terms is a priced bond.
  const rows = useMemo<Row[]>(() => {
    const byProduct = new Map((terms.data ?? []).map((t) => [t.productId, t]));
    const quoteOf = new Map((quotes.data ?? []).map((q) => [q.offeringId, q]));
    return (offerings.data ?? [])
      .filter((o) => o.offeringId && o.productId && byProduct.has(o.productId) && (o.status ?? "").toUpperCase() === "OPEN")
      .map((o) => ({
        offeringId: o.offeringId!,
        productId: o.productId!,
        name: nameOf(o.offeringId!),
        currency: o.currency ?? "",
        quote: quoteOf.get(o.offeringId!) ?? null,
        terms: byProduct.get(o.productId!)!,
        pending: pendingFor(pending.data, o.productId!, ["BOND_PRICE_SET"])[0] ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [terms.data, quotes.data, offerings.data, pending.data, nameOf]);

  const loading = terms.loading || quotes.loading || offerings.loading;
  const error = terms.error ?? offerings.error ?? null;

  const open = (r: Row) => {
    stage.reset();
    const m = midOf(r.quote);
    setMid(m == null ? "" : String(Math.round(m * 10000) / 10000));
    const s = r.terms.quoteSpread != null ? Math.round(r.terms.quoteSpread * 10000) / 100 : spreadPctOf(r.quote);
    setSpread(s == null ? "" : String(s));
    setTouched(false);
    setEditing(r);
  };

  const problem = priceProblem(mid, spread);
  const preview = problem ? null : previewOf(Number(mid), Number(spread));

  const submit = async () => {
    if (!editing || problem || stage.pending) return;
    const done = await stage.run(editing, Number(mid), Number(spread));
    void pending.reload();
    if (!done) return; // the engine's words are on the dialog
    toast.push(`Sent for approval. ${editing.name} is quoted at the new price once someone else approves it.`);
    setEditing(null);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Baracel Unyt"
        title="Bond prices"
        subtitle="The price investors buy and sell each bond at. A new price is quoted within a minute of someone other than the person who proposed it approving it."
        actions={
          <Button size="sm" variant="outline" disabled={loading} onClick={reloadAll}>
            <RefreshCw size={14} className={loading ? "animate-spin" : undefined} /> {loading ? "Loading…" : "Refresh"}
          </Button>
        }
      />

      {quotes.error && <SourceError what="the live quotes" error={quotes.error} onRetry={quotes.reload} />}
      {pending.error && <SourceError what="the changes awaiting approval" error={pending.error} onRetry={pending.reload} />}
      {rows.some((r) => r.pending) && (
        <NotePanel tone="info" className="mb-5" title="Waiting for a second person">
          A proposed price takes effect once someone else approves it in{" "}
          <Link className="font-semibold text-primary-600 underline-offset-2 hover:underline" to="/token-console/changes">Change approvals</Link>.
        </NotePanel>
      )}

      <ConsoleTable<Row>
        what="the bonds"
        source={{ data: error ? null : rows, loading, error, reload: reloadAll }}
        rowId={(r) => r.offeringId}
        emptyLabel="No open bond is priced yet."
        columns={[
          { key: "bond", header: "Bond", className: "min-w-[160px]", render: (r) => (
            <div>
              <div className="font-semibold text-text">{r.name}</div>
              <div className="text-xs text-text-faint">{r.productId}{r.terms.isin ? ` · ${r.terms.isin}` : ""}</div>
            </div>
          ) },
          { key: "buy", header: "Investors buy at", className: "tabular text-right whitespace-nowrap", render: (r) => price(r.quote?.offer, r.currency) },
          { key: "sell", header: "Investors sell at", className: "tabular text-right whitespace-nowrap", render: (r) => price(r.quote?.bid, r.currency) },
          { key: "mid", header: "Mid", className: "tabular text-right whitespace-nowrap", hideOnMobile: true, defaultHidden: true, render: (r) => price(midOf(r.quote), r.currency) },
          { key: "spread", header: "Spread", className: "tabular text-right whitespace-nowrap", hideOnMobile: true, render: (r) => {
            const s = spreadPctOf(r.quote);
            return s == null ? "—" : `${s.toFixed(2)}%`;
          } },
          { key: "yield", header: "Yield", className: "tabular text-right whitespace-nowrap", hideOnMobile: true, render: (r) => percent(r.quote?.yield) },
          { key: "status", header: "Quote", className: "whitespace-nowrap", render: (r) => (
            <div>
              <StatusBadge status={r.quote?.status ?? (quotes.loading ? null : "NOT_QUOTED")} />
              {r.quote?.asOf && <div className="mt-1 text-xs text-text-faint">{dateTime(r.quote.asOf)}</div>}
            </div>
          ) },
          { key: "desk", header: "Desk price", className: "min-w-[150px]", hideOnMobile: true, render: (r) => r.pending ? (
            <Badge tone="warning" className="whitespace-nowrap">Awaiting approval</Badge>
          ) : r.terms.anchorSetAt ? (
            <div className="text-xs text-text-soft">Set {dateTime(r.terms.anchorSetAt)}</div>
          ) : (
            <span className="text-xs text-text-faint">Market</span>
          ) },
          { key: "action", header: "", className: "text-right whitespace-nowrap", render: (r) => (
            <Button size="sm" variant="outline" disabled={!!r.pending} onClick={() => open(r)} aria-label={`Set the price of ${r.name}`}>
              <Tag size={14} /> Set price
            </Button>
          ) },
        ]}
      />

      {editing && (
        <ActionModal
          title={`Set the price of ${editing.name}`}
          description="Propose the mid price and the spread. Nothing changes until someone else approves it in Change approvals."
          submitLabel="Send for approval"
          pendingLabel="Sending…"
          problem={problem ?? undefined}
          showProblem={touched}
          pending={stage.pending}
          error={stage.error}
          onSubmit={() => void submit()}
          onClose={() => setEditing(null)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`Mid price per unit (${editing.currency})`} hint={`Now ${price(midOf(editing.quote), editing.currency)}`}>
              <Input type="number" inputMode="decimal" step="0.0001" min="0" value={mid} autoFocus
                onChange={(e) => { setMid(e.target.value); setTouched(true); }} />
            </Field>
            <Field label="Spread (%)" hint={`Buy-sell width as a share of mid, 0 to ${MAX_SPREAD_PCT}%`}>
              <Input type="number" inputMode="decimal" step="0.01" min="0" max={MAX_SPREAD_PCT} value={spread}
                onChange={(e) => { setSpread(e.target.value); setTouched(true); }} />
            </Field>
          </div>
          {preview && (
            <div className="mt-4 grid grid-cols-2 gap-3 rounded-md bg-surface-sunken px-4 py-3 text-sm">
              <div>
                <div className="text-xs text-text-faint">Investors buy at</div>
                <div className="tabular font-semibold text-text">{price(preview.buy, editing.currency)}</div>
              </div>
              <div>
                <div className="text-xs text-text-faint">Investors sell at</div>
                <div className="tabular font-semibold text-text">{price(preview.sell, editing.currency)}</div>
              </div>
            </div>
          )}
          <p className="mt-3 text-xs text-text-faint">
            The engine refuses a price the bond cannot trade at. Once approved, the price moves only a little around it.
            {editing.quote?.accruedInterest != null && ` Accrued interest of ${money(editing.quote.accruedInterest, editing.currency)} is added on top when investors buy.`}
          </p>
        </ActionModal>
      )}
    </div>
  );
}
