import { Suspense, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ShieldOff } from "lucide-react";
import { RouteLoader } from "../ui";
import { useAuth, ROLE_LABELS } from "./auth";
import { AdminLayout } from "../layout/AdminLayout";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { role, isLoading, canAccess } = useAuth();
  const location = useLocation();

  // The session is an httpOnly cookie; until GET /auth/me resolves we don't
  // yet know whether this tab is signed in. Rendering the login screen during
  // that window would flash it at someone who already has a valid session.
  if (isLoading) return <RouteLoader />;

  if (!role) return <Navigate to="/login" replace />;

  if (!canAccess(location.pathname)) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center text-center gap-3 py-24">
          <div className="h-12 w-12 rounded-full bg-danger-bg text-danger flex items-center justify-center"><ShieldOff size={22} /></div>
          <h1 className="text-lg font-semibold text-text">Access denied</h1>
          <p className="text-sm text-text-soft max-w-sm">
            {ROLE_LABELS[role]} doesn't have access to this page. This isn't just hidden navigation — the route itself
            refuses the request, matching the real API's RBAC enforcement.
          </p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Suspense fallback={<RouteLoader />}>{children}</Suspense>
    </AdminLayout>
  );
}
