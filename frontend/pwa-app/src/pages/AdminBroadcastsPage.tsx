import React, { useEffect, useState } from "react";
import { createBroadcastDraft, listBroadcastDrafts, listSegments, updateBroadcastDraft } from "../api/client";
import { useSession } from "../hooks/useSession";
import { Toast } from "../components/Toast";
import { Page } from "../components/primitives/Page";
import { Card } from "../components/primitives/Card";
import { Button } from "../components/primitives/Button";
import { FormField } from "../components/primitives/FormField";
import { Tag } from "../components/primitives/Tag";

export const AdminBroadcastsPage: React.FC = () => {
  const { tokens } = useSession();
  const [form, setForm] = useState({ subject: "", body: "", audience_segment_id: "", tags: "" });
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const loadDrafts = async () => {
    if (!tokens?.access_token) {
      setLoading(false);
      return;
    }
    try {
      const resp = await listBroadcastDrafts(tokens.access_token, { status: "draft" });
      setDrafts(resp.items || []);
    } catch (err: any) {
      setToast({ msg: err?.error?.message || "Failed to load drafts", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      if (!tokens?.access_token) {
        setLoading(false);
        setSegmentsLoading(false);
        return;
      }
      try {
        await loadDrafts();
        const segResp = await listSegments(tokens.access_token);
        setSegments(segResp.items || []);
      } catch (err: any) {
        setToast({ msg: err?.error?.message || "Failed to load data", type: "error" });
      } finally {
        setSegmentsLoading(false);
      }
    };
    load();
  }, [tokens]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokens?.access_token) {
      setToast({ msg: "Login required", type: "error" });
      return;
    }
    if (!form.subject || !form.body) {
      setToast({ msg: "Subject and body are required", type: "error" });
      return;
    }
    try {
      setSubmitting(true);
      if (editingId) {
        await updateBroadcastDraft(tokens.access_token, editingId, {
          subject: form.subject,
          body: form.body,
          audience_segment_id: form.audience_segment_id || undefined,
          tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
        });
        setToast({ msg: "Draft updated", type: "success" });
      } else {
        await createBroadcastDraft(tokens.access_token, {
          subject: form.subject,
          body: form.body,
          audience_segment_id: form.audience_segment_id || undefined,
          tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
        });
        setToast({ msg: "Draft created", type: "success" });
      }
      setForm({ subject: "", body: "", audience_segment_id: "", tags: "" });
      setEditingId(null);
      await loadDrafts();
    } catch (err: any) {
      setToast({ msg: err?.error?.message || err?.message || "Failed to create draft", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Page title="Broadcast Drafts" description="Create and manage announcement drafts.">
      <Card title="New Draft">
        <form onSubmit={onSubmit}>
          <FormField label="Subject">
            <input name="subject" className="pr-input" value={form.subject} onChange={onChange} required />
          </FormField>
          <FormField label="Body">
            <textarea name="body" className="pr-input" value={form.body} onChange={onChange} required />
          </FormField>
          <FormField label="Audience segment (optional)">
            <select
              name="audience_segment_id"
              className="pr-input"
              value={form.audience_segment_id}
              onChange={(e) => setForm({ ...form, audience_segment_id: e.target.value })}
            >
              <option value="">-- None --</option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {segmentsLoading && <span className="pr-form-hint">Loading segments...</span>}
          </FormField>
          <FormField label="Tags (comma separated, optional)">
            <input name="tags" className="pr-input" value={form.tags} onChange={onChange} placeholder="newsletter,dues" />
          </FormField>
          <Button type="submit" disabled={submitting} fullWidth>
            {submitting ? "Saving..." : editingId ? "Update draft" : "Save draft"}
          </Button>
        </form>
      </Card>

      <div style={{ marginTop: "var(--space-lg)" }}>
        <Card title="Draft list">
          {loading && <div>Loading drafts...</div>}
          {!loading && drafts.length === 0 && <div>No drafts yet.</div>}
          {!loading && drafts.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
              {drafts.map((d) => (
                <div key={d.id} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-md)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-sm)" }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{d.subject}</div>
                      <div style={{ color: "var(--color-text-muted)" }}>Created: {d.created_at ? new Date(d.created_at).toLocaleString() : "N/A"}</div>
                    </div>
                    <Tag tone="info">{d.status}</Tag>
                  </div>
                  <Button
                    variant="secondary"
                    style={{ marginTop: "var(--space-sm)" }}
                    onClick={() => {
                      setEditingId(d.id);
                      setForm({
                        subject: d.subject || "",
                        body: d.body || "",
                        audience_segment_id: d.audience_segment_id || "",
                        tags: d.tags ? d.tags.join(",") : "",
                      });
                    }}
                  >
                    Edit
                  </Button>
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

