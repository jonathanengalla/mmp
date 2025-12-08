import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { login } from "../api/client";
import { validateLogin } from "../utils/validation";
import { Toast } from "../components/Toast";
import { Card, Button, Input } from "../ui";
import { useSession } from "../hooks/useSession";
import { useBranding } from "../config/branding";

export const LoginPage: React.FC = () => {
  const [form, setForm] = useState({ email: "", password: "", mfa_code: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  const { authed, setSession } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const branding = useBranding();
  const redirect = new URLSearchParams(location.search).get("redirect") || "/profile";

  useEffect(() => {
    if (authed) {
      navigate(redirect, { replace: true });
    }
  }, [authed, navigate, redirect]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: "" });
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setToast(null);
    const v = validateLogin(form);
    setErrors(v);
    if (Object.keys(v).length) return;
    if (offline) {
      setToast({ msg: "Cannot login while offline", type: "error" });
      return;
    }
    try {
      setSubmitting(true);
      const resp = await login({ email: form.email, password: form.password, mfa_code: form.mfa_code || undefined });
      if (!resp.success) {
        const err = resp.error as any;
        let msg = "Sign in failed. Please check your email and password.";
        if (typeof err === "string" && err.trim().length > 0) {
          msg = err;
        } else if (err && typeof err === "object") {
          const message = typeof err.message === "string" ? err.message.trim() : "";
          const code = typeof err.code === "string" ? err.code.trim() : "";
          if (message) {
            msg = message;
          } else if (code) {
            msg = code === "invalid_credentials" ? "Invalid email or password. Please try again." : code;
          }
        }
        console.log("[login] failed", resp);
        setToast({ msg, type: "error" });
        return;
      }
      const access_token = resp.access_token || resp.token;
      if (access_token) {
        setSession({
          tokens: {
            access_token,
            refresh_token: resp.refresh_token || undefined,
            tenant_id: resp.tenant_id || "t1",
            member_id: resp.member_id,
          },
          user: resp.user || { email: form.email },
        });
      }
      navigate(redirect, { replace: true });
    } catch (err: any) {
      const fallback = typeof err?.message === "string" && err.message.trim().length > 0 ? err.message : "Login failed. Please try again.";
      console.error("[login] unexpected error", err);
      setToast({ msg: fallback, type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.12), transparent 36%), linear-gradient(135deg, var(--rcme-color-brand-primary), #4f8bff 46%, #a5c6ff)",
        display: "grid",
        placeItems: "center",
        padding: "var(--rcme-space-xl)",
        color: "#fff",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "var(--rcme-card-bg)",
          border: "1px solid var(--rcme-color-border-subtle)",
          borderRadius: "var(--rcme-radius-lg)",
          boxShadow: "var(--rcme-card-shadow)",
          padding: "var(--rcme-space-xxl)",
          color: "var(--rcme-color-text-primary)",
        }}
      >
        {/* Logo / Brand */}
        <div style={{ textAlign: "center", marginBottom: "var(--rcme-space-xl)" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "var(--rcme-radius-md)",
              background: "var(--rcme-color-brand-primary)",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: "var(--rcme-font-size-h3)",
              marginBottom: "var(--rcme-space-md)",
              boxShadow: "var(--rcme-shadow-sm)",
            }}
          >
            {branding.appName.slice(0, 2).toUpperCase()}
          </div>
          <h1
            style={{
              fontSize: "var(--rcme-font-size-h1)",
              fontWeight: 700,
              color: "var(--rcme-color-text-primary)",
              margin: "0 0 var(--rcme-space-xs) 0",
            }}
          >
            Welcome back
          </h1>
          <p
            style={{
              fontSize: "var(--rcme-font-size-body)",
              color: "var(--rcme-color-text-secondary)",
              margin: 0,
            }}
          >
            Sign in to {branding.appName}
          </p>
        </div>

        <Card elevation="md" padding="lg">
          {offline && (
            <div
              style={{
                padding: "var(--rcme-space-md)",
                background: "var(--rcme-color-state-warning)",
                borderRadius: "var(--rcme-radius-md)",
                color: "#111",
                fontSize: "var(--rcme-font-size-label)",
                marginBottom: "var(--rcme-space-lg)",
                display: "flex",
                alignItems: "center",
                gap: "var(--rcme-space-sm)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
              </svg>
              You're offline
            </div>
          )}
          
          <form onSubmit={onSubmit} style={{ display: "grid", gap: "var(--rcme-space-lg)" }}>
            <Input
              label="Email"
              name="email"
              type="email"
              value={form.email}
              onChange={onChange}
              disabled={submitting || offline}
              placeholder="you@example.com"
              autoComplete="email"
              error={errors.email}
            />

            <Input
              label="Password"
              name="password"
              type="password"
              value={form.password}
              onChange={onChange}
              disabled={submitting || offline}
              placeholder="••••••••"
              autoComplete="current-password"
              error={errors.password}
            />

            <Input
              label="MFA code"
              name="mfa_code"
              value={form.mfa_code}
              onChange={onChange}
              disabled={submitting || offline}
              placeholder="123456"
              autoComplete="one-time-code"
              hint="Enter if prompted"
            />

            <div style={{ display: "grid", gap: "var(--rcme-space-sm)" }}>
              <Button
                type="submit"
                disabled={submitting || offline}
                loading={submitting}
                fullWidth
                size="lg"
              >
                Sign in
              </Button>
              <Button type="button" variant="secondary" fullWidth>
                Continue with SSO
              </Button>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "var(--rcme-space-md)",
                fontSize: "var(--rcme-font-size-label)",
                color: "var(--rcme-color-text-secondary)",
              }}
            >
              <Link
                to="/forgot-password"
                style={{
                  color: "var(--rcme-color-brand-primary)",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Forgot password?
              </Link>
              <div>
                New here?{" "}
                <Link
                  to="/register"
                  style={{
                    color: "var(--rcme-color-brand-primary)",
                    fontWeight: 600,
                  }}
                >
                  Create account
                </Link>
              </div>
            </div>
          </form>
        </Card>
      </div>
      
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};
