import React, { useState } from "react";
import {
  createEventDraft,
  publishEvent,
  updateEventCapacity,
  registerForEvent,
  cancelEventRegistration,
  updateEventPricing,
  updateEventBanner,
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
  const [form, setForm] = useState({
    title: "",
    description: "",
    startDate: "",
    endDate: "",
    capacity: "",
    price: "",
    currency: "PHP",
    tags: "",
    registrationMode: "rsvp",
  });
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

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokens?.access_token) {
      setToast({ msg: "Login required", type: "error" });
      return;
    }
    try {
      setSubmitting(true);
      const capacityVal = form.capacity ? Number(form.capacity) : null;
      const priceVal = form.price ? Math.round(Number(form.price) * 100) : null;
      const tags = form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const createdEvent = await createEventDraft(tokens.access_token, {
        title: form.title,
        description: form.description,
        startDate: form.startDate,
        endDate: form.endDate,
        capacity: Number.isNaN(capacityVal as number) ? null : capacityVal,
        priceCents: Number.isNaN(priceVal as number) ? null : priceVal,
        currency: form.currency || null,
        tags,
        registrationMode: form.registrationMode as "pay_now" | "pay_later" | "either",
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
    <Page title="Events Admin" description="Create, publish, and manage event capacity/pricing.">
      <Card title="Create Event Draft">
        <form onSubmit={onSubmit}>
          <FormField label="Title">
            <input name="title" className="pr-input" value={form.title} onChange={onChange} required />
          </FormField>
          <FormField label="Description">
            <textarea name="description" className="pr-input" value={form.description} onChange={onChange} />
          </FormField>
          <FormField label="Start Date">
            <input type="datetime-local" name="startDate" className="pr-input" value={form.startDate} onChange={onChange} required />
          </FormField>
          <FormField label="End Date">
            <input type="datetime-local" name="endDate" className="pr-input" value={form.endDate} onChange={onChange} required />
          </FormField>
          <FormField label="Capacity (optional)">
            <input type="number" name="capacity" className="pr-input" value={form.capacity} onChange={onChange} />
          </FormField>
          <FormField label="Price (optional, e.g. 500.00)">
            <input type="number" name="price" className="pr-input" value={form.price} onChange={onChange} step="0.01" min="0" />
          </FormField>
          <FormField label="Currency">
            <input name="currency" className="pr-input" value={form.currency} onChange={onChange} />
          </FormField>
          <FormField label="Tags (comma separated)">
            <input name="tags" className="pr-input" value={form.tags} onChange={onChange} />
          </FormField>
          <FormField label="Registration mode">
            <select
              name="registrationMode"
              className="pr-input"
              value={form.registrationMode}
              onChange={(e) => setForm({ ...form, registrationMode: e.target.value })}
            >
              <option value="rsvp">RSVP (pay later)</option>
              <option value="pay_now">Pay now</option>
            </select>
          </FormField>
          <FormField label="Banner image">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setBannerFile(e.target.files?.[0] || null)}
            />
          </FormField>
          <Button type="submit" disabled={submitting} fullWidth>
            {submitting ? "Creating..." : "Create Event"}
          </Button>
        </form>
      </Card>

      <div style={{ display: "grid", gap: "var(--space-lg)", marginTop: "var(--space-lg)" }}>
        <Card title="Publish Event">
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
        </Card>

        <Card title="Update Capacity">
          <FormField label="Event ID">
            <input name="capacityId" className="pr-input" value={capacityId} onChange={(e) => setCapacityId(e.target.value)} />
          </FormField>
          <FormField label="Capacity">
            <input type="number" name="capacityValue" className="pr-input" value={capacityValue} onChange={(e) => setCapacityValue(e.target.value)} />
          </FormField>
          {actionButton("Save Capacity", !capacityId, async () =>
            updateEventCapacity(
              tokens!.access_token,
              capacityId,
              capacityValue === "" ? null : Number(capacityValue)
            )
          )}
        </Card>

        <Card title="Set Pricing">
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
        </Card>

        <Card title="Member Register (demo)">
          <FormField label="Event ID">
            <input name="registerEventId" className="pr-input" value={registerEventId} onChange={(e) => setRegisterEventId(e.target.value)} />
          </FormField>
          {actionButton("Register for Event", !registerEventId, async () => registerForEvent(tokens!.access_token, registerEventId))}
        </Card>

        <Card title="Cancel Registration (demo)">
          <FormField label="Event ID">
            <input name="cancelEventId" className="pr-input" value={cancelEventId} onChange={(e) => setCancelEventId(e.target.value)} />
          </FormField>
          {actionButton("Cancel Registration", !cancelEventId, async () => cancelEventRegistration(tokens!.access_token, cancelEventId))}
        </Card>
      </div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </Page>
  );
};

