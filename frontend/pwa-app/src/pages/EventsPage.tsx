import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EventDetailDto, EventsAdminSummary, EventsSelfSummary } from "../../../../libs/shared/src/models";
import { listEvents, getEventsAdminSummary, getMyEventsSummary } from "../api/client";
import { useSession } from "../hooks/useSession";
import { Toast } from "../components/Toast";
import EventCard from "../components/EventCard";
import { PageShell, Card, Button, Input } from "../ui";

const EventsPage: React.FC = () => {
  const { tokens, hasRole } = useSession();
  const navigate = useNavigate();
  const [items, setItems] = useState<EventDetailDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "upcoming" | "completed">("all");
  const [query, setQuery] = useState<string>("");
  const [adminSummary, setAdminSummary] = useState<EventsAdminSummary | null>(null);
  const [selfSummary, setSelfSummary] = useState<EventsSelfSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState<boolean>(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const isAdminSummaryView =
    hasRole?.("admin") || hasRole?.("event_manager") || hasRole?.("finance_manager") || hasRole?.("super_admin");

  useEffect(() => {
    let cancelled = false;
    const loadSummary = async () => {
      if (!tokens?.access_token) {
        setSummaryLoading(false);
        setAdminSummary(null);
        setSelfSummary(null);
        return;
      }
      setSummaryLoading(true);
      setSummaryError(null);
      try {
        if (isAdminSummaryView) {
          const data = await getEventsAdminSummary(tokens.access_token);
          if (!cancelled) {
            setAdminSummary(data);
            setSelfSummary(null);
          }
        } else {
          const data = await getMyEventsSummary(tokens.access_token);
          if (!cancelled) {
            setSelfSummary(data);
            setAdminSummary(null);
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setSummaryError(err?.message || err?.error?.message || "Unable to load events summary right now");
          setAdminSummary(null);
          setSelfSummary(null);
        }
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    };
    loadSummary();
    return () => {
      cancelled = true;
    };
  }, [tokens?.access_token, isAdminSummaryView]);

  const formatCurrency = (amountCents?: number, currency = "PHP") => {
    const amount = (amountCents ?? 0) / 100;
    return new Intl.NumberFormat("en-PH", { style: "currency", currency, minimumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (iso?: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString();
  };

  const renderNumber = (value: number | undefined) =>
    summaryLoading ? <div className="pr-skeleton" style={{ height: 22, width: 64 }} /> : <span>{value ?? 0}</span>;

  const renderAdminSummaryTiles = () => {
    const summary = adminSummary;
    return (
      <div
        style={{
          display: "grid",
          gap: "var(--app-space-sm)",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <Card>
          <div style={{ color: "var(--app-color-text-muted)", fontSize: "var(--app-font-label)" }}>Upcoming events</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>
            {renderNumber(summary?.upcomingEventsCount ?? 0)}
          </div>
          <div style={{ color: "var(--app-color-text-muted)", fontSize: "var(--app-font-body)" }}>
            {summaryLoading
              ? "Loading next event..."
              : summary?.nextEvent
              ? `Next: ${summary.nextEvent.title} • ${formatDate(summary.nextEvent.startsAt)}`
              : "No upcoming events"}
          </div>
        </Card>
        <Card>
          <div style={{ color: "var(--app-color-text-muted)", fontSize: "var(--app-font-label)" }}>Registrations (next 30 days)</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>
            {renderNumber(summary?.registrationsNext30Days.registrationsCount ?? 0)}
          </div>
          <div style={{ color: "var(--app-color-text-muted)", fontSize: "var(--app-font-body)" }}>
            {summary?.registrationsNext30Days.capacityTotal
              ? `${summary?.registrationsNext30Days.registrationsCount ?? 0} of ${
                  summary?.registrationsNext30Days.capacityTotal
                } seats filled`
              : "in the next 30 days"}
          </div>
        </Card>
        <Card>
          <div style={{ color: "var(--app-color-text-muted)", fontSize: "var(--app-font-label)" }}>Event revenue this year</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>
            {summaryLoading ? (
              <div className="pr-skeleton" style={{ height: 22, width: 120 }} />
            ) : (
              formatCurrency(summary?.eventRevenueThisYearCents)
            )}
          </div>
          <div style={{ color: "var(--app-color-text-muted)", fontSize: "var(--app-font-body)" }}>From paid event invoices</div>
        </Card>
        <Card>
          <div style={{ color: "var(--app-color-text-muted)", fontSize: "var(--app-font-label)" }}>Free vs paid mix</div>
          <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>
            {summaryLoading ? (
              <div className="pr-skeleton" style={{ height: 22, width: 140 }} />
            ) : (
              <>Paid: {summary?.paidEventsCount ?? 0}, Free: {summary?.freeEventsCount ?? 0}</>
            )}
          </div>
          <div style={{ color: "var(--app-color-text-muted)", fontSize: "var(--app-font-body)" }}>Upcoming published events</div>
        </Card>
      </div>
    );
  };

  const renderMemberSummaryTiles = () => {
    const summary = selfSummary;
    return (
      <div
        style={{
          display: "grid",
          gap: "var(--app-space-sm)",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        }}
      >
        <Card>
          <div style={{ color: "var(--app-color-text-muted)", fontSize: "var(--app-font-label)" }}>My upcoming events</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>
            {renderNumber(summary?.myUpcomingRegistrations ?? 0)}
          </div>
        </Card>
        <Card>
          <div style={{ color: "var(--app-color-text-muted)", fontSize: "var(--app-font-label)" }}>Events attended this year</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>
            {renderNumber(summary?.eventsAttendedThisYear ?? 0)}
          </div>
        </Card>
        <Card>
          <div style={{ color: "var(--app-color-text-muted)", fontSize: "var(--app-font-label)" }}>Open events</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>
            {renderNumber(summary?.openRegistrationsCount ?? 0)}
          </div>
          <div style={{ color: "var(--app-color-text-muted)", fontSize: "var(--app-font-body)" }}>
            events you can still register for
          </div>
        </Card>
      </div>
    );
  };

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
      <div style={{ marginBottom: "var(--app-space-lg)" }}>
        {summaryError && (
          <Card>
            <div style={{ color: "var(--app-color-state-error)" }}>{summaryError}</div>
          </Card>
        )}
        {!summaryError && (isAdminSummaryView ? renderAdminSummaryTiles() : renderMemberSummaryTiles())}
      </div>

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
        <div className="max-w-6xl mx-auto px-4 pb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredItems.map((ev) => {
              const slugOrId = ev.slug || ev.event_id || ev.id;
              const detailPath = `/events/${slugOrId}`;
              const checkoutPath = `/events/${slugOrId}/checkout`;
              const regMode = ev.registrationMode === "pay_now" ? "pay_now" : "rsvp";
              const eventForCard = {
                id: ev.id || ev.event_id,
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
        </div>
      )}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </PageShell>
  );
};

export default EventsPage;

