import { useState } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { Button, Field, Input, Modal, NotePanel, PageHeader, Tabs, useToast } from "../../ui";
import { tokenConsole } from "../../lib/api";
import { useAsyncData } from "../../lib/useAsyncData";
import { dateTime, money, shortId, units } from "../../lib/tokenConsole/format";
import { invalidateList } from "../../lib/tokenConsole/sharedList";
import { useAction } from "../../lib/tokenConsole/useAction";
import type {
  HoldingResponse, OfferingResponse, RedemptionResponse, SubscriptionResponse, TradeResponse,
} from "../../lib/tokenConsole/types.gen";
import { Code, ConsoleTable, StatusBadge } from "../../components/tokenconsole/ConsoleTable";
import { DetailItem } from "../../components/tokenconsole/DetailItem";
import { ActionModal, isNumber, isPositive, numberOrBlank, todayIso } from "../../components/tokenconsole/ActionModal";
import { AssetPicker, InvestorPicker, ProductPicker } from "../../components/tokenconsole/Pickers";

const num = "tabular text-right whitespace-nowrap";

export default function TokenConsoleOfferings() {
  const toast = useToast();
  const offerings = useAsyncData(tokenConsole.offerings);
  const trades = useAsyncData(tokenConsole.allTrades);
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = () => {
    void offerings.reload();
    void trades.reload();
    invalidateList("tok:offering");
  };

  return (
    <div>
      <PageHeader
        eyebrow="Baracel Unyt"
        title="Offerings"
        subtitle="Primary issuance windows: what is on sale, at what price, and how much is left. Select one to work its order book."
        actions={<Button size="sm" onClick={() => setCreating(true)}><Plus size={14} /> New offering</Button>}
      />
      <ConsoleTable<OfferingResponse>
        what="offerings"
        newest={(r) => r.createdAt}
        source={offerings}
        rowId={(r) => r.offeringId}
        onRowClick={(r) => setOpen(r.offeringId ?? null)}
        emptyLabel="No offerings"
        columns={[
          { key: "offering", header: "Offering", render: (r) => (
            <div>
              <Code>{r.offeringId}</Code>
              <div className="text-xs text-text-faint">{r.productId ?? "—"}</div>
            </div>
          ) },
          { key: "price", header: "Price", className: num, render: (r) => money(r.pricePerUnit, r.currency) },
          { key: "total", header: "Total units", className: num, render: (r) => units(r.totalUnits), hideOnMobile: true },
          { key: "issued", header: "Issued", className: num, render: (r) => units(r.outstandingUnits) },
          { key: "remaining", header: "Remaining", className: num, render: (r) => units(r.remainingUnits) },
          { key: "created", header: "Created", render: (r) => <span className="tabular text-xs text-text-soft">{dateTime(r.createdAt)}</span>, hideOnMobile: true },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
        ]}
      />
      <ConsoleTable<TradeResponse>
        title="Secondary trades"
        description="Units that changed hands between investors, across every offering."
        what="trades"
        newest={(r) => r.createdAt}
        source={trades}
        rowId={(r) => r.tradeId}
        emptyLabel="No secondary trades yet"
        columns={tradeColumns}
      />
      <Modal open={!!open} onClose={() => setOpen(null)} title={`Offering ${open ?? ""}`} size="lg">
        {open && <OfferingPanel key={open} offeringId={open} onChanged={refresh} />}
      </Modal>
      {creating && (
        <NewOfferingModal
          onClose={() => setCreating(false)}
          onCreated={(o) => {
            setCreating(false);
            toast.push(`Created offering ${o.offeringId ?? ""} as a draft — open it to start selling.`);
            refresh();
            setOpen(o.offeringId ?? null);
          }}
        />
      )}
    </div>
  );
}

const tradeColumns = [
  { key: "trade", header: "Trade", render: (r: TradeResponse) => (
    <div>
      <Code>{shortId(r.tradeId)}</Code>
      <div className="text-xs text-text-faint">{r.offeringId ?? "—"}</div>
    </div>
  ) },
  { key: "parties", header: "Seller → buyer", render: (r: TradeResponse) => (
    <span className="text-xs"><Code>{shortId(r.sellerInvestorId)}</Code> → <Code>{shortId(r.buyerInvestorId)}</Code></span>
  ), hideOnMobile: true },
  { key: "qty", header: "Units", className: num, render: (r: TradeResponse) => units(r.quantity) },
  { key: "price", header: "Price", className: num, render: (r: TradeResponse) => money(r.pricePerUnit, r.currency) },
  { key: "consideration", header: "Consideration", className: num, render: (r: TradeResponse) => money(r.consideration, r.currency) },
  { key: "premium", header: "Premium", className: num, render: (r: TradeResponse) => money(r.premium, r.currency), hideOnMobile: true },
  { key: "when", header: "When", render: (r: TradeResponse) => <span className="tabular text-xs text-text-soft">{dateTime(r.createdAt)}</span>, hideOnMobile: true },
];

function NewOfferingModal({ onClose, onCreated }: { onClose: () => void; onCreated: (o: OfferingResponse) => void }) {
  const create = useAction(tokenConsole.createOffering);
  const [assetId, setAssetId] = useState("");
  const [productId, setProductId] = useState("");
  const [price, setPrice] = useState("");
  const [total, setTotal] = useState("");
  const [minUnits, setMin] = useState("");
  const [maxUnits, setMax] = useState("");
  const touched = !!(assetId || productId || price || total || minUnits || maxUnits);
  const min = numberOrBlank(minUnits);
  const max = numberOrBlank(maxUnits);
  const problem = !assetId ? "Pick the asset that backs it."
    : !productId ? "Pick the product it sells."
    : !isPositive(price) ? "Enter a price per unit above 0."
    : !isPositive(total) ? "Enter the total units above 0."
    : (min !== undefined && !(min > 0)) || (max !== undefined && !(max > 0)) ? "Minimum and maximum must be above 0."
    : min !== undefined && max !== undefined && min > max ? "The minimum is above the maximum."
    : max !== undefined && max > Number(total) ? "The maximum is above the total units." : undefined;

  const submit = async () => {
    const o = await create.run({ assetId, productId, pricePerUnit: Number(price), totalUnits: Number(total), minUnits: min, maxUnits: max });
    if (o) onCreated(o);
  };

  return (
    <ActionModal
      title="New offering"
      description="An offering sells units of a product, backed by an approved asset. It starts as a draft; open it to take subscriptions."
      submitLabel="Create offering"
      problem={problem} showProblem={touched}
      pending={create.pending}
      error={create.error}
      onSubmit={() => void submit()}
      onClose={onClose}
      size="lg"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Backing asset" required group><AssetPicker value={assetId} onChange={setAssetId} /></Field>
        <Field label="Product" required group><ProductPicker value={productId} onChange={setProductId} /></Field>
        <Field label="Price per unit" required><Input type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="100" /></Field>
        <Field label="Total units" required><Input type="number" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} /></Field>
        <Field label="Minimum per order"><Input type="number" inputMode="decimal" value={minUnits} onChange={(e) => setMin(e.target.value)} /></Field>
        <Field label="Maximum per order"><Input type="number" inputMode="decimal" value={maxUnits} onChange={(e) => setMax(e.target.value)} /></Field>
      </div>
    </ActionModal>
  );
}

type Lifecycle = "open" | "close" | "cancel" | "connect";
const LIFECYCLE: Record<Lifecycle, { title: string; body: string; label: string; danger: boolean; ok: string }> = {
  open: { title: "Open this offering?", body: "It starts taking subscriptions.", label: "Open", danger: false, ok: "Offering opened." },
  close: { title: "Close this offering?", body: "It stops taking new subscriptions. Units already issued are unaffected.", label: "Close", danger: true, ok: "Offering closed." },
  cancel: { title: "Cancel this offering?", body: "Cancelling is terminal: it will never sell.", label: "Cancel offering", danger: true, ok: "Offering cancelled." },
  connect: {
    title: "Connect to the unit ledger?",
    body: "Links the offering to its product's token class, so its units are recorded on the unit ledger and reconcile against the books.",
    label: "Connect", danger: false, ok: "Connected to the unit ledger.",
  },
};

function OfferingPanel({ offeringId, onChanged }: { offeringId: string; onChanged: () => void }) {
  const toast = useToast();
  const offering = useAsyncData(() => tokenConsole.offering(offeringId));
  const subs = useAsyncData(() => tokenConsole.subscriptions(offeringId));
  const reds = useAsyncData(() => tokenConsole.redemptions(offeringId));
  const trades = useAsyncData(() => tokenConsole.trades(offeringId));
  const holdings = useAsyncData(() => tokenConsole.holdings(offeringId));
  const lifecycle = useAction((kind: Lifecycle) =>
    kind === "open" ? tokenConsole.openOffering(offeringId)
    : kind === "close" ? tokenConsole.closeOffering(offeringId)
    : kind === "cancel" ? tokenConsole.cancelOffering(offeringId)
    : tokenConsole.connectUnitLedger(offeringId));
  const [tab, setTab] = useState<"subs" | "reds" | "trades" | "holdings">("subs");
  const [confirm, setConfirm] = useState<Lifecycle | null>(null);
  const [order, setOrder] = useState<"subscribe" | "redeem" | "trade" | null>(null);
  const [subOpen, setSubOpen] = useState<string | null>(null);
  const [redOpen, setRedOpen] = useState<string | null>(null);

  const o = offering.data;
  const ccy = o?.currency;
  const status = o?.status;
  const refreshAll = () => {
    void offering.reload();
    void subs.reload();
    void reds.reload();
    void trades.reload();
    void holdings.reload();
    onChanged();
  };

  const runLifecycle = async () => {
    if (!confirm) return;
    const done = await lifecycle.run(confirm);
    if (!done) return;
    toast.push(LIFECYCLE[confirm].ok);
    setConfirm(null);
    refreshAll();
  };
  const ask = (k: Lifecycle) => { lifecycle.reset(); setConfirm(k); };

  return (
    <>
      {offering.error && <NotePanel tone="danger" className="mb-4">{offering.error}</NotePanel>}
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-4 mb-4">
        <DetailItem term="Product"><Code>{o?.productId}</Code></DetailItem>
        <DetailItem term="Status"><StatusBadge status={status} /></DetailItem>
        <DetailItem term="Price">{money(o?.pricePerUnit, ccy)}</DetailItem>
        <DetailItem term="Per order">{units(o?.minUnits)} – {units(o?.maxUnits)}</DetailItem>
        <DetailItem term="Total">{units(o?.totalUnits)}</DetailItem>
        <DetailItem term="Issued">{units(o?.outstandingUnits)}</DetailItem>
        <DetailItem term="Reserved">{units(o?.reservedUnits)}</DetailItem>
        <DetailItem term="Remaining">{units(o?.remainingUnits)}</DetailItem>
        <DetailItem term="Token class">{o?.tokenClassId ? <Code>{shortId(o.tokenClassId)}</Code> : <span className="text-xs text-text-faint">Not connected</span>}</DetailItem>
      </dl>
      <div className="mb-5 flex flex-wrap gap-2 border-b border-border pb-4">
        {status === "DRAFT" && <Button size="sm" onClick={() => ask("open")}>Open</Button>}
        {status === "OPEN" && <Button size="sm" variant="outline" onClick={() => ask("close")}>Close</Button>}
        {(status === "DRAFT" || status === "OPEN") && <Button size="sm" variant="ghost" onClick={() => ask("cancel")}>Cancel</Button>}
        {o && !o.tokenClassId && status !== "CANCELLED" && <Button size="sm" variant="outline" onClick={() => ask("connect")}>Connect unit ledger</Button>}
      </div>

      <Tabs
        className="mb-3"
        active={tab}
        onChange={(k) => setTab(k as typeof tab)}
        tabs={[
          { key: "subs", label: "Subscriptions", count: subs.data?.length },
          { key: "reds", label: "Redemptions", count: reds.data?.length },
          { key: "trades", label: "Trades", count: trades.data?.length },
          { key: "holdings", label: "Holdings", count: holdings.data?.length },
        ]}
      />
      {tab === "subs" && (
        <ConsoleTable<SubscriptionResponse>
          className=""
          what="subscriptions"
          newest={(r) => r.createdAt}
          source={subs}
          rowId={(r) => r.subscriptionId}
          onRowClick={(r) => setSubOpen(r.subscriptionId ?? null)}
          actions={<Button size="sm" disabled={status !== "OPEN"} title={status !== "OPEN" ? "Only an open offering takes subscriptions" : undefined} onClick={() => setOrder("subscribe")}>Subscribe an investor</Button>}
          title="Subscriptions"
          emptyLabel="No subscriptions"
          columns={[
            { key: "investor", header: "Investor", render: (r) => <Code>{shortId(r.investorId)}</Code> },
            { key: "qty", header: "Units", className: num, render: (r) => units(r.quantity) },
            { key: "amount", header: "Amount", className: num, render: (r) => money(r.amount, r.currency) },
            { key: "when", header: "Placed", render: (r) => <span className="tabular text-xs text-text-soft">{dateTime(r.createdAt)}</span>, hideOnMobile: true },
            { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          ]}
        />
      )}
      {tab === "reds" && (
        <ConsoleTable<RedemptionResponse>
          className=""
          what="redemptions"
          newest={(r) => r.createdAt}
          source={reds}
          rowId={(r) => r.redemptionId}
          onRowClick={(r) => setRedOpen(r.redemptionId ?? null)}
          actions={<Button size="sm" onClick={() => setOrder("redeem")}>Redeem for an investor</Button>}
          title="Redemptions"
          emptyLabel="No redemptions"
          columns={[
            { key: "investor", header: "Investor", render: (r) => <Code>{shortId(r.investorId)}</Code> },
            { key: "qty", header: "Units", className: num, render: (r) => units(r.quantity) },
            { key: "amount", header: "Paid", className: num, render: (r) => money(r.amount, r.currency) },
            { key: "when", header: "When", render: (r) => <span className="tabular text-xs text-text-soft">{dateTime(r.createdAt)}</span> },
          ]}
        />
      )}
      {tab === "trades" && (
        <ConsoleTable<TradeResponse>
          className=""
          what="trades"
          newest={(r) => r.createdAt}
          source={trades}
          rowId={(r) => r.tradeId}
          actions={<Button size="sm" onClick={() => setOrder("trade")}>Record a trade</Button>}
          title="Trades"
          emptyLabel="No trades"
          columns={tradeColumns}
        />
      )}

      {tab === "holdings" && (
        <ConsoleTable<HoldingResponse>
          className=""
          what="holdings"
          newest={(r) => r.updatedAt}
          source={holdings}
          rowId={(r) => r.holdingId}
          title="Holdings"
          description="Who holds this offering's units now."
          emptyLabel="Nobody holds units yet"
          columns={[
            { key: "investor", header: "Investor", render: (r) => <Code>{shortId(r.investorId)}</Code> },
            { key: "qty", header: "Units", className: num, render: (r) => units(r.quantity) },
            { key: "updated", header: "Updated", render: (r) => <span className="tabular text-xs text-text-soft">{dateTime(r.updatedAt)}</span>, hideOnMobile: true },
          ]}
        />
      )}

      {confirm && (
        <ActionModal
          size="sm"
          title={LIFECYCLE[confirm].title}
          description={LIFECYCLE[confirm].body}
          submitLabel={LIFECYCLE[confirm].label}
          tone={LIFECYCLE[confirm].danger ? "danger" : "primary"}
          pending={lifecycle.pending}
          error={lifecycle.error}
          onSubmit={() => void runLifecycle()}
          onClose={() => setConfirm(null)}
        />
      )}
      {order && (
        <OrderModal
          kind={order}
          offering={o}
          onClose={() => setOrder(null)}
          onDone={(message) => {
            setOrder(null);
            toast.push(message);
            refreshAll();
          }}
        />
      )}
      {subOpen && (
        <SubscriptionPanel
          key={subOpen}
          subscriptionId={subOpen}
          currency={ccy}
          onClose={() => setSubOpen(null)}
          onChanged={refreshAll}
        />
      )}
      {redOpen && <RedemptionPanel key={redOpen} redemptionId={redOpen} onClose={() => setRedOpen(null)} />}
    </>
  );
}

/** Subscribe, redeem, or record a secondary trade between two investors. */
function OrderModal({ kind, offering, onClose, onDone }: {
  kind: "subscribe" | "redeem" | "trade";
  offering: OfferingResponse | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const id = offering?.offeringId ?? "";
  const ccy = offering?.currency;
  const [investorId, setInvestorId] = useState("");
  const [buyerId, setBuyerId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState(offering?.pricePerUnit != null ? String(offering.pricePerUnit) : "");
  const place = useAction(async () => {
    const q = Number(quantity);
    if (kind === "subscribe") return tokenConsole.subscribe(id, { investorId, quantity: q });
    if (kind === "redeem") return tokenConsole.redeem(id, { investorId, quantity: q });
    return tokenConsole.createTrade(id, { sellerInvestorId: investorId, buyerInvestorId: buyerId, quantity: q, pricePerUnit: Number(price) });
  });
  const q = Number(quantity);
  const touched = !!(investorId || buyerId || quantity);
  const problem = !investorId ? (kind === "trade" ? "Pick the seller." : "Pick the investor.")
    : kind === "trade" && !buyerId ? "Pick the buyer."
    : kind === "trade" && buyerId === investorId ? "The buyer and the seller are the same investor."
    : !isPositive(quantity) ? "Enter units above 0."
    : kind === "subscribe" && offering?.minUnits != null && q < offering.minUnits ? `The minimum order is ${units(offering.minUnits)} units.`
    : kind === "subscribe" && offering?.maxUnits != null && q > offering.maxUnits ? `The maximum order is ${units(offering.maxUnits)} units.`
    : kind === "trade" && !isPositive(price) ? "Enter a price above 0." : undefined;

  const submit = async () => {
    const r = await place.run();
    if (!r) return;
    onDone(kind === "subscribe" ? "Subscription placed — confirm it once the money has arrived."
      : kind === "redeem" ? "Redeemed." : "Trade recorded.");
  };

  const estimate = isNumber(quantity) && offering?.pricePerUnit != null && kind === "subscribe"
    ? `≈ ${money(q * offering.pricePerUnit, ccy)} at ${money(offering.pricePerUnit, ccy)} a unit.` : undefined;

  return (
    <ActionModal
      title={kind === "subscribe" ? "Subscribe an investor" : kind === "redeem" ? "Redeem for an investor" : "Record a secondary trade"}
      description={kind === "subscribe" ? "Reserves the units. The subscription stays pending until it is confirmed."
        : kind === "redeem" ? "Buys the units back at the offering's price and pays the investor's account. It executes immediately."
        : "Moves units from one investor to another at an agreed price. It posts immediately."}
      submitLabel={kind === "subscribe" ? "Place subscription" : kind === "redeem" ? "Redeem" : "Record trade"}
      tone={kind === "redeem" ? "danger" : "primary"}
      problem={problem} showProblem={touched}
      pending={place.pending}
      error={place.error}
      onSubmit={() => void submit()}
      onClose={onClose}
      size={kind === "trade" ? "lg" : "md"}
    >
      <div className={kind === "trade" ? "grid gap-4 sm:grid-cols-2" : "grid gap-4"}>
        <Field label={kind === "trade" ? "Seller" : "Investor"} required group>
          <InvestorPicker value={investorId} onChange={setInvestorId} />
        </Field>
        {kind === "trade" && (
          <Field label="Buyer" required group><InvestorPicker value={buyerId} onChange={setBuyerId} /></Field>
        )}
        <Field label="Units" required hint={estimate}>
          <Input type="number" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
        {kind === "trade" && (
          <Field label="Price per unit" required hint="Above par is a premium to the seller.">
            <Input type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
        )}
      </div>
    </ActionModal>
  );
}

/** One subscription, read fresh, with the two decisions a pending one waits on. */
function SubscriptionPanel({ subscriptionId, currency, onClose, onChanged }: {
  subscriptionId: string; currency?: string; onClose: () => void; onChanged: () => void;
}) {
  const toast = useToast();
  const sub = useAsyncData(() => tokenConsole.subscription(subscriptionId));
  const confirmSub = useAction(tokenConsole.confirmSubscription);
  const cancelSub = useAction(tokenConsole.cancelSubscription);
  const [step, setStep] = useState<"confirm" | "cancel" | null>(null);
  const [valueDate, setValueDate] = useState(todayIso());
  const s = sub.data;

  const run = async () => {
    const done = step === "confirm"
      ? await confirmSub.run(subscriptionId, { valueDate: valueDate || undefined })
      : await cancelSub.run(subscriptionId);
    if (!done) return;
    toast.push(step === "confirm" ? "Subscription confirmed — units issued." : "Subscription cancelled.");
    setStep(null);
    void sub.reload();
    onChanged();
  };

  return createPortal(
    <Modal open onClose={onClose} title="Subscription" size="md">
      {sub.error && <NotePanel tone="danger" className="mb-4">{sub.error}</NotePanel>}
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <DetailItem term="Investor"><Code>{s?.investorId}</Code></DetailItem>
        <DetailItem term="Status"><StatusBadge status={s?.status} /></DetailItem>
        <DetailItem term="Units">{units(s?.quantity)}</DetailItem>
        <DetailItem term="Amount">{money(s?.amount, s?.currency ?? currency)}</DetailItem>
        <DetailItem term="Placed">{dateTime(s?.createdAt)}</DetailItem>
        <DetailItem term="Confirmed">{dateTime(s?.confirmedAt)}</DetailItem>
        <DetailItem term="Contract"><Code>{s?.contractId}</Code></DetailItem>
      </dl>
      {s?.status === "PENDING" && (
        <div className="mt-5 flex gap-2 border-t border-border pt-4">
          <Button size="sm" onClick={() => { confirmSub.reset(); setStep("confirm"); }}>Confirm</Button>
          <Button size="sm" variant="ghost" onClick={() => { cancelSub.reset(); setStep("cancel"); }}>Cancel subscription</Button>
        </div>
      )}
      {step && (
        <ActionModal
          size="sm"
          title={step === "confirm" ? "Confirm this subscription?" : "Cancel this subscription?"}
          description={step === "confirm" ? "Issues the units and posts the subscription to the books. Do this once the money has arrived." : "Releases the reserved units. Nothing is issued."}
          submitLabel={step === "confirm" ? "Confirm" : "Cancel subscription"}
          tone={step === "confirm" ? "primary" : "danger"}
          pending={confirmSub.pending || cancelSub.pending}
          error={step === "confirm" ? confirmSub.error : cancelSub.error}
          onSubmit={() => void run()}
          onClose={() => setStep(null)}
        >
          {step === "confirm" && (
            <Field label="Value date"><Input type="date" value={valueDate} onChange={(e) => setValueDate(e.target.value)} /></Field>
          )}
        </ActionModal>
      )}
    </Modal>,
    document.body,
  );
}

function RedemptionPanel({ redemptionId, onClose }: { redemptionId: string; onClose: () => void }) {
  const red = useAsyncData(() => tokenConsole.redemption(redemptionId));
  const r = red.data;
  return createPortal(
    <Modal open onClose={onClose} title="Redemption" size="md">
      {red.error && <NotePanel tone="danger" className="mb-4">{red.error}</NotePanel>}
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <DetailItem term="Investor"><Code>{r?.investorId}</Code></DetailItem>
        <DetailItem term="Contract"><Code>{r?.contractId}</Code></DetailItem>
        <DetailItem term="Units">{units(r?.quantity)}</DetailItem>
        <DetailItem term="Paid">{money(r?.amount, r?.currency)}</DetailItem>
        <DetailItem term="When">{dateTime(r?.createdAt)}</DetailItem>
        <DetailItem term="Offering"><Code>{r?.offeringId}</Code></DetailItem>
      </dl>
      <p className="mt-4 text-xs text-text-soft">A redemption executes when it is recorded; there is nothing further to decide.</p>
    </Modal>,
    document.body,
  );
}
