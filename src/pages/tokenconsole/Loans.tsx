import { useMemo, useState } from "react";
import { HandCoins, Plus } from "lucide-react";
import { Button, Field, GlassStat, Input, Modal, NotePanel, PageHeader, Select, StatRail, useToast } from "../../ui";
import { tokenConsole } from "../../lib/api";
import { TokApiError } from "../../lib/tokApi";
import { useAsyncData } from "../../lib/useAsyncData";
import { label, money } from "../../lib/tokenConsole/format";
import { useAction } from "../../lib/tokenConsole/useAction";
import type { InvestorContract } from "../../lib/tokenConsole/types.gen";
import { Code, ConsoleTable, StatusBadge } from "../../components/tokenconsole/ConsoleTable";

/** A blank or non-positive entry is not an amount; the backend should never see one. */
const positive = (s: string) => s.trim() !== "" && Number.isFinite(Number(s)) && Number(s) > 0;
const positiveInt = (s: string) => positive(s) && Number.isInteger(Number(s));

/* The loan endpoints (/accounting/loans/*) exist in the service's source but
   are not deployed on every environment — UAT answered Spring's own 404 for
   them on 2026-09-23. Say that, rather than "Not found" next to a real loan. */
const LOANS_MISSING = "Loan servicing isn't available on this tokenization backend yet — its loan endpoints aren't deployed.";
function explainMissing<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof TokApiError && e.isMissingEndpoint) throw new Error(LOANS_MISSING);
      throw e;
    }
  };
}
const loanApi = {
  get: explainMissing(tokenConsole.loan),
  disburse: explainMissing(tokenConsole.disburseLoan),
  accrue: explainMissing(tokenConsole.accrueLoan),
  repay: explainMissing(tokenConsole.repayLoan),
  close: explainMissing(tokenConsole.closeLoan),
};

export default function TokenConsoleLoans() {
  const toast = useToast();
  const products = useAsyncData(tokenConsole.products);
  const contracts = useAsyncData(tokenConsole.contracts);
  const investors = useAsyncData(tokenConsole.investors);
  const openAccount = useAction(tokenConsole.openAccount);

  const loanProducts = useMemo(() => (products.data ?? []).filter((p) => p.assetClass === "LOAN"), [products.data]);
  const loanProductIds = useMemo(() => new Set(loanProducts.map((p) => p.productId)), [loanProducts]);
  const loanAccounts = useMemo(
    () => (contracts.data ?? []).filter((c) => c.productId && loanProductIds.has(c.productId)),
    [contracts.data, loanProductIds],
  );
  const activeInvestors = (investors.data ?? []).filter((i) => i.lifecycleStatus === "ACTIVE");

  const [selected, setSelected] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [investorId, setInvestorId] = useState("");
  const [productId, setProductId] = useState("");
  const [contractId, setContractId] = useState("");

  const closeOpenForm = () => {
    setOpening(false);
    setInvestorId("");
    setProductId("");
    setContractId("");
    openAccount.reset();
  };

  const submitOpen = async () => {
    const r = await openAccount.run({ investorId, productId, contractId: contractId.trim() || undefined });
    if (!r) return;
    toast.push(`Opened loan account ${r.contractId ?? ""}.`);
    closeOpenForm();
    void contracts.reload();
    setSelected(r.contractId ?? null);
  };

  // The account list is contracts filtered by product, so it needs both.
  const source = {
    data: products.data && contracts.data ? loanAccounts : null,
    loading: products.loading || contracts.loading,
    error: products.error ?? contracts.error,
    reload: () => Promise.all([products.reload(), contracts.reload()]).then(() => undefined),
  };

  return (
    <div>
      <PageHeader
        eyebrow="Tokenization Console"
        title="Loans"
        subtitle="The lending lifecycle — disburse, accrue interest on the outstanding balance, repay (interest first, then principal), close."
        actions={<Button size="sm" onClick={() => setOpening(true)}><Plus size={14} /> Open loan account</Button>}
      />

      <StatRail className="mb-6">
        <GlassStat label="Loan products" value={products.data ? loanProducts.length : "—"} icon={<HandCoins size={16} />} tone="primary" />
        <GlassStat label="Loan accounts" value={source.data ? loanAccounts.length : "—"} />
        <GlassStat label="Active" value={source.data ? loanAccounts.filter((c) => c.contractStatus === "ACTIVE").length : "—"} tone="success" emphasis={false} />
        <GlassStat label="Closed" value={source.data ? loanAccounts.filter((c) => c.contractStatus === "CLOSED").length : "—"} />
      </StatRail>

      <ConsoleTable<InvestorContract>
        title="Loan accounts"
        what="loan accounts"
        source={source}
        rowId={(r) => r.contractId}
        onRowClick={(r) => setSelected(r.contractId ?? null)}
        emptyLabel="No loan accounts yet — open one to begin"
        columns={[
          { key: "account", header: "Account", render: (r) => <Code>{r.contractId}</Code> },
          { key: "borrower", header: "Borrower", render: (r) => r.investorRef ?? "—" },
          { key: "product", header: "Product", render: (r) => <Code>{r.productId}</Code>, hideOnMobile: true },
          { key: "ccy", header: "Ccy", render: (r) => r.currency ?? "—" },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.contractStatus} /> },
        ]}
      />

      <Modal
        open={opening}
        onClose={closeOpenForm}
        title="Open a loan account"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={closeOpenForm}>Cancel</Button>
            <Button size="sm" disabled={!investorId || !productId || openAccount.pending} onClick={() => void submitOpen()}>
              {openAccount.pending ? "Opening…" : "Open account"}
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-text-soft">Originate a loan for a borrower against a loan product.</p>
        <div className="grid gap-4">
          <Field label="Borrower (investor)" required hint="Only active investors can borrow.">
            <Select value={investorId} onChange={(e) => setInvestorId(e.target.value)}>
              <option value="">{investors.loading ? "Loading…" : "Select…"}</option>
              {activeInvestors.map((i) => <option key={i.investorId} value={i.investorId}>{i.displayName ?? i.externalRef ?? i.investorId}</option>)}
            </Select>
          </Field>
          <Field
            label="Loan product"
            required
            hint={products.data && loanProducts.length === 0 ? "No loan products yet. Create one on Products with asset class Loan." : undefined}
          >
            <Select value={productId} onChange={(e) => setProductId(e.target.value)} disabled={loanProducts.length === 0}>
              <option value="">Select…</option>
              {loanProducts.map((p) => <option key={p.productId} value={p.productId}>{p.productId} — {p.name}</option>)}
            </Select>
          </Field>
          <Field label="Account ID" hint="Leave blank to generate one.">
            <Input value={contractId} onChange={(e) => setContractId(e.target.value)} placeholder="Auto" />
          </Field>
        </div>
        {(investors.error || products.error) && (
          <NotePanel tone="warning" className="mt-4">Some lists could not be loaded: {investors.error ?? products.error}</NotePanel>
        )}
        {openAccount.error && <NotePanel tone="danger" className="mt-4">{openAccount.error}</NotePanel>}
      </Modal>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Loan ${selected ?? ""}`} size="lg">
        {/* Keyed so typed amounts and errors never carry over to another loan. */}
        {selected && <LoanPanel key={selected} contractId={selected} onChanged={() => void contracts.reload()} />}
      </Modal>
    </div>
  );
}

function LoanPanel({ contractId, onChanged }: { contractId: string; onChanged: () => void }) {
  const toast = useToast();
  const loan = useAsyncData(() => loanApi.get(contractId));
  const disburse = useAction(loanApi.disburse);
  const accrue = useAction(loanApi.accrue);
  const repay = useAction(loanApi.repay);
  const close = useAction(loanApi.close);

  const [disburseAmt, setDisburseAmt] = useState("");
  const [accrueDays, setAccrueDays] = useState("30");
  const [repayAmt, setRepayAmt] = useState("");

  const v = loan.data;
  const ccy = v?.currency;
  const busy = disburse.pending || accrue.pending || repay.pending || close.pending;
  const err = disburse.error ?? accrue.error ?? repay.error ?? close.error;
  // No actions until the position has loaded, and none on a closed loan.
  const locked = busy || !v || v.status === "CLOSED";
  const settled = v?.totalOutstanding === 0;
  const invalid = (s: string, ok: (s: string) => boolean, msg: string) => (s.trim() !== "" && !ok(s) ? msg : undefined);

  // Every action moves the position; re-read it rather than trusting a partial response.
  const after = async (done: unknown, message: string, reset?: () => void) => {
    if (done === undefined) return;
    toast.push(message);
    reset?.();
    await loan.reload();
    onChanged();
  };

  if (loan.error === LOANS_MISSING) {
    return <NotePanel tone="warning" title="Not available yet">{LOANS_MISSING}</NotePanel>;
  }

  return (
    <>
      {loan.error && <NotePanel tone="danger" className="mb-4">{loan.error}</NotePanel>}
      <div className="grid gap-3 sm:grid-cols-4 mb-5">
        <Figure label="Principal due" value={money(v?.outstandingPrincipal, ccy)} />
        <Figure label="Interest due" value={money(v?.outstandingInterest, ccy)} />
        <Figure label="Total outstanding" value={money(v?.totalOutstanding, ccy)} strong />
        <Figure label="Status" value={v?.status ? label(v.status) : "—"} />
      </div>

      {/* Each button sits at the bottom of its column, so a hint or error
          under one field doesn't stagger them. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col">
          <Field label="Disburse amount" error={invalid(disburseAmt, positive, "Enter an amount above 0.")}>
            <Input type="number" inputMode="decimal" value={disburseAmt} onChange={(e) => setDisburseAmt(e.target.value)} placeholder="200000" />
          </Field>
          <div className="mt-auto pt-2">
            <Button size="sm" disabled={locked || !positive(disburseAmt)}
              onClick={async () => after(await disburse.run(contractId, Number(disburseAmt)), "Disbursed.", () => setDisburseAmt(""))}>
              Disburse
            </Button>
          </div>
        </div>
        <div className="flex flex-col">
          <Field label="Accrue interest (days)" error={invalid(accrueDays, positiveInt, "Enter whole days above 0.")}>
            <Input type="number" inputMode="numeric" value={accrueDays} onChange={(e) => setAccrueDays(e.target.value)} />
          </Field>
          <div className="mt-auto pt-2">
            <Button size="sm" disabled={locked || !positiveInt(accrueDays)}
              onClick={async () => after(await accrue.run(contractId, Number(accrueDays)), "Interest accrued.")}>
              Accrue
            </Button>
          </div>
        </div>
        <div className="flex flex-col">
          <Field label="Repay amount" hint="Interest first, then principal." error={invalid(repayAmt, positive, "Enter an amount above 0.")}>
            <Input type="number" inputMode="decimal" value={repayAmt} onChange={(e) => setRepayAmt(e.target.value)} placeholder="10000" />
          </Field>
          <div className="mt-auto pt-2">
            <Button size="sm" disabled={locked || !positive(repayAmt)}
              onClick={async () => {
                const r = await repay.run(contractId, Number(repayAmt));
                await after(r, r ? `Repaid — interest ${money(r.interestPaid, ccy)}, principal ${money(r.principalPaid, ccy)}.` : "", () => setRepayAmt(""));
              }}>
              Repay
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <Button variant="outline" size="sm" disabled={locked || !settled}
          onClick={async () => after(await close.run(contractId), "Loan closed.")}>
          Close loan
        </Button>
        {v && v.status !== "CLOSED" && !settled && (
          <span className="text-[12.5px] text-text-soft">A loan can be closed once nothing is outstanding.</span>
        )}
      </div>
      {err && <NotePanel tone="danger" className="mt-3">{err}</NotePanel>}
    </>
  );
}

function Figure({ label: text, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-surface-sunken px-3 py-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-faint">{text}</div>
      <div className={strong ? "mt-1 tabular text-base font-semibold text-text" : "mt-1 tabular text-sm text-text"}>{value}</div>
    </div>
  );
}
