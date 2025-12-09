# UIR-04 — Events checkout UX and error states

- **Problem summary**: Checkout/register flows rely on in-memory paths and lack clear states for pay-now/RSVP and payment failures.
- **Goal**: Align UI to DB-backed events/payments and provide clear success/error/empty states.
- **Scope**
  - Update checkout/register pages to use backend contracts (BKS-05) including invoice/payment responses.
  - Add UI states for registration full, payment failure, and successful confirmation.
  - Ensure tenant/dark-mode styles use shared tokens and table/card components where applicable.
- **Out of scope**
  - Multi-ticket or seating features.
- **Acceptance criteria**
  - Checkout/register works against DB-backed endpoints; proper messaging on success/failure/full events.
  - UI shows loading/progress and disables duplicate submissions.
  - Visuals respect shared tokens and table/card patterns.
- **Dependencies**: BKS-05, UIR-01, THE-01/03.


