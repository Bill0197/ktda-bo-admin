import { useMemo, useState } from "react";
import {
  getSystemUsers, getRolePermissionMatrix, setRolePageAccess, inviteSystemUser, setSystemUserStatus, updateSystemUserRole,
  getDepartments, departmentForRole,
} from "../lib/api";
import {
  ROLE_LABELS, type SystemUser, type AdminRole, type Department,
} from "../mock";
import {
  PageHeader, Card, Badge, Button, Modal, DataTable, Tabs, Field, Input, Dropdown, Skeleton,
  useToast, formatDateTime, type Column,
  FilterBar, SearchInput, SelectFilter,
} from "../ui";
import { Check, UserPlus, ShieldAlert, Building2 } from "lucide-react";
import { useAuth, ADMIN_USERS } from "../lib/auth";
import { useAsyncData } from "../lib/useAsyncData";
import { NAV_DEFS } from "../lib/navConfig";

const ALL_ROLES = Object.keys(ROLE_LABELS) as AdminRole[];

const STATUS_TONE: Record<SystemUser["status"], "success" | "danger" | "info"> = {
  active: "success",
  suspended: "danger",
  invited: "info",
};

function InviteModal({ open, onClose, onInvited }: { open: boolean; onClose: () => void; onInvited: (u: SystemUser) => void }) {
  const { role } = useAuth();
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<AdminRole>("bd_officer");
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const me = role ? ADMIN_USERS[role].name : "";

  const submit = async () => {
    const nextErrors: typeof errors = {};
    if (!name.trim()) nextErrors.name = "Full name is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) nextErrors.email = "Enter a valid work email";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSubmitting(true);
    try {
      const user = await inviteSystemUser({ name: name.trim(), email: email.trim(), role: newRole }, me);
      onInvited(user);
      toast.push(`Invite sent to ${user.email}`, "success");
      setName("");
      setEmail("");
      setNewRole("bd_officer");
      setErrors({});
      onClose();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not send the invite", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={() => !submitting && onClose()} title="Invite a user" size="md">
      <div className="flex flex-col gap-4">
        <Field label="Full name" required error={errors.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Janet Wambui" invalid={!!errors.name} autoFocus />
        </Field>
        <Field label="Work email" required error={errors.email}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@investcent.co.ke" invalid={!!errors.email} />
        </Field>
        <Field label="Role" hint="Determines exactly which pages they can reach — see the permission matrix tab.">
          <Dropdown
            value={newRole}
            onChange={(v) => setNewRole(v as AdminRole)}
            options={ALL_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
            ariaLabel="Role"
          />
        </Field>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" disabled={submitting} onClick={onClose}>Cancel</Button>
          <Button disabled={submitting} onClick={submit}>{submitting ? "Sending…" : "Send invite"}</Button>
        </div>
      </div>
    </Modal>
  );
}

function UserDetailModal({
  user, onClose, onChanged,
}: {
  user: SystemUser | null;
  onClose: () => void;
  onChanged: (u: SystemUser) => void;
}) {
  const { role } = useAuth();
  const toast = useToast();
  const [pendingRole, setPendingRole] = useState<AdminRole | null>(null);
  const [busy, setBusy] = useState(false);

  const me = role ? ADMIN_USERS[role].name : "";
  const isSelf = !!user && role && ADMIN_USERS[role].email === user.email;
  const selectedRole = pendingRole ?? user?.role ?? "bd_officer";

  const saveRole = async () => {
    if (!user || !pendingRole || pendingRole === user.role) return;
    setBusy(true);
    try {
      const updated = await updateSystemUserRole(user.id, pendingRole, me);
      onChanged({ ...updated });
      toast.push(`${updated.name} is now ${ROLE_LABELS[updated.role]}`, "success");
      setPendingRole(null);
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not change the role", "error");
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async () => {
    if (!user) return;
    const next = user.status === "suspended" ? "active" : "suspended";
    setBusy(true);
    try {
      const updated = await setSystemUserStatus(user.id, next, me);
      onChanged({ ...updated });
      toast.push(next === "suspended" ? `${updated.name} suspended` : `${updated.name} reactivated`, next === "suspended" ? "warning" : "success");
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not update the status", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!user} onClose={() => !busy && onClose()} title={user?.name ?? ""} size="md">
      {user && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-text-soft">{user.email}</div>
              <div className="text-xs text-text-faint mt-0.5">
                {user.lastLogin ? `Last signed in ${formatDateTime(user.lastLogin)}` : "Hasn't signed in yet"}
              </div>
            </div>
            <Badge tone={STATUS_TONE[user.status]}>{user.status}</Badge>
          </div>

          <Field label="Role" hint="Access changes take effect on their next sign-in.">
            <div className="flex gap-2">
              <Dropdown
                value={selectedRole}
                onChange={(v) => setPendingRole(v as AdminRole)}
                options={ALL_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
                disabled={busy || !!isSelf}
                ariaLabel="Role"
                className="flex-1"
              />
              <Button variant="outline" disabled={busy || !pendingRole || pendingRole === user.role} onClick={saveRole}>
                Save
              </Button>
            </div>
          </Field>

          {isSelf && (
            <Card className="p-3.5 bg-warning-bg border-none flex gap-2.5">
              <ShieldAlert size={16} className="text-warning shrink-0 mt-0.5" />
              <div className="text-xs text-text">
                This is your own account — you can't change your own role or suspend yourself. Ask another System Admin.
              </div>
            </Card>
          )}

          <div className="flex justify-between items-center pt-1">
            <Button
              variant={user.status === "suspended" ? "outline" : "danger"}
              size="sm"
              disabled={busy || !!isSelf}
              onClick={toggleStatus}
            >
              {user.status === "suspended" ? "Reactivate account" : "Suspend account"}
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={onClose}>Close</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function PermissionMatrix({ me, canEdit }: { me: string; canEdit: boolean }) {
  const { data, loading, setData } = useAsyncData(getRolePermissionMatrix);
  const toast = useToast();
  const [busyCell, setBusyCell] = useState<string | null>(null);

  const pages = useMemo(() => NAV_DEFS.map((n) => ({ path: n.to, label: n.label, section: n.section })), []);

  const toggle = async (role: AdminRole, path: string, granted: boolean) => {
    const cell = `${role}:${path}`;
    setBusyCell(cell);
    try {
      const updated = await setRolePageAccess(role, path, granted, me);
      setData({ roles: [...updated.roles], access: { ...updated.access } });
      toast.push(`${ROLE_LABELS[role]} ${granted ? "granted" : "revoked"}: ${path}`, granted ? "success" : "info");
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not update access", "error");
    } finally {
      setBusyCell(null);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm min-w-[720px]">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-text-faint">Page</th>
            {data.roles.map((r) => (
              <th key={r} className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-text-faint whitespace-nowrap">
                {ROLE_LABELS[r]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {pages.map((p) => (
            <tr key={p.path}>
              <td className="px-5 py-2.5">
                <span className="text-text font-medium">{p.label}</span>
                {p.section && <span className="text-[11px] text-text-faint ml-2">{p.section}</span>}
              </td>
              {data.roles.map((r) => {
                const has = data.access[r].includes(p.path);
                const cell = `${r}:${p.path}`;
                const locked = p.path === "/" || (r === "system_admin" && (p.path === "/users" || p.path === "/audit-log"));
                return (
                  <td key={r} className="px-3 py-2.5 text-center">
                    <button
                      type="button"
                      disabled={!canEdit || locked || busyCell === cell}
                      onClick={() => toggle(r, p.path, !has)}
                      aria-label={`${ROLE_LABELS[r]} access to ${p.label}: ${has ? "granted" : "not granted"}`}
                      title={locked ? "Locked — always accessible" : canEdit ? "Click to toggle" : undefined}
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${
                        has ? "bg-success-bg text-success" : "text-border-strong hover:text-text-faint"
                      } ${canEdit && !locked ? "cursor-pointer" : "cursor-default"} ${busyCell === cell ? "opacity-40" : ""}`}
                    >
                      {has ? <Check size={12} strokeWidth={3} /> : <span className="select-none leading-none">—</span>}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-5 py-3 border-t border-border text-xs text-text-faint">
        The router enforces this matrix live — a role not ticked for a page can't reach it by direct URL either.
        {canEdit
          ? " Click a cell to grant or revoke; every change is audit-logged. Dashboard is always accessible, and System Admin can't lose Users & roles or the Audit log."
          : " Only a System Admin can edit the matrix."}
      </div>
    </Card>
  );
}

function DepartmentsTab({ users, departments, loading }: { users: SystemUser[]; departments: Department[] | null; loading: boolean }) {
  if (loading || !departments) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {departments.map((d) => {
        const members = users.filter((u) => d.roles.includes(u.role));
        return (
          <Card key={d.id} className="p-5">
            <div className="flex items-start gap-3">
              <span className="h-9 w-9 rounded-lg bg-primary-50 text-primary-600 ring-1 ring-primary-500/20 flex items-center justify-center shrink-0">
                <Building2 size={17} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-text">{d.name}</h2>
                  <Badge tone="neutral">{members.length} {members.length === 1 ? "member" : "members"}</Badge>
                </div>
                <p className="text-xs text-text-soft mt-1">{d.description}</p>
                <p className="text-[11px] text-text-faint mt-2">Head: {d.head}</p>
                <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                  {d.roles.map((r) => <Badge key={r} tone="info">{ROLE_LABELS[r]}</Badge>)}
                  {members.map((m) => <Badge key={m.id} tone="neutral">{m.name}</Badge>)}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export default function UsersAdmin() {
  const { role } = useAuth();
  const { data: users, loading, error, reload, setData } = useAsyncData(getSystemUsers);
  const { data: departments, loading: departmentsLoading } = useAsyncData(getDepartments);
  const [tab, setTab] = useState<"users" | "departments" | "matrix">("users");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [active, setActive] = useState<SystemUser | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const me = role ? ADMIN_USERS[role].name : "";
  const canEditMatrix = role === "system_admin";

  const upsert = (u: SystemUser) => {
    setData((prev) => {
      if (!prev) return prev;
      const exists = prev.some((x) => x.id === u.id);
      return exists ? prev.map((x) => (x.id === u.id ? u : x)) : [...prev, u];
    });
    setActive((prev) => (prev && prev.id === u.id ? u : prev));
  };

  const allUsers = users ?? [];
  const filteredUsers = allUsers.filter((u) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (statusFilter !== "all" && u.status !== statusFilter) return false;
    const q = query.trim().toLowerCase();
    return !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const columns: Column<SystemUser>[] = [
    { key: "name", header: "Name", render: (r) => <span className="text-text font-medium">{r.name}</span> },
    { key: "email", header: "Email", render: (r) => r.email, hideOnMobile: true },
    { key: "role", header: "Role", render: (r) => <Badge tone="info">{ROLE_LABELS[r.role]}</Badge> },
    { key: "department", header: "Department", render: (r) => <span className="text-text-soft text-sm">{departmentForRole(departments ?? [], r.role)?.name ?? "—"}</span>, hideOnMobile: true },
    { key: "status", header: "Status", render: (r) => <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge> },
    { key: "lastLogin", header: "Last login", render: (r) => (r.lastLogin ? formatDateTime(r.lastLogin) : <span className="text-text-faint">—</span>), hideOnMobile: true },
  ];

  return (
    <div>
      <PageHeader
        title="Users & roles"
        subtitle="Each role and the access its SOP responsibilities call for. Page access is not enforced in this console yet: anyone signed in can open every page, and the services' own roles decide what each action may do."
        actions={
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus size={14} />
            Invite user
          </Button>
        }
      />

      <Tabs
        tabs={[
          { key: "users", label: "Users", count: users?.length ?? 0 },
          { key: "departments", label: "Departments" },
          { key: "matrix", label: "Permission matrix" },
        ]}
        active={tab}
        onChange={(k) => setTab(k as typeof tab)}
        className="mb-4"
      />

      {tab === "users" && (
        <>
          {error && (
            <Card className="p-5 mb-6 flex items-center justify-between">
              <span className="text-sm text-danger">{error}</span>
              <Button size="sm" variant="outline" onClick={reload}>Retry</Button>
            </Card>
          )}
          <FilterBar>
            <SearchInput value={query} onChange={setQuery} placeholder="Search name or email…" />
            <SelectFilter value={roleFilter} onChange={setRoleFilter} options={ALL_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} allLabel="All roles" />
            <SelectFilter
              value={statusFilter}
              onChange={setStatusFilter}
              options={(Object.keys(STATUS_TONE) as SystemUser["status"][]).map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))}
              allLabel="All statuses"
            />
            <span className="text-xs text-text-faint ml-auto">{filteredUsers.length} of {allUsers.length} users</span>
          </FilterBar>
          {loading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <DataTable columns={columns} rows={filteredUsers} onRowClick={setActive} columnPicker emptyLabel={allUsers.length === 0 ? "No users yet" : "No users match"} />
          )}
        </>
      )}

      {tab === "departments" && <DepartmentsTab users={users ?? []} departments={departments} loading={departmentsLoading} />}

      {tab === "matrix" && <PermissionMatrix me={me} canEdit={canEditMatrix} />}

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} onInvited={upsert} />
      {/* Keyed by user so per-user state (pending role selection) never leaks across rows. */}
      <UserDetailModal key={active?.id ?? "none"} user={active} onClose={() => setActive(null)} onChanged={upsert} />
    </div>
  );
}
