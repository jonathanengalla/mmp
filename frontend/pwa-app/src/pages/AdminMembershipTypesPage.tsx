import React, { useEffect, useState } from "react";
import { createMembershipType, listMembershipTypes } from "../api/client";
import { useSession } from "../hooks/useSession";
import { Toast } from "../components/Toast";
import { Page } from "../components/primitives/Page";
import { Card } from "../components/primitives/Card";
import { Button } from "../components/primitives/Button";
import { FormField } from "../components/primitives/FormField";

export const AdminMembershipTypesPage: React.FC = () => {
  const { tokens } = useSession();
  const [form, setForm] = useState({ name: "", description: "", price: "", period: "monthly" });
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const load = async () => {
    if (!tokens?.access_token) {
      setLoading(false);
      return;
    }
    try {
      const resp = await listMembershipTypes(tokens.access_token);
      setTypes(resp.items || []);
    } catch (err: any) {
      setToast({ msg: err?.error?.message || "Failed to load membership types", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || form.price === "" || Number(form.price) < 0) {
      setToast({ msg: "Name and non-negative price are required", type: "error" });
      return;
    }
    if (!tokens?.access_token) {
      setToast({ msg: "Login required", type: "error" });
      return;
    }
    try {
      setSubmitting(true);
      await createMembershipType(tokens.access_token, {
        name: form.name,
        description: form.description,
        price: Number(form.price),
        period: form.period as "monthly" | "annual",
      });
      setToast({ msg: "Membership type created", type: "success" });
      setForm({ name: "", description: "", price: "", period: "monthly" });
      await load();
    } catch (err: any) {
      setToast({ msg: err?.error?.message || "Create failed", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Page title="Membership Types" description="Create and manage membership offerings.">
      <Card>
        <form onSubmit={onSubmit}>
          <FormField label="Name">
            <input name="name" className="pr-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </FormField>
          <FormField label="Description">
            <textarea name="description" className="pr-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </FormField>
          <FormField label="Price (cents)">
            <input
              type="number"
              name="price"
              className="pr-input"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              min={0}
            />
          </FormField>
          <FormField label="Period">
            <select name="period" className="pr-input" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })}>
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
            </select>
          </FormField>
          <Button type="submit" disabled={submitting} fullWidth>
            {submitting ? "Saving..." : "Create"}
          </Button>
        </form>
      </Card>
      <div style={{ marginTop: "var(--space-lg)" }}>
        <Card title="Existing Types">
          {loading && <div>Loading...</div>}
          {!loading && types.length === 0 && <div>No membership types.</div>}
          {!loading && types.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
              {types.map((t) => (
                <div key={t.id} style={{ border: "1px solid var(--app-color-border-subtle)", borderRadius: "var(--radius-md)", padding: "var(--space-md)" }}>
                  <div style={{ fontWeight: 600 }}>{t.name}</div>
                  <div style={{ color: "var(--app-color-text-muted)" }}>{t.description}</div>
                  <div>Price: {t.price}</div>
                  <div>Period: {t.period}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </Page>
  );
};

