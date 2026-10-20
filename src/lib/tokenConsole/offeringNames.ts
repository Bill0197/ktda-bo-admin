import { useCallback, useMemo } from "react";
import { tokenConsole } from "../api";
import { useSharedList } from "./sharedList";
import { label } from "./format";

/* Offerings by name, for the screens that hold only an offering id (the
 * market halts). An offering has no name of its own: the bond is the asset
 * behind it, so the name is the asset's, with the product as the fallback.
 * Both lists are the shared ones the console's pickers read. */

export type OfferingOption = { id: string; name: string; meta: string };

export function useOfferingNames() {
  const offerings = useSharedList("tok:offering", tokenConsole.offerings);
  const assets = useSharedList("tok:asset", () => tokenConsole.assets());

  const options = useMemo<OfferingOption[]>(() => {
    const assetName = new Map((assets.data ?? []).filter((a) => a.assetId).map((a) => [a.assetId!, a.name?.trim() || ""]));
    return (offerings.data ?? [])
      .filter((o) => o.offeringId)
      .map((o) => ({
        id: o.offeringId!,
        name: (o.assetId && assetName.get(o.assetId)) || o.productId || o.offeringId!,
        meta: [o.offeringId, o.productId, label(o.status), o.currency].filter(Boolean).join(" · "),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [offerings.data, assets.data]);

  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  /** The bond's name, or the id itself when the offerings list does not know it. */
  const nameOf = useCallback((id: string) => byId.get(id)?.name ?? id, [byId]);

  return {
    options,
    nameOf,
    loading: offerings.isPending || assets.isPending,
    // Names fall back to the product without the assets; only the offerings matter.
    error: offerings.error ?? null,
  };
}
