import React from "react";
import { formatCurrency, formatEventDateRange, getEventStateLabels } from "../utils/eventHelpers";
import { EventStatusPill } from "./EventStatusPill";

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
  onClick?: () => void;
}

export function EventCard({ event, onRegister, onClick }: EventCardProps) {
  const labels = getEventStateLabels(event);
  const isRegistrationOpen = labels.registrationLabel === "Registration open";

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on the register button or its container
    if ((e.target as HTMLElement).closest('button, [role="button"]')) {
      return;
    }
    if (onClick) {
      onClick();
    }
  };

  return (
    <div 
      className="bg-white rounded-lg shadow overflow-hidden flex flex-col h-full cursor-pointer hover:shadow-lg transition-shadow"
      onClick={handleCardClick}
    >
      {/* Banner - fixed height */}
      {event.bannerUrl && (
        <img src={event.bannerUrl} alt={event.title} className="w-full h-40 object-cover" />
      )}

      <div className="p-4 flex flex-col flex-grow">
        {/* Title */}
        <h3 className="text-lg font-semibold line-clamp-2 mb-2">{event.title}</h3>

        {/* Description */}
        {event.description && <p className="text-sm text-gray-600 line-clamp-2 mb-3">{event.description}</p>}

        {/* Status Pill */}
        <div className="mb-4">
          <EventStatusPill status={event.status || "published"} endDate={event.endsAt} />
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
        <div className="mt-auto pt-2">
          {isRegistrationOpen ? (
            <button
              className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-all shadow-md hover:shadow-lg text-base"
              onClick={onRegister}
              type="button"
            >
              Register Now
            </button>
          ) : (
            <button className="w-full bg-gray-200 text-gray-500 font-medium py-3 px-4 rounded-lg cursor-not-allowed text-base" disabled type="button">
              {labels.registrationLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default EventCard;
