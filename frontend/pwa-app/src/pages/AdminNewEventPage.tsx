import React, { useState } from "react";
import {
  createEventDraft,
  publishEvent,
  updateEventCapacity,
  registerForEvent,
  cancelEventRegistration,
  updateEventPricing,
  updateEventBanner,
  updateEventBasics,
} from "../api/client";
import { useSession } from "../hooks/useSession";
import { Toast } from "../components/Toast";
import { Page } from "../components/primitives/Page";
import { Card } from "../components/primitives/Card";
import { Button } from "../components/primitives/Button";
import { FormField } from "../components/primitives/FormField";
import { EventDetailDto } from "../../../../libs/shared/src/models";

export const AdminNewEventPage: React.FC = () => {
  const { tokens } = useSession();
  const [pricingType, setPricingType] = useState<"free" | "paid">("free");
  const [form, setForm] = useState({
    title: "",
    description: "",
    startDate: "",
    endDate: "",
    eventType: "IN_PERSON" as "IN_PERSON" | "ONLINE",
    location: "",
    capacity: "",
    price: "",
    registrationMode: "rsvp" as "rsvp" | "pay_now",
    tags: "",
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<EventDetailDto | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [publishingId, setPublishingId] = useState("");
  const [capacityId, setCapacityId] = useState("");
  const [capacityValue, setCapacityValue] = useState("");
  const [registerEventId, setRegisterEventId] = useState("");
  const [cancelEventId, setCancelEventId] = useState("");
  const [pricingId, setPricingId] = useState("");
  const [pricingPrice, setPricingPrice] = useState("");
  const [pricingCurrency, setPricingCurrency] = useState("PHP");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!form.title.trim()) {
      errors.title = "Title is required";
    }
    if (!form.startDate) {
      errors.startDate = "Start date is required";
    }
    if (!form.endDate) {
      errors.endDate = "End date is required";
    }
    if (pricingType === "paid") {
      const priceNum = Number(form.price);
      if (!form.price || priceNum <= 0 || Number.isNaN(priceNum)) {
        errors.price = "Price must be greater than 0 for paid events";
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    if (validationErrors[name]) {
      setValidationErrors({ ...validationErrors, [name]: "" });
    }
  };

  const handlePricingTypeChange = (type: "free" | "paid") => {
    setPricingType(type);
    if (type === "free") {
      // Reset price and force RSVP mode for free events
      setForm({ ...form, price: "", registrationMode: "rsvp" });
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      setToast({ msg: "Please fix validation errors", type: "error" });
      return;
    }
    if (!tokens?.access_token) {
      setToast({ msg: "Login required", type: "error" });
      return;
    }
    try {
      setSubmitting(true);
      const capacityVal = form.capacity ? Number(form.capacity) : null;
      
      // Business rules: Free events must have price 0 and RSVP mode
      const finalPrice = pricingType === "free" ? 0 : (form.price ? Math.round(Number(form.price) * 100) : null);
      const finalRegistrationMode = pricingType === "free" ? "rsvp" : form.registrationMode;

      const tags = form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const createdEvent = await createEventDraft(tokens.access_token, {
        title: form.title,
        description: form.description,
        startDate: form.startDate,
        endDate: form.endDate,
        location: form.location || null,
        capacity: Number.isNaN(capacityVal as number) ? null : capacityVal,
        priceCents: finalPrice,
        currency: "PHP", // Hardcoded for RCME
        tags,
        registrationMode: finalRegistrationMode as "rsvp" | "pay_now",
        eventType: form.eventType,
      });

      if (bannerFile) {
        const dataUrl = await fileToDataUrl(bannerFile);
        await updateEventBanner(tokens.access_token, createdEvent.id, dataUrl);
        createdEvent.bannerImageUrl = dataUrl;
      }
      setCreated(createdEvent);
      setPublishingId(createdEvent.id);
      setCapacityId(createdEvent.id);
      setPricingId(createdEvent.id);
      setRegisterEventId(createdEvent.id);
      setCancelEventId(createdEvent.id);
      setToast({ msg: "Event draft created", type: "success" });
    } catch (err: any) {
      setToast({ msg: err?.error?.message || err?.message || "Failed to create event", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const actionButton = (label: string, disabled: boolean, handler: () => Promise<void>) => (
    <Button
      fullWidth
      disabled={disabled || submitting}
      onClick={async () => {
        if (!tokens?.access_token) {
          setToast({ msg: "Login required", type: "error" });
          return;
        }
        try {
          setSubmitting(true);
          await handler();
        } catch (err: any) {
          setToast({ msg: err?.error?.message || err?.message || "Action failed", type: "error" });
        } finally {
          setSubmitting(false);
        }
      }}
    >
      {submitting ? "Working..." : label}
    </Button>
  );

  return (
    <Page title="Create Event" description="Create a new event for your organization.">
      {/* Main Event Creation Form */}
      <Card title="Create Event">
        <form onSubmit={onSubmit}>
          {/* Section 1: Event Details */}
          <div style={{ display: "grid", gap: "var(--space-lg)", marginBottom: "var(--space-lg)" }}>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "var(--space-sm)" }}>Event Details</h3>
            <FormField label="Title" error={validationErrors.title}>
              <input name="title" className="pr-input" value={form.title} onChange={onChange} required />
            </FormField>
            <FormField label="Description">
              <textarea name="description" className="pr-input" value={form.description} onChange={onChange} rows={4} />
            </FormField>
            <div style={{ display: "grid", gap: "var(--space-md)", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              <FormField label="Start date & time" error={validationErrors.startDate}>
                <input type="datetime-local" name="startDate" className="pr-input" value={form.startDate} onChange={onChange} required />
              </FormField>
              <FormField label="End date & time" error={validationErrors.endDate}>
                <input type="datetime-local" name="endDate" className="pr-input" value={form.endDate} onChange={onChange} required />
              </FormField>
            </div>
            <FormField label="Event type">
              <select name="eventType" className="pr-input" value={form.eventType} onChange={onChange}>
                <option value="IN_PERSON">In-person</option>
                <option value="ONLINE">Online (Webinar/Zoom)</option>
              </select>
            </FormField>
            <FormField label={form.eventType === "ONLINE" ? "Online event link" : "Venue / location"}>
              <input
                name="location"
                className="pr-input"
                value={form.location}
                onChange={onChange}
                placeholder={form.eventType === "ONLINE" ? "Zoom link or meeting URL" : "Venue name and address"}
              />
              {form.eventType === "ONLINE" && (
                <div style={{ fontSize: "0.875rem", color: "var(--app-color-text-muted)", marginTop: "0.25rem" }}>
                  Zoom link or meeting URL
                </div>
              )}
            </FormField>
            <FormField label="Capacity (optional)">
              <input type="number" name="capacity" className="pr-input" value={form.capacity} onChange={onChange} min="1" />
            </FormField>
            <FormField label="Banner image">
              <input type="file" accept="image/*" onChange={(e) => setBannerFile(e.target.files?.[0] || null)} />
            </FormField>
            <FormField label="Tags (comma separated)">
              <input name="tags" className="pr-input" value={form.tags} onChange={onChange} placeholder="e.g. networking, workshop" />
            </FormField>
          </div>

          {/* Section 2: Pricing & Registration */}
          <div style={{ display: "grid", gap: "var(--space-lg)", marginBottom: "var(--space-lg)", paddingTop: "var(--space-lg)", borderTop: "1px solid var(--app-color-border)" }}>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "var(--space-sm)" }}>Pricing & Registration</h3>
            
            {/* Free vs Paid Toggle */}
            <FormField label="Event type">
              <div style={{ display: "flex", gap: "var(--space-md)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="pricingType"
                    value="free"
                    checked={pricingType === "free"}
                    onChange={(e) => handlePricingTypeChange("free")}
                  />
                  <span>Free event</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="pricingType"
                    value="paid"
                    checked={pricingType === "paid"}
                    onChange={(e) => handlePricingTypeChange("paid")}
                  />
                  <span>Paid event</span>
                </label>
              </div>
            </FormField>

            {/* Free Event UI */}
            {pricingType === "free" && (
              <div>
                <FormField label="Registration mode">
                  <input
                    type="text"
                    className="pr-input"
                    value="RSVP only (no payment, attendance tracking only)"
                    readOnly
                    disabled
                    style={{ backgroundColor: "var(--app-color-surface-2)", cursor: "not-allowed" }}
                  />
                </FormField>
                <div style={{ fontSize: "0.875rem", color: "var(--app-color-text-muted)", marginTop: "0.25rem" }}>
                  Free events do not create invoices. Registrations are for headcount and attendance only.
                </div>
              </div>
            )}

            {/* Paid Event UI */}
            {pricingType === "paid" && (
              <div style={{ display: "grid", gap: "var(--space-md)" }}>
                <FormField label="Price per attendee" error={validationErrors.price}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                    <span style={{ fontSize: "0.875rem", color: "var(--app-color-text-muted)" }}>₱</span>
                    <input
                      type="number"
                      name="price"
                      className="pr-input"
                      value={form.price}
                      onChange={onChange}
                      step="0.01"
                      min="0.01"
                      style={{ flex: 1 }}
                      placeholder="0.00"
                    />
                    <span style={{ fontSize: "0.875rem", color: "var(--app-color-text-muted)" }}>PHP</span>
                  </div>
                </FormField>
                <FormField label="Registration mode">
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="registrationMode"
                        value="rsvp"
                        checked={form.registrationMode === "rsvp"}
                        onChange={onChange}
                      />
                      <span>RSVP (pay later)</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="registrationMode"
                        value="pay_now"
                        checked={form.registrationMode === "pay_now"}
                        onChange={onChange}
                      />
                      <span>Pay now</span>
                    </label>
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "var(--app-color-text-muted)", marginTop: "0.5rem" }}>
                    {form.registrationMode === "rsvp" ? (
                      <span>Reserve a seat. You can generate invoices later from the admin tools.</span>
                    ) : (
                      <span>Member registers and immediately receives an invoice.</span>
                    )}
                  </div>
                </FormField>
              </div>
            )}
          </div>

          <Button type="submit" disabled={submitting} fullWidth>
            {submitting ? "Creating..." : "Create Event"}
          </Button>
        </form>
      </Card>

      {/* Developer Tools Section */}
      <div style={{ marginTop: "var(--space-xl)", paddingTop: "var(--space-lg)", borderTop: "2px solid var(--app-color-border)" }}>
        <Card
          title={
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.25rem" }}>Developer tools (internal testing)</h3>
              <div style={{ fontSize: "0.75rem", color: "var(--app-color-text-muted)", fontWeight: 400 }}>
                These controls call APIs directly by ID. Not for normal admin use.
              </div>
            </div>
          }
        >
          <div style={{ display: "grid", gap: "var(--space-lg)" }}>
            <div>
              <FormField label="Event ID">
                <input name="publishingId" className="pr-input" value={publishingId} onChange={(e) => setPublishingId(e.target.value)} />
              </FormField>
              {actionButton("Publish Event", !publishingId, async () => {
                const updated = await publishEvent(tokens!.access_token, publishingId);
                setCreated(updated);
              })}
              {created && (
                <Button variant="secondary" fullWidth style={{ marginTop: "var(--space-sm)" }} onClick={() => window.open(`/events/${created.slug || created.id}`, "_blank")}>
                  View Event Page
                </Button>
              )}
            </div>

            <div>
              <FormField label="Event ID">
                <input name="capacityId" className="pr-input" value={capacityId} onChange={(e) => setCapacityId(e.target.value)} />
              </FormField>
              <FormField label="Capacity">
                <input type="number" name="capacityValue" className="pr-input" value={capacityValue} onChange={(e) => setCapacityValue(e.target.value)} />
              </FormField>
              {actionButton("Save Capacity", !capacityId, async () =>
                updateEventCapacity(tokens!.access_token, capacityId, capacityValue === "" ? null : Number(capacityValue))
              )}
            </div>

            <div>
              <FormField label="Event ID">
                <input name="pricingId" className="pr-input" value={pricingId} onChange={(e) => setPricingId(e.target.value)} />
              </FormField>
              <FormField label="Price (cents)">
                <input type="number" name="pricingPrice" className="pr-input" value={pricingPrice} onChange={(e) => setPricingPrice(e.target.value)} min={0} />
              </FormField>
              <FormField label="Currency">
                <input name="pricingCurrency" className="pr-input" value={pricingCurrency} onChange={(e) => setPricingCurrency(e.target.value)} />
              </FormField>
              {actionButton("Save Pricing", !pricingId || Number(pricingPrice) < 0, async () =>
                updateEventPricing(tokens!.access_token, pricingId, {
                  priceCents: pricingPrice === "" ? null : Number(pricingPrice),
                  currency: pricingCurrency || null,
                })
              )}
            </div>

            <div>
              <FormField label="Event ID">
                <input name="registerEventId" className="pr-input" value={registerEventId} onChange={(e) => setRegisterEventId(e.target.value)} />
              </FormField>
              {actionButton("Register for Event", !registerEventId, async () => registerForEvent(tokens!.access_token, registerEventId))}
            </div>

            <div>
              <FormField label="Event ID">
                <input name="cancelEventId" className="pr-input" value={cancelEventId} onChange={(e) => setCancelEventId(e.target.value)} />
              </FormField>
              {actionButton("Cancel Registration", !cancelEventId, async () => cancelEventRegistration(tokens!.access_token, cancelEventId))}
            </div>
          </div>
        </Card>
      </div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </Page>
  );
};
