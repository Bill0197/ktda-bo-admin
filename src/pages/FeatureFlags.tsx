import { useState } from "react";
import { getFeatureFlags, setFeatureFlag } from "../lib/api";
import { FLAG_PLATFORM_LABELS, type FeatureFlag, type FlagPlatform } from "../mock";
import { PageHeader, Card, Badge, Toggle, Skeleton, Button, useToast, formatDate, FilterBar, SearchInput, EmptyState } from "../ui";
import { Globe, Smartphone, Hash, Handshake, Scale, Banknote, LayoutDashboard, Search } from "lucide-react";
import { useAuth, ADMIN_USERS } from "../lib/auth";
import { useAsyncData } from "../lib/useAsyncData";

const PLATFORM_ORDER: FlagPlatform[] = ["investor_web", "investor_mobile", "investor_ussd", "ifa_portal", "trustee_portal", "payment_ops", "bo_admin"];

const PLATFORM_ICONS: Record<FlagPlatform, typeof Globe> = {
  investor_web: Globe,
  investor_mobile: Smartphone,
  investor_ussd: Hash,
  ifa_portal: Handshake,
  trustee_portal: Scale,
  payment_ops: Banknote,
  bo_admin: LayoutDashboard,
};

const STAGE_TONE = { ga: "success", beta: "info", planned: "accent" } as const;
const STAGE_LABEL = { ga: "GA", beta: "Beta", planned: "Planned" } as const;

export default function FeatureFlags() {
  const { role } = useAuth();
  const toast = useToast();
  const { data: flags, loading, error, reload, setData } = useAsyncData(getFeatureFlags);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const me = role ? ADMIN_USERS[role].name : "";
  const q = query.trim().toLowerCase();
  const visible = (flags ?? []).filter((f) => !q || f.label.toLowerCase().includes(q) || f.description.toLowerCase().includes(q));

  const toggle = async (flag: FeatureFlag, enabled: boolean) => {
    setBusyKey(flag.key);
    try {
      const updated = await setFeatureFlag(flag.key, enabled, me);
      setData((prev) => (prev ? prev.map((f) => (f.key === updated.key ? { ...updated } : f)) : prev));
      toast.push(`${flag.label} ${enabled ? "enabled" : "disabled"} for ${FLAG_PLATFORM_LABELS[flag.platform].title}`, enabled ? "success" : "info");
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not update the flag", "error");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Feature flags"
        tooltip="A flag turns a capability on or off per platform without a deploy — the investor mobile app ships with its flags pre-staged here, so launch day is a switch, not a release."
        subtitle="Rollout control per surface — including the investor mobile app, staged ahead of launch. Every flip is audit-logged."
      />

      {error && (
        <Card className="p-5 mb-6 flex items-center justify-between">
          <span className="text-sm text-danger">{error}</span>
          <Button size="sm" variant="outline" onClick={reload}>Retry</Button>
        </Card>
      )}

      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-5 w-40 mb-4" />
              <Skeleton className="h-10 w-full mb-2" />
              <Skeleton className="h-10 w-full" />
            </Card>
          ))}
        </div>
      )}

      {!loading && flags && (
        <FilterBar>
          <SearchInput value={query} onChange={setQuery} placeholder="Search flags…" />
          <span className="text-xs text-text-faint ml-auto">{visible.length} of {flags.length} flags</span>
        </FilterBar>
      )}

      {!loading && flags && visible.length === 0 && (
        <EmptyState icon={<Search size={20} />} title="No flags match" body={`Nothing matches “${query.trim()}” across any platform.`} />
      )}

      {!loading && flags && visible.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {PLATFORM_ORDER.map((platform) => {
            const rows = visible.filter((f) => f.platform === platform);
            if (rows.length === 0) return null;
            const Icon = PLATFORM_ICONS[platform];
            const meta = FLAG_PLATFORM_LABELS[platform];
            return (
              <Card key={platform} className="overflow-hidden">
                <div className="flex items-start gap-3 p-5 pb-4 border-b border-border">
                  <span className="h-9 w-9 rounded-lg bg-primary-50 text-primary-600 ring-1 ring-primary-500/20 flex items-center justify-center shrink-0">
                    <Icon size={17} />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-text">{meta.title}</h2>
                    {meta.note && <p className="text-xs text-text-soft mt-0.5">{meta.note}</p>}
                  </div>
                </div>
                <ul className="divide-y divide-border">
                  {rows.map((f) => (
                    <li key={f.key} className="flex items-center gap-3 px-5 py-3.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-text">{f.label}</span>
                          <Badge tone={STAGE_TONE[f.stage]}>{STAGE_LABEL[f.stage]}</Badge>
                        </div>
                        <p className="text-xs text-text-soft mt-0.5">{f.description}</p>
                        <p className="text-[11px] text-text-faint mt-1">Updated {formatDate(f.updatedAt)} by {f.updatedBy}</p>
                      </div>
                      <div className={busyKey === f.key ? "opacity-50 pointer-events-none" : ""}>
                        <Toggle checked={f.enabled} onChange={(v) => toggle(f, v)} label={f.label} />
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
