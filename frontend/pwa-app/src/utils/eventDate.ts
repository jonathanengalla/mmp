const timeZone = "Asia/Manila";

const formatDatePart = (value: string) =>
  new Date(value).toLocaleDateString("en-PH", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const formatTimePart = (value: string) =>
  new Date(value).toLocaleTimeString("en-PH", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

export const formatEventDateRange = (startsAt: string, endsAt?: string | null, tz = timeZone): string => {
  // reuse above functions but honor optional tz if provided
  const datePart = (value: string) =>
    new Date(value).toLocaleDateString("en-PH", {
      timeZone: tz,
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  const timePart = (value: string) =>
    new Date(value).toLocaleTimeString("en-PH", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  const startDate = datePart(startsAt);
  if (!endsAt) return `${startDate}, ${timePart(startsAt)}`;

  const endDate = datePart(endsAt);
  if (startDate === endDate) {
    return `${startDate}, ${timePart(startsAt)} – ${timePart(endsAt)}`;
  }
  return `${startDate}, ${timePart(startsAt)} – ${endDate}, ${timePart(endsAt)}`;
};

export const isPastEvent = (endsAt?: string | null, startsAt?: string | null): boolean => {
  const ref = endsAt || startsAt;
  if (!ref) return false;
  return new Date(ref).getTime() < Date.now();
};

