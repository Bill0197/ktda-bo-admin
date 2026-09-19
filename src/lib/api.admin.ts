/* Users & roles / RBAC, platform settings, feature flags, audit log,
 * approvals queue, system (integrations/jobs/maintenance), reports. Owned by
 * the Admin/Platform-domain wiring pass — edit only this file for that
 * domain. See apiClient.ts / api.ts.
 *
 * CORE API's admin endpoints are JdbcTemplate `SELECT *` results —
 * Map<String,Object> rows keyed by the raw snake_case column name, not the
 * camelCase shape src/mock/api.ts returns. Every function below
 * fetches the raw row(s) and maps them into exactly the shape the page
 * already renders, so pages need only the import-source split, not a
 * render-code change. See the final wiring report for the handful of
 * fields CORE genuinely can't supply yet (e.g. a display name instead of a
 * raw staff UUID on audit/feature-flag/setting "updated by") — those are
 * flagged, not silently invented. */
import { get, post } from "./apiClient";
import type {
  AdminRole, ApprovalItem, ApprovalKind, ApprovalStatus, SystemUser,
  PlatformSetting, PlatformSettingSection, FeatureFlag, FlagPlatform,
  ReportDef, ReportCategory, ReportColumn, AuditEvent, AuditCategory,
  Integration, SystemJob, MaintenanceTarget, Department,
} from "../mock";

// ---- Approvals ----

function mapApproval(row: Record<string, unknown>): ApprovalItem {
  return {
    id: row.id as string,
    kind: row.kind as ApprovalKind,
    title: row.title as string,
    detail: row.detail as string,
    amount: row.amount == null ? undefined : Number(row.amount),
    currency: (row.currency as ApprovalItem["currency"] | null) ?? undefined,
    proposedBy: row.proposed_by_name as string,
    proposedAt: row.proposed_at as string,
    status: row.status as ApprovalStatus,
    decidedBy: (row.decided_by_name as string | null) ?? undefined,
    decidedAt: (row.decided_at as string | null) ?? undefined,
    entityRef: row.entity_type && row.entity_id
      ? { entityType: row.entity_type as string, entityId: row.entity_id as string }
      : undefined,
  };
}

export async function getApprovalQueue(status?: string, kind?: string): Promise<ApprovalItem[]> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (kind) params.set("kind", kind);
  const qs = params.toString();
  const rows = await get<Record<string, unknown>[]>(`/api/approvals${qs ? `?${qs}` : ""}`);
  return rows.map(mapApproval);
}

/** The decision endpoint returns the raw `approvals` row (proposed_by/
 * decided_by as UUIDs, no name join) — refetch the (joined) list so the item
 * handed back to the page keeps showing names, same shape as everywhere
 * else in the queue. `_actor` is accepted for call-site parity with the mock
 * signature; CORE derives the decider from the session, not the body. */
export async function decideApproval(id: string, decision: "approved" | "rejected", _actor?: string): Promise<ApprovalItem> {
  await post(`/api/approvals/${id}/decision`, { decision });
  const items = await getApprovalQueue();
  const item = items.find((i) => i.id === id);
  if (!item) throw new Error("Approval not found after decision");
  return item;
}

// ---- System users (Users & roles) ----

function mapSystemUser(row: Record<string, unknown>): SystemUser {
  return {
    id: String(row.id),
    name: row.name as string,
    email: row.email as string,
    role: row.role as AdminRole,
    status: row.status as SystemUser["status"],
    lastLogin: (row.last_login_at as string | null) ?? "",
  };
}

export async function getSystemUsers(): Promise<SystemUser[]> {
  const rows = await get<Record<string, unknown>[]>("/api/users");
  return rows.map(mapSystemUser);
}

/** Name+role-only directory, open to every role (not gated on users:read) —
 * for an "assign to" picker, where the full getSystemUsers() 403s for every
 * role but system_admin. Deliberately excludes email/status/lastLogin. */
export async function getStaffDirectory(): Promise<{ id: string; name: string; role: AdminRole }[]> {
  const rows = await get<Record<string, unknown>[]>("/api/users/directory");
  return rows.map((r) => ({ id: String(r.id), name: r.name as string, role: r.role as AdminRole }));
}

/** POST /api/users returns {id, name, email, role, tempPassword} — no
 * `status` (StaffAdminService creates the account already active; there's no
 * email infra yet to support an "invited" holding state). Refetch the list
 * so the page gets a fully-shaped SystemUser back rather than a guess. */
export async function inviteSystemUser(input: { name: string; email: string; role: AdminRole }, _invitedBy?: string): Promise<SystemUser> {
  const created = await post<{ id: string }>("/api/users", input);
  const users = await getSystemUsers();
  const user = users.find((u) => u.id === created.id);
  if (!user) throw new Error("Invited user not found after creation");
  return user;
}

/** setStatus/changeRole return no body — refetch and pick the row, same
 * reasoning as decideApproval. */
export async function setSystemUserStatus(id: string, status: "active" | "suspended", _actor?: string): Promise<SystemUser> {
  await post(`/api/users/${id}/status`, { status });
  const users = await getSystemUsers();
  const user = users.find((u) => u.id === id);
  if (!user) throw new Error("User not found after status change");
  return user;
}

export async function updateSystemUserRole(id: string, role: AdminRole, _actor?: string): Promise<SystemUser> {
  await post(`/api/users/${id}/role`, { role });
  const users = await getSystemUsers();
  const user = users.find((u) => u.id === id);
  if (!user) throw new Error("User not found after role change");
  return user;
}

// ---- Departments ----

/** Ported from the mock's `getDepartments()`/`departmentForRole()` — real
 * `GET /api/departments` (`DepartmentsController`) returns each department's
 * head and member role keys already joined server-side. `role_keys` lines up
 * 1:1 with `AdminRole` values (roles.key IS the admin role key), same as the
 * mock fixture's `roles: AdminRole[]`. */
function mapDepartment(row: Record<string, unknown>): Department {
  return {
    id: row.key as string,
    name: row.name as string,
    head: (row.head_name as string | null) ?? "Unassigned",
    description: row.description as string,
    roles: ((row.role_keys as string[] | null) ?? []) as AdminRole[],
  };
}

export async function getDepartments(): Promise<Department[]> {
  const rows = await get<Record<string, unknown>[]>("/api/departments");
  return rows.map(mapDepartment);
}

/** `departmentForRole` was a synchronous fixture lookup in the mock; CORE
 * only exposes departments over HTTP, so this now takes the already-fetched
 * list rather than reaching into a module-level array — callers fetch once
 * (e.g. via `useAsyncData(getDepartments)`) and pass the result down. */
export function departmentForRole(departments: Department[], role: AdminRole): Department | undefined {
  return departments.find((d) => d.roles.includes(role));
}

// ---- RBAC / permission matrix ----

type AccessControlMatrixResponse = {
  departments: { key: string; name: string; description: string; roleKeys: string[] }[];
  roles: { key: string; label: string; departmentKey: string | null }[];
  permissions: { key: string; resource: string; action: string; label: string; group: string; route: string | null; surface: string | null; undroppable: boolean }[];
  grants: { roleKey: string; permissionKey: string; granted: boolean }[];
};

type AccessMatrix = { roles: AdminRole[]; access: Record<AdminRole, string[]> };

/** CORE's /matrix is a normalized {departments, roles, permissions, grants}
 * shape (permission-level, not page-level) — reshaped here into the mock's
 * {roles, access: role -> path[]} the page already renders, using each
 * permission's `route` to recover the page path a grant maps to. */
function toAccessMatrix(matrix: AccessControlMatrixResponse): AccessMatrix {
  const routeByPermission = new Map(
    matrix.permissions.filter((p) => p.route).map((p) => [p.key, p.route as string]),
  );
  const roles = matrix.roles.map((r) => r.key as AdminRole);
  const access = {} as Record<AdminRole, string[]>;
  for (const role of roles) access[role] = [];
  for (const grant of matrix.grants) {
    if (!grant.granted) continue;
    const route = routeByPermission.get(grant.permissionKey);
    if (!route) continue;
    const role = grant.roleKey as AdminRole;
    if (access[role]) access[role].push(route);
  }
  return { roles, access };
}

export async function getRolePermissionMatrix(): Promise<AccessMatrix> {
  const matrix = await get<AccessControlMatrixResponse>("/api/access-control/matrix");
  return toAccessMatrix(matrix);
}

/** POST /page-access returns only {roleKey, path, granted} (the single
 * toggled cell), not the whole matrix — refetch so the page's
 * `setData({...updated.roles, ...updated.access})` keeps working unchanged. */
export async function setRolePageAccess(role: AdminRole, path: string, granted: boolean, _actor?: string): Promise<AccessMatrix> {
  await post("/api/access-control/page-access", { role, path, granted });
  return getRolePermissionMatrix();
}

// ---- Platform settings ----

function mapPlatformSetting(row: Record<string, unknown>): PlatformSetting {
  return {
    key: row.key as string,
    section: row.section as PlatformSettingSection,
    label: row.label as string,
    description: row.description as string,
    value: row.value as string,
    unit: (row.unit as string | null) ?? undefined,
    // PlatformSettingsService#list/#propose joins pending_changes.after_value
    // for any setting with a still-open proposal — real "pending: X" badge.
    pendingValue: (row.pending_value as string | null) ?? undefined,
    pendingApprovalId: (row.pending_approval_id as string | null) ?? undefined,
    updatedAt: row.updated_at as string,
    // updated_by_name: real join onto staff_users — falls back to the raw
    // UUID only for a row nothing has ever updated via this path yet.
    updatedBy: (row.updated_by_name as string | null) ?? (row.updated_by as string | null) ?? "",
  };
}

export async function getPlatformSettings(): Promise<PlatformSetting[]> {
  const rows = await get<Record<string, unknown>[]>("/api/settings");
  return rows.map(mapPlatformSetting);
}

export async function proposeSettingChange(key: string, newValue: string, _proposedBy: string, reason: string): Promise<PlatformSetting> {
  const row = await post<Record<string, unknown>>(`/api/settings/${key}/propose`, { value: newValue, reason });
  return mapPlatformSetting(row);
}

// ---- Feature flags ----

function mapFeatureFlag(row: Record<string, unknown>): FeatureFlag {
  return {
    key: row.key as string,
    platform: row.platform as FlagPlatform,
    label: row.label as string,
    description: row.description as string,
    enabled: row.enabled as boolean,
    stage: row.stage as FeatureFlag["stage"],
    updatedAt: row.updated_at as string,
    // updated_by_name: real join onto staff_users, same as Platform Settings.
    updatedBy: (row.updated_by_name as string | null) ?? (row.updated_by as string | null) ?? "",
  };
}

export async function getFeatureFlags(): Promise<FeatureFlag[]> {
  const rows = await get<Record<string, unknown>[]>("/api/feature-flags");
  return rows.map(mapFeatureFlag);
}

export async function setFeatureFlag(key: string, enabled: boolean, _actor?: string): Promise<FeatureFlag> {
  const row = await post<Record<string, unknown>>(`/api/feature-flags/${key}`, { enabled });
  return mapFeatureFlag(row);
}

// ---- Audit log ----

function mapAuditEvent(row: Record<string, unknown>): AuditEvent {
  return {
    id: String(row.seq),
    at: row.at as string,
    // actor_name: real join onto staff_users by actor_id — falls back to the
    // raw actor_id only for a row whose actor isn't a resolvable staff UUID
    // (actor_id is `text`, not an FK, so an audit row can outlive the staff
    // account, or record a system/service actor that was never a staff row).
    actor: (row.actor_name as string | null) ?? (row.actor_id as string),
    actorRole: row.actor_role as string,
    category: row.category as AuditCategory,
    action: row.action as string,
    target: row.target as string,
    detail: (row.detail as string | null) ?? undefined,
    entityType: (row.entity_type as AuditEvent["entityType"] | null) ?? undefined,
    entityId: (row.entity_id as string | null) ?? undefined,
    hash: row.hash as string,
    prevHash: row.prev_hash as string,
  };
}

export async function getAuditLog(limit = 500): Promise<AuditEvent[]> {
  const rows = await get<Record<string, unknown>[]>(`/api/audit-log?limit=${limit}`);
  return rows.map(mapAuditEvent);
}

/** Real hash-chain walk over audit_events (AuditService#verifyChain), not
 * the mock's client-side recompute over the fixture array. `brokenAtId` here
 * is a `seq` value (stringified), same field name and shape the page already
 * reads from the mock's `verifyAuditChainSync()`. `reason` is additional —
 * the mock never explained a break, CORE does. */
export async function verifyAuditChain(): Promise<{ intact: boolean; length: number; brokenAtId?: string; reason?: string }> {
  return get<{ intact: boolean; length: number; brokenAtId?: string; reason?: string }>("/api/audit-log/verify");
}

// ---- System: integrations, jobs, maintenance ----

function mapIntegration(row: Record<string, unknown>): Integration {
  return {
    id: row.id as string,
    name: row.name as string,
    purpose: row.purpose as string,
    environment: row.environment as Integration["environment"],
    health: row.health as Integration["health"],
    lastCheckedAt: row.last_checked_at as string,
    note: (row.note as string | null) ?? undefined,
  };
}

export async function getIntegrations(): Promise<Integration[]> {
  const rows = await get<Record<string, unknown>[]>("/api/integrations");
  return rows.map(mapIntegration);
}

export async function setIntegrationEnvironment(id: string, environment: Integration["environment"], _actor?: string): Promise<Integration> {
  const row = await post<Record<string, unknown>>(`/api/integrations/${id}/environment`, { environment });
  return mapIntegration(row);
}

function mapSystemJob(row: Record<string, unknown>): SystemJob {
  const lastRunAt = row.last_run_at as string | null;
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    schedule: row.schedule as string,
    enabled: row.enabled as boolean,
    lastRun: lastRunAt
      ? { at: lastRunAt, status: row.last_run_status as "success" | "failed", detail: (row.last_run_detail as string | null) ?? undefined }
      : undefined,
  };
}

export async function getSystemJobs(): Promise<SystemJob[]> {
  const rows = await get<Record<string, unknown>[]>("/api/system-jobs");
  return rows.map(mapSystemJob);
}

export async function setSystemJobEnabled(id: string, enabled: boolean, _actor?: string): Promise<SystemJob> {
  const row = await post<Record<string, unknown>>(`/api/system-jobs/${id}/enabled`, { enabled });
  return mapSystemJob(row);
}

export async function runSystemJob(id: string, _actor?: string): Promise<SystemJob> {
  const row = await post<Record<string, unknown>>(`/api/system-jobs/${id}/run`);
  return mapSystemJob(row);
}

function mapMaintenanceTarget(row: Record<string, unknown>): MaintenanceTarget {
  return {
    id: row.id as string,
    app: row.app as string,
    maintenance: row.maintenance as boolean,
    note: (row.note as string | null) ?? undefined,
  };
}

export async function getMaintenanceTargets(): Promise<MaintenanceTarget[]> {
  const rows = await get<Record<string, unknown>[]>("/api/maintenance-targets");
  return rows.map(mapMaintenanceTarget);
}

export async function setMaintenanceMode(id: string, maintenance: boolean, _actor?: string): Promise<MaintenanceTarget> {
  const row = await post<Record<string, unknown>>(`/api/maintenance-targets/${id}`, { maintenance });
  return mapMaintenanceTarget(row);
}

// ---- Reports ----

function mapReport(row: Record<string, unknown>): ReportDef {
  const lastRunAt = row.last_run_at as string | null;
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as ReportCategory,
    description: row.description as string,
    frequency: row.frequency as ReportDef["frequency"],
    format: row.format as ReportDef["format"],
    restrictedTo: (row.restricted_to as string[]).map((r) => r as AdminRole),
    columns: row.columns as ReportColumn[],
    lastRun: lastRunAt
      ? {
          at: lastRunAt,
          by: row.last_run_by as string,
          sizeKb: row.last_run_size_kb as number,
          columnCount: (row.last_run_column_count as number | null) ?? undefined,
        }
      : undefined,
  };
}

/** CORE derives the role-based filter from the session (`reports:read` +
 * `restricted_to @> {role}`), not a query param — `_role` is kept so the
 * call site (`getReports(role)`) needs no change. */
export async function getReports(_role: AdminRole): Promise<ReportDef[]> {
  const rows = await get<Record<string, unknown>[]>("/api/reports");
  return rows.map(mapReport);
}

export async function generateReport(id: string, _actor: string, columnKeys?: string[]): Promise<ReportDef> {
  const row = await post<Record<string, unknown>>(`/api/reports/${id}/generate`, { columnKeys });
  return mapReport(row);
}
