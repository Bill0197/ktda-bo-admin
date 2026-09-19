import { useState } from "react";
import { OPPORTUNITY_STAGE_LABELS, type BidCriterion, type OpportunityStage } from "../mock";
import {
  getOpportunities, getBidCriteria, scoreOpportunity, decideOpportunity, setOpportunityStage,
  getInteractions,
} from "../lib/api";
import {
  PageHeader, Badge, DataTable, Skeleton, Button, Modal, Field, Textarea, Dropdown,
  GlassPanel, GlassStat, StatRail, Money, useToast, formatDate, formatDateTime, type Column,
} from "../ui";
import { Briefcase, Trophy, Ban, Scale } from "lucide-react";
import { useAuth, ADMIN_USERS } from "../lib/auth";
import { useAsyncData } from "../lib/useAsyncData";

type OppRow = Awaited<ReturnType<typeof getOpportunities>>[number];

const STAGE_TONE: Record<OpportunityStage, "neutral" | "info" | "warning" | "success" | "danger" | "accent"> = {
  qualifying: "neutral",
  bid_no_bid: "warning",
  proposal: "info",
  negotiation: "accent",
  won: "success",
  lost: "danger",
  no_bid: "danger",
};

/** Institutional pipeline with the BD SOP's Bid/No-Bid framework — its seven
 * criteria verbatim: strategic fit, capability, profitability, operational
 * complexity, compliance, win probability and reputation.
 *
 * The framework only means anything if it gates something, so an opportunity
 * cannot advance to proposal without every criterion scored and a written
 * decision. A no-bid with no rationale is the one every post-mortem asks
 * about; a bid with no rationale is how a framework becomes a rubber stamp. */
export default function Pipeline() {
  const { role } = useAuth();
  const toast = useToast();
  const { data: opps, loading, reload } = useAsyncData(getOpportunities);
  const { data: criteria } = useAsyncData(getBidCriteria);
  const [selected, setSelected] = useState<OppRow | null>(null);

  const me = role ? ADMIN_USERS[role].name : "";
  const canDecide = role === "head_of_bd" || role === "system_admin";

  const all = opps ?? [];
  const openOpps = all.filter((o) => !["won", "lost", "no_bid"].includes(o.stage));
  const pipelineValueKes = openOpps.filter((o) => o.currency === "KES").reduce((s, o) => s + o.indicativeAmount, 0);
  const won = all.filter((o) => o.stage === "won").length;
  const noBid = all.filter((o) => o.stage === "no_bid").length;

  const columns: Column<OppRow>[] = [
    { key: "counterparty", header: "Counterparty", render: (r) => (
      <div>
        <div className="text-text font-medium">{r.counterparty}</div>
        <div className="text-xs text-text-faint capitalize">{r.type.replace("_", " ")}</div>
      </div>
    ) },
    { key: "stage", header: "Stage", render: (r) => <Badge tone={STAGE_TONE[r.stage]}>{r.stageLabel}</Badge>, className: "whitespace-nowrap" },
    { key: "amount", header: "Indicative", render: (r) => <Money amount={r.indicativeAmount} currency={r.currency} compact /> },
    { key: "score", header: "Bid score", render: (r) => r.score === null
      ? <span className="text-text-faint text-xs">not scored</span>
      : (
        <div className="flex items-center gap-2">
          <span className="tabular text-text font-medium">{r.score.toFixed(2)}</span>
          <span className="text-xs text-text-faint">{r.scored}/{r.total}</span>
        </div>
      ) },
    { key: "owner", header: "Owner", render: (r) => <span className="text-text-soft">{r.ownerLabel}</span>, hideOnMobile: true },
    { key: "opened", header: "Opened", render: (r) => <span className="tabular text-xs">{formatDate(r.openedAt)}</span>, hideOnMobile: true },
    { key: "decision", header: "Decision", render: (r) => r.decision
      ? <Badge tone={r.decision === "bid" ? "success" : "danger"}>{r.decision === "bid" ? "Bid" : "No-bid"}</Badge>
      : <span className="text-text-faint text-xs">pending</span>, hideOnMobile: true },
  ];

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div>
      <PageHeader
        title="Institutional pipeline"
        tooltip="Bid/No-Bid is the SOP's gate before committing effort to an institutional opportunity: seven criteria scored 1–5, then a written decision. Operational complexity is scored inverted — 5 means simple."
        subtitle="SACCOs, pensions, corporates and institutional mandates. The retail book has no pipeline — it has a service desk."
      />

      <StatRail className="mb-5">
        <GlassStat label="Open opportunities" value={openOpps.length} icon={<Briefcase size={17} />} tone="primary" hint="qualifying through negotiation" />
        <GlassStat
          label="Pipeline value (KES)"
          value={<Money amount={pipelineValueKes} currency="KES" compact />}
          icon={<Scale size={17} />}
          tone="accent"
          hint="indicative, not committed"
        />
        <GlassStat label="Won" value={won} icon={<Trophy size={17} />} tone="success" hint="mandates converted to funded contracts" />
        <GlassStat
          label="Declined at Bid/No-Bid"
          value={noBid}
          icon={<Ban size={17} />}
          tone="neutral"
          hint="a healthy number is not zero — the framework is meant to decline things"
        />
      </StatRail>

      <GlassPanel className="p-1" sheen={false}>
        <DataTable columns={columns} rows={all} onRowClick={setSelected} columnPicker />
      </GlassPanel>

      {selected && (
        <OpportunityModal
          opp={selected}
          criteria={criteria ?? []}
          canDecide={canDecide}
          actor={me}
          onClose={() => setSelected(null)}
          onChanged={async () => { await reload(); setSelected(null); }}
          toast={toast}
        />
      )}
    </div>
  );
}

function OpportunityModal({
  opp, criteria, canDecide, actor, onClose, onChanged, toast,
}: {
  opp: OppRow;
  criteria: { key: BidCriterion; label: string; hint: string; inverted?: boolean }[];
  canDecide: boolean;
  actor: string;
  onClose: () => void;
  onChanged: () => void;
  toast: ReturnType<typeof useToast>;
}) {
  const [scores, setScores] = useState<Partial<Record<BidCriterion, number>>>(opp.scores);
  const [note, setNote] = useState(opp.decisionNote ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const { data: interactions } = useAsyncData(() => getInteractions("opportunity", opp.id));

  const scored = criteria.filter((c) => typeof scores[c.key] === "number").length;
  const values = criteria.map((c) => scores[c.key]).filter((v): v is number => typeof v === "number");
  const mean = values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;

  const act = async (key: string, fn: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await fn();
      toast.push(success, "success");
      onChanged();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not complete that", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal open onClose={onClose} title={opp.counterparty} size="lg">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <Meta label="Stage" value={opp.stageLabel} />
          <Meta label="Indicative" value={`${opp.currency} ${opp.indicativeAmount.toLocaleString()}`} />
          <Meta label="Owner" value={opp.ownerLabel} />
          <Meta label="Opened" value={formatDate(opp.openedAt)} />
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-sm font-semibold text-text">Bid / No-Bid assessment</h3>
            <span className="text-xs text-text-faint">
              {mean === null ? "not scored" : <>mean <strong className="text-text tabular">{mean.toFixed(2)}</strong> · {scored}/{criteria.length} scored</>}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {criteria.map((c) => (
              <div key={c.key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-text">{c.label}</div>
                  <div className="text-[11px] text-text-faint leading-snug">{c.hint}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      disabled={!canDecide}
                      onClick={() => setScores((s) => ({ ...s, [c.key]: n }))}
                      className={`h-7 w-7 rounded-md text-xs font-semibold tabular border transition-colors ${
                        scores[c.key] === n
                          ? "bg-primary-500 text-white border-primary-500"
                          : "bg-surface text-text-soft border-border hover:text-text disabled:opacity-50"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {canDecide && (
            <div className="flex justify-end mt-3">
              <Button
                variant="secondary"
                onClick={() => act("score", () => scoreOpportunity(opp.id, scores, actor), "Scores saved.")}
                disabled={busy === "score"}
              >
                {busy === "score" ? "Saving…" : "Save scores"}
              </Button>
            </div>
          )}
        </div>

        {opp.decisionNote && (
          <div className={`rounded-lg border p-3 ${opp.decision === "bid" ? "border-success/30 bg-success-bg/40" : "border-danger/30 bg-danger-bg/40"}`}>
            <div className="text-xs text-text-faint mb-1">
              {opp.decision === "bid" ? "Bid" : "No-bid"} — {opp.decisionBy}
            </div>
            <p className="text-[13px] text-text">{opp.decisionNote}</p>
          </div>
        )}

        {canDecide && !opp.decision && (
          <div className="flex flex-col gap-3">
            <Field label="Decision rationale" hint="Required. Every criterion must be scored first.">
              <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why bid, or why decline" />
            </Field>
            <div className="flex justify-end gap-2">
              <Button
                variant="danger"
                onClick={() => act("nobid", () => decideOpportunity(opp.id, "no_bid", note, actor), "Declined and closed.")}
                disabled={busy === "nobid" || !note.trim()}
              >
                No-bid
              </Button>
              <Button
                onClick={() => act("bid", () => decideOpportunity(opp.id, "bid", note, actor), "Bid recorded — moved to proposal.")}
                disabled={busy === "bid" || !note.trim()}
              >
                Bid
              </Button>
            </div>
          </div>
        )}

        {canDecide && opp.decision === "bid" && !["won", "lost"].includes(opp.stage) && (
          <Field label="Move stage">
            <Dropdown
              value={opp.stage}
              onChange={(v) => act("stage", () => setOpportunityStage(opp.id, v as OpportunityStage, actor), "Stage updated.")}
              options={(["proposal", "negotiation", "won", "lost"] as OpportunityStage[]).map((s) => ({ value: s, label: OPPORTUNITY_STAGE_LABELS[s] }))}
            />
          </Field>
        )}

        <div>
          <h3 className="text-sm font-semibold text-text mb-2">Interactions</h3>
          {interactions?.length ? (
            <div className="flex flex-col gap-2">
              {interactions.map((i) => (
                <div key={i.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[13px] text-text font-medium">{i.summary}</span>
                    <span className="text-[11px] text-text-faint tabular shrink-0">{formatDateTime(i.occurredAt)}</span>
                  </div>
                  {i.detail && <p className="text-xs text-text-soft leading-relaxed">{i.detail}</p>}
                  {i.outcome && <p className="text-xs text-text-faint mt-1">→ {i.outcome}</p>}
                  <div className="text-[11px] text-text-faint mt-1.5">{i.typeLabel} · {i.byName}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-text-faint">Nothing logged against this opportunity yet.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-text-faint mb-0.5">{label}</div>
      <div className="text-text font-medium break-words">{value}</div>
    </div>
  );
}
