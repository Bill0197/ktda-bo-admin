import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import {
  Badge, Button, Card, DataTable, Input, NotePanel, SectionTitle, Tabs,
} from "../../ui";
import {
  omniApi, type CheckedApplication, type CustomerSummary, type Page, type TimelineEntry,
} from "../../lib/omniApi";
import { dateOf, dateTime, label, money, shortId } from "../../lib/tokenConsole/format";
import { queriesFor } from "../../lib/tokenConsole/customerSearch";
import { ApplicationSection } from "./IdentityReview";
import { Code } from "./ConsoleTable";
import { DetailItem } from "./DetailItem";
import { CustomerPhotos } from "./CustomerPhotos";

/* The Customer desk, from omnichannel (the customer channel): find someone by
   the number or email they use, or by an id, and answer "I paid but nothing
   happened" or "I never got the code" without a developer reading logs —
   their standing, their money (M-Pesa and the product's own movements as one
   list), what we sent them and whether it reached the phone, and what they
   did in the app. Reads only; omnichannel audits every lookup against the
   staff member signed in. KYC and photo standing are shown for context; the
   decisions stay on the KYC desk. */

type Tone = "success" | "warning" | "danger" | "neutral";

const PAYMENT_TONE: Record<string, Tone> = { PAID: "success", SENT: "success", POSTED: "success", PENDING: "warning", FAILED: "danger" };
const DELIVERY: Record<string, { tone: Tone; text: string }> = {
  SENT: { tone: "success", text: "Pushed" },
  PENDING: { tone: "warning", text: "Sending" },
  NO_DEVICE: { tone: "neutral", text: "No device" },
  MUTED: { tone: "neutral", text: "Muted" },
  FAILED: { tone: "danger", text: "Push failed" },
};
const PROFILE_TONE: Record<string, Tone> = { ACTIVE: "success", PENDING: "warning", SUSPENDED: "danger", CLOSED: "neutral" };
const KYC_TONE: Record<string, Tone> = { VERIFIED: "success", IN_REVIEW: "warning", PENDING: "warning", REJECTED: "danger" };

/** The search and the customer open travel in the URL (`q`, `id`), so a
 *  lookup can be linked. */
export function CustomerDesk() {
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState(params.get("q") ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<CustomerSummary[] | null>(null);
  const selectedId = params.get("id");
  const searchId = useRef(0);

  const find = useCallback(async (typed: string) => {
    const queries = queriesFor(typed);
    if (!queries) {
      setProblem("Enter a phone number (0712 345 678), an email, or an investor or profile id.");
      return;
    }
    const run = ++searchId.current;
    setProblem(null);
    setSearching(true);
    try {
      let found: CustomerSummary[] = [];
      for (const q of queries) {
        found = await omniApi.findCustomers(q);
        if (found.length) break;
      }
      if (run !== searchId.current) return;
      setResults(found);
      // One match opens straight away; several are listed to choose from.
      setParams(found.length === 1 ? { q: typed.trim(), id: found[0].profileId } : { q: typed.trim() }, { replace: true });
    } catch (e) {
      if (run === searchId.current) setProblem(e instanceof Error ? e.message : "The search did not go through.");
    } finally {
      if (run === searchId.current) setSearching(false);
    }
  }, [setParams]);

  // A link in (?q=…, e.g. from an investor's panel) searches on arrival.
  const initial = useRef(params.get("q"));
  useEffect(() => {
    if (initial.current && !params.get("id")) void find(initial.current);
    // Only on arrival: later searches come from the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void find(text);
  };

  return (
    <div>
      <form onSubmit={submit} className="mb-5 flex max-w-2xl flex-wrap items-start gap-2" role="search">
        <div className="min-w-[260px] flex-1">
          <Input
            value={text}
            onChange={(e) => { setText(e.target.value); setProblem(null); }}
            placeholder="0712 345 678, name@example.com, or an investor or profile id"
            aria-label="Phone, email, investor id or profile id"
            invalid={!!problem}
            data-testid="customer-search"
          />
          {problem && <p role="alert" className="mt-1.5 text-[12.5px] text-danger">{problem}</p>}
        </div>
        <Button type="submit" disabled={searching}><Search size={15} /> {searching ? "Searching…" : "Find"}</Button>
      </form>

      {results && results.length === 0 && !selectedId && (
        <NotePanel tone="info" title="No customer found.">
          A phone number or email only matches once the customer has verified it.
        </NotePanel>
      )}

      {results && results.length > 1 && !selectedId && (
        <Card className="p-0">
          <DataTable
            rows={results.map((r) => ({ ...r, id: r.profileId }))}
            emptyLabel="No customers"
            columns={[
              { key: "name", header: "Customer", render: (c) => (
                <button type="button" className="text-left font-medium text-primary-600 hover:text-primary-700"
                  onClick={() => setParams({ q: text.trim(), id: c.profileId })}>
                  {c.legalName ?? c.displayName ?? "Unnamed"}
                </button>
              ) },
              { key: "status", header: "Profile", render: (c) => <Badge tone={PROFILE_TONE[c.status] ?? "neutral"}>{label(c.status)}</Badge> },
              { key: "kyc", header: "KYC", render: (c) => c.account ? <Badge tone={KYC_TONE[c.account.kycStatus] ?? "neutral"}>{label(c.account.kycStatus)}</Badge> : "—" },
              { key: "since", header: "Registered", render: (c) => <span className="tabular text-xs text-text-soft">{dateOf(c.registeredAt)}</span> },
            ]}
          />
        </Card>
      )}

      {selectedId && <CustomerView key={selectedId} profileId={selectedId} />}
    </div>
  );
}

function CustomerView({ profileId }: { profileId: string }) {
  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("timeline");

  useEffect(() => {
    let stale = false;
    omniApi.customer(profileId).then(
      (s) => { if (!stale) setSummary(s); },
      (e: unknown) => { if (!stale) setError(e instanceof Error ? e.message : "The customer could not be loaded."); },
    );
    return () => { stale = true; };
  }, [profileId]);

  if (error) return <NotePanel tone="danger">{error}</NotePanel>;
  if (!summary) return <p className="text-sm text-text-soft">Loading…</p>;

  const s = summary;
  const investorId = s.account?.investorId ?? s.links.find((l) => l.product === "TOKENIZATION")?.externalRef ?? null;
  return (
    <div className="flex flex-col gap-5" data-testid="customer-view">
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="font-display text-lg font-semibold text-text">{s.legalName ?? s.displayName ?? "Unnamed"}</h2>
          <Badge tone={PROFILE_TONE[s.status] ?? "neutral"}>{label(s.status)}</Badge>
        </div>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
          <DetailItem term="KYC">
            {s.account ? <Badge tone={KYC_TONE[s.account.kycStatus] ?? "neutral"}>{label(s.account.kycStatus)}</Badge> : "Not linked"}
          </DetailItem>
          <DetailItem term="Can invest">{s.account ? (s.account.canInvest ? "Yes" : "No") : "—"}</DetailItem>
          <DetailItem term="Registered">{dateTime(s.registeredAt)}</DetailItem>
          <DetailItem term="App on">
            {s.activeDevices === 0 ? "No device" : `${s.activeDevices} device${s.activeDevices === 1 ? "" : "s"}`}
            {" · "}{s.pushEnabled ? "push on" : "push off"}
          </DetailItem>
          <DetailItem term="Investor">
            {investorId ? <Code>{shortId(investorId)}</Code> : "—"}
          </DetailItem>
          <DetailItem term="Profile"><Code>{shortId(s.profileId)}</Code></DetailItem>
        </dl>
        <SectionTitle title="Contacts" className="mt-5" />
        <ul className="flex flex-col gap-1.5">
          {s.contacts.length === 0 && <li className="text-sm text-text-soft">None</li>}
          {s.contacts.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-16 text-xs text-text-faint">{label(c.type)}</span>
              <span className="tabular text-text">{c.value}</span>
              {c.verified ? <Badge tone="success">Verified</Badge> : <Badge tone="warning">Not verified</Badge>}
              {c.primary && <Badge tone="neutral">Primary</Badge>}
            </li>
          ))}
        </ul>
        {!s.pushEnabled && s.activeDevices > 0 && (
          <p className="mt-3 text-[12.5px] text-text-faint">Push is off, so messages wait in their in-app inbox until they open the app.</p>
        )}
      </Card>

      <div>
        <Tabs
          className="mb-3"
          active={tab}
          onChange={setTab}
          tabs={[
            { key: "timeline", label: "Timeline" },
            { key: "messages", label: "Messages" },
            { key: "activity", label: "Activity" },
            { key: "compliance", label: "Compliance" },
          ]}
        />
        {tab === "timeline" && <TimelineList profileId={profileId} />}
        {tab === "messages" && <MessageList profileId={profileId} />}
        {tab === "activity" && <ActivityList profileId={profileId} />}
        {tab === "compliance" && <Compliance profileId={profileId} />}
      </div>
    </div>
  );
}

/** A paged list read a page at a time, with "Load more". */
function usePaged<T>(fetch: (page: number) => Promise<Page<T>>) {
  const [items, setItems] = useState<T[]>([]);
  const [last, setLast] = useState<Page<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchRef = useRef(fetch);
  fetchRef.current = fetch;
  const alive = useRef(true);

  const load = useCallback(async (page: number) => {
    setLoading(true);
    setError(null);
    try {
      const p = await fetchRef.current(page);
      if (!alive.current) return;
      setItems((prev) => (page === 1 ? p.items : [...prev, ...p.items]));
      setLast(p);
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : "This could not be loaded.");
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void load(1);
    return () => { alive.current = false; };
  }, [load]);

  const more = last && last.page < last.pages ? () => void load(last.page + 1) : null;
  return { items, total: last?.total ?? null, loading, error, more };
}

/** Under a paged list: how much is shown, and the next page on demand. */
function PagedFooter({ list, empty }: { list: { items: unknown[]; total: number | null; loading: boolean; error: string | null; more: (() => void) | null }; empty: string }) {
  return (
    <>
      {list.error && <NotePanel tone="danger" className="mt-3">{list.error}</NotePanel>}
      <div className="mt-3 flex items-center gap-3 text-[12.5px] text-text-faint">
        {list.total !== null && list.total > 0 && <span>{list.items.length} of {list.total}</span>}
        {!list.loading && list.total === 0 && !list.error && <span>{empty}</span>}
        {list.more && <Button size="sm" variant="outline" disabled={list.loading} onClick={list.more}>{list.loading ? "Loading…" : "Load more"}</Button>}
      </div>
    </>
  );
}

/** KYC context: what the registry said about their application, and their
 *  photos with each decision. Deciding stays on the KYC desk. */
function Compliance({ profileId }: { profileId: string }) {
  const [app, setApp] = useState<CheckedApplication | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let stale = false;
    omniApi.applicationOfProfile(profileId).then(
      (a) => { if (!stale) setApp(a); },
      (e: unknown) => { if (!stale) setError(e instanceof Error ? e.message : "The application could not be loaded."); },
    );
    return () => { stale = true; };
  }, [profileId]);
  return (
    <div className="flex flex-col gap-6">
      {error ? <NotePanel tone="danger">{error}</NotePanel>
        : app === undefined ? <p className="text-sm text-text-soft">Loading…</p>
        : app ? <ApplicationSection app={app} />
        : <NotePanel tone="info">They have not applied to invest from the app, so there is no registry result.</NotePanel>}
      <section>
        <SectionTitle title="Photos" description={<>Decisions are made on the <Link to="/token-console/kyc" className="font-medium text-primary-600 hover:text-primary-700">KYC desk</Link>.</>} />
        <CustomerPhotos profileId={profileId} />
      </section>
    </div>
  );
}

function TimelineList({ profileId }: { profileId: string }) {
  const list = usePaged((page) => omniApi.customerTimeline(profileId, page));
  const rows = list.items.map((t: TimelineEntry, i) => ({ ...t, id: `${i}-${t.occurredAt}-${t.source}` }));
  return (
    <>
        <DataTable
          rows={rows}
          emptyLabel={list.loading ? "Loading…" : "No payments or movements"}
          columns={[
            { key: "when", header: "When", className: "whitespace-nowrap", render: (t) => <span className="tabular text-xs text-text-soft">{dateTime(t.occurredAt)}</span> },
            { key: "what", header: "What", render: (t) => (
              <div>
                <div className="text-text">{t.label}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-text-faint">
                  <span className="rounded border border-border px-1.5 py-px text-[10.5px] font-medium uppercase tracking-wide">{t.source === "MPESA" ? "M-Pesa" : "Product"}</span>
                  {t.detail}
                </div>
              </div>
            ) },
            { key: "amount", header: "Amount", className: "tabular text-right whitespace-nowrap", render: (t) => t.amount === null ? "—"
              : <span className={t.direction === "IN" ? "text-success" : "text-text"}>{t.direction === "OUT" ? "−" : "+"}{money(t.amount, t.currency)}</span> },
            { key: "status", header: "Status", className: "whitespace-nowrap", render: (t) => t.status ? <Badge tone={PAYMENT_TONE[t.status] ?? "neutral"}>{label(t.status)}</Badge> : "—" },
            { key: "ref", header: "Reference", hideOnMobile: true, render: (t) => t.reference ? <Code>{t.reference.length > 20 ? shortId(t.reference) : t.reference}</Code> : "—" },
          ]}
        />
      <PagedFooter list={list} empty="No payments or movements yet." />
    </>
  );
}

function MessageList({ profileId }: { profileId: string }) {
  const list = usePaged((page) => omniApi.customerMessages(profileId, page));
  return (
    <>
        <DataTable
          rows={list.items}
          emptyLabel={list.loading ? "Loading…" : "No messages"}
          columns={[
            { key: "when", header: "Sent", className: "whitespace-nowrap", render: (m) => <span className="tabular text-xs text-text-soft">{dateTime(m.createdAt)}</span> },
            { key: "msg", header: "Message", render: (m) => (
              <div>
                <div className="font-medium text-text">{m.title}</div>
                <div className="text-xs text-text-soft">{m.body}</div>
              </div>
            ) },
            { key: "push", header: "Phone", className: "whitespace-nowrap", render: (m) => {
              const d = DELIVERY[m.delivery] ?? { tone: "neutral" as Tone, text: label(m.delivery) };
              return <Badge tone={d.tone}>{d.text}</Badge>;
            } },
            { key: "read", header: "Read", className: "whitespace-nowrap", hideOnMobile: true, render: (m) => <span className="text-xs text-text-soft">{m.readAt ? dateOf(m.readAt) : "Not yet"}</span> },
          ]}
        />
      <PagedFooter list={list} empty="Nothing has been sent to them." />
    </>
  );
}

function ActivityList({ profileId }: { profileId: string }) {
  const list = usePaged((page) => omniApi.customerActivity(profileId, page));
  return (
    <>
        <DataTable
          rows={list.items}
          emptyLabel={list.loading ? "Loading…" : "No activity"}
          columns={[
            { key: "when", header: "When", className: "whitespace-nowrap", render: (a) => <span className="tabular text-xs text-text-soft">{dateTime(a.occurredAt)}</span> },
            { key: "action", header: "Action", render: (a) => <span className="text-text">{label(a.action)}</span> },
            { key: "outcome", header: "Outcome", className: "whitespace-nowrap", render: (a) => a.outcome === null ? "—"
              : a.outcome < 400 ? <Badge tone="success">Done</Badge>
              : <Badge tone={a.outcome >= 500 ? "danger" : "warning"}>{`Refused · ${a.outcome}`}</Badge> },
            { key: "req", header: "Request", hideOnMobile: true, render: (a) => a.requestId ? <Code>{shortId(a.requestId)}</Code> : "—" },
          ]}
        />
      <PagedFooter list={list} empty="They have not done anything in the app yet." />
    </>
  );
}
