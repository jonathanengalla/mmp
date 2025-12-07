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
    <div style={{ 
      minHeight: "100vh", 
      background: "var(--color-bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "var(--space-6) var(--space-4)",
    }}>
      <div style={{ width: "100%", maxWidth: "480px" }}>
        {/* Logo / Brand */}
        <div style={{ textAlign: "center", marginBottom: "var(--space-6)" }}>
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
            Create your account
          </h1>
          <p style={{
            fontSize: "var(--font-body-md)",
            color: "var(--color-text-secondary)",
            margin: 0,
          }}>
            Join {branding.appName}
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
            }}>
              You're offline – registration unavailable
            </div>
          )}
          
          {submitError && (
            <div style={{ 
              padding: "var(--space-3)", 
              background: "var(--color-error-soft)", 
              borderRadius: "var(--radius-md)",
              color: "var(--color-error)",
              fontSize: "var(--font-body-sm)",
              marginBottom: "var(--space-4)",
            }}>
              {submitError}
            </div>
          )}

          {submitted ? (
            <div style={{ textAlign: "center", padding: "var(--space-6) 0" }}>
              <div style={{
                width: 64,
                height: 64,
                borderRadius: "var(--radius-full)",
                background: "var(--color-success-soft)",
                color: "var(--color-success)",
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
                color: "var(--color-text-primary)",
                margin: "0 0 var(--space-2) 0",
              }}>
                Check your email
              </h2>
              <p style={{
                fontSize: "var(--font-body-md)",
                color: "var(--color-text-secondary)",
                margin: "0 0 var(--space-6) 0",
              }}>
                We've sent a verification link to <strong>{form.email}</strong>
              </p>
              <Button onClick={() => navigate("/login")} variant="secondary">
                Go to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit}>
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "1fr 1fr", 
                gap: "var(--space-4)",
                marginBottom: "var(--space-4)",
              }}>
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
              
              <div style={{ 
                marginTop: "var(--space-4)", 
                textAlign: "center",
                fontSize: "var(--font-body-sm)",
                color: "var(--color-text-secondary)",
              }}>
                Already have an account?{" "}
                <Link 
                  to="/login"
                  style={{ 
                    color: "var(--color-primary)", 
                    fontWeight: "var(--font-weight-medium)",
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
