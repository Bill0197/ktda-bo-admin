import { useState } from "react";
import { Button, Field, Input, Modal, NotePanel, PageHeader, Select, useToast } from "../../ui";
import { Plus } from "lucide-react";
import { tokenConsole } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useAsyncData } from "../../lib/useAsyncData";
import { label, shortId } from "../../lib/tokenConsole/format";
import { useAction } from "../../lib/tokenConsole/useAction";
import type { CreateProductRequest, Product } from "../../lib/tokenConsole/types.gen";
import { Code, ConsoleTable, StatusBadge } from "../../components/tokenconsole/ConsoleTable";
import { ProductConfigModal } from "./ProductConfigModal";

const ASSET_CLASSES = ["BOND", "EQUITY", "FX", "DERIVATIVE", "MONEY_MARKET", "INDEX", "BALANCED", "LOAN"] as const;
const STRUCTURES = ["POOLED_UNITIZED", "DISCRETIONARY_MANDATE"] as const;

const BLANK: CreateProductRequest = {
  productId: "", name: "", currency: "KES", assetClass: "BOND", structureType: "POOLED_UNITIZED", schemeId: "", packageId: "",
};

const opt = (v: string | undefined) => (v && v.trim() !== "" ? v : undefined);

/** Reference lists for the create form, loaded only when the form opens. */
function NewProductModal({ onClose, onCreated }: { onClose: () => void; onCreated: (p: Product) => void }) {
  const schemes = useAsyncData(tokenConsole.schemes);
  const packages = useAsyncData(tokenConsole.servicePackages);
  const domains = useAsyncData(tokenConsole.tariffDomains);
  const groups = useAsyncData(tokenConsole.productGroups);
  const categories = useAsyncData(tokenConsole.productCategories);
  const clientCategories = useAsyncData(tokenConsole.clientCategories);
  const subtypes = useAsyncData(tokenConsole.contractSubtypes);
  const dateSchemes = useAsyncData(tokenConsole.dateSchemes);
  const reportTypes = useAsyncData(tokenConsole.reportTypes);
  const create = useAction(tokenConsole.createProduct);

  const [f, setF] = useState<CreateProductRequest>(BLANK);
  const [tags, setTags] = useState("");
  const set = <K extends keyof CreateProductRequest>(k: K, v: CreateProductRequest[K]) => setF((s) => ({ ...s, [k]: v }));

  const listError = [schemes, packages, domains, groups, categories, clientCategories, subtypes, dateSchemes, reportTypes]
    .map((s) => s.error).find(Boolean);
  const valid = !!(f.productId.trim() && f.name.trim() && f.currency.trim() && f.schemeId && f.packageId);

  const submit = async () => {
    const body: CreateProductRequest = {
      ...f,
      productId: f.productId.trim(),
      name: f.name.trim(),
      currency: f.currency.trim().toUpperCase(),
      tariffDomainId: opt(f.tariffDomainId),
      productGroupId: opt(f.productGroupId),
      productCategoryId: opt(f.productCategoryId),
      clientCategoryId: opt(f.clientCategoryId),
      contractSubtypeId: opt(f.contractSubtypeId),
      dateSchemeId: opt(f.dateSchemeId),
      reportTypeId: opt(f.reportTypeId),
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    const created = await create.run(body);
    if (created) onCreated(created);
  };

  const optional = <T,>(
    fieldLabel: string, key: keyof CreateProductRequest, rows: T[] | null, value: (r: T) => string | undefined, text: (r: T) => string | undefined,
  ) => (
    <Field label={fieldLabel}>
      <Select value={(f[key] as string | undefined) ?? ""} onChange={(e) => set(key, e.target.value as never)}>
        <option value="">(none)</option>
        {(rows ?? []).map((r) => {
          const v = value(r);
          return v ? <option key={v} value={v}>{text(r) ?? v}</option> : null;
        })}
      </Select>
    </Field>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title="New product"
      size="lg"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!valid || create.pending} onClick={() => void submit()}>
            {create.pending ? "Creating…" : "Create product"}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-text-soft">Identity and bindings are required. Classification is optional.</p>
      {listError && <NotePanel tone="warning" className="mb-4">Some lists could not be loaded: {listError}</NotePanel>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Product ID" required><Input value={f.productId} onChange={(e) => set("productId", e.target.value)} placeholder="BRF-KES-INC" /></Field>
        <Field label="Name" required><Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="BRF KES Income Fund" /></Field>
        <Field label="Currency" required><Input value={f.currency} onChange={(e) => set("currency", e.target.value)} placeholder="KES" /></Field>
        <Field label="Asset class" required>
          <Select value={f.assetClass} onChange={(e) => set("assetClass", e.target.value as CreateProductRequest["assetClass"])}>
            {ASSET_CLASSES.map((v) => <option key={v} value={v}>{label(v)}</option>)}
          </Select>
        </Field>
        <Field label="Structure" required>
          <Select value={f.structureType} onChange={(e) => set("structureType", e.target.value as CreateProductRequest["structureType"])}>
            {STRUCTURES.map((v) => <option key={v} value={v}>{label(v)}</option>)}
          </Select>
        </Field>
        <Field label="Accounting scheme" required>
          <Select value={f.schemeId} onChange={(e) => set("schemeId", e.target.value)}>
            <option value="">Select…</option>
            {(schemes.data ?? []).map((s) => <option key={s.schemeId} value={s.schemeId}>{s.schemeId} — {s.name}</option>)}
          </Select>
        </Field>
        <Field label="Service package" required>
          <Select value={f.packageId} onChange={(e) => set("packageId", e.target.value)}>
            <option value="">Select…</option>
            {(packages.data ?? []).map((s) => <option key={s.packageId} value={s.packageId}>{s.packageId} — {s.name}</option>)}
          </Select>
        </Field>
        {optional("Tariff domain", "tariffDomainId", domains.data, (d) => d.tariffDomainId, (d) => d.tariffDomainId)}
        {optional("Product group", "productGroupId", groups.data, (g) => g.productGroupId, (g) => g.groupName)}
        {optional("Product category", "productCategoryId", categories.data, (c) => c.productCategoryId, (c) => c.categoryName)}
        {optional("Client category", "clientCategoryId", clientCategories.data, (c) => c.clientCategoryId, (c) => c.categoryName)}
        {optional("Contract subtype", "contractSubtypeId", subtypes.data, (c) => c.contractSubtypeId, (c) => c.subtypeName)}
        {optional("Date scheme", "dateSchemeId", dateSchemes.data, (d) => d.dateSchemeId, (d) => d.schemeName)}
        {optional("Report type", "reportTypeId", reportTypes.data, (r) => r.reportTypeId, (r) => r.reportName)}
        <div className="sm:col-span-2">
          <Field label="Tags" hint="Comma-separated">
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="flagship, income-variant" />
          </Field>
        </div>
      </div>
      {create.error && <NotePanel tone="danger" className="mt-4">{create.error}</NotePanel>}
    </Modal>
  );
}

export default function TokenConsoleProducts() {
  const { can } = useAuth();
  const canWrite = can("tok_products:write");
  const toast = useToast();
  const products = useAsyncData(tokenConsole.products);
  const [creating, setCreating] = useState(false);
  const [configuring, setConfiguring] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        eyebrow="Tokenization Console"
        title="Products"
        subtitle="Share classes: what an investor actually holds units of, and what NAV is struck against."
        actions={canWrite ? <Button size="sm" onClick={() => setCreating(true)}><Plus size={14} /> New product</Button> : undefined}
      />
      <ConsoleTable<Product>
        what="products"
        source={products}
        rowId={(r) => r.productId}
        emptyLabel="No products defined"
        columns={[
          { key: "product", header: "Product", render: (r) => (
            <div>
              <Code>{r.productId}</Code>
              <div className="text-sm text-text">{r.name ?? "—"}</div>
            </div>
          ) },
          { key: "ccy", header: "Ccy", render: (r) => r.currency ?? "—" },
          { key: "class", header: "Class", render: (r) => (
            <div className="text-xs">
              <div className="text-text-soft">{label(r.assetClass)}</div>
              <div className="text-text-faint">{label(r.structureType)}</div>
            </div>
          ), hideOnMobile: true },
          // Unlinked is normal, not an error: nothing can be reconciled for
          // the product until a token class is linked.
          { key: "token", header: "Token class", render: (r) => r.tokenClassId
            ? <Code>{shortId(r.tokenClassId)}</Code>
            : <span className="text-xs text-text-faint">Not linked</span>, hideOnMobile: true },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "configure", header: "", className: "text-right", render: (r) => r.productId ? (
            <Button size="sm" variant="ghost" aria-label={`Limits and events for ${r.productId}`} onClick={() => setConfiguring(r.productId ?? null)}>
              {canWrite ? "Configure" : "Limits & events"}
            </Button>
          ) : null },
        ]}
      />

      {creating && (
        <NewProductModal
          onClose={() => setCreating(false)}
          onCreated={(p) => {
            toast.push(`Created ${p.productId ?? "product"}`);
            setCreating(false);
            void products.reload();
          }}
        />
      )}
      {configuring && (
        <ProductConfigModal key={configuring} productId={configuring} canWrite={canWrite} onClose={() => setConfiguring(null)} />
      )}
    </div>
  );
}
