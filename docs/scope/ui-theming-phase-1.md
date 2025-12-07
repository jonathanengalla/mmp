# UI Theming – Phase 1 Completion Checklist

Goal: finish migrating the MVP UI to shared theme tokens and primitives so every page is easy to re-skin per tenant.

## 1. Coverage – which pages use primitives

For each page, confirm it uses Page, Card, Button, FormField, Tag, and future primitives only.

- [x] Golden Path: Register
- [x] Golden Path: Verify
- [x] Golden Path: Login
- [x] Golden Path: Profile

- [x] Config Center: Org Profile
- [x] Config Center: Timezone and Locale
- [x] Config Center: Membership Types
- [x] Config Center: Approval Workflow
- [x] Config Center: Payment Categories
- [x] Config Center: Invoice Template
- [x] Config Center: Feature Flags

- [x] Reporting: Member Roster
- [x] Reporting: Dues Summary
- [x] Reporting: Event Attendance

- [x] Events: Admin New Event
- [x] Events: Admin Publish Event
- [x] Events: Admin Set Capacity
- [x] Events: Member Registers
- [x] Events: Member Cancels Registration
- [x] Events: Member Views Upcoming Events
- [x] Events: Admin Sets Pricing

- [x] Communications: Admin Broadcasts List
- [x] Communications: Admin Creates Draft
- [x] Communications: Admin Edits Draft
- [x] Communications: Admin Previews Draft

## 2. No legacy styling

For each page above:

- [x] No hard coded hex colors
- [x] No hard coded font sizes or families
- [x] No hard coded border radius or shadows
- [x] Spacing uses theme spacing unit
- [x] Colors use theme color tokens through CSS variables

## 3. Layout consistency

For each admin page:

- [x] Wrapped in <Page> with title and optional description
- [x] Content width respects theme maxContentWidth
- [x] Section spacing uses spacing tokens
- [x] Headings map to theme headingScale

## 4. Theme structure

- [x] ThemeProvider wraps the app
- [x] defaultTheme and rcmeTheme both satisfy the Theme type
- [x] Components read from CSS variables, not direct theme imports
- [x] No component reaches into theme objects directly

## 5. QA checks

- [x] All primary flows are visually consistent with the RCME brand
- [x] All interactive states (hover, focus, disabled, loading) use theme tokens
- [x] Pages still behave the same, only styling changed

