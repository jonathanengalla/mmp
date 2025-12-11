import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EventDetailDto } from "../../../../libs/shared/src/models";
import { listEvents } from "../api/client";
import { useSession } from "../hooks/useSession";
import { Toast } from "../components/Toast";
import EventCard from "../components/EventCard";
import { PageShell, Card, Button, Input, Badge } from "../ui";

const EventsPage: React.FC = () => {
  const { tokens } = useSession();
  const navigate = useNavigate();
  const [items, setItems] = useState<EventDetailDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "upcoming" | "completed">("all");
  const [query, setQuery] = useState<string>("");

  const load = async () => {
    if (!tokens?.access_token) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const resp = await listEvents(tokens.access_token, { limit: 100 });
      setItems(resp.items || []);
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || "Failed to load events";
      setError(msg);
      setToast({ msg, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens?.access_token]);

  const availableTags = useMemo(() => [...new Set(items.flatMap((ev) => ev.tags || []))], [items]);

  const filteredItems = useMemo(() => {
    const now = Date.now();
    const byStatus = items.filter((ev) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "upcoming") return ev.status === "published" && new Date(ev.startDate).getTime() >= now;
      return ev.status === "completed";
    });
    const byTag = byStatus.filter((ev) => tagFilter === "all" || (ev.tags || []).includes(tagFilter));
    if (!query.trim()) return byTag;
    const q = query.toLowerCase();
    return byTag.filter((ev) => ev.title.toLowerCase().includes(q) || (ev.description || "").toLowerCase().includes(q));
  }, [items, statusFilter, tagFilter, query]);

  return (
    <PageShell
      title="Events"
      description="Upcoming and recent events for your tenant."
      actions={
        <div style={{ display: "flex", gap: "var(--app-space-sm)", flexWrap: "wrap" }}>
          <Input placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} style={{ minWidth: 200 }} />
          <select
            style={{
              minWidth: 140,
              padding: "10px 12px",
              borderRadius: "var(--app-radius-md)",
              border: "1px solid var(--app-color-border-subtle)",
              background: "var(--app-color-surface-0)",
              color: "var(--app-color-text-primary)",
            }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          >
            <option value="all">All</option>
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed</option>
          </select>
          <select
            style={{
              minWidth: 160,
              padding: "10px 12px",
              borderRadius: "var(--app-radius-md)",
              border: "1px solid var(--app-color-border-subtle)",
              background: "var(--app-color-surface-0)",
              color: "var(--app-color-text-primary)",
            }}
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
          >
            <option value="all">All tags</option>
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
          <Button variant="secondary" onClick={load}>
            Refresh
          </Button>
        </div>
      }
    >
      {loading && <Card>Loading events...</Card>}
      {!loading && error && (
        <Card>
          <div style={{ color: "var(--app-color-state-error)" }}>{error}</div>
          <Button style={{ marginTop: "var(--app-space-sm)" }} onClick={load}>
            Retry
          </Button>
        </Card>
      )}
      {!loading && !error && filteredItems.length === 0 && <Card>No events found.</Card>}
      {!loading && !error && filteredItems.length > 0 && (
        <div
          style={{
            display: "grid",
            gap: "var(--app-space-md)",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          }}
        >
          {filteredItems.map((ev) => {
            const slugOrId = ev.slug || ev.event_id || ev.id;
            const detailPath = `/events/${slugOrId}`;
            const checkoutPath = `/events/${slugOrId}/checkout`;
            const regMode = ev.registrationMode === "pay_now" ? "pay_now" : "rsvp";
            const status = ev.status || (new Date(ev.startDate).getTime() < Date.now() ? "completed" : undefined);
            const isPayNow = regMode === "pay_now";
            const remainingCapacity = ev.capacity != null ? Math.max(ev.capacity - (ev.registrationsCount || 0), 0) : null;
            const primaryLabel =
              regMode === "pay_now"
                ? ev.isRegistered
                  ? "View details"
                  : "Register (invoice required)"
                : ev.isRegistered
                ? "Manage"
                : "RSVP";
            const secondaryLabel =
              regMode === "pay_now"
                ? ev.isRegistered
                  ? "View invoice"
                  : undefined
                : ev.isRegistered
                ? "Cancel RSVP"
                : undefined;

            return (
              <EventCard
                key={ev.id || ev.event_id}
                id={ev.id || ev.event_id}
                slug={ev.slug}
                title={ev.title}
                status={status}
                description={ev.description}
                startDate={ev.startDate}
                endDate={ev.endDate}
                location={ev.location}
                bannerImageUrl={ev.bannerImageUrl}
                tags={ev.tags}
                registrationMode={regMode}
                isRegistered={ev.isRegistered}
                registrationStatus={ev.registrationStatus || undefined}
                paymentStatus={ev.paymentStatus || undefined}
                remainingCapacity={remainingCapacity}
                priceCents={ev.priceCents}
                currency={ev.currency}
                invoiceRequired={regMode === "pay_now"}
                primaryLabel={primaryLabel}
                secondaryLabel={secondaryLabel}
                onPrimaryClick={() => navigate(isPayNow && !ev.isRegistered ? checkoutPath : detailPath)}
                onSecondaryClick={
                  secondaryLabel
                    ? () => {
                        if (regMode === "pay_now") {
                          navigate("/invoices");
                        } else {
                          navigate(detailPath);
                        }
                      }
                    : undefined
                }
                footer={
                  <div style={{ display: "flex", gap: "var(--app-space-xs)", flexWrap: "wrap", alignItems: "center" }}>
                    {ev.tags &&
                      ev.tags.map((t) => (
                        <Badge key={t} variant="info">
                          {t}
                        </Badge>
                      ))}
                    <Badge variant={ev.status === "completed" ? "secondary" : "success"}>{ev.status}</Badge>
                  </div>
                }
              />
            );
          })}
        </div>
      )}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </PageShell>
  );
};

export default EventsPage;

