import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ADMIN_USERS, ROLE_LABELS, type AdminRole } from "../mock";
import { coreApi, CoreApiError, type StaffProfile } from "./coreApi";

/** Real auth against CORE API (apps/core-api) — the reference integration.
 * `role`/`canAccess` keep their exact prior shape (every existing page
 * destructures one of `role`, `login`, `logout`, `canAccess`) so this is a
 * backend swap, not a page-by-page rewrite: only the demo role-picker
 * (Login.tsx) and this file changed shape. `ROLE_LABELS` stays sourced from
 * `src/mock` — it's static display copy, not something worth a round trip. */
type AuthState = {
  role: AdminRole | null;
  /** True until the initial /me check resolves — see ProtectedRoute, which
   * must not flash the login screen at someone already signed in. */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  canAccess: (path: string) => boolean;
  /** Whether this user holds a permission key, e.g. "tok_products:write".
   * For hiding actions only: CORE checks the same permission on the request. */
  can: (permission: string) => boolean;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<StaffProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // The session lives in an httpOnly cookie CORE set — GET /auth/me on
  // mount is the only way to learn whether this tab is already signed in.
  useEffect(() => {
    let cancelled = false;
    coreApi
      .me()
      .then(({ staff }) => {
        if (!cancelled) setStaff(staff);
      })
      .catch((err) => {
        if (!cancelled && !(err instanceof CoreApiError && err.isUnauthenticated)) {
          console.error("core-api /me failed", err);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const { staff } = await coreApi.login(email, password);
    setStaff(staff);
  };

  const logout = async () => {
    try {
      await coreApi.logout();
    } finally {
      // Clear local state even if the network call failed — the caller
      // still asked to sign out, and leaving the console looking signed in
      // would be worse than a wasted request.
      setStaff(null);
    }
  };

  const canAccess = (path: string) => {
    if (!staff) return false;
    const allowed = staff.routes;
    // Exact page match, or a nested route under a granted page ("/clients/123"
    // under "/clients"). Segment-aware on purpose: "/clients" must not grant a
    // future sibling like "/clients-export".
    return allowed.includes(path) || allowed.some((p) => p !== "/" && path.startsWith(`${p}/`));
  };

  const can = (permission: string) => staff?.permissions.includes(permission) ?? false;

  const role = (staff?.role as AdminRole | undefined) ?? null;

  return (
    <Ctx.Provider value={{ role, isLoading, login, logout, canAccess, can }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// ADMIN_USERS is still the role -> {name, initials} demo directory (used
// across ~25 pages purely as "whose name to show for this role" cosmetic
// copy). It's now decorative rather than authoritative: the REAL signed-in
// identity is `staff` above (email/name from CORE API). Rewiring every "me ="
// display line to the real name is out of scope for this integration pass —
// tracked as a follow-up, not silently different behavior.
export { ADMIN_USERS, ROLE_LABELS };
export type { AdminRole };
