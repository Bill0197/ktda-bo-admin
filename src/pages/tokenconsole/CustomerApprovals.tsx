import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { Badge, Button, DataTable, DEFAULT_PAGE_SIZE, GlassPanel, PageHeader, Pagination, Skeleton, Tabs } from "../../ui";
import { useAuth } from "../../lib/auth";
import { canDecideKyc } from "../../lib/tokenConsole/kyc";
import { omniApi, omniSubjectFor, type Intervention, type Page } from "../../lib/omniApi";
import { dateTime, label, shortId } from "../../lib/tokenConsole/format";
import { INTERVENTION_LABEL, whoIs } from "../../lib/tokenConsole/interventions";
import { SourceError, StatusBadge } from "../../components/tokenconsole/ConsoleTable";
import { DecisionButtons } from "../../components/tokenconsole/CustomerInterventions";

/* Reinstatements and closures waiting for a second person (BRD FR-ADM-03),
   oldest first, or the whole log, newest first, from omnichannel. Each can be
   decided here or on the customer (the link opens them on the Customer desk). */

type View = "PENDING" | "ALL";

export default function TokenConsoleCustomerApprovals() {
  const { user } = useAuth();
  const me = omniSubjectFor(user?.email);
  // Same gate as the Customer desk's account actions; omnichannel still decides.
  const allowed = canDecideKyc(user?.tokRoles);
  const [view, setView] = useState<View>("PENDING");
  const [list, setList] = useState<Page<Intervention> | null>(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const run = useRef(0);
  // A new view starts on its first page at the size already chosen.
  const sizeRef = useRef(pageSize);
  sizeRef.current = pageSize;

  const load = useCallback(async (which: View, page: number, size: number) => {
    // Only the latest read lands, however the answers are ordered.
    const mine = ++run.current;
    setLoading(true);
    setError(null);
    try {
      const p = await omniApi.interventions(which, page, size);
      if (run.current !== mine) return;
      setList(p);
      setPageSize(size);
    } catch (e) {
      if (run.current === mine) setError(e instanceof Error ? e.message : "The proposals could not be loaded.");
    } finally {
      if (run.current === mine) setLoading(false);
    }
  }, []);

  // Leaving the page (or the view) drops an answer still on its way.
  const cancel = useCallback(() => { run.current++; }, []);
  useEffect(() => {
    void load(view, 1, sizeRef.current);
    return cancel;
  }, [view, load, cancel]);

  const reload = () => void load(view, list?.page ?? 1, pageSize);

  return (
    <div>
      <PageHeader
        eyebrow="Baracel Unyt"
        title="Customer approvals"
        subtitle="Reinstatements and closures of app profiles. Each takes effect only when someone other than the person who proposed it approves it."
        actions={
          <Button size="sm" variant="outline" disabled={loading} onClick={reload}>
            <RefreshCw size={14} className={loading ? "animate-spin" : undefined} /> {loading ? "Loading…" : "Refresh"}
          </Button>
        }
      />
      <Tabs
        className="mb-4"
        active={view}
        onChange={(k) => { setList(null); setView(k as View); }}
        tabs={[
          { key: "PENDING", label: "Waiting", count: view === "PENDING" ? list?.total : undefined },
          { key: "ALL", label: "Full log" },
        ]}
      />

      {error && <SourceError what="the proposals" error={error} onRetry={reload} />}
      {!list && loading && !error && <Skeleton className="h-48" />}

      {list && (
        <GlassPanel className="p-1" sheen={false}>
          <DataTable<Intervention>
            paged={false}
            rows={list.items}
            emptyLabel={view === "PENDING" ? "Nothing is waiting for a second person" : "No reinstatement or closure has been proposed yet"}
            columns={[
              { key: "when", header: "Proposed", className: "whitespace-nowrap", render: (i) => <span className="tabular text-xs text-text-soft">{dateTime(i.proposedAt)}</span> },
              { key: "customer", header: "Customer", render: (i) => (
                <div>
                  <Link to={`/token-console/customers?id=${encodeURIComponent(i.profileId)}`} className="font-medium text-text hover:text-primary-600" title="Open on the Customer desk">
                    {i.customer ?? `Customer ${shortId(i.profileId)}`}
                  </Link>
                  {i.profileStatus && <div className="mt-0.5 text-xs text-text-faint">Profile {label(i.profileStatus).toLowerCase()}</div>}
                </div>
              ) },
              { key: "action", header: "Action", render: (i) => <Badge tone={i.action === "CLOSE" ? "danger" : "info"}>{INTERVENTION_LABEL[i.action] ?? label(i.action)}</Badge> },
              { key: "by", header: "Proposed by", render: (i) => (
                <div>
                  <div className="text-text">{whoIs(i.proposedBy, me)}</div>
                  {i.note && <div className="mt-0.5 text-xs text-text-soft">{i.note}</div>}
                </div>
              ) },
              { key: "decision", header: "Decision", className: "whitespace-nowrap", render: (i) => i.status === "PENDING"
                ? (allowed ? <DecisionButtons intervention={i} me={me} onSettled={reload} /> : <StatusBadge status={i.status} />)
                : (
                  <div>
                    <StatusBadge status={i.status} />
                    {i.decidedBy && <div className="mt-1 text-xs text-text-faint">{whoIs(i.decidedBy, me)} · {dateTime(i.decidedAt)}</div>}
                    {i.decisionNote && <div className="mt-0.5 text-xs text-text-soft">{i.decisionNote}</div>}
                  </div>
                ) },
            ]}
            footer={
              list.items.length > pageSize ? null : (
                <Pagination
                  className="px-3 pt-3 pb-2"
                  page={list.page}
                  pageSize={pageSize}
                  total={list.total}
                  disabled={loading}
                  onPage={(p) => void load(view, p, pageSize)}
                  onPageSize={(n) => void load(view, 1, n)}
                />
              )
            }
          />
        </GlassPanel>
      )}
    </div>
  );
}
