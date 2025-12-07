# Config Center User Stories (Thin-Sliced)

1. **Story:** Admin updates organization profile.  
   **Acceptance Criteria:**  
   - Can edit name, logo, colors, contact info.  
   - Changes previewed before save.  
   - Saved values reflected in branded areas.

2. **Story:** Admin sets tenant timezone and locale.  
   **Acceptance Criteria:**  
   - Dropdowns for timezone and locale.  
   - Changes affect date/time display.  
   - Persist across sessions.

3. **Story:** Admin creates membership type.  
   **Acceptance Criteria:**  
   - Name and description required.  
   - Type appears in membership options.  
   - Can deactivate type later.

4. **Story:** Admin configures approval workflow.  
   **Acceptance Criteria:**  
   - Options: auto-approve or manual review.  
   - Selection applies to new registrations.  
   - Stored in tenant settings.

5. **Story:** Admin adds custom profile field.  
   **Acceptance Criteria:**  
   - Field types: text, number, dropdown, date.  
   - Required/optional toggle.  
   - Field visible on member profile form.

6. **Story:** Admin defines payment categories.  
   **Acceptance Criteria:**  
   - Categories list includes dues/donations/events/custom.  
   - Categories selectable in billing/payment flows.  
   - Changes do not alter historical records.

7. **Story:** Admin edits invoice template.  
   **Acceptance Criteria:**  
   - Can set logo, header, footer text, tax fields.  
   - Preview shows sample invoice.  
   - Saved template used for future invoices.

8. **Story:** Admin sets recurring dues rules.  
   **Acceptance Criteria:**  
   - Configure frequency, penalties, grace periods.  
   - Effective date recorded.  
   - Rules referenced by billing engine.

9. **Story:** Admin enables/disables modules via feature flags.  
   **Acceptance Criteria:**  
   - Toggle for Events, Donations, Projects, Reporting.  
   - UI hides disabled modules.  
   - Changes logged for audit.

10. **Story:** Admin toggles advanced payment features.  
    **Acceptance Criteria:**  
    - Options: recurring payments, installment plans, directories.  
    - Toggle state stored per tenant.  
    - Features conditionally rendered in UI.

11. **Story:** Admin manages email templates.  
    **Acceptance Criteria:**  
    - Create/edit templates with placeholders.  
    - Assign template to category (reminder/broadcast).  
    - Preview available.

12. **Story:** Admin configures reminder schedules.  
    **Acceptance Criteria:**  
    - Set timing for payment/event reminders.  
    - Supports multiple offsets (e.g., -7d, -1d).  
    - Saved schedule used by notification service.

13. **Story:** Admin sets sender identities.  
    **Acceptance Criteria:**  
    - Configure from-name and email per category.  
    - Validation on email format.  
    - Used in outbound communications.

14. **Story:** Admin defines event defaults.  
    **Acceptance Criteria:**  
    - Default event types, capacity rules, attendance options.  
    - Defaults prefill event creation form.  
    - Editable per event.

15. **Story:** Admin creates project templates.  
    **Acceptance Criteria:**  
    - Template includes name, category, default fields.  
    - Templates selectable when creating project.  
    - Editable without affecting existing projects.

16. **Story:** Admin manages role definitions.  
    **Acceptance Criteria:**  
    - Create/edit roles with permission sets.  
    - Role list shows assigned permissions count.  
    - Changes take effect immediately.

17. **Story:** Admin enables MFA requirement for admin roles.  
    **Acceptance Criteria:**  
    - Toggle enforces MFA on next login for admins.  
    - Non-admins unaffected unless enabled.  
    - Audit log entry recorded.

18. **Story:** Admin sets directory visibility rules.  
    **Acceptance Criteria:**  
    - Toggle directory visibility (public to members / hidden).  
    - Field-level visibility options available.  
    - Applied instantly to member directory view.

