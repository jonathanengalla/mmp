## Reporting 1: Admin views member roster report

- [ ] Admin-only access enforced for /reports/members.
- [ ] Tenant isolation respected (only current-tenant members returned).
- [ ] Pagination works with page/page_size.
- [ ] Status filter works.
- [ ] UI shows loading, empty, data, and error states.
- [ ] UI uses shared theme primitives (Page, Card, Table, Tag, Button).

## Reporting 2: Admin views dues collection summary

- [ ] Admin-only access enforced for /reports/dues-summary.
- [ ] Tenant isolation respected.
- [ ] Aggregation correct for unpaid/overdue/paid counts and amounts (happy path + empty dataset).
- [ ] UI shows loading, empty, data, and error states.

## Reporting 4: Admin views event attendance report

- [ ] Admin-only access enforced for /reports/events/attendance.
- [ ] Tenant isolation enforced.
- [ ] Attendance aggregation correct (registrations vs capacity).
- [ ] UI loads with correct table and loading/empty/error states.

