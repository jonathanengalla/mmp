# EVT-05A – Admin Events Dashboard Micro UI Polish

**Status:** Backlog  
**Owner:** UI/Frontend  
**Related:** `events-ux-redesign.md`, EVT-01–EVT-04  

---

## Goal

Improve readability and perceived quality of the **Admin Events Dashboard** table **without** changing any backend or behavioral logic.

This is a **pure presentation pass** that can be applied independently of EVT-01–EVT-04.

---

## In-Scope Changes

### 1. Typography & Spacing

**Table header**

- Use a slightly bolder weight and tighter line-height for the header row.
- Keep font size modest (no oversized headers) so the data, not the header, is dominant.
- Ensure header text is aligned consistently (left for text columns, right for numeric).

**Title column (first column)**

- Convert the current combined text into a stacked layout:

  - **Line 1:** Event title  
    - Style: `font-semibold`, normal text color.  
    - Behavior: Truncate with ellipsis, tooltip on hover with full title.

  - **Line 2:** Sub-label  
    - Example: `Upcoming · Paid event` or `Past event · Free event`.  
    - Style: smaller font size, muted color (e.g. `text-gray-500`).

- Add a bit more **vertical padding** on each row so the title + sublabel block has breathing room.

---

### 2. Capacity Column

Current issue: capacity text looks cramped and visually flat.

**Target layout:**

- Two-line layout inside the capacity cell:

  - **Line 1:** `<filled> / <capacity> seats`  
    - Example: `80 / 120 seats`.

  - **Line 2:** `<remaining> left`  
    - Example: `40 left`.

**Color semantics for remaining seats:**

- Let `remaining = capacity - filled`.

- Apply color only to the **second line** ("X left"):

  - **Normal state:**  
    - Condition: `remaining / capacity > 0.3`  
    - Style: neutral text (e.g. `text-gray-600`).

  - **Warning state (getting full):**  
    - Condition: `0.1 < remaining / capacity <= 0.3`  
    - Style: warning color (e.g. `text-amber-600`).

  - **Danger / full state:**  
    - Condition: `remaining <= 0`  
    - Style: danger color (e.g. `text-red-600`), text like:
      - `Full` or `Waitlist only` (depending on current logic), instead of "0 left".

> Note: This is purely visual. Do **not** change any underlying capacity logic or enforcement.

---

### 3. Action Icons

Current issue: icons look a bit inconsistent and cramped.

**Target behavior:**

- Use a consistent icon size (e.g. 16–18px) for all action icons.
- Use a shared color token for icons (e.g. neutral gray, highlight on hover).
- Maintain even spacing between icons (e.g. `gap-2` in a flex container).
- Add simple tooltips:
  - `Edit`
  - `View`
  - `Cancel`
  - `Delete`

**Order:**

- Keep the existing order so we don't retrain muscle memory:
  1. Edit
  2. View
  3. Cancel (where applicable)
  4. Delete (where allowed)

No new actions, no removed actions.

---

## Out-of-Scope (Guardrails)

To keep this safe and small, **do not**:

- Add or remove columns.
- Change any API calls or backend logic.
- Change event status logic, cancel/delete rules, or navigation.
- Introduce new filters, sorting behavior, or pagination behavior.
- Change any `onClick` handlers for existing buttons or icons.

This ticket touches **only**:

- JSX/TSX structure of the cells in the admin events table.
- CSS/Tailwind classes for spacing, font weight/size, and color.
- Optional tooltip components for icons.

---

## Implementation Notes

**File to touch (current):**

- `frontend/pwa-app/src/pages/AdminEventsDashboardPage.tsx`  
  (or the current equivalent where the admin events table is rendered)

**Suggested approach:**

1. Refactor the **Title** cell into a small inner layout with:
   - `div` for the title (truncated).
   - `div` for the sublabel (`Upcoming · Paid event` etc).

2. Wrap the **Capacity** text into a helper function inside the component:
   - Input: `capacity`, `registrations` (or equivalent fields).
   - Output: JSX with two-line layout and computed color class.

3. Wrap the **Actions** into a small `<div className="flex items-center justify-end gap-2">` row with:
   - Icons (or text buttons) that already exist.
   - Optional tooltip wrapper component if available in the design system.

---

## QA Checklist

- [ ] Title now appears as a clear two-line block with a muted sublabel.
- [ ] Capacity shows as:
      - `<filled> / <capacity> seats` on first line.
      - `<remaining> left` on second line, with color changes based on thresholds.
- [ ] Action icons are:
      - Aligned to the right.
      - Evenly spaced.
      - Consistent in size and color.
      - Showing correct tooltips on hover.
- [ ] No horizontal scroll introduced on standard desktop widths.
- [ ] No changes to:
      - Event status behavior.
      - Cancel/Delete constraints.
      - Underlying data returned by the backend.
      - Existing filters or routes.

---

## Status & When to Execute

- This ticket can be picked up **after** EVT-01–EVT-04 core behaviors are stable, or in parallel **only if** it does not block schema/logic work.
- If started early, ensure it remains visual-only and does not introduce regression risk for ongoing event logic changes.

