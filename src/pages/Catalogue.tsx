import { useState } from "react";
import { TARIFF_TYPES, TARIFF_DOMAINS, DAY_COUNT_LABELS } from "../mock";
import {
  getProducts, getServicePackages, getTariffs, getAccountTemplates, getTokenizationReadiness,
  proposeTariffChange,
} from "../lib/api";
import {
  PageHeader, Card, Badge, DataTable, Tabs, Skeleton, Button, Modal, Field, Input, Select,
  Money, InfoTip, useToast, formatDate, type Column, type TabDef,
} from "../ui";
import { useAuth, ADMIN_USERS } from "../lib/auth";
import { useAsyncData } from "../lib/useAsyncData";

/** The configuration layer the platform data specification describes:
 * institution → product → service package → accounting scheme → tariff domain.
 * Read-only except for tariffs, which stage through maker-checker like every
 * other business parameter. Adding a product is meant to be a data change, so
 * this page shows the chain rather than offering to edit code-shaped things. */
export default function Catalogue() {
  const [tab, setTab] = useState("products");
  const { data: products, loading } = useAsyncData(getProducts);
  const { data: packages } = useAsyncData(getServicePackages);
  const { data: tariffs, reload: reloadTariffs } = useAsyncData(getTariffs);
  const { data: templates } = useAsyncData(getAccountTemplates);
  const { data: hooks } = useAsyncData(getTokenizationReadiness);

  const tabs: TabDef[] = [
    { key: "products", label: "Products", count: products?.length },
    { key: "packages", label: "Service packages", count: packages?.length },
    { key: "tariffs", label: "Tariffs", count: tariffs?.length },
    { key: "accounts", label: "Account templates", count: templates?.length },
    { key: "tokenization", label: "Tokenization hooks" },
  ];

  return (
    <div>
      <PageHeader
        title="Product catalogue"
        tooltip="A service package holds the operating terms a product is sold under (fees, liquidity, redemption tiers). An accounting scheme decides which ledger accounts each contract gets. A tariff domain is a named container for rates — many products can point at one, so changing the domain changes the rate everywhere."
        subtitle="Institution → product → service package → accounting scheme → tariff domain. Adding a product is configuration, not a code change — this is the chain that makes that true."
      />
      <Tabs tabs={tabs} active={tab} onChange={setTab} className="mb-5" />
      {loading && <Skeleton className="h-64" />}
      {!loading && tab === "products" && <ProductsTab rows={products ?? []} />}
      {!loading && tab === "packages" && <PackagesTab rows={packages ?? []} />}
      {!loading && tab === "tariffs" && <TariffsTab rows={tariffs ?? []} onChanged={reloadTariffs} />}
      {!loading && tab === "accounts" && <TemplatesTab rows={templates ?? []} />}
      {!loading && tab === "tokenization" && <TokenizationTab rows={hooks ?? []} />}
    </div>
  );
}

type ProductRow = Awaited<ReturnType<typeof getProducts>>[number];

function ProductsTab({ rows }: { rows: ProductRow[] }) {
  const columns: Column<ProductRow>[] = [
    // Code, currency and the sibling link are the product's identity, so they read under its name.
    { key: "id", header: "Product", className: "min-w-[220px]", render: (r) => (
      <div>
        <div className="text-text font-medium whitespace-nowrap">{r.name}</div>
        <div className="mt-0.5 text-xs text-text-faint">
          <span className="tabular">{r.id}</span> · {r.currency} · {r.parentProductId
            ? <>variant of <span className="tabular">{r.parentProductId}</span></>
            : "parent"}
        </div>
      </div>
    ) },
    { key: "class", header: "Distribution", className: "whitespace-nowrap", render: (r) => (
      <Badge tone={r.distributionClass === "growth" ? "info" : "neutral"}>
        {r.distributionClass === "growth" ? "Growth — capitalises" : "Income — pays cash"}
      </Badge>
    ) },
    { key: "parent", header: "Variant of", className: "whitespace-nowrap", render: (r) => r.parentProductId
      ? <span className="tabular text-text-soft">{r.parentProductId}</span>
      : <span className="text-text-faint">(parent)</span>, hideOnMobile: true, defaultHidden: true },
    { key: "currency", header: "Currency", className: "whitespace-nowrap", render: (r) => <span className="tabular">{r.currency}</span>, hideOnMobile: true, defaultHidden: true },
    { key: "units", header: "Units outstanding", className: "text-right whitespace-nowrap", render: (r) => <span className="tabular">{r.unitsOutstanding.toLocaleString()}</span>, hideOnMobile: true },
    { key: "fee", header: "Fee · coupon", className: "text-right whitespace-nowrap", render: (r) => (
      <div>
        {r.managementFeePct !== null
          ? <div className="tabular text-text">{r.managementFeePct.toFixed(2)}%</div>
          : <div className="text-text-faint">unresolved</div>}
        <div className="text-xs text-text-faint">
          coupon {r.couponRatePct !== null ? <span className="tabular">{r.couponRatePct.toFixed(2)}%</span> : "unresolved"}
        </div>
      </div>
    ), hideOnMobile: true },
    { key: "coupon", header: "Coupon", className: "text-right whitespace-nowrap", render: (r) => r.couponRatePct !== null
      ? <span className="tabular">{r.couponRatePct.toFixed(2)}%</span>
      : <span className="text-text-faint">unresolved</span>, hideOnMobile: true, defaultHidden: true },
    { key: "daycount", header: "Day count", className: "whitespace-nowrap", render: (r) => r.dayCount
      ? <span className="text-text-soft">{DAY_COUNT_LABELS[r.dayCount]}</span>
      : <span className="text-text-faint">—</span>, hideOnMobile: true, defaultHidden: true },
    { key: "package", header: "Service package", render: (r) => <span className="text-text-soft">{r.packageName}</span>, hideOnMobile: true, defaultHidden: true },
    { key: "contracts", header: "Contracts", className: "text-right whitespace-nowrap", render: (r) => <span className="tabular">{r.contractCount}</span> },
    { key: "capacity", header: "Capacity", className: "whitespace-nowrap", render: (r) => (
      <Badge tone={r.capacity.withinCapacity ? "success" : "warning"}>
        {r.capacity.withinCapacity ? "Within ladder" : "Over ladder"}
      </Badge>
    ), hideOnMobile: true },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4 text-[13px] text-text-soft leading-relaxed">
        Income and growth are <strong className="text-text">sibling products</strong> linked by <span className="tabular">parentProductId</span>,
        not two unit classes of one product — they differ only in what a distribution does. An investor's payout election
        is therefore a choice of product, and switching it moves their contract to the sibling.
        <span className="block mt-2 text-text-faint">
          Both variants of a sub-fund share one bond ladder and one published NAV here. The data specification gives each
          product its own ladder and its own price; splitting the published NAV per variant is not modelled — see
          "Where the apps and the docs still diverge" in CLAUDE.md.
        </span>
      </Card>
      <Card className="p-1"><DataTable columns={columns} rows={rows} columnPicker /></Card>
    </div>
  );
}

type PackageRow = Awaited<ReturnType<typeof getServicePackages>>[number];

function PackagesTab({ rows }: { rows: PackageRow[] }) {
  return (
    <div className="flex flex-col gap-4">
      {rows.map((pkg) => (
        <Card key={pkg.id} className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <div className="text-sm font-semibold text-text">{pkg.name}</div>
              <div className="text-xs text-text-faint tabular">{pkg.id} · {pkg.packageType} package · {pkg.currency}</div>
            </div>
            <div className="flex gap-4 text-xs text-text-soft">
              <span>Min subscription <strong className="text-text tabular"><Money amount={pkg.minSubscription} currency={pkg.currency} /></strong></span>
              <span>Distribution <strong className="text-text">{pkg.distributionFrequency}</strong></span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-text-faint border-b border-border">
                  <th className="py-2 pr-4 font-medium">Item</th>
                  <th className="py-2 pr-4 font-medium">Transaction type</th>
                  <th className="py-2 pr-4 font-medium">Fee type</th>
                  <th className="py-2 font-medium">Tariff (the rate)</th>
                </tr>
              </thead>
              <tbody>
                {pkg.items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0 align-top">
                    <td className="py-2.5 pr-4">
                      <div className="text-text">{item.label}</div>
                      {item.note && <div className="text-xs text-text-faint mt-0.5 max-w-md">{item.note}</div>}
                    </td>
                    <td className="py-2.5 pr-4 text-text-soft">{item.transactionTypeLabel ?? <span className="text-text-faint">none</span>}</td>
                    <td className="py-2.5 pr-4 text-text-soft">{item.feeTypeLabel ?? <span className="text-text-faint">none</span>}</td>
                    <td className="py-2.5">
                      {item.tariff
                        ? <span className="tabular text-text">{item.tariff.value}% <span className="text-text-faint">({item.tariff.id})</span></span>
                        : <span className="text-text-faint">none</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}

type TariffRow = Awaited<ReturnType<typeof getTariffs>>[number];

const TARIFF_STATE_TONE = {
  in_force: "success",
  scheduled: "info",
  awaiting_approval: "warning",
  expired: "neutral",
} as const;

const TARIFF_STATE_LABEL = {
  in_force: "In force",
  scheduled: "Scheduled",
  awaiting_approval: "Awaiting approval",
  expired: "Expired",
} as const;

function TariffsTab({ rows, onChanged }: { rows: TariffRow[]; onChanged: () => void }) {
  const { role } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    tariffTypeId: TARIFF_TYPES[0].id,
    domainId: TARIFF_DOMAINS[0].id,
    currency: "KES" as "KES" | "USD",
    value: "",
    effectiveFrom: "",
    reason: "",
  });

  const me = role ? ADMIN_USERS[role].name : "";
  const canPropose = role === "head_of_finance" || role === "system_admin";

  const submit = async () => {
    setBusy(true);
    try {
      await proposeTariffChange(
        form.tariffTypeId, form.domainId, form.currency,
        Number(form.value), form.effectiveFrom, me, form.reason.trim(),
      );
      toast.push("Staged for approval — the new rate takes effect only once a checker signs it off.", "success");
      setOpen(false);
      setForm((f) => ({ ...f, value: "", effectiveFrom: "", reason: "" }));
      onChanged();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not stage the change", "error");
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<TariffRow>[] = [
    { key: "role", header: "Rate", className: "min-w-[190px]", render: (r) => (
      <div>
        <div className="flex items-center gap-1.5 text-text font-medium whitespace-nowrap">
          {r.typeRole}
          {r.note && <InfoTip text={r.note} />}
        </div>
        <div className="mt-0.5 text-xs text-text-faint tabular">{r.id}</div>
      </div>
    ) },
    { key: "domain", header: "Domain", className: "min-w-[200px]", render: (r) => (
      <div>
        <div className="text-text-soft">{r.domainName}</div>
        <div className="mt-0.5 text-xs text-text-faint">{r.domainScope.replace("_", " ")}</div>
      </div>
    ), hideOnMobile: true },
    // The rate is only meaningful with its currency and accrual basis, so they sit under it.
    { key: "value", header: "Value", className: "text-right whitespace-nowrap", render: (r) => (
      <div>
        <div className="tabular text-text font-medium">{r.value}%</div>
        <div className="mt-0.5 text-xs text-text-faint">
          <span className="tabular">{r.currency}</span> · {r.dayCount ? DAY_COUNT_LABELS[r.dayCount] : "n/a"}
        </div>
      </div>
    ) },
    { key: "currency", header: "Ccy", className: "whitespace-nowrap", render: (r) => <span className="tabular">{r.currency}</span>, hideOnMobile: true, defaultHidden: true },
    { key: "daycount", header: "Day count", className: "whitespace-nowrap", render: (r) => r.dayCount
      ? <span className="text-text-soft">{DAY_COUNT_LABELS[r.dayCount]}</span>
      : <span className="text-text-faint">n/a</span>, hideOnMobile: true, defaultHidden: true },
    { key: "from", header: "Effective · until", className: "whitespace-nowrap", render: (r) => (
      <div className="tabular text-xs">
        <div className="text-text-soft">{formatDate(r.effectiveFrom)}</div>
        <div className="mt-0.5 text-text-faint">→ {r.effectiveTo ? formatDate(r.effectiveTo) : "open"}</div>
      </div>
    ) },
    { key: "to", header: "Until", className: "whitespace-nowrap", render: (r) => r.effectiveTo
      ? <span className="tabular">{formatDate(r.effectiveTo)}</span>
      : <span className="text-text-faint">open</span>, hideOnMobile: true, defaultHidden: true },
    { key: "state", header: "State", className: "whitespace-nowrap", render: (r) => <Badge tone={TARIFF_STATE_TONE[r.state]}>{TARIFF_STATE_LABEL[r.state]}</Badge> },
    { key: "note", header: "Note", render: (r) => r.note
      ? <span className="text-xs text-text-soft max-w-sm block">{r.note}</span>
      : <span className="text-text-faint">—</span>, hideOnMobile: true, defaultHidden: true },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4 text-[13px] text-text-soft leading-relaxed">
        Rates are effective-dated, not edited. A change is staged as its own row and the outgoing rate is closed off on
        approval — so "what did this contract accrue at in June" stays answerable after the rate moves.
        <span className="block mt-2 text-text-faint">
          Resolution runs most-specific-first: contract override → product domain → service package → institution default.
          Contract-level overrides are modelled in the order but no override table exists yet.
        </span>
      </Card>
      {canPropose && (
        <div className="flex justify-end">
          <Button onClick={() => setOpen(true)}>Stage a rate change</Button>
        </div>
      )}
      <Card className="p-1"><DataTable columns={columns} rows={rows} columnPicker /></Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Stage a rate change">
        <div className="flex flex-col gap-4">
          <Field label="Rate">
            <Select value={form.tariffTypeId} onChange={(e) => setForm({ ...form, tariffTypeId: e.target.value })}>
              {TARIFF_TYPES.map((t) => <option key={t.id} value={t.id}>{t.role}</option>)}
            </Select>
          </Field>
          <Field label="Domain" hint="Changing a domain changes the rate everywhere that domain is referenced.">
            <Select value={form.domainId} onChange={(e) => setForm({ ...form, domainId: e.target.value })}>
              {TARIFF_DOMAINS.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.scope.replace("_", " ")})</option>)}
            </Select>
          </Field>
          <Field label="Currency">
            <Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value as "KES" | "USD" })}>
              <option value="KES">KES</option>
              <option value="USD">USD</option>
            </Select>
          </Field>
          <Field label="New value" hint="Percentage points — 1 means 1% p.a.">
            <Input type="number" step="0.01" min="0" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
          </Field>
          <Field label="Effective from" hint="Cannot be backdated. A past period is corrected with a posting, not a rate edit.">
            <Input type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
          </Field>
          <Field label="Reason">
            <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Why this rate is changing" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={submit}
              disabled={busy || !form.value || !form.effectiveFrom || !form.reason.trim()}
            >
              {busy ? "Staging…" : "Stage for approval"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

type TemplateRow = Awaited<ReturnType<typeof getAccountTemplates>>[number];

function TemplatesTab({ rows }: { rows: TemplateRow[] }) {
  const columns: Column<TemplateRow & { id: string }>[] = [
    { key: "role", header: "Account role", className: "whitespace-nowrap", render: (r) => <span className="tabular text-text font-medium">{r.role}</span> },
    { key: "name", header: "Account · code", className: "min-w-[200px]", render: (r) => (
      <div>
        <div className="text-text-soft">{r.accountName}</div>
        <div className="mt-0.5 text-xs text-text-faint tabular">{r.code}</div>
      </div>
    ) },
    { key: "code", header: "Code", className: "whitespace-nowrap", render: (r) => <span className="tabular">{r.code}</span>, hideOnMobile: true, defaultHidden: true },
    { key: "scope", header: "Scope", className: "whitespace-nowrap", render: (r) => (
      <Badge tone={r.scope === "per_contract" ? "info" : "neutral"}>
        {r.scope === "per_contract" ? "Once per contract" : "Shared per currency"}
      </Badge>
    ) },
    { key: "available", header: "Counts to available balance", className: "whitespace-nowrap", render: (r) => r.isAvailableBalance
      ? <Badge tone="success">Yes</Badge>
      : <span className="text-text-faint">No</span>, hideOnMobile: true },
    { key: "instances", header: "Instantiated", className: "text-right whitespace-nowrap", render: (r) => <span className="tabular">{r.instantiated}</span>, hideOnMobile: true },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4 text-[13px] text-text-soft leading-relaxed">
        A template maps an abstract account role to a real chart-of-accounts code for one accounting scheme — what turns
        a product configuration into actual, named ledger accounts. Whether a role is instantiated per contract or shared
        per institution is a queryable column, not something inferred from seeding code.
      </Card>
      <Card className="p-1">
        <DataTable columns={columns} rows={rows.map((r) => ({ ...r, id: `${r.schemeId}-${r.role}` }))} columnPicker />
      </Card>
    </div>
  );
}

type HookRow = Awaited<ReturnType<typeof getTokenizationReadiness>>[number];

function TokenizationTab({ rows }: { rows: HookRow[] }) {
  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4 text-[13px] text-text-soft leading-relaxed">
        Phase 2 is an activation exercise, not a migration — provided the hooks are carried from day one. All three are
        present and <strong className="text-text">dormant</strong>. Direction of truth is fixed regardless of which chain
        is chosen: the internal ledger mints first, on-chain is always the mirror.
      </Card>
      <div className="grid gap-4 sm:grid-cols-3">
        {rows.map((h) => (
          <Card key={h.level} className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium uppercase tracking-wide text-text-faint">Level — {h.level}</span>
              <Badge tone={h.populated === 0 ? "neutral" : "success"}>
                {h.populated === 0 ? "Dormant" : "Populated"}
              </Badge>
            </div>
            <div className="text-[13px] text-text mb-3">{h.what}</div>
            <div className="text-xs text-text-faint tabular mb-1">{h.column}</div>
            <div className="text-sm tabular text-text-soft">{h.populated} of {h.total} populated</div>
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <div className="text-sm font-semibold text-text mb-2">What activation still requires</div>
        <ul className="text-[13px] text-text-soft leading-relaxed list-disc pl-5 flex flex-col gap-1">
          <li>An issuance step that deploys each product's token contract and sets its token id.</li>
          <li>A subscription-path bridge that mints to the investor's address after the internal mint, recording the hash.</li>
          <li>A reconciliation check comparing on-chain balances against total units outstanding — the same discipline as the day-end cross-book check.</li>
          <li>The chain decision itself (own rollup vs. public chain via self-hosted node vs. private RPC), still open.</li>
        </ul>
      </Card>
    </div>
  );
}
