import { useMemo, useState } from "react";
import { getPlatformSettings, proposeSettingChange } from "../lib/api";
import {
  SETTING_SECTION_LABELS,
  type PlatformSetting, type PlatformSettingSection,
} from "../mock";
import {
  PageHeader, Card, Badge, Button, Modal, Tabs, Field, Input, Textarea, Skeleton,
  SearchInput, useToast, formatDate,
} from "../ui";
import { Landmark, Droplets, Percent, ShieldCheck, ArrowRight, LineChart, Timer, CreditCard, Lock } from "lucide-react";
import clsx from "clsx";
import { useAuth, ADMIN_USERS, ROLE_LABELS } from "../lib/auth";
import { useAsyncData } from "../lib/useAsyncData";
import { RedemptionTiersTab } from "./settings/RedemptionTiersTab";
import { RiskFactorsTab } from "./settings/RiskFactorsTab";
import { ApprovalRoutingTab } from "./settings/ApprovalRoutingTab";
import { TokenizationTab } from "./settings/TokenizationTab";

const SECTION_ORDER: PlatformSettingSection[] = [
  "fund_parameters", "liquidity_policy", "fees_commissions", "compliance_thresholds",
  "nav_valuation", "service_standards", "payments", "security_policy",
];

const SECTION_ICONS: Record<PlatformSettingSection, typeof Landmark> = {
  fund_parameters: Landmark,
  liquidity_policy: Droplets,
  fees_commissions: Percent,
  compliance_thresholds: ShieldCheck,
  nav_valuation: LineChart,
  service_standards: Timer,
  payments: CreditCard,
  security_policy: Lock,
};

type SettingsTab = "parameters" | "tiers" | "routing" | "riskfactors" | "tokenization";

function SettingRow({ setting, onPropose }: { setting: PlatformSetting; onPropose: (s: PlatformSetting) => void }) {
  return (
    <li className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-text">{setting.label}</span>
          {setting.pendingValue !== undefined && (
            <Badge tone="warning">pending: {setting.pendingValue}{setting.unit ? ` ${setting.unit}` : ""}</Badge>
          )}
        </div>
        <p className="text-xs text-text-soft mt-0.5 max-w-xl">{setting.description}</p>
        <p className="text-[11px] text-text-faint mt-1">Last changed {formatDate(setting.updatedAt)} by {setting.updatedBy}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm font-semibold tabular text-text">
          {setting.value}
          {setting.unit && <span className="text-text-faint font-normal ml-1">{setting.unit}</span>}
        </span>
        <Button size="sm" variant="outline" disabled={setting.pendingValue !== undefined} onClick={() => onPropose(setting)}>
          Propose change
        </Button>
      </div>
    </li>
  );
}

function SectionCard({ section, settings, onPropose }: {
  section: PlatformSettingSection;
  settings: PlatformSetting[];
  onPropose: (s: PlatformSetting) => void;
}) {
  const Icon = SECTION_ICONS[section];
  const meta = SETTING_SECTION_LABELS[section];
  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-3 p-5 pb-4 border-b border-border">
        <span className="h-9 w-9 rounded-lg bg-primary-50 text-primary-600 ring-1 ring-primary-500/20 flex items-center justify-center shrink-0">
          <Icon size={17} />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-text">{meta.title}</h2>
          <p className="text-xs text-text-soft mt-0.5">{meta.description}</p>
        </div>
      </div>
      <ul className="divide-y divide-border">
        {settings.map((s) => <SettingRow key={s.key} setting={s} onPropose={onPropose} />)}
      </ul>
    </Card>
  );
}

export default function PlatformSettings() {
  const { role } = useAuth();
  const toast = useToast();
  const { data: settings, loading, error, reload, setData } = useAsyncData(getPlatformSettings);
  const [tab, setTab] = useState<SettingsTab>("parameters");
  const [section, setSection] = useState<PlatformSettingSection>("fund_parameters");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<PlatformSetting | null>(null);
  const [newValue, setNewValue] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const me = role ? `${ADMIN_USERS[role].name} (${ROLE_LABELS[role]})` : "";

  const searching = query.trim().length > 0;
  const matches = useMemo(() => {
    if (!settings || !searching) return [];
    const q = query.trim().toLowerCase();
    return settings.filter((s) => s.label.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.key.includes(q));
  }, [settings, query, searching]);

  const openProposal = (s: PlatformSetting) => {
    setActive(s);
    setNewValue(s.value);
    setReason("");
  };

  const submit = async () => {
    if (!active) return;
    const trimmedValue = newValue.trim();
    const trimmedReason = reason.trim();
    if (!trimmedValue || trimmedValue === active.value) {
      toast.push("Enter a value different from the current one", "warning");
      return;
    }
    if (!trimmedReason) {
      toast.push("A change reason is required — it goes on the approval item", "warning");
      return;
    }
    setSubmitting(true);
    try {
      const updated = await proposeSettingChange(active.key, trimmedValue, me, trimmedReason);
      setData((prev) => (prev ? prev.map((s) => (s.key === updated.key ? { ...updated } : s)) : prev));
      toast.push("Change proposed — awaiting a second approver in the Approvals queue", "success");
      setActive(null);
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not propose the change", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Platform settings"
        tooltip="Every business parameter the investor apps, IFA portal and payment rails read lives here — changing one raises a static-data change that a second person must approve before it applies."
        subtitle="The single point of truth for commercial parameters across every surface of the platform. Changes are maker-checker gated."
      />

      <Tabs
        tabs={[
          { key: "parameters", label: "Parameters" },
          { key: "tiers", label: "Redemption tiers" },
          { key: "routing", label: "Approval routing" },
          { key: "riskfactors", label: "Risk factors" },
          { key: "tokenization", label: "Tokenization whitelist" },
        ]}
        active={tab}
        onChange={(k) => setTab(k as SettingsTab)}
        className="mb-5"
      />

      {tab === "tiers" && <RedemptionTiersTab me={me} />}
      {tab === "riskfactors" && <RiskFactorsTab me={me} />}
      {tab === "routing" && <ApprovalRoutingTab me={me} />}
      {tab === "tokenization" && <TokenizationTab me={me} />}

      {tab === "parameters" && (
        <>
          {error && (
            <Card className="p-5 mb-6 flex items-center justify-between">
              <span className="text-sm text-danger">{error}</span>
              <Button size="sm" variant="outline" onClick={reload}>Retry</Button>
            </Card>
          )}

          {loading && (
            <div className="grid grid-cols-1 lg:grid-cols-[230px_1fr] gap-6">
              <div className="flex flex-col gap-2">
                {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
              </div>
              <Card className="p-5">
                <Skeleton className="h-5 w-48 mb-4" />
                <Skeleton className="h-12 w-full mb-2" />
                <Skeleton className="h-12 w-full mb-2" />
                <Skeleton className="h-12 w-2/3" />
              </Card>
            </div>
          )}

          {!loading && settings && (
            <div className="grid grid-cols-1 lg:grid-cols-[230px_1fr] gap-6 items-start">
              <div className="lg:sticky lg:top-24 flex flex-col gap-3">
                <SearchInput value={query} onChange={setQuery} placeholder="Search all settings…" className="w-full" />
                <nav aria-label="Setting sections" className="flex lg:flex-col gap-1 overflow-x-auto pb-1 lg:pb-0">
                  {SECTION_ORDER.map((s) => {
                    const Icon = SECTION_ICONS[s];
                    const count = settings.filter((x) => x.section === s).length;
                    const activeSection = !searching && section === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => { setSection(s); setQuery(""); }}
                        className={clsx(
                          "flex items-center gap-2.5 px-3 h-9 rounded-md text-[13px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 text-left",
                          activeSection ? "bg-primary-50 text-primary-700" : "text-text-soft hover:text-text hover:bg-surface-sunken",
                        )}
                      >
                        <Icon size={15} className="shrink-0" />
                        <span className="flex-1 truncate">{SETTING_SECTION_LABELS[s].title}</span>
                        <span className={clsx("text-[11px] tabular", activeSection ? "text-primary-600" : "text-text-faint")}>{count}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="min-w-0">
                {searching ? (
                  matches.length === 0 ? (
                    <Card className="p-8 text-center text-sm text-text-faint">No settings match "{query.trim()}"</Card>
                  ) : (
                    <div className="flex flex-col gap-6">
                      {SECTION_ORDER.filter((s) => matches.some((m) => m.section === s)).map((s) => (
                        <SectionCard key={s} section={s} settings={matches.filter((m) => m.section === s)} onPropose={openProposal} />
                      ))}
                    </div>
                  )
                ) : (
                  <SectionCard section={section} settings={settings.filter((s) => s.section === section)} onPropose={openProposal} />
                )}
              </div>
            </div>
          )}
        </>
      )}

      <Modal open={!!active} onClose={() => !submitting && setActive(null)} title="Propose a setting change" size="md">
        {active && (
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-sm font-semibold text-text">{active.label}</div>
              <p className="text-xs text-text-soft mt-1">{active.description}</p>
            </div>
            <Card className="p-3.5 bg-surface-sunken border-none flex items-center gap-3 text-sm">
              <span className="tabular text-text-soft">{active.value}{active.unit ? ` ${active.unit}` : ""}</span>
              <ArrowRight size={14} className="text-text-faint shrink-0" />
              <span className="tabular font-semibold text-text">{newValue.trim() || "—"}{active.unit ? ` ${active.unit}` : ""}</span>
            </Card>
            <Field label="New value" required>
              <Input value={newValue} onChange={(e) => setNewValue(e.target.value)} autoFocus />
            </Field>
            <Field label="Reason for change" required hint="Shown verbatim on the approval item — write it for the checker.">
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Repricing after the August facility renewal…" />
            </Field>
            <p className="text-xs text-text-faint">
              This raises a static-data change in the Approvals queue. Nothing applies until a second person approves it — you can't approve your own proposal.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" disabled={submitting} onClick={() => setActive(null)}>Cancel</Button>
              <Button disabled={submitting} onClick={submit}>{submitting ? "Submitting…" : "Submit for approval"}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
