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
 * - Upcoming: neutral/default variant
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
      variant = "default";
      break;
  }
  
  return <Tag variant={variant}>{label}</Tag>;
};

