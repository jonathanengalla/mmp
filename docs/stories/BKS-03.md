# BKS-03 — Membership + verification persistence

- **Problem summary**: Membership, verification, and approval flows are in-memory; data is lost on restart and not tenant-isolated.
- **Goal**: Move membership registration, verification, approval, profile updates, and custom fields onto Prisma with tenant scoping.
- **Scope**
  - Persist members, registrations, verification tokens/expirations, approvals, roles, and custom fields in DB.
  - Replace in-memory stores and file writes; ensure tenant filters on all membership queries.
  - Wire verification/approval status transitions and audit basic events.
- **Out of scope**
  - Email delivery and templates (future communications work).
  - Directory search relevance tuning.
- **Acceptance criteria**
  - Registration → verify → approve flows persist to DB and survive restart.
  - `/members/search`, `/members/me`, `/members/pending` use DB and respect tenant filters.
  - In-memory membership code is removed/disabled; automated test covers registration + verify + approve.
- **Dependencies**: BKS-01, BKS-02.


