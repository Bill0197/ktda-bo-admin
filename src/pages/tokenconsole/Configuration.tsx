import { useState } from "react";
import { Button, Checkbox, Field, Input, Modal, NotePanel, PageHeader, SectionTitle, Select, useToast } from "../../ui";
import { Plus } from "lucide-react";
import { tokenConsole } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useAsyncData } from "../../lib/useAsyncData";
import { label } from "../../lib/tokenConsole/format";
import { useAction } from "../../lib/tokenConsole/useAction";
import type {
  AccountTemplate, AccountingScheme, ChartOfAccount, ClassifierType, ContractSubtype, CreateAccountTemplateRequest,
  ServicePackage, ServicePackageItem,
} from "../../lib/tokenConsole/types.gen";
import { Code, ConsoleTable } from "../../components/tokenconsole/ConsoleTable";

const ACCOUNT_ROLES: CreateAccountTemplateRequest["accountRole"][] = [
  "PRINCIPAL", "ACCRUED_INTEREST", "TAX_WITHHELD", "SETTLEMENT_CASH", "BANK_CASH", "UNALLOCATED",
  "FEE_INCOME", "LIQUIDITY_EXPENSE", "INVESTOR_EXPENSE", "REALIZED_GAIN_LOSS",
  "LOAN_PRINCIPAL", "LOAN_INTEREST_RECEIVABLE", "INTEREST_INCOME", "PENALTY_INCOME",
];
const SCOPES: NonNullable<CreateAccountTemplateRequest["scope"]>[] = ["PER_CONTRACT", "PER_INSTITUTION"];
const FEE_DIRECTIONS = ["", "charged_to_investor", "paid_to_investor"] as const;
const FX_BEHAVIORS = ["", "same_currency_only", "fx_at_spot", "fx_at_fixed_rate"] as const;

const WRITE = "tok_configuration:write";

export default function TokenConsoleConfiguration() {
  const { can } = useAuth();
  const canWrite = can(WRITE);
  const chart = useAsyncData(tokenConsole.chart);
  const schemes = useAsyncData(tokenConsole.schemes);
  const packages = useAsyncData(tokenConsole.servicePackages);
  const classifierTypes = useAsyncData(tokenConsole.classifierTypes);
  const classifierValues = useAsyncData(tokenConsole.classifierValues);

  return (
    <div>
      <PageHeader eyebrow="Tokenization Console" title="Configuration" subtitle="The reference data everything else in the accounting service is defined against." />

      <ConsoleTable<ChartOfAccount>
        what="the chart of accounts"
        source={chart}
        rowId={(r) => r.accountCode}
        title="Chart of accounts"
        emptyLabel="No chart loaded"
        columns={[
          { key: "code", header: "Code", render: (r) => <Code>{r.accountCode}</Code> },
          { key: "name", header: "Account", render: (r) => r.accountName ?? "—" },
          { key: "type", header: "Type", render: (r) => label(r.accountType), hideOnMobile: true },
          { key: "normal", header: "Normal balance", render: (r) => label(r.normalBalance), hideOnMobile: true },
        ]}
      />

      <ContractSubtypes canWrite={canWrite} />

      <ConsoleTable<AccountingScheme>
        what="accounting schemes"
        source={schemes}
        rowId={(r) => r.schemeId}
        title="Accounting schemes"
        emptyLabel="No schemes"
        columns={[
          { key: "id", header: "Scheme", render: (r) => <Code>{r.schemeId}</Code> },
          { key: "name", header: "Name", render: (r) => r.name ?? "—" },
          { key: "parent", header: "Parent", render: (r) => <Code>{r.parentSchemeId}</Code>, hideOnMobile: true },
        ]}
      />

      <SchemeTemplates schemes={schemes.data ?? []} canWrite={canWrite} />

      <ConsoleTable<ServicePackage>
        what="service packages"
        source={packages}
        rowId={(r) => r.packageId}
        title="Service packages"
        emptyLabel="No packages"
        columns={[
          { key: "id", header: "Package", render: (r) => <Code>{r.packageId}</Code> },
          { key: "name", header: "Name", render: (r) => r.name ?? "—" },
          { key: "type", header: "Type", render: (r) => label(r.packageType), hideOnMobile: true },
          { key: "freq", header: "Distributes", render: (r) => r.distributionFrequency ?? "—", hideOnMobile: true },
        ]}
      />

      <PackageItems packages={packages.data ?? []} canWrite={canWrite} />

      <ConsoleTable<ClassifierType>
        what="classifiers"
        source={classifierTypes}
        rowId={(r) => r.classifierTypeId}
        title="Classifiers"
        description="Types, and how many values belong to each."
        emptyLabel="No classifier types"
        columns={[
          { key: "id", header: "Type", render: (r) => <Code>{r.classifierTypeId}</Code> },
          { key: "name", header: "Name", render: (r) => r.name ?? "—" },
          { key: "applies", header: "Applies to", render: (r) => label(r.appliesTo), hideOnMobile: true },
          { key: "values", header: "Values", className: "tabular text-right", render: (r) => classifierValues.error
            ? "—"
            : (classifierValues.data ?? []).filter((v) => v.classifierTypeId === r.classifierTypeId).length },
        ]}
      />
    </div>
  );
}

function ContractSubtypes({ canWrite }: { canWrite: boolean }) {
  const toast = useToast();
  const subtypes = useAsyncData(tokenConsole.contractSubtypes);
  const create = useAction(tokenConsole.createContractSubtype);
  const [open, setOpen] = useState(false);
  const [id, setId] = useState("");
  const [name, setName] = useState("");

  const close = () => {
    setOpen(false);
    setId("");
    setName("");
    create.reset();
  };

  const submit = async () => {
    const saved = await create.run({ contractSubtypeId: id.trim(), subtypeName: name.trim() });
    if (saved === undefined) return;
    toast.push(`Created ${id.trim()}`);
    close();
    void subtypes.reload();
  };

  return (
    <>
      <ConsoleTable<ContractSubtype>
        what="contract subtypes"
        source={subtypes}
        rowId={(r) => r.contractSubtypeId}
        title="Contract subtypes"
        description="What kind of contract subscribing to a product creates."
        actions={canWrite ? <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus size={14} /> New subtype</Button> : undefined}
        emptyLabel="No contract subtypes"
        columns={[
          { key: "id", header: "ID", render: (r) => <Code>{r.contractSubtypeId}</Code> },
          { key: "name", header: "Name", render: (r) => r.subtypeName ?? "—" },
        ]}
      />
      <Modal
        open={open}
        onClose={close}
        title="New contract subtype"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={close}>Cancel</Button>
            <Button size="sm" disabled={!id.trim() || !name.trim() || create.pending} onClick={() => void submit()}>
              {create.pending ? "Creating…" : "Create"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Subtype ID" required><Input value={id} onChange={(e) => setId(e.target.value)} placeholder="CS-DIRECT-RETAIL" /></Field>
          <Field label="Name" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Direct retail subscription" /></Field>
        </div>
        {create.error && <NotePanel tone="danger" className="mt-4">{create.error}</NotePanel>}
      </Modal>
    </>
  );
}

/** Account templates for one scheme. The form and list below the picker are
 * keyed by scheme, so a draft for one scheme is never submitted to another. */
function SchemeTemplates({ schemes, canWrite }: { schemes: AccountingScheme[]; canWrite: boolean }) {
  const [schemeId, setSchemeId] = useState("");
  return (
    <section className="mb-6">
      <SectionTitle title="Account templates" description="Map an account role to a chart-of-accounts code, within one scheme." />
      <div className="mb-3 w-full max-w-sm">
      <Field label="Scheme">
        <Select value={schemeId} onChange={(e) => setSchemeId(e.target.value)}>
          <option value="">Select a scheme…</option>
          {schemes.map((s) => <option key={s.schemeId} value={s.schemeId}>{s.schemeId} — {s.name}</option>)}
        </Select>
      </Field>
      </div>
      {schemeId && <SchemeTemplatesFor key={schemeId} schemeId={schemeId} canWrite={canWrite} />}
    </section>
  );
}

function SchemeTemplatesFor({ schemeId, canWrite }: { schemeId: string; canWrite: boolean }) {
  const toast = useToast();
  const templates = useAsyncData(() => tokenConsole.schemeTemplates(schemeId));
  const create = useAction(tokenConsole.createAccountTemplate);
  const [accountRole, setRole] = useState<CreateAccountTemplateRequest["accountRole"]>("PRINCIPAL");
  const [accountCode, setCode] = useState("");
  const [scope, setScope] = useState<NonNullable<CreateAccountTemplateRequest["scope"]>>("PER_CONTRACT");
  const [availableBalance, setAvailable] = useState(false);

  const submit = async () => {
    const saved = await create.run({ schemeId, accountRole, accountCode: accountCode.trim() || undefined, scope, availableBalance });
    if (saved === undefined) return;
    toast.push(`Added ${accountRole} to ${schemeId}`);
    setCode("");
    setAvailable(false);
    void templates.reload();
  };

  return (
    <>
      {canWrite && (
        <div className="mb-3">
          <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto_auto]">
            <Field label="Role">
              <Select value={accountRole} onChange={(e) => setRole(e.target.value as CreateAccountTemplateRequest["accountRole"])}>
                {ACCOUNT_ROLES.map((v) => <option key={v} value={v}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Code"><Input value={accountCode} onChange={(e) => setCode(e.target.value)} placeholder="Role default" /></Field>
            <Field label="Scope">
              <Select value={scope} onChange={(e) => setScope(e.target.value as NonNullable<CreateAccountTemplateRequest["scope"]>)}>
                {SCOPES.map((v) => <option key={v} value={v}>{v}</option>)}
              </Select>
            </Field>
            <div className="pb-2"><Checkbox checked={availableBalance} onChange={setAvailable}>Available balance</Checkbox></div>
            <Button size="sm" disabled={create.pending} onClick={() => void submit()}>{create.pending ? "Adding…" : "Add template"}</Button>
          </div>
          {create.error && <NotePanel tone="danger" className="mt-2">{create.error}</NotePanel>}
        </div>
      )}
      <ConsoleTable<AccountTemplate>
        what="account templates"
        source={templates}
        rowId={(r) => r.templateId}
        emptyLabel="No templates on this scheme yet"
        className=""
        columns={[
          { key: "role", header: "Role", render: (r) => <Code>{r.accountRole}</Code> },
          { key: "code", header: "Code", render: (r) => <Code>{r.accountCode}</Code> },
          { key: "scope", header: "Scope", render: (r) => label(r.scope), hideOnMobile: true },
          { key: "available", header: "Available bal.", render: (r) => (r.availableBalance ? "Yes" : "No") },
        ]}
      />
    </>
  );
}

function PackageItems({ packages, canWrite }: { packages: ServicePackage[]; canWrite: boolean }) {
  const [packageId, setPackageId] = useState("");
  return (
    <section className="mb-6">
      <SectionTitle title="Service-package items" description="Fee, limit, notice-tier and lock-in rules on a package." />
      <div className="mb-3 w-full max-w-sm">
      <Field label="Service package">
        <Select value={packageId} onChange={(e) => setPackageId(e.target.value)}>
          <option value="">Select a package…</option>
          {packages.map((s) => <option key={s.packageId} value={s.packageId}>{s.packageId} — {s.name}</option>)}
        </Select>
      </Field>
      </div>
      {packageId && <PackageItemsFor key={packageId} packageId={packageId} canWrite={canWrite} />}
    </section>
  );
}

const ITEM_BLANK = {
  itemId: "", itemRole: "", feeDirection: "", feeCurrency: "", transactionTypeId: "", feeTypeId: "",
  tariffId: "", thresholdMin: "", thresholdMax: "", noticeDays: "", priority: "", valueDays: "",
  fxBehavior: "", maxOccurrencesPerPeriod: "", periodDays: "", lockInDays: "",
};
type ItemDraft = typeof ITEM_BLANK;
const NUMERIC: (keyof ItemDraft)[] = ["thresholdMin", "thresholdMax", "noticeDays", "priority", "valueDays", "maxOccurrencesPerPeriod", "periodDays", "lockInDays"];

function PackageItemsFor({ packageId, canWrite }: { packageId: string; canWrite: boolean }) {
  const toast = useToast();
  const items = useAsyncData(() => tokenConsole.servicePackageItems(packageId));
  // Pickers only matter to someone who can add an item.
  const transactionTypes = useAsyncData(() => (canWrite ? tokenConsole.transactionTypes() : Promise.resolve([])));
  const feeTypes = useAsyncData(() => (canWrite ? tokenConsole.feeTypes() : Promise.resolve([])));
  const tariffValues = useAsyncData(() => (canWrite ? tokenConsole.tariffValues() : Promise.resolve([])));
  const create = useAction(tokenConsole.createServicePackageItem);

  const [f, setF] = useState<ItemDraft>({ ...ITEM_BLANK });
  const set = (k: keyof ItemDraft) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const [isAllowed, setAllowed] = useState(true);
  const [lockInWaivable, setWaivable] = useState(false);
  const [forfeitsReturnsIfEarly, setForfeits] = useState(false);

  const num = (s: string) => (s.trim() === "" ? undefined : Number(s));
  const opt = (s: string) => (s.trim() === "" ? undefined : s.trim());
  const nonNumeric = NUMERIC.filter((k) => f[k].trim() !== "" && !Number.isFinite(Number(f[k])));
  const tMin = num(f.thresholdMin);
  const tMax = num(f.thresholdMax);
  const problem = nonNumeric.length ? "Numeric fields must be numbers."
    : tMin !== undefined && tMax !== undefined && tMin > tMax ? "Min threshold is above max."
    : undefined;

  const submit = async () => {
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
    toast.push(`Added ${f.itemId.trim()} to ${packageId}`);
    setF({ ...ITEM_BLANK });
    setAllowed(true);
    setWaivable(false);
    setForfeits(false);
    void items.reload();
  };

  const numberField = (fieldLabel: string, k: keyof ItemDraft) => (
    <Field label={fieldLabel}><Input type="number" inputMode="decimal" value={f[k]} onChange={(e) => set(k)(e.target.value)} /></Field>
  );

  return (
    <>
      {canWrite && (
        <div className="mb-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Item ID" required><Input value={f.itemId} onChange={(e) => set("itemId")(e.target.value)} placeholder="ITM-…" /></Field>
            <Field label="Role" required><Input value={f.itemRole} onChange={(e) => set("itemRole")(e.target.value)} placeholder="MANAGEMENT_FEE" /></Field>
            <Field label="Direction">
              <Select value={f.feeDirection} onChange={(e) => set("feeDirection")(e.target.value)}>
                {FEE_DIRECTIONS.map((v) => <option key={v || "none"} value={v}>{v ? label(v.toUpperCase()) : "(n/a)"}</option>)}
              </Select>
            </Field>
            <Field label="Fee currency"><Input value={f.feeCurrency} onChange={(e) => set("feeCurrency")(e.target.value)} placeholder="KES" /></Field>
            <Field label="Transaction type">
              <Select value={f.transactionTypeId} onChange={(e) => set("transactionTypeId")(e.target.value)}>
                <option value="">(none)</option>
                {(transactionTypes.data ?? []).map((t) => <option key={t.transactionTypeId} value={t.transactionTypeId}>{t.code}</option>)}
              </Select>
            </Field>
            <Field label="Fee type">
              <Select value={f.feeTypeId} onChange={(e) => set("feeTypeId")(e.target.value)}>
                <option value="">(none)</option>
                {(feeTypes.data ?? []).map((t) => <option key={t.feeTypeId} value={t.feeTypeId}>{t.code}</option>)}
              </Select>
            </Field>
            <Field label="Tariff" hint="Resolves the rate">
              <Select value={f.tariffId} onChange={(e) => set("tariffId")(e.target.value)}>
                <option value="">(none)</option>
                {(tariffValues.data ?? []).map((t) => <option key={t.tariffValueId} value={t.tariffValueId}>{t.tariffTypeId} · {t.currency}</option>)}
              </Select>
            </Field>
            {numberField("Notice (days)", "noticeDays")}
          </div>

          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-text-soft">Thresholds, priority, value dating, FX, frequency, lock-in</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {numberField("Min threshold", "thresholdMin")}
              {numberField("Max threshold", "thresholdMax")}
              {numberField("Priority", "priority")}
              {numberField("Value days", "valueDays")}
              <Field label="FX behaviour">
                <Select value={f.fxBehavior} onChange={(e) => set("fxBehavior")(e.target.value)}>
                  {FX_BEHAVIORS.map((v) => <option key={v || "none"} value={v}>{v ? label(v.toUpperCase()) : "(none)"}</option>)}
                </Select>
              </Field>
              {numberField("Max occurrences", "maxOccurrencesPerPeriod")}
              {numberField("Per (days)", "periodDays")}
              {numberField("Lock-in (days)", "lockInDays")}
            </div>
          </details>

          <div className="mt-3 flex flex-wrap items-center gap-5">
            <Checkbox checked={isAllowed} onChange={setAllowed}>Allowed</Checkbox>
            <Checkbox checked={lockInWaivable} onChange={setWaivable}>Lock-in waivable</Checkbox>
            <Checkbox checked={forfeitsReturnsIfEarly} onChange={setForfeits}>Forfeits returns if early</Checkbox>
            <Button size="sm" disabled={!f.itemId.trim() || !f.itemRole.trim() || !!problem || create.pending} onClick={() => void submit()}>
              {create.pending ? "Adding…" : "Add item"}
            </Button>
            {problem && <span className="text-xs text-danger">{problem}</span>}
          </div>
          {create.error && <NotePanel tone="danger" className="mt-2">{create.error}</NotePanel>}
        </div>
      )}
      <ConsoleTable<ServicePackageItem>
        what="package items"
        source={items}
        rowId={(r) => r.itemId}
        emptyLabel="No items on this package yet"
        className=""
        columns={[
          { key: "item", header: "Item", render: (r) => (
            <div>
              <Code>{r.itemId}</Code>
              <div className="text-xs text-text-soft">{r.itemRole ?? "—"}</div>
            </div>
          ) },
          { key: "direction", header: "Direction", render: (r) => (r.feeDirection ? label(r.feeDirection.toUpperCase()) : "—"), hideOnMobile: true },
          { key: "notice", header: "Notice", className: "tabular text-right", render: (r) => r.noticeDays ?? "—", hideOnMobile: true },
          { key: "value", header: "Value days", className: "tabular text-right", render: (r) => r.valueDays ?? "—", hideOnMobile: true },
          { key: "fx", header: "FX", render: (r) => (r.fxBehavior ? label(r.fxBehavior.toUpperCase()) : "—"), hideOnMobile: true },
          { key: "lockin", header: "Lock-in", className: "tabular text-right", render: (r) => r.lockInDays ?? "—" },
          { key: "allowed", header: "Allowed", render: (r) => (r.allowed ? "Yes" : "No") },
        ]}
      />
    </>
  );
}
