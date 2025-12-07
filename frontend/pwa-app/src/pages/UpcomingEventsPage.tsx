import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listUpcomingEvents } from "../api/client";
import { useSession } from "../hooks/useSession";
import { Toast } from "../components/Toast";
import { Page } from "../components/primitives/Page";
import { Card } from "../components/primitives/Card";
import { Button } from "../components/primitives/Button";
import EventCard from "../components/EventCard";
import { UpcomingEventDto } from "../../../../libs/shared/src/models";

export const UpcomingEventsPage: React.FC = () => {
  const { tokens } = useSession();
  const navigate = useNavigate();
  const [items, setItems] = useState<UpcomingEventDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [query, setQuery] = useState<string>("");

  const load = async () => {
    if (!tokens?.access_token) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const resp = await listUpcomingEvents(tokens.access_token);
      setItems(resp || []);
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
    const byTag = items.filter((ev) => tagFilter === "all" || (ev.tags || []).includes(tagFilter));
    if (!query.trim()) return byTag;
    const q = query.toLowerCase();
    return byTag.filter((ev) => ev.title.toLowerCase().includes(q) || (ev.description || "").toLowerCase().includes(q));
  }, [items, tagFilter, query]);

  return (
    <Page
      title="Upcoming Events"
      description="Browse what’s next and register with a single click. Invoice-first for paid events, RSVP for the rest."
      actions={
        <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
          <input
            className="pr-input"
            placeholder="Search by title"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ minWidth: 200 }}
          />
          <select className="pr-input" style={{ minWidth: 160 }} value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
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
          <div style={{ color: "var(--color-error)" }}>{error}</div>
          <Button style={{ marginTop: "var(--space-sm)" }} onClick={load}>
            Retry
          </Button>
        </Card>
      )}
      {!loading && !error && filteredItems.length === 0 && <Card>No upcoming events found.</Card>}
      {!loading && !error && filteredItems.length > 0 && (
        <div
          style={{
            display: "grid",
            gap: "var(--space-md)",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          }}
        >
          {filteredItems.map((ev) => {
            const slugOrId = ev.slug || ev.event_id;
            const detailPath = `/events/${slugOrId}`;
            const checkoutPath = `/events/${slugOrId}/checkout`;
            const regMode = ev.registrationMode === "pay_now" ? "pay_now" : "rsvp";
            const isPayNow = regMode === "pay_now";
            const remainingCapacity =
              ev.capacity != null ? Math.max(ev.capacity - (ev.registrationsCount || 0), 0) : null;
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
                key={ev.event_id}
                id={ev.event_id}
                slug={ev.slug}
                title={ev.title}
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
              />
            );
          })}
        </div>
      )}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </Page>
  );
};

