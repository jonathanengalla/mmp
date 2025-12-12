import React from "react";
import { formatCurrency, formatEventDateRange, getEventStateLabels } from "../utils/eventHelpers";

interface Event {
  id: string;
  title: string;
  description?: string;
  bannerUrl?: string;
  startsAt: string;
  endsAt: string;
  location?: string;
  priceCents: number;
  capacity: number | null;
  status?: string;
  registrations?: number;
}

interface EventCardProps {
  event: Event;
  onRegister?: () => void;
}

export function EventCard({ event, onRegister }: EventCardProps) {
  const labels = getEventStateLabels(event);
  const isRegistrationOpen = labels.registrationLabel === "Registration open";

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Banner */}
      {event.bannerUrl && (
        <img src={event.bannerUrl} alt={event.title} className="w-full h-48 object-cover" />
      )}

      <div className="p-4">
        {/* Title */}
        <h3 className="text-lg font-semibold line-clamp-2 mb-2">{event.title}</h3>

        {/* Description */}
        {event.description && <p className="text-sm text-gray-600 line-clamp-2 mb-3">{event.description}</p>}

        {/* Inline chips */}
        <div className="flex gap-2 mb-4">
          <span
            className={`inline-block px-2 py-1 text-xs rounded ${
              labels.eventStatusLabel === "Upcoming"
                ? "bg-blue-100 text-blue-800"
                : labels.eventStatusLabel === "Past event"
                ? "bg-gray-100 text-gray-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {labels.eventStatusLabel}
          </span>
          <span className="inline-block px-2 py-1 text-xs rounded bg-green-100 text-green-800">{labels.modeLabel}</span>
        </div>

        {/* Labeled details */}
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-semibold">When:</span> {formatEventDateRange(event.startsAt, event.endsAt)}
          </div>

          <div>
            <span className="font-semibold">Location:</span> {event.location || "Location TBA"}
          </div>

          <div>
            <span className="font-semibold">Cost:</span> {event.priceCents > 0 ? formatCurrency(event.priceCents / 100) : "Free"}
          </div>

          <div>
            <span className="font-semibold">Capacity:</span>{" "}
            <span className={labels.capacityLabel.startsWith("Over capacity") ? "text-red-600" : ""}>
              {labels.capacityLabel}
            </span>
          </div>

          <div>
            <span className="font-semibold">Registration:</span> {labels.registrationLabel}
          </div>
        </div>

        {/* Action button */}
        <div className="mt-4">
          {isRegistrationOpen ? (
            <button
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
              onClick={onRegister}
              type="button"
            >
              Register
            </button>
          ) : (
            <button
              className="w-full bg-gray-300 text-gray-600 py-2 rounded cursor-not-allowed"
              disabled
              type="button"
            >
              {labels.registrationLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default EventCard;
