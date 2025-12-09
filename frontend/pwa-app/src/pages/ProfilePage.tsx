import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  getCurrentMember,
  updateCurrentMember,
  updateMyAvatar,
  listInvoices,
  downloadInvoicePdf,
  getProfileCustomFieldSchema,
  getMyCustomFields,
  updateMyCustomFields,
  MemberProfile,
  UpdateMemberProfilePayload,
  ProfileCustomFieldSchema,
  ProfileCustomFieldValues,
  CustomFieldDefinition,
} from "../api/client";
import { Toast } from "../components/Toast";
import { useSession } from "../hooks/useSession";
import { Page } from "../components/primitives/Page";
import { Card } from "../components/primitives/Card";
import { FormField } from "../components/primitives/FormField";
import { Button } from "../components/primitives/Button";
import { Tag } from "../components/primitives/Tag";
import { Table, TableHeader, TableBody, TableRow, TableHeadCell, TableCell, TableCard } from "../components/ui/Table";

interface FormState {
  phone: string;
  address: string;
  linkedinUrl: string;
  otherSocials: string;
}

interface FormErrors {
  linkedinUrl?: string;
}

/** Check if a field is visible based on its conditions */
const isFieldVisible = (
  field: CustomFieldDefinition,
  values: ProfileCustomFieldValues
): boolean => {
  if (!field.visibleWhen || field.visibleWhen.length === 0) return true;
  
  for (const condition of field.visibleWhen) {
    const currentValue = values[condition.fieldId];
    if (condition.equals !== undefined && currentValue !== condition.equals) {
      return false;
    }
  }
  return true;
};

/** Validate LinkedIn URL: must start with http(s) and contain linkedin.com */
const validateLinkedinUrl = (url: string): string | undefined => {
  if (!url) return undefined;
  if (!/^https?:\/\//i.test(url)) {
    return "LinkedIn URL must start with http:// or https://";
  }
  if (!url.toLowerCase().includes("linkedin.com")) {
    return "LinkedIn URL must contain linkedin.com";
  }
  return undefined;
};

export const ProfilePage: React.FC = () => {
  const { authed, tokens, logout } = useSession();
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [form, setForm] = useState<FormState>({ phone: "", address: "", linkedinUrl: "", otherSocials: "" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const offline = typeof navigator !== "undefined" && !navigator.onLine;

  // Avatar state
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Custom fields state
  const [customFieldSchema, setCustomFieldSchema] = useState<ProfileCustomFieldSchema | null>(null);
  const [customFieldValues, setCustomFieldValues] = useState<ProfileCustomFieldValues>({});
  const [customFieldErrors, setCustomFieldErrors] = useState<Record<string, string>>({});
  const [customFieldsSaving, setCustomFieldsSaving] = useState(false);

  const fetchProfile = async () => {
    if (!tokens?.access_token) {
      setLoading(false);
      return;
    }
    setLoadError(null);
    try {
      const data = await getCurrentMember(tokens.access_token);
      setProfile(data);
      setForm({
        phone: data.phone || "",
        address: data.address || "",
        linkedinUrl: data.linkedinUrl || "",
        otherSocials: data.otherSocials || "",
      });
    } catch (err: unknown) {
      const error = err as { status?: number; error?: { message?: string } };
      if (error?.status === 401 || error?.status === 403) {
        logout();
        window.location.href = "/login";
      } else {
        setLoadError(error?.error?.message || "Failed to load profile");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [tokens, authed]);

  useEffect(() => {
    const fetchInvoices = async () => {
      if (!tokens?.access_token) {
        setInvoicesLoading(false);
        return;
      }
      try {
        const resp = await listInvoices(tokens.access_token, { status: "unpaid,overdue" });
        setInvoices(resp.items || []);
      } catch {
        // Silently fail for invoices
      } finally {
        setInvoicesLoading(false);
      }
    };
    fetchInvoices();
  }, [tokens]);

  // Fetch custom field schema and values
  useEffect(() => {
    const fetchCustomFields = async () => {
      if (!tokens?.access_token) return;
      try {
        const [schema, values] = await Promise.all([
          getProfileCustomFieldSchema(tokens.access_token),
          getMyCustomFields(tokens.access_token),
        ]);
        setCustomFieldSchema(schema);
        setCustomFieldValues(values.customFields || {});
      } catch {
        // Silently fail for custom fields
      }
    };
    fetchCustomFields();
  }, [tokens]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    if (name === "linkedinUrl") {
      setErrors((prev) => ({ ...prev, linkedinUrl: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    const linkedinError = validateLinkedinUrl(form.linkedinUrl);
    if (linkedinError) {
      newErrors.linkedinUrl = linkedinError;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setToast({ msg: "Image must be less than 2MB", type: "error" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleAvatarSave = async () => {
    if (!tokens?.access_token || avatarPreview === null) return;

    try {
      setAvatarSaving(true);
      await updateMyAvatar(tokens.access_token, { avatarUrl: avatarPreview });
      setProfile((prev) => prev ? { ...prev, avatarUrl: avatarPreview } : prev);
      setAvatarPreview(null);
      setToast({ msg: "Profile photo updated", type: "success" });
    } catch (err: unknown) {
      const error = err as { message?: string };
      setToast({ msg: error?.message || "Failed to update photo", type: "error" });
    } finally {
      setAvatarSaving(false);
    }
  };

  const handleAvatarRemove = async () => {
    if (!tokens?.access_token) return;

    try {
      setAvatarSaving(true);
      await updateMyAvatar(tokens.access_token, { avatarUrl: null });
      setProfile((prev) => prev ? { ...prev, avatarUrl: null } : prev);
      setAvatarPreview(null);
      setToast({ msg: "Profile photo removed", type: "success" });
    } catch (err: unknown) {
      const error = err as { message?: string };
      setToast({ msg: error?.message || "Failed to remove photo", type: "error" });
    } finally {
      setAvatarSaving(false);
    }
  };

  // Custom field change handler
  const onCustomFieldChange = (fieldId: string, value: string | number | boolean | null) => {
    setCustomFieldValues((prev) => ({ ...prev, [fieldId]: value }));
    setCustomFieldErrors((prev) => ({ ...prev, [fieldId]: "" }));
  };

  // Custom fields validation
  const validateCustomFields = useCallback((): boolean => {
    if (!customFieldSchema) return true;
    
    const errors: Record<string, string> = {};
    
    for (const field of customFieldSchema.fields) {
      if (!isFieldVisible(field, customFieldValues)) continue;
      
      const value = customFieldValues[field.id];
      const validation = field.validation || {};

      if (validation.required && (value === undefined || value === null || value === "")) {
        errors[field.id] = `${field.label} is required`;
        continue;
      }

      if (value === undefined || value === null || value === "") continue;

      if ((field.type === "text" || field.type === "textarea") && typeof value === "string") {
        if (validation.minLength && value.length < validation.minLength) {
          errors[field.id] = `Must be at least ${validation.minLength} characters`;
        }
        if (validation.maxLength && value.length > validation.maxLength) {
          errors[field.id] = `Must be at most ${validation.maxLength} characters`;
        }
      }

      if (field.type === "number") {
        const numVal = typeof value === "number" ? value : parseFloat(String(value));
        if (isNaN(numVal)) {
          errors[field.id] = "Must be a valid number";
        } else {
          if (validation.min !== undefined && numVal < validation.min) {
            errors[field.id] = `Must be at least ${validation.min}`;
          }
          if (validation.max !== undefined && numVal > validation.max) {
            errors[field.id] = `Must be at most ${validation.max}`;
          }
        }
      }
    }

    setCustomFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [customFieldSchema, customFieldValues]);

  // Save custom fields
  const onSaveCustomFields = async () => {
    if (!tokens?.access_token || !validateCustomFields()) return;

    try {
      setCustomFieldsSaving(true);
      const result = await updateMyCustomFields(tokens.access_token, customFieldValues);
      setCustomFieldValues(result.customFields);
      setToast({ msg: "Additional information saved", type: "success" });
    } catch (err: any) {
      if (err?.error?.errors) {
        setCustomFieldErrors(err.error.errors);
      } else {
        setToast({ msg: err?.message || "Failed to save", type: "error" });
      }
    } finally {
      setCustomFieldsSaving(false);
    }
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (offline) {
      setToast({ msg: "Cannot save while offline", type: "error" });
      return;
    }
    if (!tokens?.access_token) {
      window.location.href = "/login";
      return;
    }
    if (!validateForm()) {
      return;
    }
    try {
      setSaving(true);
      const payload: UpdateMemberProfilePayload = {
        phone: form.phone,
        address: form.address,
        linkedinUrl: form.linkedinUrl,
        otherSocials: form.otherSocials,
      };
      const updated = await updateCurrentMember(tokens.access_token, payload);
      setProfile(updated);
      setForm({
        phone: updated.phone || "",
        address: updated.address || "",
        linkedinUrl: updated.linkedinUrl || "",
        otherSocials: updated.otherSocials || "",
      });
      setToast({ msg: "Profile updated", type: "success" });
    } catch (err: unknown) {
      const error = err as { status?: number; error?: { message?: string } };
      if (error?.status === 401 || error?.status === 403) {
        logout();
        window.location.href = "/login";
      } else {
        setToast({ msg: error?.error?.message || "Save failed", type: "error" });
      }
    } finally {
      setSaving(false);
    }
  };

  const onDownload = async (invoiceId: string) => {
    if (!tokens?.access_token) return;
    try {
      const blob = await downloadInvoicePdf(tokens.access_token, invoiceId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoiceId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setToast({ msg: error?.message || "Download failed", type: "error" });
    }
  };

  // Loading state
  if (loading) {
    return (
      <Page title="Profile">
        <Card>
          <div style={{ 
            padding: "var(--space-8)", 
            textAlign: "center", 
            color: "var(--app-color-text-muted)" 
          }}>
            <div className="pr-skeleton" style={{ 
              width: 48, 
              height: 48, 
              borderRadius: "var(--radius-full)",
              margin: "0 auto var(--space-4)",
            }} />
            <div className="pr-skeleton pr-skeleton--text" style={{ maxWidth: 200, margin: "0 auto" }} />
          </div>
        </Card>
      </Page>
    );
  }

  // Error state with retry
  if (loadError) {
    return (
      <Page title="Profile">
        <Card>
          <div style={{ padding: "var(--space-8)", textAlign: "center" }}>
            <div style={{ 
              width: 64,
              height: 64,
              borderRadius: "var(--radius-full)",
              background: "var(--app-color-state-error-soft)",
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
            <h3 style={{ 
              fontSize: "var(--font-h3)", 
              fontWeight: "var(--font-weight-semibold)",
              margin: "0 0 var(--space-2) 0",
            }}>
              Failed to load profile
            </h3>
            <p style={{ 
              color: "var(--app-color-text-secondary)", 
              marginBottom: "var(--space-4)" 
            }}>
              {loadError}
            </p>
            <Button variant="secondary" onClick={fetchProfile}>
              Try again
            </Button>
          </div>
        </Card>
      </Page>
    );
  }

  const statusVariant = profile?.status === "active" ? "success" : "warning";

  return (
    <Page title="Profile" description="Manage your account information">
      {offline && (
        <div style={{ 
          padding: "var(--space-3)", 
          background: "var(--app-color-state-warning-soft)", 
          borderRadius: "var(--radius-md)",
          color: "var(--app-color-state-warning)",
          fontSize: "var(--font-body-sm)",
          marginBottom: "var(--space-4)",
        }}>
          You're offline – changes won't be saved
        </div>
      )}

      {/* Account info card */}
      <Card title="Account Information">
        <div style={{ 
          display: "flex", 
          alignItems: "flex-start", 
          gap: "var(--space-5)",
          marginBottom: "var(--space-6)",
          paddingBottom: "var(--space-6)",
          borderBottom: "1px solid var(--app-color-border-subtle)",
        }}>
          {/* Avatar section */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-2)" }}>
            <div style={{ position: "relative" }}>
              {avatarPreview || profile?.avatarUrl ? (
                <img
                  src={avatarPreview || profile?.avatarUrl || ""}
                  alt="Profile"
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: "var(--radius-full)",
                    objectFit: "cover",
                    border: "3px solid var(--app-color-border-subtle)",
                  }}
                />
              ) : (
                <div style={{
                  width: 80,
                  height: 80,
                  borderRadius: "var(--radius-full)",
                  background: "var(--app-color-primary-soft)",
                  color: "var(--app-color-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "var(--font-weight-bold)",
                  fontSize: "var(--font-h2)",
                  border: "3px solid var(--app-color-border-subtle)",
                }}>
                  {profile?.first_name?.charAt(0)}{profile?.last_name?.charAt(0)}
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              style={{ display: "none" }}
            />
            <div style={{ display: "flex", gap: "var(--space-2)", flexDirection: "column" }}>
              {avatarPreview ? (
                <>
                  <Button 
                    size="sm" 
                    onClick={handleAvatarSave} 
                    disabled={avatarSaving}
                    loading={avatarSaving}
                  >
                    Save Photo
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => setAvatarPreview(null)}
                    disabled={avatarSaving}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={offline}
                  >
                    {profile?.avatarUrl ? "Change Photo" : "Upload Photo"}
                  </Button>
                  {profile?.avatarUrl && (
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={handleAvatarRemove}
                      disabled={avatarSaving || offline}
                    >
                      Remove
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Member info */}
          <div style={{ flex: 1 }}>
            <h3 style={{ 
              margin: 0, 
              fontSize: "var(--font-h3)",
              fontWeight: "var(--font-weight-semibold)",
            }}>
              {profile?.first_name} {profile?.last_name}
            </h3>
            <p style={{ 
              margin: "var(--space-1) 0 0", 
              color: "var(--app-color-text-secondary)",
              fontSize: "var(--font-body-md)",
            }}>
              {profile?.email}
            </p>
            <div style={{ marginTop: "var(--space-2)" }}>
              <Tag variant={statusVariant}>{profile?.status}</Tag>
            </div>
          </div>
        </div>

        {/* Editable contact form */}
        <form onSubmit={onSave}>
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", 
            gap: "var(--space-4)" 
          }}>
            <FormField label="Phone">
              <input
                name="phone"
                className="pr-input"
                value={form.phone}
                onChange={onChange}
                disabled={saving || offline}
                placeholder="+1 555 123 4567"
              />
            </FormField>
            
            <FormField label="LinkedIn URL" error={errors.linkedinUrl}>
              <input
                name="linkedinUrl"
                className={`pr-input ${errors.linkedinUrl ? "pr-input--error" : ""}`}
                value={form.linkedinUrl}
                onChange={onChange}
                disabled={saving || offline}
                placeholder="https://linkedin.com/in/yourprofile"
              />
            </FormField>
          </div>

          <FormField label="Address">
            <textarea
              name="address"
              className="pr-input"
              value={form.address}
              onChange={onChange}
              disabled={saving || offline}
              rows={2}
              placeholder="City, Country"
              style={{ resize: "vertical" }}
            />
          </FormField>
          
          <FormField label="Other Socials">
            <input
              name="otherSocials"
              className="pr-input"
              value={form.otherSocials}
              onChange={onChange}
              disabled={saving || offline}
              placeholder="@twitter, etc."
            />
          </FormField>
          
          <div style={{ marginTop: "var(--space-4)" }}>
            <Button type="submit" disabled={saving || offline} loading={saving}>
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      {/* Custom Fields Section */}
      {customFieldSchema && customFieldSchema.fields.length > 0 && (
        <div style={{ marginTop: "var(--space-6)" }}>
          <Card title="Additional Information">
            {(() => {
              // Sort groups by order
              const sortedGroups = [...(customFieldSchema.groups || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
              const sortedFields = [...customFieldSchema.fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
              
              // Group fields by groupId
              const ungroupedFields = sortedFields.filter((f) => !f.groupId && isFieldVisible(f, customFieldValues));
              const groupedFieldsMap = new Map<string, CustomFieldDefinition[]>();
              
              for (const group of sortedGroups) {
                groupedFieldsMap.set(
                  group.id,
                  sortedFields.filter((f) => f.groupId === group.id && isFieldVisible(f, customFieldValues))
                );
              }

              const renderField = (field: CustomFieldDefinition) => {
                const value = customFieldValues[field.id];
                const error = customFieldErrors[field.id];

                return (
                  <FormField
                    key={field.id}
                    label={field.label}
                    required={field.validation?.required}
                    error={error}
                  >
                    {field.type === "text" && (
                      <input
                        className={`pr-input ${error ? "pr-input--error" : ""}`}
                        value={String(value || "")}
                        onChange={(e) => onCustomFieldChange(field.id, e.target.value)}
                        disabled={customFieldsSaving || offline}
                        placeholder={field.helpText}
                      />
                    )}
                    {field.type === "textarea" && (
                      <textarea
                        className={`pr-input ${error ? "pr-input--error" : ""}`}
                        value={String(value || "")}
                        onChange={(e) => onCustomFieldChange(field.id, e.target.value)}
                        disabled={customFieldsSaving || offline}
                        placeholder={field.helpText}
                        rows={3}
                        style={{ resize: "vertical" }}
                      />
                    )}
                    {field.type === "number" && (
                      <input
                        type="number"
                        className={`pr-input ${error ? "pr-input--error" : ""}`}
                        value={value !== null && value !== undefined ? String(value) : ""}
                        onChange={(e) => onCustomFieldChange(field.id, e.target.value ? parseFloat(e.target.value) : null)}
                        disabled={customFieldsSaving || offline}
                        placeholder={field.helpText}
                        min={field.validation?.min}
                        max={field.validation?.max}
                      />
                    )}
                    {field.type === "date" && (
                      <input
                        type="date"
                        className={`pr-input ${error ? "pr-input--error" : ""}`}
                        value={String(value || "")}
                        onChange={(e) => onCustomFieldChange(field.id, e.target.value)}
                        disabled={customFieldsSaving || offline}
                      />
                    )}
                    {field.type === "select" && (
                      <select
                        className={`pr-input ${error ? "pr-input--error" : ""}`}
                        value={String(value || "")}
                        onChange={(e) => onCustomFieldChange(field.id, e.target.value)}
                        disabled={customFieldsSaving || offline}
                      >
                        <option value="">Select...</option>
                        {(field.options || []).map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    )}
                    {field.type === "checkbox" && (
                      <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                        <input
                          type="checkbox"
                          checked={value === true || value === "true"}
                          onChange={(e) => onCustomFieldChange(field.id, e.target.checked)}
                          disabled={customFieldsSaving || offline}
                          style={{ width: 18, height: 18 }}
                        />
                        <span style={{ color: "var(--app-color-text-secondary)", fontSize: "var(--font-body-sm)" }}>
                          {field.helpText || "Yes"}
                        </span>
                      </label>
                    )}
                  </FormField>
                );
              };

              return (
                <>
                  {/* Grouped fields */}
                  {sortedGroups.map((group) => {
                    const groupFields = groupedFieldsMap.get(group.id) || [];
                    if (groupFields.length === 0) return null;
                    
                    return (
                      <div key={group.id} style={{ marginBottom: "var(--space-6)" }}>
                        <h4 style={{
                          margin: "0 0 var(--space-2) 0",
                          fontSize: "var(--font-body)",
                          fontWeight: "var(--font-weight-semibold)",
                          color: "var(--app-color-text-primary)",
                        }}>
                          {group.label}
                        </h4>
                        {group.description && (
                          <p style={{
                            margin: "0 0 var(--space-4) 0",
                            fontSize: "var(--font-caption)",
                            color: "var(--app-color-text-muted)",
                          }}>
                            {group.description}
                          </p>
                        )}
                        <div style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                          gap: "var(--space-4)",
                        }}>
                          {groupFields.map(renderField)}
                        </div>
                      </div>
                    );
                  })}

                  {/* Ungrouped fields */}
                  {ungroupedFields.length > 0 && (
                    <div style={{ marginBottom: "var(--space-4)" }}>
                      {sortedGroups.length > 0 && (
                        <h4 style={{
                          margin: "0 0 var(--space-4) 0",
                          fontSize: "var(--font-body)",
                          fontWeight: "var(--font-weight-semibold)",
                          color: "var(--app-color-text-primary)",
                        }}>
                          Other Information
                        </h4>
                      )}
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                        gap: "var(--space-4)",
                      }}>
                        {ungroupedFields.map(renderField)}
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: "var(--space-4)" }}>
                    <Button
                      onClick={onSaveCustomFields}
                      disabled={customFieldsSaving || offline}
                      loading={customFieldsSaving}
                    >
                      Save Additional Information
                    </Button>
                  </div>
                </>
              );
            })()}
          </Card>
        </div>
      )}

      {/* Outstanding Invoices Section */}
      <div style={{ marginTop: "var(--space-6)" }}>
        <Card title="Outstanding Invoices">
          {invoicesLoading ? (
            <div style={{ padding: "var(--space-4)", textAlign: "center", color: "var(--app-color-text-muted)" }}>
              Loading invoices...
            </div>
          ) : invoices.length === 0 ? (
            <div style={{ 
              padding: "var(--space-6)", 
              textAlign: "center", 
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
                <path d="M9 17H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4" />
                <path d="M12 15v6" />
                <path d="M9 18l3 3 3-3" />
              </svg>
              <p style={{ margin: 0 }}>No outstanding invoices</p>
            </div>
          ) : (
            <TableCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHeadCell>Description</TableHeadCell>
                    <TableHeadCell>Amount</TableHeadCell>
                    <TableHeadCell>Status</TableHeadCell>
                    <TableHeadCell>Due Date</TableHeadCell>
                    <TableHeadCell align="right">Action</TableHeadCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.invoice_id}>
                      <TableCell>{inv.description || "Invoice"}</TableCell>
                      <TableCell>{(inv.amount / 100).toFixed(2)} {inv.currency}</TableCell>
                      <TableCell>
                        <Tag 
                          variant={inv.status === "paid" ? "success" : inv.status === "overdue" ? "danger" : "warning"}
                        >
                          {inv.status}
                        </Tag>
                      </TableCell>
                      <TableCell>{inv.due_date || "N/A"}</TableCell>
                      <TableCell align="right">
                        <Button variant="ghost" size="sm" onClick={() => onDownload(inv.invoice_id)}>
                          Download PDF
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableCard>
          )}
        </Card>
      </div>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </Page>
  );
};
