import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { Badge, Button, Checkbox, Field, GlassPanel, Input, Modal, NotePanel, Select, useToast } from "../../../ui";
import { tokenConsole } from "../../../lib/api";
import { label } from "../../../lib/tokenConsole/format";
import { useAction } from "../../../lib/tokenConsole/useAction";
import { useAsyncData } from "../../../lib/useAsyncData";
import type { ServicePackage, ServicePackageItem } from "../../../lib/tokenConsole/types.gen";
import { Code, ConsoleTable, type Source } from "../../../components/tokenconsole/ConsoleTable";
import { EntityCreateFlow } from "../../../components/tokenconsole/EntityCreate";

const FEE_DIRECTIONS = ["charged_to_investor", "paid_to_investor"] as const;
const FX_BEHAVIORS = ["same_currency_only", "fx_at_spot", "fx_at_fixed_rate"] as const;

/* Table cells are narrow; the form keeps the full wording. Unknown values
   (the API takes free strings) fall back to the generic label. */
const DIRECTION_LABELS: Record<string, string> = { charged_to_investor: "Investor pays", paid_to_investor: "Paid to investor" };
const FX_LABELS: Record<string, string> = { same_currency_only: "Same currency", fx_at_spot: "At spot", fx_at_fixed_rate: "Fixed rate" };
const shortLabel = (map: Record<string, string>, v?: string) => (v ? (map[v] ?? label(v.toUpperCase())) : "—");
const days = (n?: number) => (n == null ? "—" : `${n}d`);

/** Packages on the left; the selected package's items on the right. */
export function PackagesTab({ packages }: { packages: Source<ServicePackage> }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const active = picked ?? packages.data?.[0]?.packageId ?? null;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <ConsoleTable<ServicePackage>
        className=""
        title="Service packages"
        description="Select one to see its fee, limit and lock-in rules."
        actions={<Button size="sm" onClick={() => setCreating(true)}><Plus size={14} /> New package</Button>}
        what="service packages"
        source={packages}
        rowId={(r) => r.packageId}
        selectedId={active}
        onRowClick={(r) => setPicked(r.packageId ?? null)}
        emptyLabel="No packages yet — a product needs one before it can be created"
        columns={[
          { key: "package", header: "Package", render: (r) => <Code>{r.packageId}</Code> },
          { key: "name", header: "Name", render: (r) => r.name ?? "—" },
          { key: "type", header: "Type", render: (r) => label(r.packageType), hideOnMobile: true },
        ]}
      />

      <GlassPanel className="p-4" sheen={false}>
        {active ? (
          <ItemsPanel key={active} packageId={active} packageName={packages.data?.find((p) => p.packageId === active)?.name} />
        ) : (
          <p className="py-6 text-center text-[13px] text-text-soft">Create a package to add fee and lock-in rules.</p>
        )}
      </GlassPanel>

      {creating && (
        <EntityCreateFlow entityKey="servicePackage" originLabel="Configuration" onCreated={(id) => setPicked(id)} onClose={() => setCreating(false)} />
      )}
    </div>
  );
}

function ItemsPanel({ packageId, packageName }: { packageId: string; packageName?: string }) {
  const items = useAsyncData(() => tokenConsole.servicePackageItems(packageId));
  const [adding, setAdding] = useState(false);

  return (
    <>
      <ConsoleTable<ServicePackageItem>
        className=""
        title={packageName ? `Items · ${packageName}` : "Items"}
        description="Fee, limit, notice-tier and lock-in rules."
        actions={<Button size="sm" onClick={() => setAdding(true)}><Plus size={14} /> Add item</Button>}
        what="package items"
        source={items}
        rowId={(r) => r.itemId}
        emptyLabel="No items on this package yet"
        columns={[
          { key: "item", header: "Item", render: (r) => (
            <span className="block min-w-0">
              <span className="flex min-w-0 items-center gap-2">
                <Code>{r.itemId}</Code>
                {/* Allowed is the norm; only the exception earns a badge. */}
                {r.allowed === false && <Badge tone="danger">Blocked</Badge>}
              </span>
              <span className="block truncate text-xs text-text-soft">{r.itemRole}</span>
            </span>
          ) },
          { key: "direction", header: "Direction", render: (r) => shortLabel(DIRECTION_LABELS, r.feeDirection) },
          { key: "notice", header: "Notice", className: "tabular text-right", render: (r) => days(r.noticeDays), hideOnMobile: true },
          { key: "value", header: "Value", className: "tabular text-right", render: (r) => days(r.valueDays), hideOnMobile: true },
          { key: "lockin", header: "Lock-in", className: "tabular text-right", render: (r) => days(r.lockInDays) },
          { key: "fx", header: "FX", render: (r) => shortLabel(FX_LABELS, r.fxBehavior), hideOnMobile: true },
        ]}
      />
      {adding && (
        <AddItemModal
          packageId={packageId}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            void items.reload();
          }}
        />
      )}
    </>
  );
}

const BLANK = {
  itemId: "", itemRole: "", feeDirection: "", feeCurrency: "", transactionTypeId: "", feeTypeId: "",
  tariffId: "", thresholdMin: "", thresholdMax: "", noticeDays: "", priority: "", valueDays: "",
  fxBehavior: "", maxOccurrencesPerPeriod: "", periodDays: "", lockInDays: "",
};
type Draft = typeof BLANK;

const num = (s: string) => (s.trim() === "" ? undefined : Number(s));
const opt = (s: string) => (s.trim() === "" ? undefined : s.trim());

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border pt-4 first:border-0 first:pt-0">
      <h3 className="mb-3 text-[13px] font-semibold text-text">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function AddItemModal({ packageId, onClose, onAdded }: { packageId: string; onClose: () => void; onAdded: () => void }) {
  const transactionTypes = useAsyncData(tokenConsole.transactionTypes);
  const feeTypes = useAsyncData(tokenConsole.feeTypes);
  const tariffValues = useAsyncData(tokenConsole.tariffValues);
  const create = useAction(tokenConsole.createServicePackageItem);
  const toast = useToast();

  const [f, setF] = useState<Draft>(BLANK);
  const set = (k: keyof Draft) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const [isAllowed, setAllowed] = useState(true);
  const [lockInWaivable, setWaivable] = useState(false);
  const [forfeitsReturnsIfEarly, setForfeits] = useState(false);

  const numericKeys: (keyof Draft)[] = ["thresholdMin", "thresholdMax", "noticeDays", "priority", "valueDays", "maxOccurrencesPerPeriod", "periodDays", "lockInDays"];
  const badNumber = numericKeys.find((k) => f[k].trim() !== "" && !Number.isFinite(Number(f[k])));
  const tMin = num(f.thresholdMin);
  const tMax = num(f.thresholdMax);
  const thresholdError = tMin !== undefined && tMax !== undefined && tMin > tMax ? "Min is above max." : undefined;
  const problem = !f.itemId.trim() ? "Item ID is required."
    : !f.itemRole.trim() ? "Role is required."
    : badNumber ? "Numbers only in the numeric fields."
    : thresholdError;
  const listError = [transactionTypes, feeTypes, tariffValues].map((s) => s.error).find(Boolean);

  const text = (k: keyof Draft, props: { placeholder?: string; type?: string } = {}) => (
    <Input {...props} inputMode={props.type === "number" ? "decimal" : undefined} value={f[k]} onChange={(e) => set(k)(e.target.value)} />
  );
  const number = (k: keyof Draft) => text(k, { type: "number" });

  const submit = async () => {
    if (problem) return;
    const saved = await create.run({
      itemId: f.itemId.trim(), servicePackageId: packageId, itemRole: f.itemRole.trim(),
      feeDirection: opt(f.feeDirection), feeCurrency: opt(f.feeCurrency)?.toUpperCase(),
      transactionTypeId: opt(f.transactionTypeId), feeTypeId: opt(f.feeTypeId), tariffId: opt(f.tariffId),
      thresholdMin: tMin, thresholdMax: tMax, noticeDays: num(f.noticeDays),
      priority: num(f.priority), valueDays: num(f.valueDays), fxBehavior: opt(f.fxBehavior),
      maxOccurrencesPerPeriod: num(f.maxOccurrencesPerPeriod), periodDays: num(f.periodDays),
      lockInDays: num(f.lockInDays), isAllowed, lockInWaivable, forfeitsReturnsIfEarly,
    });
    if (saved === undefined) return;
    toast.push(`Added ${f.itemId.trim()} to ${packageId}.`);
    onAdded();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Add package item · ${packageId}`}
      size="lg"
      footer={
        <>
          {problem && (f.itemId || f.itemRole) ? <p className="mr-auto self-center text-[12.5px] text-text-soft">{problem}</p> : null}
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!!problem || create.pending} onClick={() => void submit()}>{create.pending ? "Adding…" : "Add item"}</Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-text-soft">Only fields marked * are required.</p>
      {listError && <NotePanel tone="warning" className="mb-4">Some lists could not be loaded: {listError}</NotePanel>}
      <div className="flex flex-col gap-5">
        <Group title="What it is">
          <Field label="Item ID" required>{text("itemId", { placeholder: "ITM-MGMT-FEE" })}</Field>
          <Field label="Role" required>{text("itemRole", { placeholder: "MANAGEMENT_FEE" })}</Field>
          <Field label="Transaction type">
            <Select value={f.transactionTypeId} onChange={(e) => set("transactionTypeId")(e.target.value)}>
              <option value="">(none)</option>
              {transactionTypes.data?.map((t) => <option key={t.transactionTypeId} value={t.transactionTypeId}>{label(t.code)}</option>)}
            </Select>
          </Field>
          <div className="flex items-end pb-2.5">
            <Checkbox checked={isAllowed} onChange={setAllowed}>Allowed</Checkbox>
          </div>
        </Group>

        <Group title="Fee">
          <Field label="Fee type">
            <Select value={f.feeTypeId} onChange={(e) => set("feeTypeId")(e.target.value)}>
              <option value="">(none)</option>
              {feeTypes.data?.map((t) => <option key={t.feeTypeId} value={t.feeTypeId}>{label(t.code)}</option>)}
            </Select>
          </Field>
          <Field label="Tariff" hint="Resolves the rate.">
            <Select value={f.tariffId} onChange={(e) => set("tariffId")(e.target.value)}>
              <option value="">(none)</option>
              {tariffValues.data?.map((t) => <option key={t.tariffValueId} value={t.tariffValueId}>{t.tariffTypeId} · {t.currency}</option>)}
            </Select>
          </Field>
          <Field label="Direction">
            <Select value={f.feeDirection} onChange={(e) => set("feeDirection")(e.target.value)}>
              <option value="">(not applicable)</option>
              {FEE_DIRECTIONS.map((v) => <option key={v} value={v}>{label(v.toUpperCase())}</option>)}
            </Select>
          </Field>
          <Field label="Fee currency">
            <Input value={f.feeCurrency} maxLength={3} className="uppercase placeholder:normal-case" onChange={(e) => set("feeCurrency")(e.target.value)} placeholder="KES" />
          </Field>
          <Field label="Min threshold">{number("thresholdMin")}</Field>
          <Field label="Max threshold" error={thresholdError}>{number("thresholdMax")}</Field>
        </Group>

        <Group title="Timing and FX">
          <Field label="Notice (days)">{number("noticeDays")}</Field>
          <Field label="Value days">{number("valueDays")}</Field>
          <Field label="Priority">{number("priority")}</Field>
          <Field label="FX behavior">
            <Select value={f.fxBehavior} onChange={(e) => set("fxBehavior")(e.target.value)}>
              <option value="">(none)</option>
              {FX_BEHAVIORS.map((v) => <option key={v} value={v}>{label(v.toUpperCase())}</option>)}
            </Select>
          </Field>
          <Field label="Max occurrences">{number("maxOccurrencesPerPeriod")}</Field>
          <Field label="Per (days)">{number("periodDays")}</Field>
        </Group>

        <Group title="Lock-in">
          <Field label="Lock-in (days)">{number("lockInDays")}</Field>
          <div className="flex flex-col justify-end gap-2.5 pb-1">
            <Checkbox checked={lockInWaivable} onChange={setWaivable}>Lock-in waivable</Checkbox>
            <Checkbox checked={forfeitsReturnsIfEarly} onChange={setForfeits}>Forfeits returns if redeemed early</Checkbox>
          </div>
        </Group>
      </div>
      {create.error && <NotePanel tone="danger" className="mt-4">{create.error}</NotePanel>}
    </Modal>
  );
}
