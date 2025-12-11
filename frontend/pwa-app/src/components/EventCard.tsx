import React from "react";
import { Card } from "./primitives/Card";
import { Tag } from "./primitives/Tag";
import { Button } from "./primitives/Button";

export interface EventCardProps {
  id: string;
  slug?: string | null;
  title: string;
  description?: string | null;
  startDate: string;
  endDate?: string | null;
  location?: string | null;
  bannerImageUrl?: string | null;
  tags?: string[] | null;
  registrationMode: "rsvp" | "pay_now";
  isRegistered?: boolean;
  registrationStatus?: string | null;
  paymentStatus?: string | null;
  remainingCapacity?: number | null;
  priceCents?: number | null;
  currency?: string | null;
  onPrimaryClick: () => void;
  onSecondaryClick?: () => void;
  primaryLabel: string;
  secondaryLabel?: string;
  disabled?: boolean;
}

const formatDateRange = (start: string, end?: string | null) => {
  const startStr = new Date(start).toLocaleString();
  if (!end) return startStr;
  return `${startStr} - ${new Date(end).toLocaleString()}`;
};

const formatPrice = (priceCents?: number | null, currency?: string | null) => {
  if (priceCents == null) return "Free";
  const unit = currency || "PHP";
  return `${unit} ${(priceCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const EventCard: React.FC<EventCardProps> = ({
  title,
  description,
  startDate,
  endDate,
  location,
  bannerImageUrl,
  tags,
  registrationMode,
  isRegistered,
  registrationStatus,
  paymentStatus,
  remainingCapacity,
  priceCents,
  currency,
  onPrimaryClick,
  onSecondaryClick,
  primaryLabel,
  secondaryLabel,
  disabled,
}) => {
  const isPastEvent = new Date(startDate).getTime() < Date.now();
  const modeLabel = registrationMode === "pay_now" ? "Invoice required" : "RSVP";
  const paymentLabel =
    paymentStatus === "paid"
      ? "Paid"
      : paymentStatus === "pending"
      ? "Payment pending"
      : paymentStatus === "unpaid"
      ? "Payment outstanding"
      : null;

  const registrationLabel = isRegistered ? registrationStatus || "Registered" : "Not registered";

  return (
    <Card>
      <div style={{ display: "grid", gap: "var(--space-md)" }}>
        <div
          style={{
            position: "relative",
            width: "100%",
            paddingTop: "32%",
            background: "var(--app-color-surface-1)",
            borderRadius: "var(--radius-large)",
            overflow: "hidden",
            border: "1px solid var(--app-color-border-subtle)",
          }}
        >
          {bannerImageUrl ? (
            <img
              src={bannerImageUrl}
              alt={title}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                  "linear-gradient(135deg, var(--app-color-surface-2) 0%, var(--app-color-surface-3, var(--app-color-surface-2)) 100%)",
                color: "var(--app-color-text-muted)",
                fontWeight: 600,
              }}
            >
              Upcoming Event
            </div>
          )}
        </div>

        <div style={{ display: "grid", gap: "var(--space-sm)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-sm)" }}>
            <div style={{ display: "grid", gap: "var(--space-xxs)" }}>
              <div style={{ fontSize: "var(--font-body-lg)", fontWeight: 700 }}>{title}</div>
              {description && (
                <div style={{ color: "var(--app-color-text-muted)", lineHeight: 1.4 }}>{description}</div>
              )}
            </div>
            <div style={{ display: "flex", gap: "var(--space-xxs)", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <Tag variant={registrationMode === "pay_now" ? "warning" : "info"}>{modeLabel}</Tag>
              {isRegistered && <Tag variant="success">{registrationLabel}</Tag>}
              {paymentLabel && <Tag variant={paymentStatus === "paid" ? "success" : "warning"}>{paymentLabel}</Tag>}
            </div>
          </div>

          <div style={{ display: "flex", gap: "var(--space-md)", flexWrap: "wrap", color: "var(--app-color-text-muted)" }}>
            <span>{formatDateRange(startDate, endDate)}</span>
            <span>•</span>
            <span>{location || "Location TBA"}</span>
            <span>•</span>
            <span>{formatPrice(priceCents, currency)}</span>
          </div>

          {tags && tags.length > 0 && (
            <div style={{ display: "flex", gap: "var(--space-xxs)", flexWrap: "wrap" }}>
              {tags.map((tag) => (
                <Tag key={tag} variant="info" size="sm">
                  {tag}
                </Tag>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap", alignItems: "center" }}>
            {remainingCapacity != null && (
              <Tag variant={remainingCapacity > 0 ? "default" : "danger"} size="sm">
                {remainingCapacity > 0 ? `${remainingCapacity} seats left` : "Full"}
              </Tag>
            )}
            {isRegistered && registrationStatus === "cancelled" && (
              <Tag variant="warning" size="sm">
                Registration cancelled
              </Tag>
            )}
            {isPastEvent && (
              <Tag variant="default" size="sm">
                Event ended
              </Tag>
            )}
          </div>

          {!isPastEvent && (
            <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
              <Button onClick={onPrimaryClick} disabled={disabled}>
                {primaryLabel}
              </Button>
              {secondaryLabel && onSecondaryClick && (
                <Button variant="secondary" onClick={onSecondaryClick} disabled={disabled}>
                  {secondaryLabel}
                </Button>
              )}
            </div>
          )}
          {isPastEvent && (
            <div style={{ color: "var(--app-color-text-muted)" }}>
              Registration closed
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default EventCard;
