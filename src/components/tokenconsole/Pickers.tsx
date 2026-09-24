import { useMemo } from "react";
import { tokenConsole } from "../../lib/api";
import { useSharedList } from "../../lib/tokenConsole/sharedList";
import { label as humanize, shortId } from "../../lib/tokenConsole/format";
import { EntityPicker, type PickerOption } from "./EntityPicker";

/* Searchable pickers for the records the console's forms point at. Each reads
   one shared list (sharedList.ts, keyed like the entity registry where the two
   overlap), so a form with several pickers fetches each list once, and a
   record created elsewhere in the tab shows up here too. */

type PickerProps = { value: string; onChange: (id: string) => void; placeholder?: string; disabled?: boolean };

function makePicker<T>(
  key: string,
  fetch: () => Promise<T[]>,
  toOption: (row: T) => PickerOption | null,
  noun: string,
) {
  return function Picker({ value, onChange, placeholder, disabled, filter }: PickerProps & { filter?: (row: T) => boolean }) {
    const list = useSharedList(key, fetch);
    const options = useMemo(
      () => (list.data ?? []).filter((r) => !filter || filter(r)).map(toOption).filter((o): o is PickerOption => o !== null),
      [list.data, filter],
    );
    return (
      <EntityPicker
        options={options}
        value={value || null}
        onChange={(v) => onChange(v ?? "")}
        loading={list.isPending}
        disabled={disabled}
        placeholder={placeholder ?? `Select ${noun}…`}
        emptyLabel={list.error ? `Couldn't load ${noun}s: ${list.error}` : `No ${noun}s`}
      />
    );
  };
}

export const ContractPicker = makePicker(
  "tok:contract", tokenConsole.contracts,
  (c) => (c.contractId ? { id: c.contractId, label: c.investorRef ?? c.contractId, meta: `${c.productId ?? "—"} · ${c.contractStatus ?? "—"}` } : null),
  "contract",
);

/** Investors that cannot transact are listed but greyed, with the reason —
 *  an operator who can't find someone otherwise assumes the list is broken. */
export const InvestorPicker = makePicker(
  "tok:investor", tokenConsole.investors,
  (i) => i.investorId
    ? {
        id: i.investorId,
        label: i.displayName ?? i.externalRef ?? i.investorId,
        meta: i.externalRef ?? shortId(i.investorId),
        disabledReason: i.lifecycleStatus && i.lifecycleStatus !== "ACTIVE" ? humanize(i.lifecycleStatus) : undefined,
      }
    : null,
  "investor",
);

export const ProductPicker = makePicker(
  "tok:product", tokenConsole.products,
  (p) => (p.productId ? { id: p.productId, label: p.name ?? p.productId, meta: `${p.productId} · ${p.currency ?? ""}` } : null),
  "product",
);

export const OfferingPicker = makePicker(
  "tok:offering", tokenConsole.offerings,
  (o) => (o.offeringId ? { id: o.offeringId, label: `${o.productId ?? "—"} · ${o.offeringId}`, meta: `${humanize(o.status)} · ${o.currency ?? ""}` } : null),
  "offering",
);

export const AssetPicker = makePicker(
  "tok:asset", () => tokenConsole.assets(),
  (a) => a.assetId
    ? {
        id: a.assetId,
        label: a.name ?? a.assetId,
        meta: `${humanize(a.status)} · ${a.currency ?? ""}`,
        // Only an approved asset can back an offering.
        disabledReason: a.status === "DRAFT" ? "Not approved yet" : a.status === "RETIRED" ? "Retired" : undefined,
      }
    : null,
  "asset",
);

export const SubFundPicker = makePicker(
  "tok:subFund", tokenConsole.subFunds,
  (f) => (f.subFundId ? { id: f.subFundId, label: f.name ?? f.subFundId, meta: f.baseCurrency ?? undefined } : null),
  "sub-fund",
);

export const TokenClassPicker = makePicker(
  "tok:tokenClass", tokenConsole.tokenClasses,
  (t) => (t.tokenClassId
    ? { id: t.tokenClassId, label: t.name ?? t.symbol ?? shortId(t.tokenClassId), meta: `${t.symbol ?? ""} ${t.currency ?? ""} · ${humanize(t.status)}` }
    : null),
  "token class",
);

export const TariffTypePicker = makePicker(
  "tok:tariffType", tokenConsole.tariffTypes,
  (t) => (t.tariffTypeId ? { id: t.tariffTypeId, label: t.name ?? t.tariffTypeId, meta: t.tariffTypeId } : null),
  "tariff type",
);

export const TariffDomainPicker = makePicker(
  "tok:tariffDomain", tokenConsole.tariffDomains,
  (d) => (d.tariffDomainId ? { id: d.tariffDomainId, label: d.name ?? d.tariffDomainId, meta: d.tariffDomainId } : null),
  "tariff domain",
);

export const TariffValuePicker = makePicker(
  "tok:tariffValue", tokenConsole.tariffValues,
  (v) => (v.tariffValueId
    ? { id: v.tariffValueId, label: `${v.tariffTypeId ?? "—"} · ${v.currency ?? ""} · ${v.rate ?? "—"}`, meta: `${v.tariffDomainId ?? ""} from ${v.effectiveFrom ?? "—"}` }
    : null),
  "tariff",
);
