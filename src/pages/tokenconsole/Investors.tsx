import { useMemo, useState } from "react";
import { Button, PageHeader, SearchInput } from "../../ui";
import { tokenConsole } from "../../lib/api";
import { useAsyncData } from "../../lib/useAsyncData";
import { dateOf, label } from "../../lib/tokenConsole/format";
import type { Investor } from "../../lib/tokenConsole/types.gen";
import { Code, ConsoleTable, StatusBadge } from "../../components/tokenconsole/ConsoleTable";
import { InvestorChannelActions } from "../../components/tokenconsole/InvestorChannelActions";

export default function TokenConsoleInvestors() {
  const investors = useAsyncData(tokenConsole.investors);
  const [q, setQ] = useState("");
  const [channel, setChannel] = useState<Investor | null>(null);
  const term = q.trim().toLowerCase();

  const rows = useMemo(
    () => (investors.data ?? []).filter((i) =>
      !term || (i.displayName ?? "").toLowerCase().includes(term) || (i.externalRef ?? "").toLowerCase().includes(term)),
    [investors.data, term],
  );

  return (
    <div>
      <PageHeader eyebrow="Tokenization Console" title="Investors" subtitle="Everyone on the token register, and where each one sits in its lifecycle." />
      <ConsoleTable<Investor>
        what="investors"
        source={investors}
        rows={rows}
        rowId={(r) => r.investorId}
        actions={<SearchInput value={q} onChange={setQ} placeholder="Name or reference…" className="w-64" />}
        title="Register"
        description={investors.data ? `${rows.length} of ${investors.data.length} investors` : undefined}
        emptyLabel={term ? "No investor matches that" : "No investors on the register yet"}
        columns={[
          { key: "name", header: "Name", render: (r) => <span className="text-text font-medium">{r.displayName ?? "—"}</span> },
          { key: "ref", header: "Reference", render: (r) => <Code>{r.externalRef}</Code> },
          { key: "category", header: "Category", render: (r) => label(r.investorCategory), hideOnMobile: true },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.lifecycleStatus} /> },
          { key: "onboarded", header: "Onboarded", render: (r) => <span className="tabular text-xs text-text-soft">{dateOf(r.onboardedAt)}</span>, hideOnMobile: true },
          { key: "app", header: "", className: "text-right", render: (r) => r.investorId ? (
            <Button size="sm" variant="ghost" aria-label={`App channel for ${r.displayName ?? r.externalRef ?? "investor"}`} onClick={() => setChannel(r)}>
              App channel
            </Button>
          ) : null },
        ]}
      />
      {channel && <InvestorChannelActions key={channel.investorId} investor={channel} onClose={() => setChannel(null)} />}
    </div>
  );
}
