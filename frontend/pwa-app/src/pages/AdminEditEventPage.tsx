import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Page } from "../components/primitives/Page";
import { Card } from "../components/primitives/Card";
import { Button } from "../components/primitives/Button";
import { FormField } from "../components/primitives/FormField";
import { Tag } from "../components/primitives/Tag";
import { useSession } from "../hooks/useSession";
import {
  getEventDetail,
  publishEvent,
  updateEventBanner,
  updateEventBasics,
  updateEventCapacity,
  updateEventPricing,
  updateEventRegistrationMode,
  updateEventTags,
  uploadEventBanner,
} from "../api/client";
import { EventDetailDto } from "../../../../libs/shared/src/models";

export const AdminEditEventPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tokens } = useSession();

  const [event, setEvent] = useState<EventDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    startDate: "",
    endDate: "",
    location: "",
    registrationMode: "rsvp",
    capacity: "",
    priceCents: "",
    currency: "PHP",
    tags: "",
    bannerImageUrl: "",
  });

  const canSave = useMemo(() => !!form.title && !!form.startDate, [form.title, form.startDate]);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const load = async () => {
    if (!tokens?.access_token || !id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const detail = await getEventDetail(tokens.access_token, id);
      setEvent(detail);
      setForm({
        title: detail.title,
        description: detail.description || "",
        startDate: detail.startDate,
        endDate: detail.endDate || "",
        location: detail.location || "",
        registrationMode: detail.registrationMode,
        capacity: detail.capacity == null ? "" : String(detail.capacity),
        priceCents: detail.priceCents == null ? "" : String(detail.priceCents),
        currency: detail.currency || "PHP",
        tags: (detail.tags || []).join(", "),
        bannerImageUrl: detail.bannerImageUrl || "",
      });
    } catch (err: any) {
      setError(err?.message || err?.error?.message || "Failed to load event");
    } finally {
      setLoading(false);
    }
  };

  const onSelectBannerFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !tokens?.access_token || !id) return;
    const file = e.target.files[0];
    setBannerError(null);
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setBannerError("Please upload JPG, PNG, or WEBP.");
      return;
    }
    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      setBannerError("Please upload an image under 5 MB.");
      return;
    }
    try {
      setUploadingBanner(true);
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
      const resp = await uploadEventBanner(tokens.access_token, id, dataUrl);
      setForm((prev) => ({ ...prev, bannerImageUrl: resp.url }));
      setToast({ msg: "Banner uploaded", type: "success" });
    } catch (err: any) {
      setBannerError(err?.message || "Upload failed");
      setToast({ msg: err?.message || "Upload failed", type: "error" });
    } finally {
      setUploadingBanner(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tokens?.access_token]);

  const onSave = async () => {
    if (!tokens?.access_token || !event || !id) return;
    try {
      setSaving(true);
      setError(null);
      const updates: Promise<unknown>[] = [];
      const tags = form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const rawCapacity = form.capacity === "" ? null : Number(form.capacity);
      const capacityVal = Number.isNaN(rawCapacity as number) ? null : rawCapacity;
      const rawPrice = form.priceCents === "" ? null : Number(form.priceCents);
      const priceVal = Number.isNaN(rawPrice as number) ? null : rawPrice;

      const basicPatch: Record<string, unknown> = {};
      if (form.title !== event.title) basicPatch.title = form.title;
      if ((form.description || "") !== (event.description || "")) basicPatch.description = form.description;
      if (form.startDate !== event.startDate) basicPatch.startDate = form.startDate;
      if ((form.endDate || "") !== (event.endDate || "")) basicPatch.endDate = form.endDate || null;
      if ((form.location || "") !== (event.location || "")) basicPatch.location = form.location || null;
      if (Object.keys(basicPatch).length > 0) {
        updates.push(updateEventBasics(tokens.access_token, id, basicPatch));
      }

      if (form.registrationMode !== event.registrationMode) {
        updates.push(updateEventRegistrationMode(tokens.access_token, id, form.registrationMode as "pay_now" | "rsvp"));
      }

      if (
        (capacityVal === null && event.capacity !== null && event.capacity !== undefined) ||
        (capacityVal !== null && capacityVal !== event.capacity)
      ) {
        updates.push(updateEventCapacity(tokens.access_token, id, capacityVal));
      }

      if (
        (priceVal === null && event.priceCents !== null && event.priceCents !== undefined) ||
        (priceVal !== null && priceVal !== event.priceCents) ||
        (form.currency || "PHP") !== (event.currency || "PHP")
      ) {
        updates.push(
          updateEventPricing(tokens.access_token, id, {
            priceCents: priceVal,
            currency: form.currency || null,
          })
        );
      }

      if (JSON.stringify(tags) !== JSON.stringify(event.tags || [])) {
        updates.push(updateEventTags(tokens.access_token, id, tags));
      }

      if ((form.bannerImageUrl || "") !== (event.bannerImageUrl || "")) {
        updates.push(updateEventBanner(tokens.access_token, id, form.bannerImageUrl || null));
      }

      if (updates.length === 0) {
        setToast({ msg: "No changes to save", type: "success" });
      } else {
        await Promise.all(updates);
        setToast({ msg: "Event updated", type: "success" });
        await load();
      }
    } catch (err: any) {
      setError(err?.message || err?.error?.message || "Failed to save changes");
      setToast({ msg: err?.message || "Failed to save changes", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const onPublish = async () => {
    if (!tokens?.access_token || !id) return;
    try {
      setSaving(true);
      await publishEvent(tokens.access_token, id);
      setToast({ msg: "Event published", type: "success" });
      await load();
    } catch (err: any) {
      setError(err?.message || "Publish failed");
    } finally {
      setSaving(false);
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  return (
    <Page
      title="Edit Event"
      description="Adjust the essentials: title, schedule, registration mode, capacity, pricing, and tags."
      actions={
        event && (
          <Button variant="secondary" onClick={() => navigate(`/events/${event.slug || event.id}`)}>
            View as member
          </Button>
        )
      }
    >
      {loading && <Card>Loading event...</Card>}
      {!loading && error && (
        <Card>
          <div style={{ color: "var(--app-color-state-error)" }}>{error}</div>
          <Button style={{ marginTop: "var(--space-sm)" }} onClick={load}>
            Retry
          </Button>
        </Card>
      )}
      {!loading && event && (
        <div style={{ display: "grid", gap: "var(--space-lg)" }}>
          <Card title="Basics">
            <div style={{ display: "grid", gap: "var(--space-md)" }}>
              <FormField label="Title">
                <input name="title" className="pr-input" value={form.title} onChange={onChange} required />
              </FormField>
              <FormField label="Description">
                <textarea name="description" className="pr-input" value={form.description} onChange={onChange} rows={4} />
              </FormField>
              <div style={{ display: "grid", gap: "var(--space-md)", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                <FormField label="Start date/time">
                  <input type="datetime-local" name="startDate" className="pr-input" value={form.startDate} onChange={onChange} required />
                </FormField>
                <FormField label="End date/time">
                  <input type="datetime-local" name="endDate" className="pr-input" value={form.endDate} onChange={onChange} />
                </FormField>
                <FormField label="Location">
                  <input name="location" className="pr-input" value={form.location} onChange={onChange} placeholder="Venue or link" />
                </FormField>
              </div>
              <FormField label="Banner image">
                <div style={{ display: "grid", gap: "var(--space-sm)" }}>
                  {form.bannerImageUrl ? (
                    <img
                      src={form.bannerImageUrl}
                      alt="Banner preview"
                      style={{ width: "100%", maxWidth: 360, borderRadius: "8px", objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        maxWidth: 360,
                        height: 160,
                        borderRadius: "8px",
                        background: "var(--app-color-surface-2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--app-color-text-muted)",
                      }}
                    >
                      No banner uploaded yet
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={uploadingBanner}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploadingBanner ? "Uploading..." : "Change banner"}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      style={{ display: "none" }}
                      onChange={onSelectBannerFile}
                    />
                    <div style={{ color: "var(--app-color-text-muted)", fontSize: 12 }}>
                      JPG, PNG, or WEBP. Max 5 MB.
                    </div>
                  </div>
                  <div>
                    <input
                      name="bannerImageUrl"
                      className="pr-input"
                      value={form.bannerImageUrl}
                      onChange={onChange}
                      placeholder="Or paste an image URL..."
                    />
                  </div>
                  {bannerError && <div style={{ color: "var(--app-color-state-error)" }}>{bannerError}</div>}
                </div>
              </FormField>
            </div>
          </Card>

          <Card title="Registration settings">
            <div style={{ display: "grid", gap: "var(--space-md)" }}>
              <FormField label="Mode">
                <select
                  name="registrationMode"
                  className="pr-input"
                  value={form.registrationMode}
                  onChange={onChange}
                >
                  <option value="rsvp">RSVP (no invoice upfront)</option>
                  <option value="pay_now">Pay-now (invoice created)</option>
                </select>
              </FormField>
              <div style={{ display: "grid", gap: "var(--space-md)", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                <FormField label="Capacity (optional)">
                  <input type="number" name="capacity" className="pr-input" value={form.capacity} onChange={onChange} />
                </FormField>
                <FormField label="Price (cents)">
                  <input type="number" name="priceCents" className="pr-input" value={form.priceCents} onChange={onChange} min={0} />
                </FormField>
                <FormField label="Currency">
                  <input name="currency" className="pr-input" value={form.currency} onChange={onChange} />
                </FormField>
              </div>
              <FormField label="Tags (comma separated)">
                <input name="tags" className="pr-input" value={form.tags} onChange={onChange} placeholder="e.g. networking, workshop" />
              </FormField>
              <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                <Button disabled={!canSave || saving} onClick={onSave}>
                  {saving ? "Saving..." : "Save changes"}
                </Button>
                {event.status === "draft" && (
                  <Button variant="secondary" disabled={saving} onClick={onPublish}>
                    Publish
                  </Button>
                )}
              </div>
              {toast && (
                <Tag variant={toast.type === "success" ? "success" : "danger"}>{toast.msg}</Tag>
              )}
            </div>
          </Card>
        </div>
      )}
    </Page>
  );
};

export default AdminEditEventPage;

