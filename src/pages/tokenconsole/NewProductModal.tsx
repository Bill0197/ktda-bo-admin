import { useState, type ReactNode } from "react";
import { Button, Field, Input, Modal, NotePanel, Select } from "../../ui";
import { tokenConsole } from "../../lib/api";
import { ASSET_CLASSES } from "../../lib/tokenConsole/entityRegistry";
import { invalidateList } from "../../lib/tokenConsole/sharedList";
import { PENDING_CHANGES_KEY, usePendingChanges } from "../../lib/tokenConsole/usePendingChanges";
import type { ConfigChange } from "../../lib/tokenConsole/configChanges";
import { label } from "../../lib/tokenConsole/format";
import { useAction } from "../../lib/tokenConsole/useAction";
import type { CreateProductRequest } from "../../lib/tokenConsole/types.gen";
import { EntityRefField, MultiEntityRefField } from "../../components/tokenconsole/EntityCreate";

const STRUCTURES = ["POOLED_UNITIZED", "DISCRETIONARY_MANDATE"] as const;
const DISTRIBUTION_TYPES = ["INCOME", "GROWTH"] as const;
const ORIGIN = "New product";

/** Everything is a string while editing; the request is assembled on submit. */
type Draft = Omit<CreateProductRequest, "clientCategories" | "tags" | "distributionType"> & {
  distributionType: string;
  clientCategories: string[];
  tags: string;
};

const BLANK: Draft = {
  productId: "", name: "", currency: "KES", assetClass: "BOND", structureType: "POOLED_UNITIZED",
  schemeId: "", packageId: "", tariffDomainId: "", subFundId: "", distributionType: "",
  productGroupId: "", productCategoryId: "", clientCategoryId: "", clientCategories: [],
  contractSubtypeId: "", dateSchemeId: "", reportTypeId: "",
  parentProductId: "", baseProductId: "", activeFrom: "", activeTo: "", tags: "",
};

const opt = (v: string | undefined) => (v && v.trim() !== "" ? v.trim() : undefined);

function problemWith(f: Draft): string | undefined {
  if (!f.productId.trim()) return "Product ID is required.";
  if (!f.name.trim()) return "Name is required.";
  if (!/^[A-Za-z]{3}$/.test(f.currency.trim())) return "Currency must be a three-letter code.";
  if (!f.schemeId) return "Pick or create an accounting scheme.";
  if (!f.packageId) return "Pick or create a service package.";
  if (f.activeFrom && f.activeTo && f.activeTo < f.activeFrom) return "Active to is before active from.";
  return undefined;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border pt-4 first:border-0 first:pt-0">
      <h3 className="mb-3 text-[13px] font-semibold text-text">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/** Mounted only while open, so every opening starts from a blank form. Every
 * reference can be picked, or created on the spot with New — recursively.
 * The product itself is not created here: it is staged for maker-checker, and
 * exists once a different checker approves it (see Change approvals). */
export function NewProductModal({ onClose, onStaged }: { onClose: () => void; onStaged: (c: ConfigChange) => void }) {
  const create = useAction((body: CreateProductRequest) => tokenConsole.stageChange("PRODUCT_CREATE", body));
  const pending = usePendingChanges();
  const [f, setF] = useState<Draft>(BLANK);
  const [dirty, setDirty] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDirty(true);
    setF((s) => ({ ...s, [k]: v }));
  };
  // A second request for the same id could only fail on approval; say so now.
  const waiting = f.productId.trim() && (pending.data ?? []).some(
    (c) => c.changeType === "PRODUCT_CREATE" && c.targetId?.toLowerCase() === f.productId.trim().toLowerCase(),
  );
  const problem = problemWith(f) ?? (waiting ? `A request to create ${f.productId.trim()} is already awaiting approval.` : undefined);

  const ref = (fieldLabel: string, k: keyof Draft, entityKey: string, opts: { required?: boolean; hint?: string } = {}) => (
    <Field label={fieldLabel} required={opts.required} hint={opts.hint} group>
      <EntityRefField entityKey={entityKey} value={String(f[k] ?? "")} onChange={(v) => set(k, v)} originLabel={ORIGIN} />
    </Field>
  );

  const submit = async () => {
    if (problem) return;
    const body: CreateProductRequest = {
      productId: f.productId.trim(),
      name: f.name.trim(),
      currency: f.currency.trim().toUpperCase(),
      assetClass: f.assetClass,
      structureType: f.structureType,
      schemeId: f.schemeId,
      packageId: f.packageId,
      tariffDomainId: opt(f.tariffDomainId),
      subFundId: opt(f.subFundId),
      distributionType: (opt(f.distributionType) as CreateProductRequest["distributionType"]) ?? undefined,
      productGroupId: opt(f.productGroupId),
      productCategoryId: opt(f.productCategoryId),
      clientCategoryId: opt(f.clientCategoryId),
      clientCategories: f.clientCategories.length ? f.clientCategories : undefined,
      contractSubtypeId: opt(f.contractSubtypeId),
      dateSchemeId: opt(f.dateSchemeId),
      reportTypeId: opt(f.reportTypeId),
      parentProductId: opt(f.parentProductId),
      baseProductId: opt(f.baseProductId),
      activeFrom: opt(f.activeFrom),
      activeTo: opt(f.activeTo),
      tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    const staged = await create.run(body);
    if (staged) {
      invalidateList(PENDING_CHANGES_KEY);
      onStaged(staged);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="New product"
      size="lg"
      footer={
        <>
          {dirty && problem ? <p className="mr-auto self-center text-[12.5px] text-text-soft">{problem}</p> : null}
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!!problem || create.pending} onClick={() => void submit()}>
            {create.pending ? "Sending…" : "Send for approval"}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-text-soft">
        Pick an existing record for each reference, or create one with New. Only fields marked * are required.
        The product is created once someone other than you approves it in Change approvals; the references you create with New are saved straight away.
      </p>
      <div className="flex flex-col gap-5">
        <Section title="Identity">
          <Field label="Product ID" required>
            <Input value={f.productId} onChange={(e) => set("productId", e.target.value)} placeholder="BRF-KES-INC" />
          </Field>
          <Field label="Name" required>
            <Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="BRF KES Income Fund" />
          </Field>
          <Field label="Currency" required>
            <Input value={f.currency} maxLength={3} className="uppercase" onChange={(e) => set("currency", e.target.value)} placeholder="KES" />
          </Field>
          <Field label="Asset class" required>
            <Select value={f.assetClass} onChange={(e) => set("assetClass", e.target.value as Draft["assetClass"])}>
              {ASSET_CLASSES.map((v) => <option key={v} value={v}>{label(v)}</option>)}
            </Select>
          </Field>
          <Field label="Structure" required>
            <Select value={f.structureType} onChange={(e) => set("structureType", e.target.value as Draft["structureType"])}>
              {STRUCTURES.map((v) => <option key={v} value={v}>{label(v)}</option>)}
            </Select>
          </Field>
          <Field label="Distribution type">
            <Select value={f.distributionType} onChange={(e) => set("distributionType", e.target.value)}>
              <option value="">(none)</option>
              {DISTRIBUTION_TYPES.map((v) => <option key={v} value={v}>{label(v)}</option>)}
            </Select>
          </Field>
        </Section>

        <Section title="Bindings">
          {ref("Accounting scheme", "schemeId", "scheme", { required: true })}
          {ref("Service package", "packageId", "servicePackage", { required: true })}
          {ref("Tariff domain", "tariffDomainId", "tariffDomain")}
          {ref("Sub-fund", "subFundId", "subFund")}
        </Section>

        <Section title="Classification">
          {ref("Product group", "productGroupId", "productGroup")}
          {ref("Product category", "productCategoryId", "productCategory")}
          {ref("Primary client category", "clientCategoryId", "clientCategory")}
          {ref("Contract subtype", "contractSubtypeId", "contractSubtype")}
          {ref("Date scheme", "dateSchemeId", "dateScheme")}
          {ref("Report type", "reportTypeId", "reportType")}
          <div className="sm:col-span-2">
            <Field label="Eligible client categories" hint="Every category this product may be sold to." group>
              <MultiEntityRefField entityKey="clientCategory" value={f.clientCategories} onChange={(v) => set("clientCategories", v)} originLabel={ORIGIN} />
            </Field>
          </div>
        </Section>

        <Section title="Lineage and lifetime">
          {ref("Parent product", "parentProductId", "product", { hint: "The sibling this variant derives from." })}
          {ref("Base product", "baseProductId", "product")}
          <Field label="Active from">
            <Input type="date" value={f.activeFrom ?? ""} onChange={(e) => set("activeFrom", e.target.value)} />
          </Field>
          <Field label="Active to" error={f.activeFrom && f.activeTo && f.activeTo < f.activeFrom ? "Before active from." : undefined}>
            <Input type="date" value={f.activeTo ?? ""} min={f.activeFrom || undefined} onChange={(e) => set("activeTo", e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Tags" hint="Comma-separated.">
              <Input value={f.tags} onChange={(e) => set("tags", e.target.value)} placeholder="flagship, income-variant" />
            </Field>
          </div>
        </Section>
      </div>
      {create.error && <NotePanel tone="danger" className="mt-4">{create.error}</NotePanel>}
    </Modal>
  );
}
