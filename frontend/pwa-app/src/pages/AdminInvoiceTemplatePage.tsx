import React, { useEffect, useState } from "react";
import { getInvoiceTemplate, updateInvoiceTemplate } from "../api/client";
import { useSession } from "../hooks/useSession";
import { Toast } from "../components/Toast";
import { Page } from "../components/primitives/Page";
import { Card } from "../components/primitives/Card";
import { Button } from "../components/primitives/Button";
import { FormField } from "../components/primitives/FormField";

export const AdminInvoiceTemplatePage: React.FC = () => {
  const { tokens } = useSession();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const load = async () => {
    if (!tokens?.access_token) {
      setLoading(false);
      return;
    }
    try {
      const resp = await getInvoiceTemplate(tokens.access_token);
      setSubject(resp.subject || "");
      setBody(resp.body || "");
    } catch (err: any) {
      setToast({ msg: err?.error?.message || "Failed to load template", type: "error" });
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
    if (!subject.trim() || !body.trim()) {
      setToast({ msg: "Subject and body are required", type: "error" });
      return;
    }
    if (body.trim().length < 10) {
      setToast({ msg: "Body must be at least 10 characters", type: "error" });
      return;
    }
    if (!tokens?.access_token) {
      setToast({ msg: "Login required", type: "error" });
      return;
    }
    try {
      setSaving(true);
      await updateInvoiceTemplate(tokens.access_token, { subject: subject.trim(), body: body.trim() });
      setToast({ msg: "Template saved", type: "success" });
    } catch (err: any) {
      setToast({ msg: err?.error?.message || "Save failed", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page title="Invoice Template" description="Edit subject and body used for invoice emails.">
      <Card>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <form onSubmit={onSubmit}>
            <FormField label="Subject">
              <input className="pr-input" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
            </FormField>
            <FormField label="Body">
              <textarea className="pr-input" style={{ minHeight: 180 }} value={body} onChange={(e) => setBody(e.target.value)} />
              <small>
                Merge tokens like {"{{member.name}}"}, {"{{amount}}"}, {"{{due_date}}"}.
              </small>
            </FormField>
            <Button type="submit" disabled={saving} fullWidth>
              {saving ? "Saving..." : "Save"}
            </Button>
          </form>
        )}
      </Card>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </Page>
  );
};

