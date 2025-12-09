# BKS-06 — Audit & reporting data store

- **Problem summary**: No durable audit logs or reporting data; current reporting routes are stubbed.
- **Goal**: Persist audit events and basic reporting aggregates for members, dues, events, and payments.
- **Scope**
  - Add audit_log table writes for auth, membership approvals, invoice creation/payment, event registration/check-in.
  - Implement reporting queries for member roster, dues summary, event attendance against DB data.
  - Expose `/reporting` endpoints using DB, removing stubs.
- **Out of scope**
  - BI dashboards or external analytics sinks.
  - Complex filters beyond current UI needs.
- **Acceptance criteria**
  - Audit entries created for defined actions and retrievable per tenant.
  - Reporting endpoints return DB-backed data; UI pages load without stub data.
  - In-memory reporting references removed; tests cover audit insert and report query.
- **Dependencies**: BKS-01, BKS-02, BKS-03, BKS-04, BKS-05.


