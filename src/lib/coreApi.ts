/* Client for CORE API (apps/core-api) — the reference integration: bo-admin's
 * auth/RBAC is the first surface wired to a real backend instead of
 * the local mock layer (src/mock). Business-domain pages (clients, NAV, ledger, ...) still run
 * on src/mock — only login/session/route-access come from here. See
 * apps/core-api/README.md for the service this talks to.
 *
 * Session is an httpOnly cookie CORE sets — there is no token to read or
 * store client-side, so every call goes with credentials: "include" and
 * `me()` is the only way to learn who (if anyone) is signed in. */

const CORE_API_BASE = import.meta.env.VITE_CORE_API_BASE ?? "http://localhost:8090";

export class CoreApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "CoreApiError";
    this.status = status;
    this.code = code;
  }

  get isUnauthenticated() {
    return this.status === 401;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${CORE_API_BASE}${path}`, {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new CoreApiError(0, `Cannot reach CORE API at ${CORE_API_BASE}. Is it running?`);
  }

  const text = await res.text();
  const body: unknown = text ? safeJson(text) : null;

  if (!res.ok) {
    const env = (body ?? {}) as { error?: string; code?: string };
    throw new CoreApiError(res.status, env.error ?? res.statusText, env.code);
  }
  return body as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export type StaffProfile = {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  /** Routes this role's `read` permissions back — what canAccess(path) needs. */
  routes: string[];
};

export const coreApi = {
  login: (email: string, password: string) =>
    request<{ staff: StaffProfile }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  me: () => request<{ staff: StaffProfile }>("/api/auth/me"),
};
