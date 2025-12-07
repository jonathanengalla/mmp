import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createMemberAdmin } from "../api/client";
import { validateAdminCreateMember } from "../utils/validation";
import { useSession } from "../hooks/useSession";
import { Toast } from "../components/Toast";
import { Page } from "../components/primitives/Page";
import { Card } from "../components/primitives/Card";
import { FormField } from "../components/primitives/FormField";
import { Button } from "../components/primitives/Button";

interface FormState {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  linkedinUrl: string;
  otherSocials: string;
}

const initialForm: FormState = {
  email: "",
  first_name: "",
  last_name: "",
  phone: "",
  address: "",
  linkedinUrl: "",
  otherSocials: "",
};

export const AdminCreateMemberPage: React.FC = () => {
  const navigate = useNavigate();
  const { tokens } = useSession();
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear error for field being edited
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    const validationErrors = validateAdminCreateMember(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    if (!tokens?.access_token) {
      setToast({ msg: "Not authenticated", type: "error" });
      return;
    }

    setSubmitting(true);
    try {
      await createMemberAdmin(tokens.access_token, {
        email: form.email,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone || undefined,
        address: form.address || undefined,
        linkedinUrl: form.linkedinUrl || undefined,
        otherSocials: form.otherSocials || undefined,
      });
      setToast({ msg: `Member ${form.first_name} ${form.last_name} created successfully`, type: "success" });
      // Clear form after success
      setForm(initialForm);
      // Redirect to directory after a short delay so user can see the toast
      setTimeout(() => {
        navigate("/directory");
      }, 1500);
    } catch (err: unknown) {
      const error = err as { status?: number; error?: { message?: string; details?: { field: string; issue: string }[] } };
      if (error?.status === 409) {
        setErrors({ email: "A member with this email already exists" });
        setToast({ msg: "A member with this email already exists", type: "error" });
      } else if (error?.status === 400 && error?.error?.details) {
        // Map validation errors to form fields
        const fieldErrors: Record<string, string> = {};
        for (const detail of error.error.details) {
          fieldErrors[detail.field] = detail.issue === "required" ? `${detail.field} is required` : `Invalid ${detail.field}`;
        }
        setErrors(fieldErrors);
        setToast({ msg: error?.error?.message || "Validation failed", type: "error" });
      } else {
        setToast({ msg: error?.error?.message || "Failed to create member", type: "error" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onCancel = () => {
    navigate("/admin/pending-members");
  };

  return (
    <Page title="Add Member" description="Create a new member account manually.">
      <Card>
        <form onSubmit={onSubmit}>
          <FormField label="Email" error={errors.email}>
            <input
              name="email"
              type="email"
              className="pr-input"
              value={form.email}
              onChange={onChange}
              disabled={submitting}
              placeholder="member@example.com"
            />
          </FormField>

          <FormField label="First Name" error={errors.first_name}>
            <input
              name="first_name"
              className="pr-input"
              value={form.first_name}
              onChange={onChange}
              disabled={submitting}
              placeholder="John"
            />
          </FormField>

          <FormField label="Last Name" error={errors.last_name}>
            <input
              name="last_name"
              className="pr-input"
              value={form.last_name}
              onChange={onChange}
              disabled={submitting}
              placeholder="Doe"
            />
          </FormField>

          <FormField label="Phone (optional)">
            <input
              name="phone"
              className="pr-input"
              value={form.phone}
              onChange={onChange}
              disabled={submitting}
              placeholder="+1 555-123-4567"
            />
          </FormField>

          <FormField label="Address (optional)">
            <textarea
              name="address"
              className="pr-input"
              value={form.address}
              onChange={onChange}
              disabled={submitting}
              rows={3}
              placeholder="Street address, city, country"
              style={{ resize: "vertical" }}
            />
          </FormField>

          <FormField label="LinkedIn URL (optional)" error={errors.linkedinUrl}>
            <input
              name="linkedinUrl"
              className="pr-input"
              value={form.linkedinUrl}
              onChange={onChange}
              disabled={submitting}
              placeholder="https://linkedin.com/in/johndoe"
            />
          </FormField>

          <FormField label="Other Socials (optional)">
            <textarea
              name="otherSocials"
              className="pr-input"
              value={form.otherSocials}
              onChange={onChange}
              disabled={submitting}
              rows={2}
              placeholder="@twitter, Facebook URL, etc."
              style={{ resize: "vertical" }}
            />
          </FormField>

          <div style={{ display: "flex", gap: "var(--space-md)", marginTop: "var(--space-lg)" }}>
            <Button type="submit" disabled={submitting} fullWidth>
              {submitting ? "Creating..." : "Create Member"}
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </Page>
  );
};

