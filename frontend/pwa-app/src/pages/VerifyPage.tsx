import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { verifyEmail, requestVerification } from "../api/client";
import { Card } from "../components/primitives/Card";
import { Button } from "../components/primitives/Button";
import { FormField } from "../components/primitives/FormField";
import { Toast } from "../components/Toast";
import { useBranding } from "../config/branding";

type VerifyState = "verifying" | "success" | "invalid" | "expired" | "resend";

export const VerifyPage: React.FC = () => {
  const [params] = useSearchParams();
  const branding = useBranding();
  const token = params.get("token");
  const [state, setState] = useState<VerifyState>(token ? "verifying" : "resend");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const doVerify = async () => {
      try {
        await verifyEmail(token);
        setState("success");
      } catch (err: unknown) {
        const error = err as { error?: { code?: string; message?: string } };
        const code = error?.error?.code;
        if (code === "expired_token" || code === "token_expired") {
          setState("expired");
          setVerifyError(error?.error?.message || "Your verification link has expired");
        } else {
          setState("invalid");
          setVerifyError(error?.error?.message || "Invalid verification token");
        }
      }
    };

    doVerify();
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setToast({ msg: "Please enter your email", type: "error" });
      return;
    }
    setSubmitting(true);
    try {
      await requestVerification(email);
      setToast({ msg: "Verification email sent! Check your inbox.", type: "success" });
      setEmail("");
    } catch (err: unknown) {
      const error = err as { error?: { message?: string } };
      setToast({ msg: error?.error?.message || "Failed to send verification email", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const renderContent = () => {
    switch (state) {
      case "verifying":
        return (
          <div style={{ textAlign: "center", padding: "var(--space-8)" }}>
            <div className="pr-skeleton" style={{ 
              width: 48, 
              height: 48, 
              borderRadius: "var(--radius-full)",
              margin: "0 auto var(--space-4)",
            }} />
            <p style={{ color: "var(--app-color-text-muted)", margin: 0 }}>
              Verifying your email...
            </p>
          </div>
        );

      case "success":
        return (
          <div style={{ textAlign: "center", padding: "var(--space-6)" }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: "var(--radius-full)",
              background: "var(--app-color-state-success-soft)",
              color: "var(--app-color-state-success)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "var(--space-4)",
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h2 style={{
              fontSize: "var(--font-h3)",
              fontWeight: "var(--font-weight-semibold)",
              margin: "0 0 var(--space-2) 0",
            }}>
              Email Verified!
            </h2>
            <p style={{
              color: "var(--app-color-text-secondary)",
              margin: "0 0 var(--space-6) 0",
            }}>
              Your email has been verified. You can now log in to your account.
            </p>
            <Button as="a" href="/login">
              Go to Login
            </Button>
          </div>
        );

      case "expired":
        return (
          <div style={{ textAlign: "center", padding: "var(--space-6)" }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: "var(--radius-full)",
              background: "var(--app-color-state-warning-soft)",
              color: "var(--app-color-state-warning)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "var(--space-4)",
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h2 style={{
              fontSize: "var(--font-h3)",
              fontWeight: "var(--font-weight-semibold)",
              margin: "0 0 var(--space-2) 0",
            }}>
              Link Expired
            </h2>
            <p style={{
              color: "var(--app-color-text-secondary)",
              margin: "0 0 var(--space-4) 0",
            }}>
              {verifyError || "Your verification link has expired. Request a new one below."}
            </p>
            <Button variant="secondary" onClick={() => setState("resend")}>
              Resend Verification Email
            </Button>
          </div>
        );

      case "invalid":
        return (
          <div style={{ textAlign: "center", padding: "var(--space-6)" }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: "var(--radius-full)",
              background: "var(--app-color-state-error-soft)",
              color: "var(--app-color-state-error)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "var(--space-4)",
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h2 style={{
              fontSize: "var(--font-h3)",
              fontWeight: "var(--font-weight-semibold)",
              margin: "0 0 var(--space-2) 0",
            }}>
              Verification Failed
            </h2>
            <p style={{
              color: "var(--app-color-text-secondary)",
              margin: "0 0 var(--space-4) 0",
            }}>
              {verifyError || "This verification link is invalid or has already been used."}
            </p>
            <Button variant="secondary" onClick={() => setState("resend")}>
              Resend Verification Email
            </Button>
          </div>
        );

      case "resend":
        return (
          <div>
            <p style={{ 
              color: "var(--app-color-text-secondary)", 
              marginBottom: "var(--space-4)" 
            }}>
              Enter your email below to receive a new verification link.
            </p>
            <form onSubmit={handleResend}>
              <FormField label="Email" required>
                <input
                  type="email"
                  className="pr-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={submitting}
                />
              </FormField>
              <Button type="submit" disabled={submitting} loading={submitting} fullWidth>
                Resend Verification Email
              </Button>
            </form>
          </div>
        );
    }
  };

  return (
    <div style={{ 
      minHeight: "100vh", 
      background: "var(--app-color-bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "var(--space-4)",
    }}>
      <div style={{ width: "100%", maxWidth: "420px" }}>
        {/* Logo / Brand */}
        <div style={{ textAlign: "center", marginBottom: "var(--space-6)" }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: "var(--radius-lg)",
            background: "var(--app-color-primary)",
            color: "var(--app-color-on-primary)",
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
            color: "var(--app-color-text-primary)",
            margin: "0 0 var(--space-1) 0",
          }}>
            Verify Email
          </h1>
          <p style={{
            fontSize: "var(--font-body-md)",
            color: "var(--app-color-text-secondary)",
            margin: 0,
          }}>
            Complete your registration
          </p>
        </div>

        <Card>
          {renderContent()}
          
          {state !== "success" && state !== "verifying" && (
            <div style={{ 
              marginTop: "var(--space-4)", 
              paddingTop: "var(--space-4)",
              borderTop: "1px solid var(--app-color-border-subtle)",
              textAlign: "center",
              fontSize: "var(--font-body-sm)",
              color: "var(--app-color-text-secondary)",
            }}>
              Already verified?{" "}
              <Link 
                to="/login"
                style={{ 
                  color: "var(--app-color-primary)", 
                  fontWeight: "var(--font-weight-medium)",
                }}
              >
                Sign in
              </Link>
            </div>
          )}
        </Card>
      </div>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};
