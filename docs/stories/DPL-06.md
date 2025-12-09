# DPL-06 — Deploy order + rollback playbook

- **Problem summary**: No documented deploy order or rollback steps; migrations could ship without guardrails.
- **Goal**: Establish deploy sequencing, smoke checks, and rollback steps for Render + Vercel.
- **Scope**
  - Define deploy order: migrate → backend start → frontend publish; include smoke test checklist.
  - Document rollback steps for failed backend/frontend deploys (previous image/commit, db rollback strategy if safe).
  - Add simple checklist for toggling maintenance mode (if needed) during migration issues.
- **Out of scope**
  - Automated canary/blue-green tooling changes.
- **Acceptance criteria**
  - Playbook documented and reviewed; includes commands/links for Render/Vercel rollback.
  - Smoke checklist covers auth, membership, invoices, events, and config endpoints.
  - Team can execute a table-top rollback without ambiguity.
- **Dependencies**: DPL-01, DPL-03 readiness; relies on BKS endpoints existing.


