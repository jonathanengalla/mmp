import { parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

/**
 * Format currency in Philippine Pesos
 */
export function formatCurrency(amount: number): string {
  return `₱${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format event date range for Asia/Manila timezone
 * Single day: "Jun 15, 2025, 6:00 PM to 12:00 AM"
 * Multi-day: "Oct 3, 2025, 7:00 PM to Oct 4, 2025, 4:00 AM"
 */
export function formatEventDateRange(startsAt: string, endsAt: string, tz: string = "Asia/Manila"): string {
  const start = parseISO(startsAt);
  const end = parseISO(endsAt);

  const startDate = formatInTimeZone(start, tz, "MMM d, yyyy");
  const endDate = formatInTimeZone(end, tz, "MMM d, yyyy");
  const startTime = formatInTimeZone(start, tz, "h:mm a");
  const endTime = formatInTimeZone(end, tz, "h:mm a");

  // Single day event
  if (startDate === endDate) {
    return `${startDate}, ${startTime} to ${endTime}`;
  }

  // Multi-day event
  return `${startDate}, ${startTime} to ${endDate}, ${endTime}`;
}

/**
 * Get event state labels for display
 */
export function getEventStateLabels(
  event: {
    status?: string;
    startsAt: string;
    endsAt: string;
    priceCents: number;
    capacity: number | null;
    registrations?: number;
  },
  now: Date = new Date(),
) {
  const startsAt = parseISO(event.startsAt);
  const endsAt = parseISO(event.endsAt);
  const registrations = event.registrations || 0;

  // Event status label
  let eventStatusLabel = "Upcoming";
  if (event.status === "CANCELLED") {
    eventStatusLabel = "Cancelled";
  } else if (now >= endsAt) {
    eventStatusLabel = "Past event";
  }

  // Mode label
  const modeLabel = event.priceCents > 0 ? "Paid event" : "Free event";

  // Capacity label
  let capacityLabel = "No limit";
  if (event.capacity !== null) {
    const filled = registrations;
    const total = event.capacity;
    const available = total - filled;

    if (filled > total) {
      // Over capacity
      capacityLabel = `Over capacity: ${filled} of ${total} seats filled`;
    } else if (filled === total) {
      // Full
      capacityLabel = `Full (${filled} of ${total} seats filled)`;
    } else {
      // Available
      capacityLabel = `${filled} of ${total} seats filled (${available} left)`;
    }
  }

  // Registration label
  let registrationLabel = "Registration open";

  if (event.status === "CANCELLED") {
    registrationLabel = "Event cancelled";
  } else if (now >= startsAt) {
    registrationLabel = "Registration closed";
  } else if (event.capacity !== null && registrations >= event.capacity) {
    registrationLabel = "Registration full";
  }

  return {
    eventStatusLabel,
    registrationLabel,
    capacityLabel,
    modeLabel,
  };
}

