import { useState } from "react";
import { Button, PageHeader, useToast } from "../../ui";
import { Plus } from "lucide-react";
import { tokenConsole } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useAsyncData } from "../../lib/useAsyncData";
import { label, shortId } from "../../lib/tokenConsole/format";
import type { Product } from "../../lib/tokenConsole/types.gen";
import { Code, ConsoleTable, StatusBadge } from "../../components/tokenconsole/ConsoleTable";
import { NewProductModal } from "./NewProductModal";
import { ProductConfigModal } from "./ProductConfigModal";

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
        <ProductConfigModal key={configuring} productId={configuring} canWrite={canWrite} onClose={() => setConfiguring(null)} onChanged={() => void products.reload()} />
      )}
    </div>
  );
}
