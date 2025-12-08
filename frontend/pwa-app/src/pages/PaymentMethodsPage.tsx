import React, { useEffect, useState } from "react";
import { getMemberPaymentMethods, createMemberPaymentMethod, MemberPaymentMethod, MemberPaymentMethodsResponse } from "../api/client";
import { useSession } from "../hooks/useSession";
import { Toast } from "../components/Toast";
import { Page } from "../components/primitives/Page";
import { Card } from "../components/primitives/Card";
import { FormField } from "../components/primitives/FormField";
import { Button } from "../components/primitives/Button";
import { Tag } from "../components/primitives/Tag";

interface FormState {
  brand: string;
  last4: string;
  expMonth: string;
  expYear: string;
  label: string;
}

interface FormErrors {
  brand?: string;
  last4?: string;
  expMonth?: string;
  expYear?: string;
}

const initialForm: FormState = {
  brand: "",
  last4: "",
  expMonth: "",
  expYear: "",
  label: "",
};

// Generate years for dropdown
const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 15 }, (_, i) => currentYear + i);

export const PaymentMethodsPage: React.FC = () => {
  const { tokens, logout } = useSession();
  const [methods, setMethods] = useState<MemberPaymentMethod[]>([]);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const fetchMethods = async () => {
    if (!tokens?.access_token) {
      setLoading(false);
      return;
    }
    setLoadError(null);
    try {
      const resp: MemberPaymentMethodsResponse = await getMemberPaymentMethods(tokens.access_token);
      setMethods(resp.items);
      setDefaultId(resp.defaultId);
    } catch (err: unknown) {
      const error = err as { status?: number; error?: { message?: string } };
      if (error?.status === 401 || error?.status === 403) {
        logout();
        window.location.href = "/login";
      } else {
        setLoadError(error?.error?.message || "Failed to load payment methods");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMethods();
  }, [tokens]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name as keyof FormErrors]) {
      setFormErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    if (!form.brand) errors.brand = "Brand is required";
    if (!form.last4) errors.last4 = "Last 4 digits required";
    else if (!/^\d{4}$/.test(form.last4)) errors.last4 = "Must be exactly 4 digits";
    if (!form.expMonth) errors.expMonth = "Month required";
    else {
      const month = parseInt(form.expMonth, 10);
      if (isNaN(month) || month < 1 || month > 12) errors.expMonth = "Invalid month";
    }
    if (!form.expYear) errors.expYear = "Year required";
    else {
      const year = parseInt(form.expYear, 10);
      if (isNaN(year) || year < currentYear) errors.expYear = "Invalid year";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (!tokens?.access_token) {
      window.location.href = "/login";
      return;
    }
    setSubmitting(true);
    try {
      const resp = await createMemberPaymentMethod(tokens.access_token, {
        brand: form.brand,
        last4: form.last4,
        expMonth: parseInt(form.expMonth, 10),
        expYear: parseInt(form.expYear, 10),
        label: form.label || undefined,
      });
      setMethods(resp.items);
      setDefaultId(resp.defaultId);
      setForm(initialForm);
      setToast({ msg: "Payment method added", type: "success" });
    } catch (err: unknown) {
      const error = err as { error?: { message?: string } };
      setToast({ msg: error?.error?.message || "Failed to add payment method", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <Page title="Payment Methods">
        <Card>
          <div style={{ padding: "var(--space-8)", textAlign: "center", color: "var(--app-color-text-muted)" }}>
            <div className="pr-skeleton" style={{ 
              width: 48, 
              height: 32, 
              borderRadius: "var(--radius-md)",
              margin: "0 auto var(--space-4)",
            }} />
            <p style={{ margin: 0 }}>Loading payment methods...</p>
          </div>
        </Card>
      </Page>
    );
  }

  // Error state with retry
  if (loadError) {
    return (
      <Page title="Payment Methods">
        <Card>
          <div style={{ padding: "var(--space-8)", textAlign: "center", color: "var(--app-color-text-primary)" }}>
            <div style={{ 
              width: 64,
              height: 64,
              borderRadius: "var(--radius-full)",
              background: "var(--app-color-error-soft)",
              color: "var(--app-color-state-error)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "var(--space-4)",
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 style={{ fontSize: "var(--font-h3)", margin: "0 0 var(--space-2) 0" }}>
              Failed to load payment methods
            </h3>
            <p style={{ color: "var(--app-color-text-secondary)", marginBottom: "var(--space-4)" }}>
              {loadError}
            </p>
            <Button variant="secondary" onClick={fetchMethods}>
              Try again
            </Button>
          </div>
        </Card>
      </Page>
    );
  }

  return (
    <Page title="Payment Methods" description="Manage your saved cards for dues and event payments">
      {/* Saved payment methods */}
      <Card title="Saved Cards">
        {methods.length === 0 ? (
          <div style={{ 
            padding: "var(--space-6)", 
            textAlign: "center",
              color: "var(--app-color-text-muted)",
              background: "var(--app-color-surface-1)",
              borderRadius: "var(--radius-md)",
              color: "var(--app-color-text-muted)",
              background: "var(--app-color-surface-1)",
              borderRadius: "var(--radius-md)",
          }}>
            <svg 
              width="40" 
              height="40" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="1.5"
              style={{ margin: "0 auto var(--space-3)", opacity: 0.5 }}
            >
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
            <p style={{ margin: 0 }}>No payment methods saved yet</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {methods.map((method) => (
              <div 
                key={method.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "var(--space-4)",
                  background: "var(--app-color-surface-1)",
                  borderRadius: "var(--radius-md)",
                  border: method.id === defaultId ? "1px solid var(--app-color-primary)" : "1px solid transparent",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  {/* Card icon */}
                  <div style={{
                    width: 40,
                    height: 28,
                    borderRadius: "var(--radius-sm)",
                    background: "var(--app-color-surface-0)",
                    border: "1px solid var(--app-color-border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "var(--font-caption)",
                    fontWeight: "var(--font-weight-bold)",
                    color: "var(--app-color-text-secondary)",
                  }}>
                    {method.brand.slice(0, 4).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ 
                      fontWeight: "var(--font-weight-medium)",
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                    }}>
                      {method.brand} •••• {method.last4}
                      {method.id === defaultId && <Tag variant="default" size="sm">Default</Tag>}
                    </div>
                    <div style={{ 
                      fontSize: "var(--font-caption)", 
                      color: "var(--app-color-text-muted)",
                      marginTop: "var(--space-1)",
                    }}>
                      Expires {String(method.expMonth).padStart(2, "0")}/{method.expYear}
                      {method.label && ` · ${method.label}`}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add new payment method */}
      <div style={{ marginTop: "var(--space-6)" }}>
        <Card title="Add a New Card">
          <form onSubmit={onSubmit}>
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", 
              gap: "var(--space-4)" 
            }}>
              <FormField label="Card Brand" error={formErrors.brand} required>
                <select
                  name="brand"
                  className={`pr-input ${formErrors.brand ? "pr-input--error" : ""}`}
                  value={form.brand}
                  onChange={onChange}
                  disabled={submitting}
                >
                  <option value="">Select brand</option>
                  <option value="Visa">Visa</option>
                  <option value="MasterCard">MasterCard</option>
                  <option value="American Express">American Express</option>
                  <option value="Discover">Discover</option>
                </select>
              </FormField>

              <FormField label="Last 4 Digits" error={formErrors.last4} required>
                <input
                  name="last4"
                  className={`pr-input ${formErrors.last4 ? "pr-input--error" : ""}`}
                  value={form.last4}
                  onChange={onChange}
                  disabled={submitting}
                  placeholder="1234"
                  maxLength={4}
                />
              </FormField>
            </div>

            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "1fr 1fr 2fr", 
              gap: "var(--space-4)" 
            }}>
              <FormField label="Month" error={formErrors.expMonth} required>
                <select
                  name="expMonth"
                  className={`pr-input ${formErrors.expMonth ? "pr-input--error" : ""}`}
                  value={form.expMonth}
                  onChange={onChange}
                  disabled={submitting}
                >
                  <option value="">MM</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Year" error={formErrors.expYear} required>
                <select
                  name="expYear"
                  className={`pr-input ${formErrors.expYear ? "pr-input--error" : ""}`}
                  value={form.expYear}
                  onChange={onChange}
                  disabled={submitting}
                >
                  <option value="">YYYY</option>
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Label" hint="e.g., Personal, Company">
                <input
                  name="label"
                  className="pr-input"
                  value={form.label}
                  onChange={onChange}
                  disabled={submitting}
                  placeholder="Optional nickname"
                />
              </FormField>
            </div>

            <div style={{ marginTop: "var(--space-4)" }}>
              <Button type="submit" disabled={submitting} loading={submitting}>
                Add Card
              </Button>
            </div>
          </form>
        </Card>
      </div>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </Page>
  );
};
