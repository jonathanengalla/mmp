import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerMember } from "../api/client";
import { validateRegistration } from "../utils/validation";
import { Toast } from "../components/Toast";
import { Card } from "../components/primitives/Card";
import { Button } from "../components/primitives/Button";
import { FormField } from "../components/primitives/FormField";
import { useBranding } from "../config/branding";

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const branding = useBranding();
  const [form, setForm] = useState({
    email: "",
    first_name: "",
    last_name: "",
    phone: "",
    address: "",
    linkedinUrl: "",
    otherSocials: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const offline = typeof navigator !== "undefined" && !navigator.onLine;

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSubmitError(null);
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: "" });
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validateRegistration(form);
    setErrors(v);
    if (Object.keys(v).length) return;
    if (offline) {
      setToast({ msg: "Cannot register while offline", type: "error" });
      return;
    }
    try {
      setSubmitting(true);
      setSubmitError(null);
      await registerMember({
        email: form.email,
        firstName: form.first_name,
        lastName: form.last_name,
        phone: form.phone || undefined,
        address: form.address || undefined,
        linkedinUrl: form.linkedinUrl || undefined,
        otherSocials: form.otherSocials || undefined,
      });
      setSubmitted(true);
      setToast(null);
    } catch (err: any) {
      const message = err?.error?.message || (err?.status === 409 ? "This email is already registered or pending approval." : "Registration failed");
      setSubmitError(message);
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
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--rcme-space-xl)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "var(--rcme-card-bg)",
          border: "1px solid var(--rcme-color-border-subtle)",
          borderRadius: "var(--rcme-card-radius)",
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
            Create your account
          </h1>
          <p
            style={{
              fontSize: "var(--rcme-font-size-body)",
              color: "var(--rcme-color-text-secondary)",
              margin: 0,
            }}
          >
            Join {branding.appName}
          </p>
        </div>

        <Card>
          {offline && (
            <div
              style={{
                padding: "var(--rcme-space-md)",
                background: "var(--rcme-color-state-warning)",
                borderRadius: "var(--rcme-radius-md)",
                color: "#111",
                fontSize: "var(--rcme-font-size-label)",
                marginBottom: "var(--rcme-space-lg)",
              }}
            >
              You're offline – registration unavailable
            </div>
          )}
          
          {submitError && (
            <div
              style={{
                padding: "var(--rcme-space-md)",
                background: "var(--rcme-color-state-error)",
                borderRadius: "var(--rcme-radius-md)",
                color: "#111",
                fontSize: "var(--rcme-font-size-label)",
                marginBottom: "var(--rcme-space-lg)",
              }}
            >
              {submitError}
            </div>
          )}

          {submitted ? (
            <div style={{ textAlign: "center", padding: "var(--rcme-space-xxl) 0" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "var(--rcme-radius-pill)",
                  background: "rgba(127, 207, 133, 0.16)",
                  color: "var(--rcme-color-state-success)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "var(--rcme-space-lg)",
                }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <h2
                style={{
                  fontSize: "var(--rcme-font-size-h2)",
                  fontWeight: 600,
                  color: "var(--rcme-color-text-primary)",
                  margin: "0 0 var(--rcme-space-sm) 0",
                }}
              >
                Check your email
              </h2>
              <p
                style={{
                  fontSize: "var(--rcme-font-size-body)",
                  color: "var(--rcme-color-text-secondary)",
                  margin: "0 0 var(--rcme-space-xl) 0",
                }}
              >
                We've sent a verification link to <strong>{form.email}</strong>
              </p>
              <Button onClick={() => navigate("/login")} variant="secondary">
                Go to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "var(--rcme-space-lg)",
                  marginBottom: "var(--rcme-space-lg)",
                }}
              >
                <FormField label="First name" error={errors.first_name} required>
                  <input 
                    name="first_name" 
                    className={`pr-input ${errors.first_name ? "pr-input--error" : ""}`}
                    value={form.first_name} 
                    onChange={onChange} 
                    disabled={submitting || offline}
                    placeholder="John"
                  />
                </FormField>
                <FormField label="Last name" error={errors.last_name} required>
                  <input 
                    name="last_name" 
                    className={`pr-input ${errors.last_name ? "pr-input--error" : ""}`}
                    value={form.last_name} 
                    onChange={onChange} 
                    disabled={submitting || offline}
                    placeholder="Doe"
                  />
                </FormField>
              </div>
              
              <FormField label="Email" error={errors.email} required>
                <input 
                  name="email" 
                  type="email"
                  className={`pr-input ${errors.email ? "pr-input--error" : ""}`}
                  value={form.email} 
                  onChange={onChange} 
                  disabled={submitting || offline}
                  placeholder="you@example.com"
                />
              </FormField>
              
              <FormField label="Phone" hint="Optional">
                <input 
                  name="phone" 
                  className="pr-input" 
                  value={form.phone} 
                  onChange={onChange} 
                  disabled={submitting || offline}
                  placeholder="+1 555 123 4567"
                />
              </FormField>
              
              <FormField label="Address" hint="Optional">
                <input 
                  name="address" 
                  className="pr-input" 
                  value={form.address} 
                  onChange={onChange} 
                  disabled={submitting || offline}
                  placeholder="City, Country"
                />
              </FormField>
              
              <FormField label="LinkedIn URL" error={errors.linkedinUrl} hint="Optional">
                <input 
                  name="linkedinUrl" 
                  className={`pr-input ${errors.linkedinUrl ? "pr-input--error" : ""}`}
                  value={form.linkedinUrl} 
                  onChange={onChange} 
                  disabled={submitting || offline} 
                  placeholder="https://linkedin.com/in/you"
                />
              </FormField>
              
              <FormField label="Other socials" hint="Optional">
                <textarea 
                  name="otherSocials" 
                  className="pr-input" 
                  value={form.otherSocials} 
                  onChange={onChange} 
                  disabled={submitting || offline}
                  rows={2}
                  placeholder="@twitter, etc."
                  style={{ resize: "vertical" }}
                />
              </FormField>
              
              <Button 
                type="submit" 
                disabled={submitting || offline} 
                loading={submitting}
                fullWidth
                size="lg"
              >
                Create account
              </Button>
              
              <div
                style={{
                  marginTop: "var(--rcme-space-lg)",
                  textAlign: "center",
                  fontSize: "var(--rcme-font-size-label)",
                  color: "var(--rcme-color-text-secondary)",
                }}
              >
                Already have an account?{" "}
                <Link 
                  to="/login"
                  style={{ 
                  color: "var(--rcme-color-brand-primary)", 
                  fontWeight: 600,
                  }}
                >
                  Sign in
                </Link>
              </div>
            </form>
          )}
        </Card>
      </div>
      
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};
