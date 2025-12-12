# OneLedger Events & Registration System  
## Master Implementation & Delivery Plan

**Last Updated:** January 12, 2025  
**Project:** RCME Member Portal / OneLedger  
**Status:** In Progress - Phase 1 Active  
**Scope:** RCME tenant first, designed to generalize to other clubs and tenants

---

## 0. Purpose of this Document

This is the single source of truth for how Events, Registration, Attendance, and Event-linked Invoicing work in OneLedger.

- Product and business source for Zara and Jon  
- Alignment reference for developers (Claude + BMad devs)  
- Anchor for tickets (BKS, EVT) and future docs  

All other event-related specs are either superseded or referenced as supporting detail. If something here conflicts with older docs, this document wins.

---

## 1. Executive Summary

We are implementing a clear events and registration system that separates three concerns:

1. **Event management**  
   Creating and managing events (free or paid, in person or online).

2. **Registration**  
   Members, guests, and sponsors signing up for events, with or without payment.

3. **Attendance**  
   Tracking who actually showed up or participated, independent of payment.

Events are the core function of the club. Payment and invoices sit on top of that foundation. Member management and basic finance are already stable, and we will not destabilize those.

---

## 2. Business Context and Problem Statement

### Current Problems

- Free events sometimes create invoices, which they never should.
- It is not clear when invoices are created during registration.
- Attendance tracking is mixed up with payment tracking.
- Finance metrics are polluted with zero amount invoices and noisy event data.
- Admins do not have explicit controls for registration modes.
- There is no clear model for online events and manual attendance credit.
- The system does not distinguish well between:
  - Members
  - Guests invited by members
  - Sponsors or donor registrations

### Impact

- Finance dashboard does not fully reflect reality.
- Admins are unsure when money is owed versus when someone just RSVP’d.
- Members see invoices they do not expect, or do not see invoices they should.
- Attendance, engagement, and recognition cannot be tracked cleanly.
- It is harder to scale to other Rotary style clubs and tenants.

---

## 3. Core Concepts and Definitions

These are the shared definitions the whole system must respect.

### 3.1 Entities

- **Event**  
  A scheduled activity organized by the club. Can be:
  - In person (physical venue)
  - Online (Zoom, webinar, hybrid)

- **Registration**  
  A commitment to attend, created when a member or guest signs up for an event.

- **Attendance**  
  A record that someone actually attended or participated, set by admin via check in or mark attended.

- **Invoice**  
  A record of money owed or paid. Tied to:
  - Membership dues
  - Donations
  - Paid events only

- **Tenant**  
  A club or organization using OneLedger. Example: RCME.  
  The design should naturally extend beyond RCME.

### 3.2 Event Price

- `price = 0` → Free event  
- `price > 0` → Paid event  

Price is stored once on the event and used as the default invoice amount for any event invoices.

### 3.3 Registration Mode

Defines what happens at the moment of registration:

- `RSVP`  
  - Hold a seat.
  - No invoice created at registration.
  - Admin can generate invoices later for paid events.

- `PAY_NOW`  
  - Hold a seat.
  - Invoice created immediately at registration for paid events.
  - Member sees invoice right away.

### 3.4 Attendance

Attendance answers the question: **did they actually attend**.

- Stored as `checkedInAt` timestamp on the registration.
- Works for both in person and online events.
- Does not modify invoices.

### 3.5 Roles and Personas

- **Member**  
  Fully onboarded club member.

- **Guest**  
  A person invited to an event, may be:
  - A guest of a member
  - A prospective member
  - A sponsor rep

- **Admin**  
  Portal admin, can manage events, finance, and attendance.

- **Treasurer / Finance Role**  
  Focused on invoices, payments, financial reporting.

- **Event Chair / Event Owner**  
  Event level admin for a specific event. May not have full tenant admin rights but can:
  - View registrations
  - Mark attendance
  - Trigger invoice generation if allowed

---

## 4. Core Business Rules

### Rule 1: Invoice = Money Owed or Paid

Invoices are created only for financial transactions.

- Membership dues → Always create invoice  
- Donations → Always create invoice (always fully paid or paid at creation)  
- Paid events → Create invoice only when business rules say so  
- Free events → Never create invoices  

There must be **no** zero amount invoices for events.

### Rule 2: Separate Event, Registration, and Attendance

1. **Event price**  
   Defines how much this event costs per person.  
   - Zero means free.
   - Greater than zero means paid.

2. **Registration mode**  
   Defines whether an invoice is created at registration for paid events.  
   - Free events are always RSVP.

3. **Attendance**  
   Defines who actually participated, independent of payment.  
   - Works for in person and online.

### Rule 3: Free Events

- Free events must use `RSVP` only.
- Admin UI must lock registration mode to “RSVP only (attendance tracking)”.
- Backend must enforce that free events cannot be configured with `PAY_NOW`.
- Free event registrations:
  - Create registrations.
  - Never create invoices.
- Attendance is still tracked:
  - For engagement.
  - For recognition.
  - For communication.

Free events must not affect Finance revenue metrics.

### Rule 4: Paid Events

For `price > 0`:

- Admin chooses `RSVP` or `PAY_NOW`:

  - **RSVP mode**  
    - Member registers.
    - Registration created.
    - No invoice created yet.
    - Admin can later generate invoices in bulk or individually.

  - **PAY_NOW mode**  
    - Member registers.
    - Registration created.
    - Invoice created immediately with:
      - `source = EVT`
      - Status `ISSUED`
    - Member sees invoice in their list.

### Rule 5: Attendance for In Person and Online

- Attendance is set manually by admin or event chair.
- UI label:
  - “Check in” for in person.
  - “Mark attended” for online.
- Attendance can be undone.
- Attendance does not change invoices.

### Rule 6: Guests and Sponsors (Business Lens)

Even if not fully implemented in Phase 1, the model must allow:

- Guests to register with:
  - Contact info
  - Relationship to member (optional)
- Sponsors or corporate tables to be handled via:
  - Separate invoice
  - Possibly grouped registrations

We are not implementing all sponsor flows yet, but we must not block them with design choices.

---

## 5. What Is Already Complete

### 5.1 Member Management (Stable, Do Not Break)

- Member CRUD
- Member profiles and photos
- Member roster and directory
- Member status management
- Pending members workflow
- Roles and permissions
- Member search and filtering

### 5.2 Invoices and Finance (Working, Needs Event Alignment)

- Dues invoices creation and tracking
- Donation invoices creation and tracking
- Finance dashboard tiles and revenue mix
- Invoice lists for admin and member
- Invoice number generation pattern:  
  `{TENANT}-{YEAR}-{TYPE}-{SEQ}`  
  Example:  
  - RCME 2025 Dues: `RCME-2025-DUES-001`  
  - RCME 2025 Events: `RCME-2025-EVT-001`  
  - RCME 2025 Donations: `RCME-2025-DON-001`
- Finance metrics already exclude zero amount invoices

Required adjustment: event invoices must align with new registration rules.

### 5.3 Events UX (Partially Complete)

- Member facing events grid is live.
- Admin events dashboard exists with:
  - Soft delete via `deletedAt`
  - Cancel versus delete rules
  - Capacity constraints (cannot reduce below current registrations)
- Event status model in code:
  - DRAFT
  - PUBLISHED
  - CANCELLED
  - ARCHIVED
- Member endpoints already filter out deleted events and non published events in most paths.

Still missing:

- Event creation form controls for registration mode.
- Clean separation between free and paid events.
- Attendance tracking and report.
- Bulk and individual invoice generation for RSVP events.

---

## 6. Implementation Plan – 4 Phases

### Phase 1 – Schema and Clean Slate (Current Phase)

**Goal:** Add missing database fields and clean rcme dev event data so we are not fighting legacy noise.

**Changes:**

1. **Schema Fields**
   - Event:
     - `registrationMode` enum: `RSVP` | `PAY_NOW`
   - EventRegistration:
     - `checkedInAt` DateTime? for attendance

2. **Data Reset for rcme dev**
   - Delete all Events and EventRegistrations for rcme dev tenant.
   - Keep:
     - Members
     - Dues invoices
     - Donation invoices
     - Finance history unrelated to events

**Business Impact:**

- All future RCME event testing runs on a clean foundation.
- Member and finance baselines remain intact.
- We avoid constantly patching bad seed data.

**Success:**

- Schema fields exist and are used in code.
- rcme dev has no legacy events or registrations.
- Finance dashboard still reflects dues and donations correctly.

---

### Phase 2 – Event Creation and Registration Logic

**Goal:** Ensure events and registrations behave correctly for free and paid cases.

#### 2A. Event Creation Form (Admin)

UI must show:

- Event Type:
  - In person
  - Online (Webinar or Zoom)
- Location:
  - Physical address or “Online event link”
- Price:
  - Numeric price in pesos

Then:

- If `price = 0` (free):
  - Registration mode is locked to:
    - “RSVP only (attendance tracking)”
  - Help text:
    - “Free events use RSVP only. No invoices will be created.”

- If `price > 0` (paid):
  - Admin must choose:
    - RSVP only, no invoice upfront
    - Pay now, invoice created on registration
  - Help text must clearly explain the difference.

Backend validation must:

- Force `registrationMode = RSVP` if price is zero.
- Reject any attempt to set `PAY_NOW` on a free event.
- Allow both modes for paid events.

#### 2B. Registration Flow (Member and Guest)

Three main flows:

1. **Free Event (price = 0)**

   - Member or guest clicks “Register”.
   - System creates EventRegistration.
   - No invoice created.
   - Member sees event under “My Events” or a similar view.

2. **Paid Event, RSVP Mode**

   - Member or guest clicks “Register”.
   - System creates EventRegistration.
   - No invoice created yet.
   - Admin can later generate invoices in bulk or individually.

3. **Paid Event, Pay Now Mode**

   - Member clicks “Register”.
   - System creates EventRegistration.
   - System creates Invoice with:
     - `source = EVT`
     - Status `ISSUED`
     - Amount = event price
   - Member sees invoice in their invoice list.

**Business Alignment Questions:**

- For guests and sponsors, in Pay Now mode, do we:
  - Create invoice tied to a member, or
  - Allow an invoice to be linked to a guest record with minimal info?

For now, we treat all registrations as member based, but we must not design ourselves into a corner where guest or sponsor flows cannot be added.

---

### Phase 3 – Attendance Tracking and Check In

**Goal:** Track actual participation for in person and online events, independent of invoices.

#### 3A. Manual Attendance

One endpoint, different labels:

- For in person:
  - “Check in” button per registration.
  - Sets `checkedInAt`.
  - Used at the door, or by someone at the venue.

- For online:
  - “Mark attended” label.
  - Same behavior, different text.
  - Used after verifying participation on Zoom or another platform.

Rules:

- Attendance can be toggled on or off.
- Attendance never creates, updates, or deletes invoices.
- Attendance can be set even if an invoice is unpaid, especially in RSVP mode where invoices may come later.

#### 3B. Attendance Report

Admin attendance report must show:

**Summary section:**

- Event name
- Event type (in person or online)
- When (date and time range)
- Location or online link
- Capacity
- Registrations
- Attended count
- Attendance rate as a percentage

If event is paid:

- Paid invoices count
- Unpaid invoices count
- Total collected for this event

**Detail table:**

- Member or guest name
- Email
- Registration timestamp
- Attendance status and timestamp
- Invoice number and status, if any
- Actions:
  - Check in / Mark attended
  - Undo attendance
  - Generate invoice (for RSVP mode only, paid events)

For free events:

- Invoice column hidden or labeled “Not applicable”.

For paid events:

- Invoice column visible and uses the same invoice number pattern as the rest of the system.

---

### Phase 4 – Admin Invoice Tools and Post Event Features

**Goal:** Let admins manage invoicing for RSVP events and send follow up communications.

#### 4A. Bulk Invoice Generation (Paid RSVP Events)

From the event detail or attendance report, admin can:

- See:
  - “Registrations: X”
  - “Invoices created: Y”
- Click:
  - “Generate invoices for all registrations without an invoice”.

System must:

- Create invoices only for registrations with no event invoice yet.
- Use the event price.
- Mark them as `ISSUED`.
- Respect source `EVT`.

Bulk invoice generation must be blocked for free events.

#### 4B. Individual Invoice Generation

From the attendance report table:

- For a registration without an invoice:
  - Admin clicks “Generate invoice”.
- System creates a single invoice and links it.

Use cases:

- Late payers.
- Special arrangements.
- Mini corrections.

Again, this is only allowed for paid events.

#### 4C. Thank You Communications (Future)

Based on attendance:

- Admin can send thank you messages to:
  - All attendees
  - Or specific segments (for example, attendees who paid, or attendees who are guests)

This is a future enhancement, but attendance design should make it easy.

---

## 7. Testing Strategy

We keep the original four main scenarios and add guest nuance later.

### Free In Person Event

Coffee Meetup, 0 pesos, RSVP, in person.

- Mode is locked to RSVP.
- Registration creates no invoice.
- Attendance check in works.
- Attendance report shows registration and attendance only.
- Finance dashboard does not reflect this event.

### Free Online Event

Webinar, 0 pesos, RSVP, online.

- Same as free in person, with “Mark attended” instead of “Check in”.

### Paid In Person, RSVP Mode

Workshop, 1 500 pesos, RSVP, in person.

- Registration creates no invoice.
- Bulk invoice generation creates invoices for every registration.
- Attendance is tracked and visible for all.
- Finance dashboard sees only event invoices, no zero amount noise.

### Paid Online, Pay Now Mode

Masterclass, 2 500 pesos, Pay now, online.

- Registration creates invoice.
- Member sees invoice.
- Attendance marking works.
- Finance and invoices remain consistent.

---

## 8. Migration and Data Strategy

### What We Are Not Touching

- Member data
- Dues invoices
- Donation invoices
- Production tenant seeds and real data

### What We Are Doing

- Adding `registrationMode` and `checkedInAt`.
- Cleaning rcme dev events and registrations only.
- Manually creating new test events to validate all scenarios.
- Later, updating seeds to reflect the new rules.

### Safety

- All schema changes are additive.
- Clean slate applies only to rcme dev.
- Other tenants remain untouched until we decide to adopt this model there.

---

## 9. Additional Business Considerations and Gaps

These are points we need to hold in view as we build and test.

### 9.1 Capacity Adjustments and Overselling

- It must be possible to increase capacity after tickets are sold, so overselling is solved by increasing capacity, not by mutating registrations.
- We should not allow capacity to be lowered below `registrationsCount`.

This has already been respected in the code and should remain a hard rule.

### 9.2 Event Status and Financial Audit

- Events with paid invoices must not be hard deleted.
- Soft delete via `deletedAt` is correct.
- Cancelled events:
  - Should not automatically void invoices.
  - Any refund or discount logic is a separate financial action, not part of event deletion.

### 9.3 Refunds and Credits (Future)

For now:

- Refunds and credits are manual financial actions.
- This plan does not implement refund workflows, but the design must not block them.
- We may later add a Refund or Adjustment model that links back to invoices, not to events directly.

### 9.4 Guests and Non Members

From a business perspective, we know:

- Guests and prospective members are common for Rotary events.
- Sponsors often pay for tables, not just single seats.

This plan assumes:

- Phase 1 implementation treats all registrations as member based.
- Future phases can:
  - Add guest registrations with minimal profile.
  - Add sponsor level invoices that cover multiple seats.

### 9.5 Multi Tenant Support

Even though the plan uses RCME as the main playground, the concepts are tenant neutral:

- Events belong to a tenant.
- Registrations, attendance, and invoices all respect `tenantId`.
- Any per tenant differences (for example, naming conventions) should be configurable from metadata, not via code forks.

---

## 10. Repo Structure, Docs, and Tracking

To stop losing context and keep everyone aligned, we will organize files like this.

### 10.1 Specs

Under `docs/specs/events`:

- `oneledger-events-master-plan.md`  
  - This document.  
  - Product and business source of truth.  

- Phase and feature specs:
  - `EVT-01-schema-and-clean-slate.md`
  - `EVT-02-event-creation-and-registration.md`
  - `EVT-03-attendance-and-reporting.md`
  - `EVT-04-event-invoicing-and-post-event-tools.md`

Each EVT spec:

- Restates scope and success criteria for that phase.
- Links back to this master plan.
- Links to relevant tickets (BKS, EVT, UIR).

### 10.2 Stories and QA Docs

Under `docs/stories`:

- `EVT-01-free-event-rsvp-flow.md`
- `EVT-02-paid-event-pay-now-flow.md`
- `EVT-03-attendance-report-usage.md`

Each story includes:

- Scenario description.
- Step by step flows for member and admin.
- Screenshots as we stabilize UI.

### 10.3 Checklists

Under `docs/management`:

- `master-delivery-checklist.md`  
  - Add a section for Events with rows:
    - EVT 01 Schema and Clean Slate
    - EVT 02 Event Creation and Registration
    - EVT 03 Attendance and Reporting
    - EVT 04 Event Invoicing and Post Event Features
  - Each row has:
    - Status
    - Link to spec
    - Link to story doc
    - QA notes

### 10.4 Archive

Old or conflicting docs move to:

- `docs/specs/archive/events/`

We do not delete them, we just mark them clearly as archived so nobody uses them as the active plan.

---

### EVT-03 Backend Notes (Jan 2025)

- Attendance report API returns member id/name/email, registration timestamp, `checkedInAt`, and invoice id/number/status/amount for paid events.
- Filtering/search is currently client-side; acceptable for expected admin row counts (< a few hundred). If volume grows, add server-side filters for status and search (name/email/invoice).
- Attendance endpoints are gated to ADMIN/EVENT_MANAGER/OFFICER and never touch invoices.
- Tests (node:test via ts-node) cover: mark/undo happy path and 404, bulk mark validation, and paid vs unpaid summary in reports for paid events.

---

## 11. Working Agreements

To keep this consistent:

1. Any new event related ticket must link to:
   - This master plan.
   - The relevant EVT phase spec.

2. Any change to core behavior must:
   - Update this master plan.
   - Update affected EVT spec.
   - Add or update a story doc with a concrete scenario.

3. BMad devs and Claude:
   - Use the EVT specs for technical breakdown.
   - Keep this master plan as the framing context.

---

## 12. Alignment Questions

For Zara:

1. Do the three registration scenarios (free, RSVP, Pay now) match real RCME operations? Yes
2. For online events, is manual attendance marking acceptable as the first version? yes
3. Do you want any additional event types called out (for example, hybrid, purely social, committee meetings)? not for now
4. Is the attendance report format enough for how you run events today? yes
5. Are sponsor and guest flows fine as a “do not block, but implement later” item? yes

For Jon:

1. Confirmed that membership and non event finance flows remain off limits for risky changes. 
2. Confirmed that events are the main priority for now and we are comfortable resetting rcme dev events.
3. Confirmed that this master plan replaces all scattered event specs going forward.

---

**This is the single active master plan for OneLedger Events and Registration. All other event related documents are supporting or archived.**

