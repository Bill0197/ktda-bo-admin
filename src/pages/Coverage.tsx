import { useMemo, useState } from "react";
import { SEGMENT_LABELS, type CommercialSegment } from "../mock";
import {
  getCoverageBook, getCrmOwners, getSegmentModel,
  setCoverageOwner as setClientOwner, setCoverageSegment as setClientSegment,
} from "../lib/api";
import {
  PageHeader, Badge, DataTable, Skeleton, Button, Modal, Field, Input, Dropdown,
  GlassPanel, GlassStat, StatRail, NotePanel, Tabs, useToast, FilterBar, SearchInput,
  SelectFilter, type Column, type TabDef,
} from "../ui";
import { UsersRound, UserX, Layers } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth, ADMIN_USERS } from "../lib/auth";
import { useAsyncData } from "../lib/useAsyncData";

type BookRow = Awaited<ReturnType<typeof getCoverageBook>>[number];

/** Who covers whom, and under what service model.
 *
 * Commercial segment is a DIFFERENT AXIS from the risk band already on the
 * client file: a Low-risk customer can be institutional and a High-risk one
 * mass retail. Servicing a book by its AML rating is the mistake this page
 * exists to prevent.
 *
 * Mass retail is legitimately unowned — thousands of self-service contracts
 * from KES 100 have no relationship to manage — so an unassigned mass-retail
 * client is not a gap. Only segments whose service model promises a named
 * owner are counted as one. */
export default function Coverage() {
  const [tab, setTab] = useState("book");
  const { data: book, loading, reload } = useAsyncData(getCoverageBook);
  const { data: model } = useAsyncData(getSegmentModel);

  const tabs: TabDef[] = [
    { key: "book", label: "Coverage book", count: book?.length },
    { key: "model", label: "Service model" },
  ];

  return (
    <div>
      <PageHeader
        title="Coverage & segmentation"
        tooltip="Commercial segment (mass retail → institutional) drives who services a client and how often. It is separate from the AML risk band, which drives monitoring."
        subtitle="Relationship ownership as a dated assignment — a handover never erases who covered the client before it."
      />
      <Tabs tabs={tabs} active={tab} onChange={setTab} className="mb-5" />
      {loading && <Skeleton className="h-96" />}
      {!loading && tab === "book" && <BookTab rows={book ?? []} onChanged={reload} />}
      {!loading && tab === "model" && <ModelTab rows={model ?? []} />}
    </div>
  );
}

function BookTab({ rows, onChanged }: { rows: BookRow[]; onChanged: () => void }) {
  const { role } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { data: owners } = useAsyncData(getCrmOwners);

  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState("all");
  const [gapsOnly, setGapsOnly] = useState(false);
  const [editing, setEditing] = useState<BookRow | null>(null);
  const [form, setForm] = useState({ ownerId: "", segment: "" as "" | CommercialSegment, reason: "" });
  const [busy, setBusy] = useState(false);

  const me = role ? ADMIN_USERS[role].name : "";
  const canAssign = role === "bd_officer" || role === "head_of_bd" || role === "system_admin";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (segment !== "all" && r.segment !== segment) return false;
      if (gapsOnly && !r.gap) return false;
      return !q || r.name.toLowerCase().includes(q) || r.clientId.toLowerCase().includes(q);
    });
  }, [rows, query, segment, gapsOnly]);

  const gaps = rows.filter((r) => r.gap).length;
  const unsegmented = rows.filter((r) => !r.segment).length;

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      // Both writes are optional and independent — reassigning an owner
      // should not force a segment change, and vice versa.
      if (form.ownerId && form.ownerId !== editing.ownerId) {
        await setClientOwner(editing.clientId, form.ownerId, me, form.reason.trim() || undefined);
      }
      if (form.segment && form.segment !== editing.segment) {
        await setClientSegment(editing.clientId, form.segment, me, form.reason.trim() || undefined);
      }
      toast.push("Updated. The previous window is closed, not overwritten.", "success");
      setEditing(null);
      onChanged();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not update", "error");
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<BookRow>[] = [
    { key: "name", header: "Client", render: (r) => (
      <div>
        <div className="text-text font-medium">{r.name}</div>
        <div className="text-xs text-text-faint tabular">{r.clientId}</div>
      </div>
    ) },
    { key: "segment", header: "Segment", render: (r) => r.segmentLabel
      ? <Badge tone={r.segment === "institutional" || r.segment === "hnwi" ? "accent" : "neutral"}>{r.segmentLabel}</Badge>
      : <Badge tone="warning">Unsegmented</Badge>, className: "whitespace-nowrap" },
    { key: "owner", header: "Owner", render: (r) => r.ownerLabel
      ? <span className="text-text-soft">{r.ownerLabel}</span>
      : r.expectsOwner
        ? <Badge tone="danger">No owner</Badge>
        : <span className="text-text-faint">Pooled queue</span>, className: "whitespace-nowrap" },
    { key: "model", header: "Service model", render: (r) => r.serviceModel
      ? <span className="text-xs text-text-soft max-w-xs block">{r.serviceModel.coverage}</span>
      : <span className="text-text-faint">—</span>, hideOnMobile: true },
    { key: "review", header: "Review cadence", render: (r) => r.serviceModel?.reviewMonths
      ? <span className="tabular text-text-soft">{r.serviceModel.reviewMonths}-monthly</span>
      : <span className="text-text-faint">No scheduled review</span>, hideOnMobile: true, className: "whitespace-nowrap" },
    { key: "action", header: "", className: "whitespace-nowrap", render: (r) => (
      <div className="flex gap-1 justify-end">
        <Button variant="ghost" onClick={() => navigate(`/clients/${r.clientId}`)}>Open</Button>
        {canAssign && (
          <Button
            variant="ghost"
            onClick={() => { setEditing(r); setForm({ ownerId: r.ownerId ?? "", segment: r.segment ?? "", reason: "" }); }}
          >
            Reassign
          </Button>
        )}
      </div>
    ) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <StatRail columns={3}>
        <GlassStat label="Clients in the book" value={rows.length} icon={<UsersRound size={17} />} tone="primary" hint="every activated client, pooled and named" />
        <GlassStat
          label="Coverage gaps"
          value={gaps}
          icon={<UserX size={17} />}
          tone={gaps ? "danger" : "success"}
          hint="segments that promise a named owner and have none"
        />
        <GlassStat
          label="Unsegmented"
          value={unsegmented}
          icon={<Layers size={17} />}
          tone={unsegmented ? "warning" : "success"}
          hint="no commercial segment assigned"
        />
      </StatRail>

      <FilterBar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search client…" />
        <SelectFilter
          value={segment}
          onChange={setSegment}
          allLabel="All segments"
          options={Object.entries(SEGMENT_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <button
          type="button"
          onClick={() => setGapsOnly((v) => !v)}
          className={`h-9 px-3.5 rounded-md border text-[13px] font-medium transition-colors ${
            gapsOnly
              ? "border-danger/40 bg-danger-bg text-danger"
              : "border-border bg-glass text-text-soft hover:text-text hover:border-border-strong"
          }`}
        >
          Gaps only
        </button>
      </FilterBar>

      <GlassPanel className="p-1" sheen={false}><DataTable columns={columns} rows={filtered} columnPicker emptyLabel="No clients match" /></GlassPanel>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Reassign — ${editing?.name ?? ""}`}>
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-text-soft">
            Each change closes the current window and opens a new one from today. Leave a field unchanged to leave that
            assignment alone.
          </p>
          <Field label="Relationship owner">
            <Dropdown
              value={form.ownerId}
              onChange={(v) => setForm({ ...form, ownerId: v })}
              placeholder="Unassigned"
              options={(owners ?? []).map((o) => ({ value: o.id, label: o.name, description: o.roleLabel }))}
            />
          </Field>
          <Field label="Commercial segment" hint="Separate from the AML risk band — this drives servicing, not monitoring.">
            <Dropdown
              value={form.segment}
              onChange={(v) => setForm({ ...form, segment: v as CommercialSegment })}
              placeholder="Unsegmented"
              options={Object.entries(SEGMENT_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </Field>
          <Field label="Reason" hint="Recorded on the assignment. A handover with no reason is the one nobody can explain later.">
            <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Why it is moving" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              onClick={save}
              disabled={busy || (form.ownerId === (editing?.ownerId ?? "") && form.segment === (editing?.segment ?? ""))}
            >
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

type ModelRow = Awaited<ReturnType<typeof getSegmentModel>>[number];

function ModelTab({ rows }: { rows: ModelRow[] }) {
  return (
    <div className="flex flex-col gap-4">
      <NotePanel tone="info">
        The BD SOP requires ongoing servicing but fixes no cadence per segment. These are
        <strong className="text-text"> indicative</strong> and would be BO-editable in a real build — flagged rather
        than presented as Investcent policy.
      </NotePanel>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <GlassPanel key={r.key} className="p-5 flex flex-col gap-3 lift">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-text">{r.label}</span>
              <Badge tone="neutral">{r.clients} {r.clients === 1 ? "client" : "clients"}</Badge>
            </div>
            <p className="text-[13px] text-text-soft leading-relaxed">{r.coverage}</p>
            <div className="pt-3 border-t border-border text-xs">
              <span className="text-text-faint">Review cadence </span>
              <span className="text-text font-medium">
                {r.reviewMonths ? `every ${r.reviewMonths} months` : "none — self-service"}
              </span>
            </div>
          </GlassPanel>
        ))}
      </div>
    </div>
  );
}
