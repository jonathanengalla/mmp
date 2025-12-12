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
    <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col h-full">
      {/* Banner - fixed height */}
      {event.bannerUrl && (
        <img src={event.bannerUrl} alt={event.title} className="w-full h-40 object-cover" />
      )}

      <div className="p-4 flex flex-col flex-grow">
        {/* Title */}
        <h3 className="text-lg font-semibold line-clamp-2 mb-2">{event.title}</h3>

        {/* Description */}
        {event.description && <p className="text-sm text-gray-600 line-clamp-2 mb-3">{event.description}</p>}

        {/* Inline chips */}
        <div className="flex gap-2 mb-3">
          <span
            className={`inline-block px-2 py-1 text-xs rounded ${
              labels.eventStatusLabel === "Upcoming"
                ? "bg-blue-100 text-blue-800"
                : labels.eventStatusLabel === "Past event"
                ? "bg-gray-100 text-gray-800"
                : labels.eventStatusLabel === "Cancelled"
                ? "bg-red-100 text-red-800"
                : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {labels.eventStatusLabel}
          </span>
          <span className="inline-block px-2 py-1 text-xs rounded bg-green-100 text-green-800">{labels.modeLabel}</span>
        </div>

        {/* Labeled details */}
        <div className="space-y-1.5 text-sm mb-4 flex-grow">
          <div>
            <span className="text-xs font-semibold text-gray-500">When:</span>{" "}
            <span className="text-sm text-gray-700">{formatEventDateRange(event.startsAt, event.endsAt)}</span>
          </div>

          <div>
            <span className="text-xs font-semibold text-gray-500">Location:</span>{" "}
            <span className="text-sm text-gray-700">{event.location || "Location TBA"}</span>
          </div>

          <div>
            <span className="text-xs font-semibold text-gray-500">Cost:</span>{" "}
            <span className="text-sm text-gray-700">
              {event.priceCents > 0 ? formatCurrency(event.priceCents / 100) : "Free"}
            </span>
          </div>

          <div>
            <span className="text-xs font-semibold text-gray-500">Capacity:</span>{" "}
            <span
              className={`text-sm ${
                labels.capacityLabel.startsWith("Full") &&
                event.capacity !== null &&
                event.registrations !== undefined &&
                event.registrations > event.capacity
                  ? "text-red-600 font-medium"
                  : "text-gray-700"
              }`}
            >
              {labels.capacityLabel}
            </span>
          </div>

          <div>
            <span className="text-xs font-semibold text-gray-500">Registration:</span>{" "}
            <span className="text-sm text-gray-700">{labels.registrationLabel}</span>
          </div>
        </div>

        {/* Action button */}
        <div className="mt-auto">
          {isRegistrationOpen ? (
            <button
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
              onClick={onRegister}
              type="button"
            >
              Register
            </button>
          ) : (
            <button className="w-full bg-gray-300 text-gray-600 py-2 rounded cursor-not-allowed" disabled type="button">
              {labels.registrationLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default EventCard;
