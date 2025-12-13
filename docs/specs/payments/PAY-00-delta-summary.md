# PAY-00 Delta Summary — TCP Refinements

**Date:** 2025-12-12  
**Version:** 1.0 → 1.1  
**Status:** Implementation Ready

## Changes from Previous PAY-00

### 1. Payment.invoiceId Rule Clarified
- **Option B adopted:** Allocations are the single source of truth for all payment-to-invoice linkage
- `Payment.invoiceId` is convenience metadata only, never used for balance/status calculations
- All new code must query Allocations, not `Payment.invoiceId`
- Explicitly stated in Payment Model Restructuring section and schema comments

### 2. Index Hygiene Note Added
- Instruction to simplify redundant indexes during implementation
- Preserve: tenant scoping, idempotencyKey uniqueness, query performance
- Remove: `@@unique([id, tenantId])` when id is already PK
- Added to schema section with examples

### 3. Credit v1 Constraint Explicit
- Credits can only be fully applied to single invoice in v1
- No partial application, no multi-invoice splitting
- Removed `appliedToAllocationId` from v1 Credit model
- Updated credit apply endpoint to reflect v1 limitation

### 4. Invoice Status Invariant Formalized
- `computeAndSetInvoiceStatus(invoiceId)` is the only path to update status
- Function name and location specified: `auth-service/src/services/invoice/computeInvoiceStatus.ts`
- Framed as non-negotiable invariant
- All allocation changes must call this function

### 5. Reminder Engine v1 Scope Tightened
- Success criteria defined: logging, email queuing, admin visibility
- Open tracking, bounce handling explicitly out of scope for v1
- Deferred to COMMS-02 or later
- Added ReminderLog model specification

### 6. Proof Upload Security Requirements Added
- Restricted storage bucket (not public)
- RBAC enforcement: only Admin/Finance roles for tenant
- Members cannot see proof (not even their own)
- Signed URLs with short expiry
- Audit log on proof access
- New endpoint: `GET /admin/payments/:id/proof`

### 7. On-Platform vs Off-Platform Classification Defined
- Channel-based classification: SIMULATED/TRAXION = on-platform, MANUAL_* = off-platform
- Export requirements: invoice reference codes, channel, on/off-platform flag
- Collections report filters to on-platform by default
- Exceptions report filters to off-platform
- New section added to document

### 8. Migration Operational Guardrails Added
- Pre-migration validation requirements (rcme-dev, FIN-01/FIN-02 totals match)
- Backup/snapshot requirements
- Write freeze options during migration
- Post-migration validation checklist
- Added as "Operational Guardrails (NON-NEGOTIABLE)" subsection

### 9. UI Must/Should/Nice Tags Added
- Member portal: Must (outstanding invoices, basic payment history, basic deadlines), Should (dedicated pages), Nice (enhanced features)
- Admin portal: Must (payments inbox, manual entry, detail view, at least one export), Should (reject reason, exceptions report, enhanced filters), Nice (dedicated credits UI, advanced exports)
- Clear prioritization for safe scope cuts
- Updated UI section with priority tags

### 10. FIN/EVT Integration Notes Reinforced
- New section: "Integration with Existing FIN/EVT Stacks"
- Explicit statements on how Allocations affect FIN-01, FIN-02, EVT-01-04
- FIN-01 must query Allocations, use `computeAndSetInvoiceStatus` logic
- FIN-02 balance from Allocations, status from stored field (set by function)
- EVT stack unchanged: event invoices use same Invoice model, same allocation logic

## Additional Refinements

- Added ReminderLog model specification
- Clarified proof storage (storage key, not public URL)
- Updated all endpoint descriptions to reference `computeAndSetInvoiceStatus`
- Added security section for proof uploads
- Updated implementation sequence with Must/Should/Nice priorities
- Document status changed to "Implementation Ready"

## Impact on Implementation

- **No scope expansion:** All changes are clarifications and guardrails
- **Clearer invariants:** Engineers have explicit rules to follow
- **Safer migrations:** Operational guardrails prevent production issues
- **Protected v1 scope:** Must/Should/Nice tags allow safe cuts if needed

---

**For Dev/Architect:** Review updated PAY-00 document for full details. All changes preserve v1 scope while adding necessary guardrails and clarifications.
