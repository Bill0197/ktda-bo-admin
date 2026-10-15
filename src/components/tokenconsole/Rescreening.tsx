import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, DataTable, NotePanel, SectionTitle, useToast } from "../../ui";
import { OmniApiError, omniApi, type CheckedApplication } from "../../lib/omniApi";
import { dateTime } from "../../lib/tokenConsole/format";
import { useAction } from "../../lib/tokenConsole/useAction";
import { Code } from "./ConsoleTable";

/** Customers a nightly re-screening referred: not clear after onboarding, so
 *  each is back under review on the engine and cannot invest until the KYC
 *  desk decides. The sweep runs nightly over everyone last screened more
 *  than 30 days ago; staff can run it now. */
export function Rescreening({ mayRun }: { mayRun: boolean }) {
  const toast = useToast();
  const [rows, setRows] = useState<CheckedApplication[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const sweep = useAction(omniApi.rescreen);

  const load = useCallback(async () => {
    try {
      const p = await omniApi.screeningHits(1, 50);
      setRows(p.items);
      setTotal(p.total);
      setError(null);
    } catch (e) {
      // An omnichannel (or proxy) that predates the list: say so, not "failed".
      if (e instanceof OmniApiError && (e.status === 404 || e.status === 405)) setUnavailable(true);
      else setError(e instanceof Error ? e.message : "The re-screening hits could not be loaded.");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const run = async () => {
    const r = await sweep.run();
    if (!r) return;
    toast.push(`Re-screened ${r.screened}: ${r.hits} referred.`);
    await load();
  };

  return (
    <section className="mt-8" data-testid="rescreening">
      <SectionTitle
        title="Re-screening hits"
        description="Customers whose last screening after onboarding was not clear. Each is already back under review."
      />
      {mayRun && !unavailable && (
        <div className="mb-3 flex items-center gap-3">
          <Button size="sm" variant="outline" disabled={sweep.pending} onClick={() => void run()}>
            {sweep.pending ? "Running…" : "Run re-screening now"}
          </Button>
          <span className="text-xs text-text-faint">Otherwise it runs every night.</span>
        </div>
      )}
      {sweep.error && <NotePanel tone="danger" className="mb-3">{sweep.error}</NotePanel>}
      {unavailable ? (
        <NotePanel tone="info">This omnichannel does not have re-screening yet.</NotePanel>
      ) : error ? (
        <NotePanel tone="danger">{error}</NotePanel>
      ) : (
        <Card className="p-0">
          <DataTable
            paged={false}
            rows={(rows ?? []).map((a) => ({ ...a }))}
            emptyLabel={rows === null ? "Loading…" : "Nobody has been referred."}
            columns={[
              { key: "who", header: "Customer", render: (a) => (
                <Link to={`/token-console/customers?q=${encodeURIComponent(a.profileId)}&id=${encodeURIComponent(a.profileId)}`}
                  className="font-medium text-primary-600 hover:text-primary-700">{a.fullName}</Link>
              ) },
              { key: "inv", header: "Investor", hideOnMobile: true, render: (a) => <Code>{a.externalRef.slice(0, 8)}</Code> },
              { key: "when", header: "Re-screened", className: "whitespace-nowrap", render: (a) => a.rescreenedAt ? <span className="tabular text-xs text-text-soft">{dateTime(a.rescreenedAt)}</span> : "—" },
              { key: "ref", header: "Provider reference", hideOnMobile: true, render: (a) => a.rescreenReference ? <Code>{a.rescreenReference}</Code> : "—" },
            ]}
          />
        </Card>
      )}
      {rows && total > rows.length && <p className="mt-2 text-xs text-text-faint">Showing the latest {rows.length} of {total}.</p>}
    </section>
  );
}
