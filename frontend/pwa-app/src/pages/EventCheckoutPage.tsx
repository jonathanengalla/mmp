import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Page } from "../components/primitives/Page";
import { Card } from "../components/primitives/Card";
import { Button } from "../components/primitives/Button";
import { Tag } from "../components/primitives/Tag";
import { useSession } from "../hooks/useSession";
import { eventCheckout } from "../api/client";
import { EventCheckoutResponse } from "../../../../libs/shared/src/models";

const formatAmount = (amountCents: number, currency?: string) => {
  const unit = currency || "PHP";
  return `${unit} ${(amountCents / 100).toFixed(2)}`;
};

export const EventCheckoutPage: React.FC = () => {
  const { slugOrId = "" } = useParams<{ slugOrId: string }>();
  const navigate = useNavigate();
  const { tokens } = useSession();
  const [data, setData] = useState<EventCheckoutResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!tokens?.access_token) {
      setError("Login required");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const resp = await eventCheckout(tokens.access_token, slugOrId);
      setData(resp);
    } catch (err: any) {
      setError(err?.message || err?.error?.message || "Unable to start checkout for this event.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugOrId, tokens?.access_token]);

  const event = data?.event;
  const invoice = data?.invoice || null;
  const detailPath = `/events/${event?.slug || event?.id || slugOrId}`;

  const renderInvoiceCard = () => {
    if (!invoice) return null;
    return (
      <Card title="Invoice summary">
        <div style={{ display: "grid", gap: "var(--space-sm)" }}>
          <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600 }}>Invoice ID: {invoice.id}</span>
            <Tag variant={invoice.status === "paid" ? "success" : invoice.status === "pending" ? "warning" : "default"}>
              {invoice.status}
            </Tag>
          </div>
          <div>Amount: {formatAmount(invoice.amountCents, invoice.currency)}</div>
          <div>Due date: {invoice.dueDate ? new Date(invoice.dueDate).toLocaleString() : "Not set"}</div>
          {invoice.eventTitle && <div>Event: {invoice.eventTitle}</div>}
          <div style={{ color: "var(--app-color-text-muted)" }}>
            Your registration is confirmed. An invoice has been created for this event. You can view it anytime under Invoices.
          </div>
        </div>
      </Card>
    );
  };

  const renderEventSummary = () => {
    if (!event) return null;
    return (
      <Card title="Event summary">
        <div style={{ display: "grid", gap: "var(--space-sm)" }}>
          <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center", flexWrap: "wrap" }}>
            <Tag variant="success">{event.status}</Tag>
            <Tag variant="info">{event.registrationMode === "pay_now" ? "Payment required" : "RSVP"}</Tag>
          </div>
          <div>
            <div style={{ color: "var(--app-color-text-muted)" }}>Title</div>
            <div style={{ fontWeight: 600 }}>{event.title}</div>
          </div>
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
            <div style={{ color: "var(--app-color-text-muted)" }}>Price</div>
            <div>{event.priceCents != null ? formatAmount(event.priceCents, event.currency || undefined) : "Free"}</div>
          </div>
        </div>
      </Card>
    );
  };

  const renderContent = () => {
    if (loading) return <Card>Starting checkout...</Card>;
    if (error) {
      return (
        <Card>
          <div style={{ color: "var(--app-color-state-error)" }}>{error}</div>
          <Button style={{ marginTop: "var(--space-sm)" }} onClick={load}>
            Retry
          </Button>
        </Card>
      );
    }
    if (!event) return <Card>Event not found.</Card>;

    if (event.registrationMode === "rsvp") {
      return (
        <div style={{ display: "grid", gap: "var(--space-lg)" }}>
          <Card title="RSVP confirmed">
            <div style={{ display: "grid", gap: "var(--space-md)" }}>
              <div>You’re registered for {event.title}. This event does not require payment.</div>
              <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                <Button onClick={() => navigate(detailPath)}>View event details</Button>
                <Button variant="secondary" onClick={() => navigate("/events")}>
                  Back to events
                </Button>
              </div>
            </div>
          </Card>
          {renderEventSummary()}
        </div>
      );
    }

    return (
      <div style={{ display: "grid", gap: "var(--space-lg)" }}>
        {renderEventSummary()}
        {renderInvoiceCard()}
        <Card>
          <div style={{ display: "grid", gap: "var(--space-sm)" }}>
            <div style={{ fontWeight: 600 }}>Next steps</div>
            <div style={{ color: "var(--app-color-text-muted)" }}>
              Please complete payment before the event. You can view this invoice anytime under Invoices.
            </div>
            <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
              <Button onClick={() => navigate("/invoices")}>Go to Invoices</Button>
              <Button variant="secondary" onClick={() => navigate(detailPath)}>
                Back to Event
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  };

  return <Page title="Event Checkout" description="Complete your event registration.">{renderContent()}</Page>;
};

export default EventCheckoutPage;


