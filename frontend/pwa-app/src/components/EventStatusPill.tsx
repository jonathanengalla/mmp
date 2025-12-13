import React from "react";
import { Tag } from "./primitives/Tag";
import { getEventStatusPill } from "../utils/eventHelpers";

type EventStatusPillProps = {
  status: string;
  endDate?: string | null;
};

/**
 * EventStatusPill component displays a status pill for events.
 * Shows: "Upcoming event", "Past event", or "Cancelled event"
 * 
 * Styling (per Zara's requirements):
 * - Upcoming: neutral or soft primary (success variant)
 * - Past: subtle neutral (default variant)
 * - Cancelled: soft danger (danger variant)
 */
export const EventStatusPill: React.FC<EventStatusPillProps> = ({ status, endDate }) => {
  const pillStatus = getEventStatusPill({ status, endDate });
  
  let label: string;
  let variant: "default" | "success" | "warning" | "danger" | "info";
  
  switch (pillStatus) {
    case "cancelled":
      label = "Cancelled event";
      variant = "danger";
      break;
    case "past":
      label = "Past event";
      variant = "default";
      break;
    case "upcoming":
      label = "Upcoming event";
      variant = "success";
      break;
    default:
      label = "Upcoming event";
      variant = "success";
  }

  return (
    <Tag 
      variant={variant} 
      size="md"
      style={{
        fontSize: "4rem",
        padding: "2rem 4rem",
        fontWeight: 600,
        lineHeight: "1.4",
        display: "inline-block",
      }}
    >
      {label}
    </Tag>
  );
};

