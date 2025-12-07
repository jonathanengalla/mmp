import React, { useEffect, useState } from "react";
import { listSegments, listBroadcastDrafts, updateBroadcastDraft, getBroadcastPreview } from "../api/client";
import { useSession } from "../hooks/useSession";
import { Toast } from "../components/Toast";
import { useParams } from "react-router-dom";
import { Page } from "../components/primitives/Page";
import { Card } from "../components/primitives/Card";
import { Button } from "../components/primitives/Button";
import { FormField } from "../components/primitives/FormField";

export const AdminBroadcastEditPage: React.FC = () => {
  const { id } = useParams();
  const { tokens } = useSession();
  const [form, setForm] = useState({ subject: "", body: "", audience_segment_id: "", tags: "" });
  const [segments, setSegments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [segmentsLoading, setSegmentsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [preview, setPreview] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!tokens?.access_token || !id) {
        setLoading(false);
        setSegmentsLoading(false);
        return;
      }
      try {
        const segResp = await listSegments(tokens.access_token);
        setSegments(segResp.items || []);
      } catch (err: any) {
        setToast({ msg: err?.error?.message || "Failed to load segments", type: "error" });
      } finally {
        setSegmentsLoading(false);
      }

      try {
        const draftsResp = await listBroadcastDrafts(tokens.access_token, { status: "draft", page_size: 50 });
        const draft = (draftsResp.items || []).find((d: any) => d.id === id || d.broadcast_id === id);
        if (draft) {
          setForm({
            subject: draft.subject || "",
            body: draft.body || "",
            audience_segment_id: draft.audience_segment_id || "",
            tags: draft.tags ? draft.tags.join(",") : "",
          });
        }
      } catch (err: any) {
        setToast({ msg: err?.error?.message || "Failed to load draft", type: "error" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tokens, id]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokens?.access_token || !id) {
      setToast({ msg: "Login required", type: "error" });
      return;
    }
    try {
      setSubmitting(true);
      await updateBroadcastDraft(tokens.access_token, id, {
        subject: form.subject,
        body: form.body,
        audience_segment_id: form.audience_segment_id || undefined,
        tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
      });
      setToast({ msg: "Draft updated", type: "success" });
    } catch (err: any) {
      setToast({ msg: err?.error?.message || err?.message || "Update failed", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Page title="Edit Broadcast Draft" description="Update and preview a draft.">
      <Card>
        {loading ? (
          <div>Loading draft...</div>
        ) : (
          <form onSubmit={onSubmit}>
            <FormField label="Subject">
              <input name="subject" className="pr-input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
            </FormField>
            <FormField label="Body">
              <textarea name="body" className="pr-input" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
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
            <FormField label="Tags (comma separated)">
              <input name="tags" className="pr-input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            </FormField>
            <Button type="submit" disabled={submitting} fullWidth>
              {submitting ? "Saving..." : "Save changes"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              fullWidth
              style={{ marginTop: "var(--space-sm)" }}
              onClick={async () => {
                if (!tokens?.access_token || !id) {
                  setToast({ msg: "Login required", type: "error" });
                  return;
                }
                try {
                  setPreviewLoading(true);
                  const resp = await getBroadcastPreview(tokens.access_token, id);
                  setPreview(resp);
                } catch (err: any) {
                  setToast({ msg: err?.error?.message || "Failed to load preview", type: "error" });
                } finally {
                  setPreviewLoading(false);
                }
              }}
            >
              {previewLoading ? "Loading preview..." : "Preview"}
            </Button>
          </form>
        )}
      </Card>
      {preview && (
        <Card title="Preview" style={{ marginTop: "var(--space-lg)" } as any}>
          <div style={{ marginBottom: "var(--space-xs)" }}>
            <strong>Subject:</strong> {preview.subject}
          </div>
          <div style={{ marginBottom: "var(--space-xs)" }}>
            <strong>Segment:</strong> {preview.audience_segment_name || preview.audience_segment_id || "None"}
          </div>
          <div style={{ marginTop: "var(--space-sm)", whiteSpace: "pre-wrap" }}>{preview.renderedPreview}</div>
        </Card>
      )}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </Page>
  );
};

