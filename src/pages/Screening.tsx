import { useState } from "react";
import { Link } from "react-router-dom";
import {
  type ClientComplianceProfile, type ScreeningResult, type RiskRating, type Transaction,
} from "../mock";
import { getComplianceProfiles, getScreeningResults, getTransactions, getClients, runScreening, runEodScreening } from "../lib/api";
import {
  PageHeader, Card, Badge, Button, Tabs, DataTable, type Column, Skeleton, useToast, formatDateTime,
  FilterBar, SearchInput, Money,
} from "../ui";
import { PlayCircle, MoonStar } from "lucide-react";
import { useAuth, ADMIN_USERS } from "../lib/auth";
import { useAsyncData } from "../lib/useAsyncData";

const RISK_TONE: Record<RiskRating, "success" | "warning" | "danger"> = { low: "success", medium: "warning", high: "danger" };
const SCREEN_TONE = (v: string): "success" | "warning" | "danger" => (v === "clear" ? "success" : v === "potential_match" ? "warning" : "danger");

/** yyyy-mm-dd `days` from today — safe to compare against due-date strings. */
function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function ClientLink({ clientId }: { clientId: string }) {
  return (
    <Link to={`/clients/${clientId}`} className="tabular text-primary-600 font-medium hover:underline">
      {clientId}
    </Link>
  );
}

function RiskCell({ rating }: { rating: RiskRating | null }) {
  return rating ? <Badge tone={RISK_TONE[rating]}>{rating} risk</Badge> : <span className="text-text-faint">Not rated</span>;
}

function TxRiskBadge({ score }: { score?: number }) {
  if (score == null) return <span className="text-text-faint">—</span>;
  const tone = score >= 70 ? "danger" : score >= 40 ? "warning" : "success";
  return <Badge tone={tone}>{score}/100</Badge>;
}

export default function Screening() {
  const { role } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useAsyncData(() =>
    Promise.all([
      getComplianceProfiles(),
      getScreeningResults(),
      // getTransactions() is Ledger/Finance-domain (api.ledger.ts); its return
      // type there is still the generic Record<string, unknown>[] shape, cast
      // here rather than editing another pass's file.
      getTransactions() as Promise<Transaction[]>,
      getClients(),
    ]),
  );
  const [tab, setTab] = useState("onboarding");
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState<string | null>(null);

  const me = role ? ADMIN_USERS[role].name : "";
  const [profiles, results, transactions, clients] = data ?? [[], [], [], []];
  const horizon = isoDaysFromNow(90);
  const q = query.trim().toLowerCase();

  const nameFor = (clientId: string) => clients.find((c) => c.id === clientId)?.name ?? "";
  const matchesClient = (clientId: string) => !q || clientId.toLowerCase().includes(q) || nameFor(clientId).toLowerCase().includes(q);

  const profileRows = profiles.map((p) => ({ ...p, id: p.clientId }));

  const onboardingRows = results.filter((r) => r.trigger === "onboarding" && matchesClient(r.clientId));
  const txRows = transactions.filter((t) => !q || t.reference.toLowerCase().includes(q) || t.id.toLowerCase().includes(q));
  const eodRows = profileRows.filter((p) => matchesClient(p.clientId) && (p.nextScreeningDue ? p.nextScreeningDue <= horizon : p.lifecycleStatus !== "active"));
  const allRows = results.filter((r) => matchesClient(r.clientId));
  const kycRows = profileRows.filter((p) => matchesClient(p.clientId) && (p.nextKycRefreshDue ? p.nextKycRefreshDue <= horizon : p.lifecycleStatus !== "active"));

  const run = async (clientId: string) => {
    setRunning(clientId);
    try {
      await runScreening(clientId, "periodic", me);
      toast.push(`Screening run for ${clientId}`, "success");
      await reload();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Screening failed", "error");
    } finally {
      setRunning(null);
    }
  };

  const runEod = async () => {
    setRunning("eod");
    try {
      const { screened, matches } = await runEodScreening(me);
      toast.push(`End-of-day screening complete — ${screened} customers, ${matches} match${matches === 1 ? "" : "es"}`, matches > 0 ? "warning" : "success");
      await reload();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "EOD screening failed", "error");
    } finally {
      setRunning(null);
    }
  };

  const resultColumns: Column<ScreeningResult>[] = [
    { key: "runAt", header: "Run at", render: (r) => formatDateTime(r.runAt) },
    { key: "clientId", header: "Client", render: (r) => <ClientLink clientId={r.clientId} /> },
    { key: "clientName", header: "Name", render: (r) => nameFor(r.clientId) || <span className="text-text-faint">—</span>, hideOnMobile: true },
    { key: "trigger", header: "Trigger", render: (r) => <span className="capitalize">{r.trigger.replace(/_/g, " ")}</span>, hideOnMobile: true },
    { key: "sanctions", header: "Sanctions", render: (r) => <Badge tone={SCREEN_TONE(r.sanctions)}>{r.sanctions.replace(/_/g, " ")}</Badge> },
    { key: "pep", header: "PEP", render: (r) => <Badge tone={SCREEN_TONE(r.pep)}>{r.pep.replace(/_/g, " ")}</Badge> },
    { key: "adverseMedia", header: "Adverse media", render: (r) => <Badge tone={SCREEN_TONE(r.adverseMedia)}>{r.adverseMedia.replace(/_/g, " ")}</Badge>, hideOnMobile: true },
    {
      key: "resolution",
      header: "Resolution",
      render: (r) => {
        if (r.resolution) return <Badge tone={r.resolution.outcome === "false_positive" ? "success" : "neutral"}>{r.resolution.outcome.replace(/_/g, " ")}</Badge>;
        const hasMatch = r.sanctions !== "clear" || r.pep !== "clear" || r.adverseMedia !== "clear";
        if (hasMatch) {
          return (
            <Link to={`/clients/${r.clientId}`} title="Resolve on the client's screening tab">
              <Badge tone="warning">needs resolution</Badge>
            </Link>
          );
        }
        return <span className="text-text-faint">—</span>;
      },
    },
    { key: "runBy", header: "Run by", render: (r) => r.runBy, hideOnMobile: true, defaultHidden: true },
  ];

  const txColumns: Column<Transaction>[] = [
    { key: "reference", header: "Reference", render: (r) => <span className="tabular text-text">{r.reference}</span> },
    { key: "createdAt", header: "When", render: (r) => formatDateTime(r.createdAt), hideOnMobile: true },
    { key: "type", header: "Type", render: (r) => <span className="capitalize">{r.type}</span> },
    { key: "amount", header: "Amount", render: (r) => <Money amount={r.amount} currency={r.subFund === "USD_EUROBOND" ? "USD" : "KES"} /> },
    { key: "counterparty", header: "Counterparty", render: (r) => r.counterparty ?? <span className="text-text-faint">—</span>, hideOnMobile: true },
    { key: "riskScore", header: "Screening risk score", render: (r) => <TxRiskBadge score={r.riskScore} /> },
    { key: "status", header: "Status", render: (r) => <Badge tone={r.status === "settled" ? "success" : r.status === "failed" ? "danger" : "info"}>{r.status}</Badge>, hideOnMobile: true },
  ];

  const eodColumns: Column<ClientComplianceProfile>[] = [
    { key: "clientId", header: "Client", render: (r) => <ClientLink clientId={r.clientId} /> },
    { key: "clientName", header: "Name", render: (r) => nameFor(r.clientId) || <span className="text-text-faint">—</span>, hideOnMobile: true },
    { key: "riskRating", header: "Risk rating", render: (r) => <RiskCell rating={r.riskRating} /> },
    { key: "lastScreenedAt", header: "Last screened", render: (r) => (r.lastScreenedAt ? formatDateTime(r.lastScreenedAt) : <span className="text-text-faint">Never</span>), hideOnMobile: true },
    { key: "nextScreeningDue", header: "Next due", render: (r) => r.nextScreeningDue ?? <Badge tone="warning">Not scheduled</Badge> },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (r) => (
        <Button size="sm" variant="outline" disabled={running !== null} onClick={() => run(r.clientId)}>
          <PlayCircle size={14} /> {running === r.clientId ? "Running…" : "Run screening"}
        </Button>
      ),
    },
  ];

  const kycColumns: Column<ClientComplianceProfile>[] = [
    { key: "clientId", header: "Client", render: (r) => <ClientLink clientId={r.clientId} /> },
    { key: "riskRating", header: "Risk rating", render: (r) => <RiskCell rating={r.riskRating} /> },
    { key: "lastKycRefreshAt", header: "Last refresh", render: (r) => (r.lastKycRefreshAt ? formatDateTime(r.lastKycRefreshAt) : <span className="text-text-faint">Never</span>), hideOnMobile: true },
    { key: "nextKycRefreshDue", header: "Next due", render: (r) => r.nextKycRefreshDue ?? <Badge tone="warning">Not scheduled</Badge> },
  ];

  return (
    <div>
      <PageHeader
        title="Screening operations"
        tooltip="Onboarding screening covers new applicants, transaction screening scores every money movement, and the end-of-day batch re-screens the whole register daily against sanctions, PEP and adverse-media lists."
        subtitle="Onboarding, transaction and end-of-day screening across the client book. Match resolution happens on the client's file."
        actions={
          <Button size="sm" disabled={running !== null} onClick={runEod}>
            <MoonStar size={14} /> {running === "eod" ? "Screening register…" : "Run end-of-day screening"}
          </Button>
        }
      />

      {error && (
        <Card className="p-5 mb-6 flex items-center justify-between">
          <span className="text-sm text-danger">{error}</span>
          <Button size="sm" variant="outline" onClick={reload}>Retry</Button>
        </Card>
      )}

      <FilterBar>
        <Tabs
          tabs={[
            { key: "onboarding", label: "Onboarding", count: loading ? undefined : onboardingRows.length },
            { key: "transactions", label: "Transactions", count: loading ? undefined : txRows.length },
            { key: "eod", label: "Portfolio", count: loading ? undefined : eodRows.length },
            { key: "results", label: "All results", count: loading ? undefined : allRows.length },
            { key: "kyc", label: "KYC refresh", count: loading ? undefined : kycRows.length },
          ]}
          active={tab}
          onChange={setTab}
        />
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder={tab === "transactions" ? "Search transaction reference…" : "Search client ID or name…"}
          className="w-64 sm:ml-auto"
        />
      </FilterBar>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : (
        <>
          {tab === "onboarding" && (
            <DataTable columns={resultColumns} rows={onboardingRows} columnPicker emptyLabel="No onboarding screenings match" />
          )}
          {tab === "transactions" && (
            <DataTable columns={txColumns} rows={txRows} columnPicker emptyLabel="No transactions match" />
          )}
          {tab === "eod" && (
            <DataTable columns={eodColumns} rows={eodRows} columnPicker emptyLabel="Portfolio fully screened — next batch runs at 05:00" />
          )}
          {tab === "results" && (
            <DataTable columns={resultColumns} rows={allRows} columnPicker emptyLabel="No screening results match" />
          )}
          {tab === "kyc" && (
            <DataTable columns={kycColumns} rows={kycRows} columnPicker emptyLabel="No KYC refreshes due in the next 90 days" />
          )}
        </>
      )}
    </div>
  );
}
