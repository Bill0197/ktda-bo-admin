import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout, Button, Field, Input } from "../ui";
import { ShieldCheck, ClipboardCheck, Lock } from "lucide-react";
import { useAuth } from "../lib/auth";
import { CoreApiError } from "../lib/coreApi";

const BULLETS = [
  { label: "Page-level RBAC — not just hidden nav", icon: <Lock size={15} /> },
  { label: "Maker-checker on every payment release", icon: <ClipboardCheck size={15} /> },
  { label: "Every action auditable end to end", icon: <ShieldCheck size={15} /> },
];

/** Real sign-in against CORE API (apps/core-api) — no local account store, no
 * remembered token: the session is an httpOnly cookie the server sets, so
 * signing in is a round trip and nothing about it is knowable client-side
 * before that resolves. Replaces the former role-picker demo login. */
export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate("/");
    } catch (err) {
      setError(err instanceof CoreApiError ? err.message : "Could not reach CORE API.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Investcent Investment Bank"
      title="Bond Retail Fund — BO Admin"
      description="Run the fund's day-to-day operations: approvals, client onboarding, NAV publication, and liquidity monitoring — scoped precisely to what your role owns."
      bullets={BULLETS}
    >
      <div className="max-w-md w-full relative z-10">
        <h2 className="text-xl font-display font-semibold text-text mb-1.5">Sign in</h2>
        <p className="text-sm text-text-soft mb-6">
          Accounts are issued by an administrator. New sign-ups need approval before they can be used.
        </p>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field label="Email" required>
            <Input
              type="email"
              value={email}
              autoComplete="username"
              autoFocus
              required
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Password" required>
            <Input
              type="password"
              value={password}
              autoComplete="current-password"
              required
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" size="lg" disabled={isSubmitting} className="w-full justify-center mt-1">
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
