import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { login } from "../api/client";
import { validateLogin } from "../utils/validation";
import { Toast } from "../components/Toast";
import { Page } from "../components/primitives/Page";
import { Card } from "../components/primitives/Card";
import { FormField } from "../components/primitives/FormField";
import { Button } from "../components/primitives/Button";
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
        setToast({ msg: resp.error || "Login failed", type: "error" });
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
      setToast({ msg: err?.error?.message || "Login failed", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ 
      minHeight: "100vh", 
      background: "var(--color-bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "var(--space-4)",
    }}>
      <div style={{ width: "100%", maxWidth: "420px" }}>
        {/* Logo / Brand */}
        <div style={{ textAlign: "center", marginBottom: "var(--space-8)" }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: "var(--radius-lg)",
            background: "var(--color-primary)",
            color: "var(--color-text-on-primary)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "var(--font-weight-bold)",
            fontSize: "var(--font-h4)",
            marginBottom: "var(--space-4)",
          }}>
            {branding.appName.slice(0, 2).toUpperCase()}
          </div>
          <h1 style={{
            fontSize: "var(--font-h2)",
            fontWeight: "var(--font-weight-bold)",
            color: "var(--color-text-primary)",
            margin: "0 0 var(--space-1) 0",
          }}>
            Welcome back
          </h1>
          <p style={{
            fontSize: "var(--font-body-md)",
            color: "var(--color-text-secondary)",
            margin: 0,
          }}>
            Sign in to {branding.appName}
          </p>
        </div>

        <Card>
          {offline && (
            <div style={{ 
              padding: "var(--space-3)", 
              background: "var(--color-warning-soft)", 
              borderRadius: "var(--radius-md)",
              color: "var(--color-warning)",
              fontSize: "var(--font-body-sm)",
              marginBottom: "var(--space-4)",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
              </svg>
              You're offline
            </div>
          )}
          
          <form onSubmit={onSubmit}>
            <FormField label="Email" error={errors.email} required>
              <input 
                name="email" 
                type="email"
                className={`pr-input ${errors.email ? "pr-input--error" : ""}`}
                value={form.email} 
                onChange={onChange} 
                disabled={submitting || offline}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </FormField>
            
            <FormField label="Password" error={errors.password} required>
              <input 
                name="password" 
                type="password" 
                className={`pr-input ${errors.password ? "pr-input--error" : ""}`}
                value={form.password} 
                onChange={onChange} 
                disabled={submitting || offline}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </FormField>
            
            <FormField label="MFA code" hint="Enter if prompted">
              <input 
                name="mfa_code" 
                className="pr-input" 
                value={form.mfa_code} 
                onChange={onChange} 
                disabled={submitting || offline}
                placeholder="123456"
                autoComplete="one-time-code"
              />
            </FormField>
            
            <Button 
              type="submit" 
              disabled={submitting || offline} 
              loading={submitting}
              fullWidth
              size="lg"
            >
              Sign in
            </Button>
            
            <div style={{ 
              marginTop: "var(--space-4)", 
              textAlign: "center",
              fontSize: "var(--font-body-sm)",
              color: "var(--color-text-secondary)",
            }}>
              Don't have an account?{" "}
              <Link 
                to="/register"
                style={{ 
                  color: "var(--color-primary)", 
                  fontWeight: "var(--font-weight-medium)",
                }}
              >
                Register
              </Link>
            </div>
          </form>
        </Card>
      </div>
      
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};
