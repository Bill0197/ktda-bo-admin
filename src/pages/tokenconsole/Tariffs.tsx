import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { Badge, Button, Checkbox, Field, GlassPanel, Input, NotePanel, PageHeader, Select, useToast } from "../../ui";
import { tokenConsole } from "../../lib/api";
import { useAsyncData } from "../../lib/useAsyncData";
import { calendarDate, label, percent } from "../../lib/tokenConsole/format";
import { invalidateList } from "../../lib/tokenConsole/sharedList";
import { useAction } from "../../lib/tokenConsole/useAction";
import type { CreateTariffValueRequest, ResolvedTariff, TariffDomain, TariffType, TariffValue } from "../../lib/tokenConsole/types.gen";
import { Code, ConsoleTable } from "../../components/tokenconsole/ConsoleTable";
import { ActionModal, isNumber, todayIso } from "../../components/tokenconsole/ActionModal";
import { ContractPicker, TariffDomainPicker, TariffTypePicker } from "../../components/tokenconsole/Pickers";

type DayCount = NonNullable<CreateTariffValueRequest["dayCount"]>;
const DAY_COUNTS: DayCount[] = ["ACTUAL_365", "ACTUAL_360", "THIRTY_360"];

/** Values are effective-dated and never edited: a new rate is a new row, so
 * past periods still resolve to the rate that was in force. The console this
 * page came from listed values without their rate or dates; they are the
 * point of the table, so they are shown here. */
export default function TokenConsoleTariffs() {
  const domains = useAsyncData(tokenConsole.tariffDomains);
  const types = useAsyncData(tokenConsole.tariffTypes);
  const values = useAsyncData(tokenConsole.tariffValues);
  const toast = useToast();
  const [creating, setCreating] = useState<"type" | "value" | null>(null);

  return (
    <div>
      <PageHeader
        eyebrow="Tokenization Console"
        title="Tariffs"
        subtitle="Fee and rate definitions: a domain groups types, and a value is what a type actually charges, from a date."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setCreating("type")}><Plus size={14} /> Tariff type</Button>
            <Button size="sm" onClick={() => setCreating("value")}><Plus size={14} /> Rate</Button>
          </div>
        }
      />

      <ResolveTool />

      <ConsoleTable<TariffValue>
        what="tariff values"
        source={values}
        rowId={(r) => r.tariffValueId}
        title="Values"
        emptyLabel="No values"
        columns={[
          { key: "type", header: "Type", render: (r) => (
            <div>
              <Code>{r.tariffTypeId}</Code>
              <div className="text-xs text-text-faint">{r.tariffDomainId ?? ""}</div>
            </div>
          ) },
          { key: "rate", header: "Rate", className: "tabular text-right whitespace-nowrap", render: (r) => (
            <div>
              <div className="text-text">{percent(r.rate)}</div>
              <div className="text-[11px] text-text-faint">{r.currency ?? ""} · {label(r.dayCount)}</div>
            </div>
          ) },
          { key: "effective", header: "Effective", render: (r) => (
            <span className="tabular text-xs text-text-soft">
              {calendarDate(r.effectiveFrom)}{r.effectiveTo ? ` – ${calendarDate(r.effectiveTo)}` : " onward"}
            </span>
          ), hideOnMobile: true },
          { key: "approved", header: "Approved", render: (r) => (
            <Badge tone={r.approved ? "success" : "warning"} className="whitespace-nowrap">{r.approved ? "Approved" : "Pending"}</Badge>
          ) },
        ]}
      />

      <ConsoleTable<TariffType>
        what="tariff types"
        source={types}
        rowId={(r) => r.tariffTypeId}
        title="Types"
        emptyLabel="No types"
        columns={[
          { key: "id", header: "Type", render: (r) => <Code>{r.tariffTypeId}</Code> },
          { key: "name", header: "Name", render: (r) => r.name ?? "—" },
          { key: "kind", header: "Kind", render: (r) => label(r.valueKind), hideOnMobile: true },
        ]}
      />

      <ConsoleTable<TariffDomain>
        what="tariff domains"
        source={domains}
        rowId={(r) => r.tariffDomainId}
        title="Domains"
        emptyLabel="No domains"
        columns={[
          { key: "id", header: "Domain", render: (r) => <Code>{r.tariffDomainId}</Code> },
          { key: "name", header: "Name", render: (r) => r.name ?? "—" },
          { key: "category", header: "Category", render: (r) => r.domainCategory ?? "—", hideOnMobile: true },
          { key: "parent", header: "Parent", render: (r) => <Code>{r.parentDomainId}</Code>, hideOnMobile: true },
        ]}
      />

      {creating === "type" && (
        <TariffTypeModal onClose={() => setCreating(null)} onDone={() => { setCreating(null); toast.push("Tariff type created."); void types.reload(); invalidateList("tok:tariffType"); }} />
      )}
      {creating === "value" && (
        <TariffValueModal onClose={() => setCreating(null)} onDone={() => { setCreating(null); toast.push("Rate added."); void values.reload(); invalidateList("tok:tariffValue"); }} />
      )}
    </div>
  );
}

/** Which rate a contract actually gets for a tariff type on a date — walked
 *  up the chain contract → product → package → institution by the service. */
function ResolveTool() {
  const [contractId, setContractId] = useState("");
  const [type, setType] = useState("");
  const [date, setDate] = useState(todayIso());
  const resolve = useAction(tokenConsole.resolveTariff);
  const [result, setResult] = useState<ResolvedTariff | null>(null);
  const run = async () => {
    setResult(null);
    const r = await resolve.run(contractId, type, date || undefined);
    if (r) setResult(r);
  };
  return (
    <GlassPanel className="mb-6 p-4" sheen={false}>
      <h3 className="mb-3 text-[13px] font-semibold text-text">Resolve a rate</h3>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end">
        <Field label="Contract" group><ContractPicker value={contractId} onChange={setContractId} /></Field>
        <Field label="Tariff type" group><TariffTypePicker value={type} onChange={setType} /></Field>
        <Field label="On"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Button disabled={!contractId || !type || resolve.pending} onClick={() => void run()}>
          <Search size={14} /> {resolve.pending ? "Resolving…" : "Resolve"}
        </Button>
      </div>
      {resolve.error && <NotePanel tone="danger" className="mt-3">{resolve.error}</NotePanel>}
      {result && (
        <p className="mt-3 text-sm text-text">
          <strong className="tabular">{percent(result.rate)}</strong> {result.currency} · {label(result.dayCount)} · from domain{" "}
          <Code>{result.tariffDomainId}</Code>, in force {calendarDate(result.effectiveFrom)}
          {result.effectiveTo ? ` – ${calendarDate(result.effectiveTo)}` : " onward"}.
        </p>
      )}
    </GlassPanel>
  );
}

function TariffTypeModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const create = useAction(tokenConsole.createTariffType);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const problem = !id.trim() ? "An ID is required." : !name.trim() ? "A name is required." : undefined;
  const submit = async () => {
    const r = await create.run({ tariffTypeId: id.trim(), name: name.trim(), valueKind: "PERCENTAGE" });
    if (r) onDone();
  };
  return (
    <ActionModal title="New tariff type" description="A kind of rate a domain can carry — a coupon, a management fee. Its rates are added separately."
      submitLabel="Create type" problem={problem} showProblem={!!(id || name)} pending={create.pending} error={create.error}
      onSubmit={() => void submit()} onClose={onClose}>
      <div className="grid gap-4">
        <Field label="ID" required><Input value={id} onChange={(e) => setId(e.target.value)} placeholder="MGMT_FEE" /></Field>
        <Field label="Name" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Management fee" /></Field>
      </div>
    </ActionModal>
  );
}

/** Rates are never edited: a change is a new, effective-dated row, so a past
 *  period still resolves to what was in force then. */
function TariffValueModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const create = useAction(tokenConsole.createTariffValue);
  const [type, setType] = useState("");
  const [domain, setDomain] = useState("");
  const [currency, setCurrency] = useState("KES");
  const [rate, setRate] = useState("");
  const [dayCount, setDayCount] = useState<DayCount>("ACTUAL_365");
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState("");
  const [approved, setApproved] = useState(false);
  const problem = !type ? "Pick the tariff type." : !domain ? "Pick the domain."
    : !/^[A-Za-z]{3}$/.test(currency) ? "Currency is a three-letter code."
    : !isNumber(rate) || Number(rate) < 0 ? "Enter the rate as a fraction, e.g. 0.015 for 1.5%."
    : !from ? "An effective-from date is required."
    : to && to < from ? "It ends before it starts." : undefined;
  const submit = async () => {
    const r = await create.run({
      tariffTypeId: type, tariffDomainId: domain, currency: currency.toUpperCase(), rate: Number(rate), dayCount,
      effectiveFrom: from, effectiveTo: to || undefined, approved,
    });
    if (r) onDone();
  };
  return (
    <ActionModal title="New rate" description="What a tariff type charges in a domain, from a date. An unapproved rate never resolves."
      submitLabel="Add rate" problem={problem} showProblem={!!(type || domain || rate)} pending={create.pending} error={create.error}
      onSubmit={() => void submit()} onClose={onClose} size="lg">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tariff type" required group><TariffTypePicker value={type} onChange={setType} /></Field>
        <Field label="Domain" required group><TariffDomainPicker value={domain} onChange={setDomain} /></Field>
        <Field label="Rate" required hint="A fraction: 0.015 means 1.5%."><Input type="number" inputMode="decimal" step="any" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
        <Field label="Currency" required><Input value={currency} maxLength={3} className="uppercase" onChange={(e) => setCurrency(e.target.value)} /></Field>
        <Field label="Day count">
          <Select value={dayCount} onChange={(e) => setDayCount(e.target.value as DayCount)}>
            {DAY_COUNTS.map((d) => <option key={d} value={d}>{label(d)}</option>)}
          </Select>
        </Field>
        <div />
        <Field label="Effective from" required><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Effective to"><Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></Field>
        <div className="sm:col-span-2"><Checkbox checked={approved} onChange={setApproved}>Approved — it resolves from its effective date</Checkbox></div>
      </div>
    </ActionModal>
  );
}
