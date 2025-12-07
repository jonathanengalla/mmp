import React, { useEffect, useState } from "react";
import { getOrgProfile, updateOrgProfile } from "../api/client";
import { useSession } from "../hooks/useSession";
import { Toast } from "../components/Toast";
import { Page } from "../components/primitives/Page";
import { Card } from "../components/primitives/Card";
import { FormField } from "../components/primitives/FormField";
import { Button } from "../components/primitives/Button";

export const AdminOrgProfilePage: React.FC = () => {
  const { tokens } = useSession();
  const [form, setForm] = useState({ name: "", description: "", logoUrl: "", timezone: "", locale: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [errors, setErrors] = useState<{ name?: string; timezone?: string; locale?: string }>({});

  const validate = () => {
    const errs: any = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (form.timezone && !/^[A-Za-z]+\/[A-Za-z0-9_\-]+$/.test(form.timezone)) errs.timezone = "Timezone must be IANA format, e.g., Asia/Manila";
    if (form.locale && !/^[a-z]{2}(-[A-Z]{2})?$/.test(form.locale)) errs.locale = "Locale must be xx or xx-XX";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  useEffect(() => {
    const load = async () => {
      if (!tokens?.access_token) {
        setLoading(false);
        return;
      }
      try {
        const resp = await getOrgProfile(tokens.access_token);
        setForm({
          name: resp.name || "",
          description: resp.description || "",
          logoUrl: resp.logoUrl || "",
          timezone: resp.timezone || "",
          locale: resp.locale || "",
        });
      } catch (err: any) {
        setToast({ msg: err?.error?.message || "Failed to load profile", type: "error" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tokens]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!tokens?.access_token) {
      setToast({ msg: "Login required", type: "error" });
      return;
    }
    try {
      setSubmitting(true);
      await updateOrgProfile(tokens.access_token, form);
      setToast({ msg: "Organization profile saved", type: "success" });
    } catch (err: any) {
      setToast({ msg: err?.error?.message || "Save failed", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Page title="Organization Profile" description="Manage tenant branding and basics.">
      <Card>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <form onSubmit={onSubmit}>
            <FormField label="Name" error={errors.name}>
              <input name="name" className="pr-input" value={form.name} onChange={onChange} required />
            </FormField>
            <FormField label="Description">
              <textarea name="description" className="pr-input" value={form.description} onChange={onChange} />
            </FormField>
            <FormField label="Logo URL">
              <input name="logoUrl" className="pr-input" value={form.logoUrl} onChange={onChange} />
            </FormField>
            <FormField label="Timezone" error={errors.timezone}>
              <input name="timezone" className="pr-input" value={form.timezone} onChange={onChange} onBlur={validate} placeholder="e.g., Asia/Manila" />
            </FormField>
            <FormField label="Locale" error={errors.locale}>
              <input name="locale" className="pr-input" value={form.locale} onChange={onChange} onBlur={validate} placeholder="e.g., en-PH" />
            </FormField>
            <Button type="submit" disabled={submitting || Object.keys(errors).length > 0} fullWidth>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </form>
        )}
      </Card>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </Page>
  );
};

