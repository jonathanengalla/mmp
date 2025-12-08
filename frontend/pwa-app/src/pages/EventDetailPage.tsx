import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Page } from "../components/primitives/Page";
import { Card } from "../components/primitives/Card";
import { Button } from "../components/primitives/Button";
import { Tag } from "../components/primitives/Tag";
import { useSession } from "../hooks/useSession";
import { cancelEventRegistration, getEventDetail, registerForEvent } from "../api/client";
import { EventDetailDto } from "../../../../libs/shared/src/models";

const currencyDisplay = (priceCents?: number | null, currency?: string | null) => {
  if (priceCents === null || priceCents === undefined) return "Free";
  const unit = currency || "PHP";
  return `${unit} ${(priceCents / 100).toLocaleString()}`;
};

const TicketCode: React.FC<{ code: string }> = ({ code }) => (
  <div
    style={{
      border: "1px solid var(--app-color-border-subtle)",
      borderRadius: "var(--radius-medium)",
      padding: "var(--space-3)",
      background: "var(--app-color-surface-1)",
      display: "grid",
      gap: "var(--space-1)",
    }}
  >
    <div style={{ fontSize: "var(--font-caption)", color: "var(--app-color-text-muted)" }}>Ticket code</div>
    <div style={{ fontFamily: "monospace", fontWeight: 600, wordBreak: "break-all" }}>{code}</div>
    <div style={{ fontSize: "var(--font-caption)", color: "var(--app-color-text-muted)" }}>
      Show this ticket code at the event for check-in.
    </div>
  </div>
);

// NOTE: QR rendering was removed to avoid a peer dependency conflict with React 19.
// We now show a plain ticket code instead. A future React-19 compatible QR library
// can be wired in here without changing the API.
export const EventDetailPage: React.FC = () => {
  const { slugOrId = "" } = useParams<{ slugOrId: string }>();
  const navigate = useNavigate();
  const { tokens } = useSession();
  const [event, setEvent] = useState<EventDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const detail = await getEventDetail(tokens?.access_token || null, slugOrId);
      setEvent(detail);
    } catch (err: any) {
      setError(err?.message || err?.error?.message || "Failed to load event");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugOrId, tokens?.access_token]);

  const onRegister = async () => {
    if (!event) return;
    if (!tokens?.access_token) {
      setError("Login required");
      return;
    }
    if (event.registrationMode === "pay_now") {
      navigate(`/events/${detailSlugOrId}/checkout`);
      return;
    }
    try {
      setSubmitting(true);
      const updated = await registerForEvent(tokens.access_token, event.id);
      setEvent(updated);
    } catch (err: any) {
      setError(err?.message || err?.error?.message || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  const onCancel = async () => {
    if (!event) return;
    if (!tokens?.access_token) {
      setError("Login required");
      return;
    }
    try {
      setSubmitting(true);
      const updated = await cancelEventRegistration(tokens.access_token, event.id);
      setEvent(updated);
    } catch (err: any) {
      setError(err?.message || err?.error?.message || "Cancel failed");
    } finally {
      setSubmitting(false);
    }
  };

  const capacityLeft =
    event?.capacity != null ? (event.capacity - (event.registrationsCount || 0)) : null;
  const isRegistered = !!event?.isRegistered;
  const registrationDisabled = event?.status !== "published";
  const registrationMode = event?.registrationMode === "pay_now" ? "pay_now" : "rsvp";
  const registerLabel =
    registrationMode === "pay_now" ? "Register (invoice will be created)" : isRegistered ? "Update RSVP" : "RSVP";
  const cancelLabel = registrationMode === "pay_now" ? "Cancel registration" : "Cancel RSVP";
  const helperText =
    registrationMode === "pay_now"
      ? "Checkout will create an invoice you can pay before the event. Paying early secures your seat."
      : "No payment needed now. RSVP to save your spot.";
  const paymentStatusText =
    event?.paymentStatus === "paid"
      ? "Payment: Paid"
      : event?.paymentStatus === "pending"
      ? "Payment: Pending"
      : "Payment: Unpaid";
  const statusVariant =
    event?.status === "published"
      ? "success"
      : event?.status === "draft"
      ? "warning"
      : event?.status === "cancelled"
      ? "danger"
      : "default";
  const detailSlugOrId = event?.slug || slugOrId;
  const checkoutPath = `/events/${detailSlugOrId}/checkout`;

  return (
    <Page title={event?.title || "Event Detail"} description={event?.description || undefined}>
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
          <Card padding="none" variant="flat">
            {event.bannerImageUrl ? (
              <img
                src={event.bannerImageUrl}
                alt={event.title}
                style={{ width: "100%", maxHeight: 360, objectFit: "cover", borderRadius: "var(--radius-large)" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: 220,
                  borderRadius: "var(--radius-large)",
                  background:
                    "linear-gradient(135deg, var(--app-color-surface-2) 0%, var(--app-color-surface-3, var(--app-color-surface-2)) 100%)",
                }}
              />
            )}
          </Card>

          <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center", flexWrap: "wrap" }}>
            <Tag variant={statusVariant}>{event.status}</Tag>
            <Tag variant={registrationMode === "pay_now" ? "warning" : "info"}>
              {registrationMode === "pay_now" ? "Invoice required" : "RSVP"}
            </Tag>
            {(event.tags || []).map((tag) => (
              <Tag key={tag} variant="info">
                {tag}
              </Tag>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--space-lg)", alignItems: "flex-start" }}>
            <div style={{ display: "grid", gap: "var(--space-md)" }}>
              <Card title="Event details">
                <div style={{ display: "grid", gap: "var(--space-sm)" }}>
                  <div>
                    <div style={{ color: "var(--app-color-text-muted)" }}>Date / Time</div>
                    <div>{new Date(event.startDate).toLocaleString()}</div>
                    {event.endDate && <div>{new Date(event.endDate).toLocaleString()}</div>}
                  </div>
                  <div>
                    <div style={{ color: "var(--app-color-text-muted)" }}>Location</div>
                    <div>{event.location || "TBA"}</div>
                  </div>
                  <div>
                    <div style={{ color: "var(--app-color-text-muted)" }}>Capacity</div>
                    <div>
                      {event.capacity ?? "N/A"}
                      {capacityLeft != null && ` • ${capacityLeft} seats remaining`}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--app-color-text-muted)" }}>Price</div>
                    <div>{currencyDisplay(event.priceCents, event.currency)}</div>
                  </div>
                  {event.ticketCode && isRegistered && (
                    <div>
                      <div style={{ color: "var(--app-color-text-muted)" }}>Ticket code</div>
                      <TicketCode code={event.ticketCode} />
                    </div>
                  )}
                </div>
              </Card>
              <Card title="Description">
                <div style={{ whiteSpace: "pre-wrap", color: "var(--app-color-text-primary)" }}>
                  {event.description || "No description provided."}
                </div>
              </Card>
            </div>

            <div style={{ display: "grid", gap: "var(--space-md)" }}>
              <Card title="Registration">
                {registrationDisabled && <Tag variant="warning">Registration is not open for this event.</Tag>}
                {!isRegistered && !registrationDisabled && (
                  <>
                    <div style={{ color: "var(--app-color-text-muted)", marginBottom: "var(--space-sm)" }}>{helperText}</div>
                    <Button fullWidth disabled={submitting} onClick={onRegister}>
                      {submitting ? "Saving..." : registerLabel}
                    </Button>
                  </>
                )}
                {isRegistered && (
                  <div style={{ display: "grid", gap: "var(--space-sm)" }}>
                    <Tag variant={registrationMode === "pay_now" && event.paymentStatus !== "paid" ? "warning" : "success"}>
                      {registrationMode === "pay_now"
                        ? event.paymentStatus === "paid"
                          ? "Registered and paid"
                          : "Registered – payment outstanding"
                        : "You’re registered"}
                    </Tag>
                    <div style={{ color: "var(--app-color-text-muted)" }}>{helperText}</div>
                    <div>{paymentStatusText}</div>
                    <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                      {registrationMode === "pay_now" && (
                        <Button onClick={() => navigate("/invoices")}>View invoice</Button>
                      )}
                      <Button variant="secondary" disabled={submitting} onClick={onCancel}>
                        {submitting ? "Saving..." : cancelLabel}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
              <Card>
                <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                  {registrationMode === "pay_now" && !registrationDisabled && !isRegistered && (
                    <Button onClick={() => navigate(checkoutPath)}>Go to checkout</Button>
                  )}
                  <Button variant="secondary" onClick={() => navigate("/events/upcoming")}>
                    Back to events
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
};

export default EventDetailPage;

