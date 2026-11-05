import { useEffect, useState } from "react";
import { Badge, Button, DataTable, Field, Input, Modal, NotePanel, PageHeader, useToast } from "../../ui";
import { tokenConsole } from "../../lib/api";
import { useAsyncData } from "../../lib/useAsyncData";
import { calendarDate, label, money, percent } from "../../lib/tokenConsole/format";
import { invalidateList } from "../../lib/tokenConsole/sharedList";
import { useAction } from "../../lib/tokenConsole/useAction";
import { PENDING_CHANGES_KEY, usePendingChanges } from "../../lib/tokenConsole/usePendingChanges";
import { pendingFor } from "../../lib/tokenConsole/configChanges";
import type { BondLadderView, FundResponse, Institution, InstitutionAccount, SubFundResponse } from "../../lib/tokenConsole/types.gen";
import { Code, ConsoleTable, StatusBadge } from "../../components/tokenconsole/ConsoleTable";
import { ActionModal, isNumber, isPositive, isWhole } from "../../components/tokenconsole/ActionModal";
import { TariffDomainPicker } from "../../components/tokenconsole/Pickers";

const num = "tabular text-right whitespace-nowrap";

export default function TokenConsoleFunds() {
  const funds = useAsyncData(tokenConsole.funds);
  const subFunds = useAsyncData(tokenConsole.subFunds);
  const ladders = useAsyncData(tokenConsole.ladders);
  const institutions = useAsyncData(tokenConsole.institutions);
  const institutionAccounts = useAsyncData(tokenConsole.institutionAccounts);
  const [ladderFor, setLadderFor] = useState<{ id: string; name?: string } | null>(null);
  const [domainFor, setDomainFor] = useState<Institution | null>(null);
  const toast = useToast();
  // The default domain is maker-checker controlled: a change waits for approval.
  const pending = usePendingChanges();
  const { reload: reloadPending } = pending;
  useEffect(() => { void reloadPending(); }, [reloadPending]);
  const domainWaiting = (institutionId?: string) =>
    institutionId ? pendingFor(pending.data, institutionId, ["INSTITUTION_DEFAULT_TARIFF_DOMAIN_SET"])[0] : undefined;

  return (
    <div>
      <PageHeader
        eyebrow="Baracel Unyt"
        title="Institutions"
        subtitle="Institutions and the structure products hang off them: their accounts, funds, sub-funds and bond ladders. Select a sub-fund to work its ladder."
      />

      <ConsoleTable<BondLadderView>
        what="bond ladders"
        source={ladders}
        rowId={(r) => r.subFundId}
        onRowClick={(r) => r.subFundId && setLadderFor({ id: r.subFundId, name: r.subFundName })}
        title="Bond ladders"
        description="Coupon cover and capacity per sub-fund. Headroom is what can still be sold before claims exceed what the ladder pays."
        emptyLabel="No ladders built"
        columns={[
          { key: "subFund", header: "Sub-fund", render: (r) => (
            <div>
              <div className="text-text font-medium">{r.subFundName ?? "—"}</div>
              <div className="text-xs text-text-faint">{r.currency ?? ""} · blended coupon {percent(r.blendedCoupon)}</div>
            </div>
          ) },
          { key: "capacity", header: "Capacity", className: num, render: (r) => money(r.capacity, r.currency), hideOnMobile: true },
          { key: "claims", header: "Claims", className: num, render: (r) => money(r.claims, r.currency), hideOnMobile: true },
          { key: "headroom", header: "Headroom", className: num, render: (r) => (
            <span className={(r.headroom ?? 0) < 0 ? "text-danger" : undefined}>{money(r.headroom, r.currency)}</span>
          ) },
          { key: "cover", header: "Coupon cover", render: (r) => r.everyMonthCovered === undefined
            ? <span className="text-text-faint">—</span>
            : <Badge tone={r.everyMonthCovered ? "success" : "warning"} className="whitespace-nowrap">{r.everyMonthCovered ? "Every month" : "Gaps"}</Badge> },
        ]}
      />

      <ConsoleTable<SubFundResponse>
        what="sub-funds"
        source={subFunds}
        rowId={(r) => r.subFundId}
        onRowClick={(r) => r.subFundId && setLadderFor({ id: r.subFundId, name: r.name })}
        title="Sub-funds"
        emptyLabel="No sub-funds"
        columns={[
          { key: "name", header: "Name", render: (r) => <span className="text-text font-medium">{r.name ?? "—"}</span> },
          { key: "ccy", header: "Ccy", render: (r) => r.baseCurrency ?? "—" },
          { key: "min", header: "Minimum", className: num, render: (r) => money(r.minInvestmentAmount, r.baseCurrency), hideOnMobile: true },
          { key: "gate", header: "Gate", className: num, render: (r) => percent(r.gatePct), hideOnMobile: true },
          { key: "facility", header: "Facility", className: num, render: (r) => money(r.facilitySize, r.baseCurrency), hideOnMobile: true },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
        ]}
      />

      <ConsoleTable<FundResponse>
        what="funds"
        source={funds}
        rowId={(r) => r.fundId}
        title="Funds"
        emptyLabel="No funds"
        columns={[
          { key: "name", header: "Name", render: (r) => <span className="text-text font-medium">{r.name ?? "—"}</span> },
          { key: "reg", header: "Registration", render: (r) => <Code>{r.registrationRef}</Code> },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
        ]}
      />

      <ConsoleTable<Institution>
        what="institutions"
        source={institutions}
        rowId={(r) => r.institutionId}
        title="Institutions"
        emptyLabel="No institutions"
        columns={[
          { key: "name", header: "Name", render: (r) => <span className="text-text font-medium">{r.name ?? "—"}</span> },
          { key: "country", header: "Country", render: (r) => r.country ?? "—" },
          { key: "ccy", header: "Local ccy", render: (r) => r.localCurrency ?? "—" },
          { key: "domain", header: "Default tariff domain", render: (r) => {
            const waiting = domainWaiting(r.institutionId);
            const to = waiting?.payload?.tariffDomainId;
            return (
              <div>
                <Code>{r.defaultTariffDomainId ?? "—"}</Code>
                {waiting && (
                  <div className="mt-0.5 text-xs text-warning">
                    {typeof to === "string" && to ? <>Change to <span className="tabular">{to}</span> awaiting approval</> : "Change awaiting approval"}
                  </div>
                )}
              </div>
            );
          }, hideOnMobile: true },
          { key: "actions", header: "", className: "text-right", render: (r) => (
            <Button size="sm" variant="ghost" disabled={!!domainWaiting(r.institutionId)} onClick={() => setDomainFor(r)}>Set default domain</Button>
          ) },
        ]}
      />

      <ConsoleTable<InstitutionAccount>
        what="institution accounts"
        source={institutionAccounts}
        rowId={(r) => r.institutionAccountId}
        title="Institution accounts"
        description="The institution's own ledger accounts, one per purpose and currency."
        emptyLabel="No institution accounts"
        columns={[
          { key: "purpose", header: "Purpose", render: (r) => label(r.purpose) },
          { key: "ccy", header: "Ccy", render: (r) => r.currency ?? "—" },
          { key: "institution", header: "Institution", render: (r) =>
            institutions.data?.find((i) => i.institutionId === r.institutionId)?.name ?? <Code>{r.institutionId}</Code> },
          { key: "id", header: "Account", render: (r) => <Code>{r.institutionAccountId}</Code>, hideOnMobile: true },
        ]}
      />

      <Modal open={!!ladderFor} onClose={() => setLadderFor(null)} title={`Bond ladder · ${ladderFor?.name ?? ""}`} size="lg">
        {ladderFor && <LadderPanel key={ladderFor.id} subFundId={ladderFor.id} onChanged={() => void ladders.reload()} />}
      </Modal>
      {domainFor && (
        <DefaultDomainModal
          institution={domainFor}
          onClose={() => setDomainFor(null)}
          onDone={() => {
            setDomainFor(null);
            toast.push("Default tariff domain change sent for approval. It applies once someone else approves it.");
            invalidateList(PENDING_CHANGES_KEY);
          }}
        />
      )}
    </div>
  );
}

/** A sub-fund's bond ladder: the rungs, and what they pay each month. */
function LadderPanel({ subFundId, onChanged }: { subFundId: string; onChanged: () => void }) {
  const toast = useToast();
  const ladder = useAsyncData(() => tokenConsole.ladder(subFundId));
  // Clearing answers with no body, so success is an explicit `true` — useAction
  // resolves a failure to undefined, and the two must not look alike.
  const clear = useAction(async () => {
    await tokenConsole.clearLadder(subFundId);
    return true;
  });
  const [confirming, setConfirming] = useState(false);
  const [adding, setAdding] = useState(false);
  const l = ladder.data;
  const rungs = (l?.rungs ?? []).map((r, i) => ({ ...r, id: `${r.ladderSlot ?? i}-${r.isin ?? i}` }));

  const refresh = () => {
    void ladder.reload();
    onChanged();
  };
  const run = async () => {
    const done = await clear.run();
    if (!done) return;
    toast.push("Ladder cleared.");
    setConfirming(false);
    refresh();
  };

  return (
    <>
      {ladder.error && <NotePanel tone="danger" className="mb-4">{ladder.error}</NotePanel>}
      {l && (
        <p className="mb-4 text-sm text-text-soft">
          Blended coupon {percent(l.blendedCoupon)} · capacity {money(l.capacity, l.currency)} · claims {money(l.claims, l.currency)} ·{" "}
          {l.everyMonthCovered ? "a coupon lands every month" : `coupons land in months ${(l.couponMonths ?? []).join(", ") || "—"}`}
        </p>
      )}
      <DataTable
        paged={false}
        rows={rungs}
        emptyLabel={ladder.loading ? "Loading…" : "No rungs yet — add the bonds this sub-fund holds"}
        columns={[
          { key: "slot", header: "Slot", className: "tabular", render: (r) => r.ladderSlot ?? "—" },
          { key: "isin", header: "ISIN", render: (r) => <Code>{r.isin ?? "—"}</Code> },
          { key: "tenor", header: "Tenor", className: "tabular", render: (r) => (r.tenorYears != null ? `${r.tenorYears}y` : "—") },
          { key: "coupon", header: "Coupon", className: "tabular text-right", render: (r) => percent(r.couponRate) },
          { key: "months", header: "Months", render: (r) => <Code>{r.couponMonths ?? "—"}</Code>, hideOnMobile: true },
          { key: "face", header: "Face held", className: "tabular text-right", render: (r) => money(r.faceValueHeld, l?.currency) },
          { key: "maturity", header: "Matures", render: (r) => <span className="tabular text-xs text-text-soft">{calendarDate(r.maturityDate)}</span>, hideOnMobile: true },
        ]}
      />
      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
        <Button size="sm" onClick={() => setAdding(true)}>Add rung</Button>
        <Button size="sm" variant="ghost" disabled={!rungs.length} onClick={() => { clear.reset(); setConfirming(true); }}>Clear ladder</Button>
      </div>
      {confirming && (
        <ActionModal
          size="sm"
          title="Clear this ladder?"
          description="Removes every rung. The sub-fund then has no coupon cover or capacity until rungs are added back."
          submitLabel="Clear ladder"
          tone="danger"
          pending={clear.pending}
          error={clear.error}
          onSubmit={() => void run()}
          onClose={() => setConfirming(false)}
        />
      )}
      {adding && (
        <AddRungModal
          subFundId={subFundId}
          nextSlot={Math.max(0, ...rungs.map((r) => r.ladderSlot ?? 0)) + 1}
          onClose={() => setAdding(false)}
          onDone={() => { setAdding(false); toast.push("Rung added."); refresh(); }}
        />
      )}
    </>
  );
}

const COUPON_MONTHS = /^(0[1-9]|1[0-2])(,(0[1-9]|1[0-2]))*$/;

function AddRungModal({ subFundId, nextSlot, onClose, onDone }: { subFundId: string; nextSlot: number; onClose: () => void; onDone: () => void }) {
  const add = useAction(tokenConsole.addRung);
  const [slot, setSlot] = useState(String(nextSlot));
  const [isin, setIsin] = useState("");
  const [tenor, setTenor] = useState("");
  const [coupon, setCoupon] = useState("");
  const [months, setMonths] = useState("");
  const [face, setFace] = useState("");
  const [acquired, setAcquired] = useState("");
  const [matures, setMatures] = useState("");
  const touched = !!(isin || tenor || coupon || months || face);
  const problem = !isWhole(slot) ? "The slot is a whole number above 0."
    : !isWhole(tenor) ? "Tenor is whole years above 0."
    : !isNumber(coupon) || Number(coupon) <= 0 || Number(coupon) >= 1 ? "Coupon is a fraction: 0.1085 means 10.85%."
    : !COUPON_MONTHS.test(months.replace(/\s/g, "")) ? "Coupon months are two-digit months, comma-separated: 01,07."
    : !isPositive(face) ? "Enter the face value held."
    : acquired && matures && matures < acquired ? "It matures before it was acquired." : undefined;
  const submit = async () => {
    const r = await add.run(subFundId, {
      ladderSlot: Number(slot), isin: isin.trim() || undefined, tenorYears: Number(tenor), couponRate: Number(coupon),
      couponMonths: months.replace(/\s/g, ""), faceValueHeld: Number(face), acquisitionDate: acquired || undefined, maturityDate: matures || undefined,
    });
    if (r) onDone();
  };
  return (
    <ActionModal title="Add a rung" description="One bond on the ladder: what it pays, and in which months."
      submitLabel="Add rung" problem={problem} showProblem={touched} pending={add.pending} error={add.error}
      onSubmit={() => void submit()} onClose={onClose} size="lg">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Slot" required><Input type="number" inputMode="numeric" value={slot} onChange={(e) => setSlot(e.target.value)} /></Field>
        <Field label="ISIN"><Input value={isin} onChange={(e) => setIsin(e.target.value)} placeholder="KE1000012345" /></Field>
        <Field label="Tenor (years)" required><Input type="number" inputMode="numeric" value={tenor} onChange={(e) => setTenor(e.target.value)} /></Field>
        <Field label="Coupon rate" required hint="A fraction: 0.1085 means 10.85%."><Input type="number" inputMode="decimal" step="any" value={coupon} onChange={(e) => setCoupon(e.target.value)} /></Field>
        <Field label="Coupon months" required hint="Comma-separated: 01,07 pays in January and July."><Input value={months} onChange={(e) => setMonths(e.target.value)} placeholder="01,07" /></Field>
        <Field label="Face value held" required><Input type="number" inputMode="decimal" value={face} onChange={(e) => setFace(e.target.value)} /></Field>
        <Field label="Acquired"><Input type="date" value={acquired} onChange={(e) => setAcquired(e.target.value)} /></Field>
        <Field label="Matures"><Input type="date" value={matures} min={acquired || undefined} onChange={(e) => setMatures(e.target.value)} /></Field>
      </div>
    </ActionModal>
  );
}

function DefaultDomainModal({ institution, onClose, onDone }: { institution: Institution; onClose: () => void; onDone: () => void }) {
  const save = useAction((institutionId: string, tariffDomainId: string) =>
    tokenConsole.stageChange("INSTITUTION_DEFAULT_TARIFF_DOMAIN_SET", { institutionId, tariffDomainId }));
  const [domain, setDomain] = useState(institution.defaultTariffDomainId ?? "");
  const submit = async () => {
    if (!institution.institutionId) return;
    const r = await save.run(institution.institutionId, domain);
    if (r) onDone();
  };
  return (
    <ActionModal title={`Default tariff domain · ${institution.name ?? ""}`}
      description="The domain a rate resolves to when nothing more specific — contract, product or package — carries one. The change goes to Change approvals and applies once someone other than you approves it."
      submitLabel="Send for approval" pendingLabel="Sending…"
      problem={!domain ? "Pick a tariff domain." : domain === institution.defaultTariffDomainId ? "That is already the default." : undefined} showProblem={!!domain}
      pending={save.pending} error={save.error} onSubmit={() => void submit()} onClose={onClose}>
      <Field label="Tariff domain" required group><TariffDomainPicker value={domain} onChange={setDomain} /></Field>
    </ActionModal>
  );
}
