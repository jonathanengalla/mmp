# Events UX Redesign Specification

**Last Updated:** January 11, 2025  
**Status:** Phase 1 In Progress

## Overview
Member-facing event cards and admin event management flows with clear delete/cancel safeguards, capacity handling, and consistent currency/date formatting.

## Member Events Grid
- No circular pills; inline chips for status and mode.
- Labeled details: When, Location, Cost, Capacity, Registration.
- Date formatting uses Asia/Manila timezone.
- Capacity states include over-capacity warning in red.
- Registration button disabled when closed/full/cancelled.

## Admin Events Dashboard
- Container: max-w-[1440px] with horizontal scroll fallback.
- Columns: Title (chips), When, Capacity, Price, Revenue, Actions.
- Delete only when no invoices/registrations; otherwise Cancel.
- Capacity shows over-capacity in red.
- Currency displays as ₱ with two decimals.

## Event Status Model
- Enum: DRAFT, PUBLISHED, CANCELLED, ARCHIVED (legacy COMPLETED retained).
- Member visibility: status=PUBLISHED and deletedAt=null.
- Cancel: sets status=CANCELLED; keeps invoices/registrations.
- Delete: soft delete (deletedAt) only when no invoices/registrations; returns EVENT_HAS_ACTIVITY otherwise.

## Capacity Management
- Increase always allowed.
- Decrease blocked below current registrations → CAPACITY_TOO_LOW.
- Display examples:
  - "80 of 120 seats filled (40 left)"
  - "Full (120 of 120 seats filled)"
  - "Over capacity: 130 of 120 seats filled" (red)

## Currency Display
- All PHP amounts as: ₱X,XXX.XX via `formatCurrency(amount)`.
- For stored cents: divide by 100 before formatting.

## Backend Touchpoints
- `prisma/schema.prisma`: EventStatus enum with ARCHIVED; deletedAt; defaults.
- `src/eventsHandlers.ts`: list/filter events, delete/cancel/update with validations.
- `src/server.ts`: admin routes for list/delete/cancel/update.

## Frontend Touchpoints
- `src/utils/eventHelpers.ts`: currency/date/label helpers.
- `src/components/EventCard.tsx`: member card layout.
- `src/pages/AdminEventsDashboardPage.tsx`: admin table with chips/actions.

## Testing Checklist
- [ ] Member cards match layout and states.
- [ ] Admin dashboard renders without horizontal scroll on 1440px.
- [ ] Delete blocked with invoices/registrations → EVENT_HAS_ACTIVITY.
- [ ] Cancel works and preserves data.
- [ ] Capacity validation enforced (CAPACITY_TOO_LOW).
- [ ] Currency displays with ₱ and two decimals.
- [ ] Over capacity shows red.
- [ ] Soft-deleted events hidden from members.

