import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button, Field, Input, Modal, PageHeader, SearchInput, Select, useToast } from "../../ui";
import { tokenConsole } from "../../lib/api";
import { useAsyncData } from "../../lib/useAsyncData";
import { dateOf, label } from "../../lib/tokenConsole/format";
import type { Investor } from "../../lib/tokenConsole/types.gen";
import { Code, ConsoleTable, StatusBadge } from "../../components/tokenconsole/ConsoleTable";
import { InvestorChannelActions } from "../../components/tokenconsole/InvestorChannelActions";
import { InvestorPanel } from "../../components/tokenconsole/InvestorPanel";
import { ActionModal } from "../../components/tokenconsole/ActionModal";
import { invalidateList, useSharedSource } from "../../lib/tokenConsole/sharedList";
import { useAction } from "../../lib/tokenConsole/useAction";
import type { OnboardInvestorRequest } from "../../lib/tokenConsole/types.gen";

export default function TokenConsoleInvestors() {
  const investors = useAsyncData(tokenConsole.investors);
  const [q, setQ] = useState("");
  const [channel, setChannel] = useState<Investor | null>(null);
  const [onboarding, setOnboarding] = useState(false);
  const [open, setOpen] = useState<Investor | null>(null);
  const toast = useToast();
  const term = q.trim().toLowerCase();

  const rows = useMemo(
    () => (investors.data ?? []).filter((i) =>
      !term || (i.displayName ?? "").toLowerCase().includes(term) || (i.externalRef ?? "").toLowerCase().includes(term)),
    [investors.data, term],
  );

  return (
    <div>
      <PageHeader
        eyebrow="Baracel Unyt"
        title="Investors"
        subtitle="Everyone on the token register, and where each one sits in its lifecycle. Select one for their holdings, cash and movements."
        actions={<Button size="sm" onClick={() => setOnboarding(true)}><Plus size={14} /> Onboard investor</Button>}
      />
      <ConsoleTable<Investor>
        what="investors"
        source={investors}
        rows={rows}
        rowId={(r) => r.investorId}
        onRowClick={(r) => setOpen(r)}
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
            <Button size="sm" variant="ghost" aria-label={`App channel for ${r.displayName ?? r.externalRef ?? "investor"}`} onClick={(e) => { e.stopPropagation(); setChannel(r); }}>
              App channel
            </Button>
          ) : null },
        ]}
      />
      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.displayName ?? open?.externalRef ?? "Investor"} size="lg">
        {open?.investorId && <InvestorPanel key={open.investorId} investorId={open.investorId} onChanged={() => void investors.reload()} />}
      </Modal>
      {onboarding && (
        <OnboardModal
          onClose={() => setOnboarding(false)}
          onDone={(message) => {
            setOnboarding(false);
            toast.push(message);
            void investors.reload();
            invalidateList("tok:investor");
          }}
        />
      )}
      {channel && <InvestorChannelActions key={channel.investorId} investor={channel} onClose={() => setChannel(null)} />}
    </div>
  );
}

/** Onboarding runs the service's risk-based gate: a low-risk, KYC-verified
 * applicant is cleared straight away; anything else waits on the KYC desk.
 * The three classifications are the service's own classifier values. */
function OnboardModal({ onClose, onDone }: { onClose: () => void; onDone: (message: string) => void }) {
  const values = useSharedSource("tok:classifierValue", tokenConsole.classifierValues);
  const onboard = useAction(tokenConsole.onboardInvestor);
  const [externalRef, setRef] = useState("");
  const [displayName, setName] = useState("");
  const [investorCategory, setCategory] = useState<OnboardInvestorRequest["investorCategory"]>("INDIVIDUAL");
  const [riskTier, setRisk] = useState("");
  const [kycStatus, setKyc] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const codes = (typeId: string) => (values.data ?? [])
    .filter((v) => v.classifierTypeId === typeId && v.code)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const problem = !externalRef.trim() ? "A reference is required."
    : !displayName.trim() ? "A name is required."
    : !riskTier || !kycStatus || !jurisdiction ? "Choose the risk tier, KYC status and jurisdiction." : undefined;

  const submit = async () => {
    const r = await onboard.run({ externalRef: externalRef.trim(), displayName: displayName.trim(), investorCategory, riskTier, kycStatus, jurisdiction });
    if (!r) return;
    onDone(r.autoCleared
      ? `${displayName.trim()} was cleared and is active.`
      : `${displayName.trim()} is waiting on a KYC decision — see the KYC desk.`);
  };

  const select = (labelText: string, typeId: string, value: string, set: (v: string) => void) => (
    <Field label={labelText} required>
      <Select value={value} onChange={(e) => set(e.target.value)}>
        <option value="">{values.loading ? "Loading…" : "Select…"}</option>
        {codes(typeId).map((v) => <option key={v.valueId ?? v.code} value={v.code}>{v.name ?? v.code}</option>)}
      </Select>
    </Field>
  );

  return (
    <ActionModal
      title="Onboard an investor"
      description="Low risk and KYC verified clears straight away; anything else opens a review on the KYC desk."
      submitLabel="Onboard"
      problem={problem}
      showProblem={!!(externalRef || displayName)}
      pending={onboard.pending}
      error={onboard.error ?? values.error}
      onSubmit={() => void submit()}
      onClose={onClose}
      size="lg"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Reference" required hint="Your own id for them, e.g. a client number."><Input value={externalRef} onChange={(e) => setRef(e.target.value)} /></Field>
        <Field label="Name" required><Input value={displayName} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Category" required>
          <Select value={investorCategory} onChange={(e) => setCategory(e.target.value as OnboardInvestorRequest["investorCategory"])}>
            <option value="INDIVIDUAL">Individual</option>
            <option value="INSTITUTIONAL">Institutional</option>
          </Select>
        </Field>
        {select("Risk tier", "RISK_TIER", riskTier, setRisk)}
        {select("KYC status", "KYC_STATUS", kycStatus, setKyc)}
        {select("Jurisdiction", "JURISDICTION", jurisdiction, setJurisdiction)}
      </div>
    </ActionModal>
  );
}
