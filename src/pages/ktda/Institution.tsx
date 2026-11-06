import type { ReactNode } from "react";
import { Badge, GlassPanel, PageHeader, SectionTitle, Skeleton } from "../../ui";
import { useAsyncData } from "../../lib/useAsyncData";
import { ALL_FEATURES, institutionApi, type InstitutionFeature } from "../../lib/api.institution";
import { tokenConsole } from "../../lib/api.tokenConsole";
import { SourceError } from "../../components/tokenconsole/ConsoleTable";

/* This back office's institution, read-only: who it is, what its customers
   may use, and the values it carries over the platform defaults. All of it
   comes from omnichannel, which answers only for the institution this back
   office is configured for. Changing a setting is not offered yet. */

const FEATURE_LABELS: Record<InstitutionFeature, string> = {
  TRANSFERS: "Transfers",
  WITHDRAWALS: "Withdrawals",
  TOP_UPS: "Top-ups",
  INVESTING: "Investing",
  FX: "Currency exchange",
};

type Setting = { group: string; label: string; value: ReactNode; order: number };

const GROUPS = ["Messages", "Withdrawals", "Transfers", "Payment gateway", "Funding account", "Other"];

const amount = (raw: string, ccy: string) => {
  if (raw.trim().toLowerCase() === "none") return "No limit";
  const n = Number(raw);
  return Number.isFinite(n) ? `${ccy} ${n.toLocaleString("en-KE", { maximumFractionDigits: 2 })}` : raw;
};

const FUNDING: Record<string, string> = {
  "bank-name": "Bank",
  "account-name": "Account name",
  "account-number": "Account number",
  swift: "SWIFT code",
  branch: "Branch",
  correspondent: "Correspondent bank",
  note: "Note",
};

/** A setting's name as a person reads it, with its value formatted. */
function describe(name: string, raw: string): Setting {
  const parts = name.split(".");
  const ccy = (parts[1] ?? "").toUpperCase();
  if (name === "sms.sender") return { group: "Messages", label: "SMS sender name", value: raw, order: 0 };
  if (parts[0] === "withdrawals" && parts.length === 3) {
    const label = { "per-transaction": `Most per withdrawal (${ccy})`, "per-day": `Most per day (${ccy})` }[parts[2]];
    if (label) return { group: "Withdrawals", label, value: amount(raw, ccy), order: parts[2] === "per-day" ? 1 : 0 };
  }
  if (parts[0] === "transfers" && parts.length === 3) {
    const label = { min: `Smallest transfer (${ccy})`, "per-transaction": `Most per transfer (${ccy})`, "per-day": `Most per day (${ccy})` }[parts[2]];
    if (label) return { group: "Transfers", label, value: amount(raw, ccy), order: ["min", "per-transaction", "per-day"].indexOf(parts[2]) };
  }
  if (name === "payments.gateway.partner-id") return { group: "Payment gateway", label: "Partner ID", value: raw, order: 0 };
  if (name === "payments.gateway.institution") return { group: "Payment gateway", label: "Institution at the gateway", value: raw, order: 1 };
  if (parts[0] === "payments" && parts[1] === "funding" && parts.length === 4 && FUNDING[parts[3]]) {
    const c = parts[2].toUpperCase();
    return { group: "Funding account", label: `${FUNDING[parts[3]]} (${c})`, value: raw, order: Object.keys(FUNDING).indexOf(parts[3]) };
  }
  return { group: "Other", label: name, value: raw, order: 0 };
}

export default function Institution() {
  const own = useAsyncData(() => institutionApi.own());
  const settings = useAsyncData(() => institutionApi.settings());
  // The engine's name, for an institution omnichannel has not named yet.
  const engine = useAsyncData(() => tokenConsole.institutions());

  const me = own.data?.[0] ?? null;
  const name = me?.name || (engine.data ?? []).find((i) => i.institutionId === me?.id)?.name || null;
  const features = new Set(settings.data?.features ?? []);
  const rows = Object.entries(settings.data?.set ?? {}).map(([k, v]) => describe(k, v));

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Institution"
        subtitle="The institution this back office works for, what its customers can use, and where it differs from the platform defaults. Read-only."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassPanel className="p-5" data-testid="institution-identity">
          <SectionTitle title="Who" />
          {own.error ? (
            <SourceError what="this back office's institution" error={own.error} onRetry={own.reload} className="" />
          ) : own.loading && !own.data ? (
            <Skeleton className="h-16" />
          ) : !me ? (
            <p className="text-sm text-text-soft">Omnichannel did not name an institution for this back office.</p>
          ) : (
            <dl className="text-[13px]">
              <Row k="Name" v={name ?? "Not named yet"} />
              <Row k="Institution ID" v={<span className="font-mono text-[12px]">{me.id}</span>} />
              <Row k="Currency" v={me.localCurrency ?? "—"} />
              <Row k="Country" v={me.country ?? "—"} />
              <Row k="Status" v={me.status ?? "—"} />
            </dl>
          )}
        </GlassPanel>

        <GlassPanel className="p-5" data-testid="institution-features">
          <SectionTitle title="What its customers can use" />
          {settings.error ? (
            <SourceError what="the institution's settings" error={settings.error} onRetry={settings.reload} className="" />
          ) : settings.loading && !settings.data ? (
            <Skeleton className="h-16" />
          ) : (
            <ul className="flex flex-wrap gap-2">
              {ALL_FEATURES.map((f) => (
                <li key={f} data-feature={f} data-on={features.has(f) ? "true" : "false"}>
                  <Badge tone={features.has(f) ? "success" : "neutral"}>
                    {FEATURE_LABELS[f]}: {features.has(f) ? "offered" : "not offered"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>
      </div>

      {settings.data && (
        <GlassPanel className="mt-4 p-5" data-testid="institution-settings">
          <SectionTitle title="Set for this institution" />
          {rows.length === 0 ? (
            <p className="text-sm text-text-soft">This institution sets nothing of its own.</p>
          ) : (
            <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
              {GROUPS.filter((g) => rows.some((r) => r.group === g)).map((g) => (
                <div key={g}>
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-text-faint">{g}</div>
                  <dl className="text-[13px]">
                    {rows.filter((r) => r.group === g).sort((a, b) => a.order - b.order).map((r) => (
                      <Row key={r.label} k={r.label} v={r.value} />
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-[12.5px] text-text-soft">
            Anything not listed follows the platform defaults. Changing a setting is not offered here yet.
          </p>
        </GlassPanel>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/60 py-1.5">
      <dt className="text-text-soft">{k}</dt>
      <dd className="text-right text-text">{v}</dd>
    </div>
  );
}
