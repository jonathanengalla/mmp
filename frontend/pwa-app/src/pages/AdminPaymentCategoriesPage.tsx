import React, { useEffect, useState } from "react";
import { listPaymentCategories, createPaymentCategory, updatePaymentCategory } from "../api/client";
import { useSession } from "../hooks/useSession";
import { Toast } from "../components/Toast";
import { Page } from "../components/primitives/Page";
import { Card } from "../components/primitives/Card";
import { Button } from "../components/primitives/Button";
import { FormField } from "../components/primitives/FormField";

type Category = {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: "dues" | "event" | "other";
  active: boolean;
};

const validate = (cat: Partial<Category>) => {
  const errors: Record<string, string> = {};
  const code = (cat.code || "").trim();
  const name = (cat.name || "").trim();
  if (!code) errors.code = "Code required";
  if (!/^[A-Z0-9_]{1,32}$/.test(code)) errors.code = "Use A-Z, 0-9, underscore, max 32 chars";
  if (!name) errors.name = "Name required";
  if (name.length > 100) errors.name = "Max 100 chars";
  if (!cat.type || !["dues", "event", "other"].includes(cat.type)) errors.type = "Select type";
  return errors;
};

export const AdminPaymentCategoriesPage: React.FC = () => {
  const { tokens } = useSession();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState<Partial<Category>>({ code: "", name: "", type: "dues", description: "" });
  const [editing, setEditing] = useState<string | null>(null);
  const [editCat, setEditCat] = useState<Partial<Category>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!tokens?.access_token) {
      setLoading(false);
      return;
    }
    try {
      const resp = await listPaymentCategories(tokens.access_token);
      setCategories(resp.items || []);
    } catch (err: any) {
      setToast({ msg: err?.error?.message || "Failed to load categories", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens]);

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validate(newCat);
    if (Object.keys(errors).length) {
      setToast({ msg: Object.values(errors)[0], type: "error" });
      return;
    }
    try {
      setSaving(true);
      await createPaymentCategory(tokens!.access_token, {
        code: (newCat.code || "").trim().toUpperCase(),
        name: (newCat.name || "").trim(),
        type: newCat.type as Category["type"],
        description: newCat.description,
      });
      setToast({ msg: "Category created", type: "success" });
      setNewCat({ code: "", name: "", type: "dues", description: "" });
      setAdding(false);
      await load();
    } catch (err: any) {
      setToast({ msg: err?.error?.message || "Create failed", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const errors = validate({ ...editCat, code: "OK" }); // code not editable, skip
    if (errors.name || errors.type) {
      setToast({ msg: errors.name || errors.type || "Invalid data", type: "error" });
      return;
    }
    try {
      setSaving(true);
      await updatePaymentCategory(tokens!.access_token, editing, {
        name: editCat.name?.trim(),
        description: editCat.description,
        type: editCat.type as Category["type"],
        active: editCat.active,
      });
      setToast({ msg: "Category updated", type: "success" });
      setEditing(null);
      setEditCat({});
      await load();
    } catch (err: any) {
      setToast({ msg: err?.error?.message || "Update failed", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (cat: Category) => {
    setEditing(cat.id);
    setEditCat({ ...cat });
  };

  return (
    <Page title="Payment Categories" description="Define categories for dues, events, and other payments.">
      <Card>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <>
            {categories.length === 0 && <div>No categories yet.</div>}
            {categories.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    style={{
                      border: "1px solid var(--app-color-border-subtle)",
                      borderRadius: "var(--radius-md)",
                      padding: "var(--space-md)",
                      display: "flex",
                      gap: "var(--space-md)",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ minWidth: 80, fontWeight: 700 }}>{cat.code}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{cat.name}</div>
                      <div style={{ color: "var(--app-color-text-muted)" }}>{cat.description}</div>
                      <div>Type: {cat.type}</div>
                      <div>Status: {cat.active ? "Active" : "Inactive"}</div>
                    </div>
                    <Button variant="secondary" onClick={() => startEdit(cat)}>
                      Edit
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      <div style={{ marginTop: "var(--space-lg)" }}>
        {!adding ? (
          <Button onClick={() => setAdding(true)}>Add Category</Button>
        ) : (
          <Card title="New Category">
            <form onSubmit={submitNew}>
              <FormField label="Code">
                <input className="pr-input" value={newCat.code} onChange={(e) => setNewCat({ ...newCat, code: e.target.value })} placeholder="DUES" />
              </FormField>
              <FormField label="Name">
                <input className="pr-input" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} />
              </FormField>
              <FormField label="Type">
                <select className="pr-input" value={newCat.type} onChange={(e) => setNewCat({ ...newCat, type: e.target.value as Category["type"] })}>
                  <option value="dues">dues</option>
                  <option value="event">event</option>
                  <option value="other">other</option>
                </select>
              </FormField>
              <FormField label="Description">
                <textarea className="pr-input" value={newCat.description} onChange={(e) => setNewCat({ ...newCat, description: e.target.value })} />
              </FormField>
              <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>

      {editing && (
        <Card title={`Edit Category ${editCat.code}`} style={{ marginTop: "var(--space-lg)" } as any}>
          <form onSubmit={submitEdit}>
            <FormField label="Name">
              <input className="pr-input" value={editCat.name || ""} onChange={(e) => setEditCat({ ...editCat, name: e.target.value })} />
            </FormField>
            <FormField label="Type">
              <select className="pr-input" value={editCat.type || "dues"} onChange={(e) => setEditCat({ ...editCat, type: e.target.value as Category["type"] })}>
                <option value="dues">dues</option>
                <option value="event">event</option>
                <option value="other">other</option>
              </select>
            </FormField>
            <FormField label="Description">
              <textarea className="pr-input" value={editCat.description || ""} onChange={(e) => setEditCat({ ...editCat, description: e.target.value })} />
            </FormField>
            <FormField label="Status">
              <select className="pr-input" value={editCat.active ? "active" : "inactive"} onChange={(e) => setEditCat({ ...editCat, active: e.target.value === "active" })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </FormField>
            <div style={{ display: "flex", gap: "var(--space-sm)" }}>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Update"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </Page>
  );
};

