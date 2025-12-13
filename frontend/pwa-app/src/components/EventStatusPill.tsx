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
 * Styling:
 * - Upcoming: success/green variant (active color)
 * - Past: subtle neutral (default variant)
 * - Cancelled: danger variant
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
  
  // Custom styling for upcoming events - darker green with white text
  const isUpcoming = pillStatus === "upcoming";
  const customStyle: React.CSSProperties = {
    fontSize: "2.5rem", // doubled from 1.25rem
    padding: "2rem 4rem", // doubled from 1rem 2rem
    fontWeight: 700,
    lineHeight: "1.4",
    display: "inline-block",
    borderRadius: "var(--radius-md, 0.5rem)",
    ...(isUpcoming ? {
      backgroundColor: "#059669", // darker green (emerald-600)
      color: "#ffffff", // white text
      border: "none"
    } : {})
  };

  return (
    <div style={{ display: "inline-block" }}>
      <Tag 
        variant={variant} 
        size="lg"
        style={customStyle}
      >
        {label}
      </Tag>
    </div>
  );
};

