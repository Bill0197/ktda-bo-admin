import { useState } from "react";
import { Button, Field, NotePanel, useToast } from "../../ui";
import { tokenConsole } from "../../lib/api";
import { useAsyncData } from "../../lib/useAsyncData";
import { shortId } from "../../lib/tokenConsole/format";
import { useAction } from "../../lib/tokenConsole/useAction";
import type { Product } from "../../lib/tokenConsole/types.gen";
import { Code, StatusBadge } from "../../components/tokenconsole/ConsoleTable";
import { DetailItem } from "../../components/tokenconsole/DetailItem";
import { ActionModal } from "../../components/tokenconsole/ActionModal";
import { SubFundPicker, TariffValuePicker, TokenClassPicker } from "../../components/tokenconsole/Pickers";

type Edit = "status" | "tokenClass" | "subFund" | "coupon";

/** A product's switch and the three things it is bound to after creation: the
 * token class its units are recorded against, the sub-fund whose ladder backs
 * it, and the coupon tariff its accrual reads. */
export function ProductBindings({ productId, canWrite, onChanged }: { productId: string; canWrite: boolean; onChanged: () => void }) {
  const toast = useToast();
  const products = useAsyncData(tokenConsole.products);
  const coupons = useAsyncData(tokenConsole.productCouponTariffs);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [value, setValue] = useState("");
  const p: Product | undefined = products.data?.find((x) => x.productId === productId);
  const coupon = coupons.data?.find((c) => c.productId === productId)?.tariffId;
  const active = p?.status === "ACTIVE" || p?.active === true;

  const save = useAction(async (kind: Edit, v: string) => {
    if (kind === "status") await (active ? tokenConsole.deactivateProduct(productId) : tokenConsole.activateProduct(productId));
    else if (kind === "tokenClass") await tokenConsole.linkTokenClass(productId, { tokenClassId: v });
    else if (kind === "subFund") await tokenConsole.assignSubFund(productId, { subFundId: v });
    else await tokenConsole.assignCouponTariff({ productId, tariffId: v });
    return true;
  });

  const open = (kind: Edit, current = "") => {
    save.reset();
    setValue(current);
    setEdit(kind);
  };
  const run = async () => {
    if (!edit) return;
    const done = await save.run(edit, value);
    if (!done) return;
    toast.push(
      edit === "status" ? (active ? "Product deactivated." : "Product activated.")
      : edit === "tokenClass" ? "Token class linked." : edit === "subFund" ? "Sub-fund assigned." : "Coupon tariff assigned.",
    );
    setEdit(null);
    void products.reload();
    void coupons.reload();
    onChanged();
  };

  const TITLES: Record<Edit, string> = {
    status: active ? "Deactivate this product?" : "Activate this product?",
    tokenClass: "Link a token class",
    subFund: "Assign a sub-fund",
    coupon: "Assign the coupon tariff",
  };
  const DESCRIPTIONS: Record<Edit, string> = {
    status: active ? "It stops taking new accounts and subscriptions. Existing holdings are unaffected." : "It can take accounts and subscriptions again.",
    tokenClass: "Units of this product are then recorded on the unit ledger against this token class, and the two books can be reconciled.",
    subFund: "The sub-fund whose bond ladder backs this product, and whose NAV it is priced from.",
    coupon: "The rate the product's interest accrual reads.",
  };

  return (
    <section className="mb-6">
      {(products.error || coupons.error) && <NotePanel tone="danger" className="mb-3">{products.error ?? coupons.error}</NotePanel>}
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-4">
        <DetailItem term="Status"><StatusBadge status={p?.status} /></DetailItem>
        <DetailItem term="Token class">{p?.tokenClassId ? <Code>{shortId(p.tokenClassId)}</Code> : <span className="text-xs text-text-faint">Not linked</span>}</DetailItem>
        <DetailItem term="Sub-fund">{p?.subFundId ? <Code>{shortId(p.subFundId)}</Code> : <span className="text-xs text-text-faint">None</span>}</DetailItem>
        <DetailItem term="Coupon tariff">{coupon ? <Code>{coupon}</Code> : <span className="text-xs text-text-faint">None</span>}</DetailItem>
      </dl>
      {canWrite && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={!p} onClick={() => open("status")}>{active ? "Deactivate" : "Activate"}</Button>
          <Button size="sm" variant="ghost" disabled={!p} onClick={() => open("tokenClass", p?.tokenClassId ?? "")}>Token class</Button>
          <Button size="sm" variant="ghost" disabled={!p} onClick={() => open("subFund", p?.subFundId ?? "")}>Sub-fund</Button>
          <Button size="sm" variant="ghost" disabled={!p} onClick={() => open("coupon", coupon ?? "")}>Coupon tariff</Button>
        </div>
      )}
      {edit && (
        <ActionModal
          size={edit === "status" ? "sm" : "md"}
          title={TITLES[edit]}
          description={DESCRIPTIONS[edit]}
          submitLabel={edit === "status" ? (active ? "Deactivate" : "Activate") : "Save"}
          tone={edit === "status" && active ? "danger" : "primary"}
          problem={edit !== "status" && !value ? "Pick one." : undefined}
          showProblem={false}
          pending={save.pending}
          error={save.error}
          onSubmit={() => void run()}
          onClose={() => setEdit(null)}
        >
          {edit === "tokenClass" && <Field label="Token class" required group><TokenClassPicker value={value} onChange={setValue} /></Field>}
          {edit === "subFund" && <Field label="Sub-fund" required group><SubFundPicker value={value} onChange={setValue} /></Field>}
          {edit === "coupon" && <Field label="Coupon rate" required group><TariffValuePicker value={value} onChange={setValue} /></Field>}
        </ActionModal>
      )}
    </section>
  );
}
