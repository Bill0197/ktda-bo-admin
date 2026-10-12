import { useState } from "react";
import { Button, Field, GlassPanel, Input, Modal, NotePanel, PageHeader, useToast } from "../../ui";
import { tokenConsole } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useAsyncData } from "../../lib/useAsyncData";
import { dateTime } from "../../lib/tokenConsole/format";
import { useAction } from "../../lib/tokenConsole/useAction";
import type { ActiveSessionResponse, AdminUserResponse, LoginAuditResponse } from "../../lib/tokenConsole/types.gen";
import { Code, ConsoleTable, StatusBadge } from "../../components/tokenconsole/ConsoleTable";
import { ActionModal } from "../../components/tokenconsole/ActionModal";

type UserAction = "approve" | "reject" | "enable" | "disable";

/* The tokenization service's own accounts — the accounts people sign in to
   BO Admin with. Ported from tokenization-web's Administration page.
   BO Admin's "Users & roles" page is a separate, demo-data surface. */
const CONFIRM: Record<"reject" | "disable", { title: string; body: (who: string) => string; button: string }> = {
  reject: { title: "Reject this signup?", body: (who) => `${who} will not be able to sign in.`, button: "Reject" },
  disable: {
    title: "Disable this account?",
    body: (who) => `${who} is signed out of BO Admin and cannot sign in again until the account is re-enabled.`,
    button: "Disable",
  },
};

export default function TokenConsoleUsers() {
  const { user } = useAuth();
  const toast = useToast();
  const users = useAsyncData(tokenConsole.adminUsers);
  const sessions = useAsyncData(tokenConsole.activeSessions);
  const audit = useAsyncData(() => tokenConsole.loginAudit(50));
  const config = useAsyncData(tokenConsole.adminConfig);
  const [editingLimit, setEditingLimit] = useState(false);
  const act = useAction(tokenConsole.userAction);
  const [confirming, setConfirming] = useState<{ user: AdminUserResponse; action: "reject" | "disable" } | null>(null);

  // The service enforces this; the check only decides what to render. A page
  // whose every request 403s is worse than saying so up front.
  if (user && !user.isTokAdmin) {
    return (
      <div>
        <PageHeader eyebrow="Baracel Unyt" title="Tokenization users" />
        <GlassPanel className="p-6">
          <p className="text-sm text-text">This page needs the ADMIN role on the tokenization service.</p>
          <p className="mt-1 text-[13px] text-text-soft">
            You are signed in as <span className="text-text">{user.email}</span>
            {user.tokRoles.length ? ` (${user.tokRoles.join(", ")})` : ""}.
          </p>
        </GlassPanel>
      </div>
    );
  }

  const run = async (u: AdminUserResponse, action: UserAction) => {
    if (!u.id) return;
    const done = await act.run(u.id, action);
    setConfirming(null);
    if (!done) return;
    toast.push(`${u.email ?? "Account"}: ${action === "approve" ? "approved" : action === "reject" ? "rejected" : action === "enable" ? "enabled" : "disabled"}.`);
    void users.reload();
    void sessions.reload();
  };

  const isSelf = (u: AdminUserResponse) => !!user && u.email?.toLowerCase() === user.email.toLowerCase();

  return (
    <div>
      <PageHeader eyebrow="Baracel Unyt" title="Tokenization users" subtitle="The accounts people sign in to BO Admin with: approvals, sessions and the sign-in audit trail." />

      {act.error && <NotePanel tone="danger" className="mb-4">{act.error}</NotePanel>}

      <GlassPanel className="mb-6 flex flex-wrap items-center justify-between gap-3 p-4" sheen={false}>
        <div>
          <div className="text-[13px] font-semibold text-text">Sessions per account</div>
          <p className="text-sm text-text-soft">
            {config.error ? config.error
              : config.data == null ? "Loading…"
              : !config.data.maxConcurrentSessions ? "Unlimited — an account can be signed in anywhere at once."
              : `${config.data.maxConcurrentSessions} at a time. Signing in beyond that signs the oldest session out — so a shared login signs its other users out.`}
          </p>
        </div>
        <Button size="sm" variant="outline" disabled={config.data == null} onClick={() => setEditingLimit(true)}>Change limit</Button>
      </GlassPanel>

      <ConsoleTable<AdminUserResponse>
        title="Accounts"
        description="New signups arrive here pending approval."
        what="accounts"
        source={users}
        rowId={(r) => r.id}
        emptyLabel="No accounts"
        columns={[
          { key: "name", header: "Name", render: (r) => <span className="font-medium text-text">{r.fullName ?? "—"}</span> },
          { key: "email", header: "Email", render: (r) => r.email ?? "—" },
          { key: "roles", header: "Roles", render: (r) => (r.roles ?? []).join(", ") || "—", hideOnMobile: true },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "created", header: "Created", render: (r) => <span className="tabular text-xs text-text-soft">{dateTime(r.createdAt)}</span>, hideOnMobile: true },
          { key: "actions", header: "", className: "text-right", render: (r) => {
            if (!r.id) return null;
            // Never offer a way to lock yourself, or the root account, out.
            if (isSelf(r) || r.root) return <span className="text-xs text-text-faint">{isSelf(r) ? "You" : "Root"}</span>;
            return (
              <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                {r.status === "PENDING" ? (
                  <>
                    <Button size="sm" disabled={act.pending} onClick={() => void run(r, "approve")}>Approve</Button>
                    <Button size="sm" variant="ghost" disabled={act.pending} onClick={() => setConfirming({ user: r, action: "reject" })}>Reject</Button>
                  </>
                ) : r.status === "DISABLED" ? (
                  <Button size="sm" variant="outline" disabled={act.pending} onClick={() => void run(r, "enable")}>Enable</Button>
                ) : r.status === "REJECTED" ? null : (
                  <Button size="sm" variant="ghost" disabled={act.pending} onClick={() => setConfirming({ user: r, action: "disable" })}>Disable</Button>
                )}
              </div>
            );
          } },
        ]}
      />

      <ConsoleTable<ActiveSessionResponse>
        title="Active sessions"
        what="active sessions"
        source={sessions}
        rowId={(r) => `${r.email ?? ""}-${r.lastRequest ?? ""}`}
        emptyLabel="No active sessions"
        columns={[
          { key: "email", header: "Account", render: (r) => r.email ?? "—" },
          { key: "count", header: "Sessions", className: "tabular text-right", render: (r) => r.sessionCount ?? 0 },
          { key: "last", header: "Last request", render: (r) => <span className="tabular text-xs text-text-soft">{dateTime(r.lastRequest)}</span> },
        ]}
      />

      <ConsoleTable<LoginAuditResponse>
        title="Sign-in audit"
        description="Who signed in, when, and from where — the latest 50."
        what="the sign-in audit"
        source={audit}
        rowId={(r) => r.id ?? `${r.email ?? ""}-${r.occurredAt ?? ""}`}
        emptyLabel="No sign-ins recorded"
        columns={[
          { key: "email", header: "Account", render: (r) => r.email ?? "—" },
          { key: "when", header: "When", render: (r) => <span className="tabular text-xs text-text-soft">{dateTime(r.occurredAt)}</span> },
          { key: "from", header: "From", render: (r) => <Code>{r.ipAddress ?? "—"}</Code>, hideOnMobile: true },
          { key: "event", header: "Event", render: (r) => <StatusBadge status={r.event} /> },
          { key: "detail", header: "Detail", render: (r) => r.detail ?? "—", hideOnMobile: true },
        ]}
      />

      {editingLimit && (
        <SessionLimitModal
          current={config.data?.maxConcurrentSessions ?? 0}
          onClose={() => setEditingLimit(false)}
          onDone={() => {
            setEditingLimit(false);
            toast.push("Session limit saved.");
            void config.reload();
          }}
        />
      )}
      {confirming && (
        <Modal
          open
          size="sm"
          onClose={() => (act.pending ? undefined : setConfirming(null))}
          title={CONFIRM[confirming.action].title}
          footer={
            <>
              <Button variant="ghost" size="sm" disabled={act.pending} onClick={() => setConfirming(null)}>Cancel</Button>
              <Button variant="danger" size="sm" disabled={act.pending} onClick={() => void run(confirming.user, confirming.action)}>
                {act.pending ? "Saving…" : CONFIRM[confirming.action].button}
              </Button>
            </>
          }
        >
          <p className="text-sm text-text-soft">{CONFIRM[confirming.action].body(confirming.user.email ?? "This account")}</p>
        </Modal>
      )}
    </div>
  );
}

function SessionLimitModal({ current, onClose, onDone }: { current: number; onClose: () => void; onDone: () => void }) {
  const save = useAction(tokenConsole.updateAdminConfig);
  const [value, setValue] = useState(String(current));
  const n = Number(value);
  const problem = value.trim() === "" || !Number.isInteger(n) || n < 0 ? "A whole number, 0 or more." : undefined;
  const submit = async () => {
    const r = await save.run({ maxConcurrentSessions: n });
    if (r) onDone();
  };
  return (
    <ActionModal
      title="Sessions per account"
      description="How many places one account can be signed in at once. It applies from each account's next sign-in."
      submitLabel="Save"
      problem={problem}
      pending={save.pending}
      error={save.error}
      onSubmit={() => void submit()}
      onClose={onClose}
      size="sm"
    >
      <Field label="Limit" hint="0 means unlimited.">
        <Input type="number" inputMode="numeric" min={0} step={1} value={value} onChange={(e) => setValue(e.target.value)} />
      </Field>
    </ActionModal>
  );
}
