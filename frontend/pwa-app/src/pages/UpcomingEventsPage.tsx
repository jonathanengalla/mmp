import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listUpcomingEvents } from "../api/client";
import { useSession } from "../hooks/useSession";
import { Toast } from "../components/Toast";
import { PageShell, Card, Button, Input } from "../ui";
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
    <PageShell
      title="Upcoming Events"
      description="Browse what’s next and register with a single click. Invoice-first for paid events, RSVP for the rest."
      actions={
        <div style={{ display: "flex", gap: "var(--app-space-sm)", flexWrap: "wrap" }}>
          <Input
            placeholder="Search by title"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ minWidth: 200 }}
          />
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
      {!loading && !error && filteredItems.length === 0 && <Card>No upcoming events found.</Card>}
      {!loading && !error && filteredItems.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((ev) => {
            const slugOrId = ev.slug || ev.event_id;
            const detailPath = `/events/${slugOrId}`;
            const checkoutPath = `/events/${slugOrId}/checkout`;
            const regMode = ev.registrationMode === "pay_now" ? "pay_now" : "rsvp";
            const eventForCard = {
              id: ev.event_id,
              title: ev.title,
              description: ev.description || undefined,
              bannerUrl: ev.bannerImageUrl || undefined,
              startsAt: ev.startDate,
              endsAt: ev.endDate || ev.startDate,
              location: ev.location || undefined,
              priceCents: ev.priceCents ?? 0,
              capacity: ev.capacity ?? null,
              status: ev.status?.toUpperCase?.(),
              registrations: ev.registrationsCount ?? 0,
            };

            const handleRegister = () => {
              navigate(regMode === "pay_now" && !ev.isRegistered ? checkoutPath : detailPath);
            };

            return <EventCard key={eventForCard.id} event={eventForCard} onRegister={handleRegister} />;
          })}
        </div>
      )}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </PageShell>
  );
};

