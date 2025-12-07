# Communications User Stories (Thin-Sliced)

1. **Story:** Admin drafts a broadcast email.  
   **Acceptance Criteria:**  
   - Subject and body required.  
   - Tenant branding applied.  
   - Saved as Draft until sent.

2. **Story:** Admin selects audience segment.  
   **Acceptance Criteria:**  
   - Can choose all members or filter by role/tier/event.  
   - Selected segment count displayed.  
   - Segment saved with draft.

3. **Story:** Admin sends a broadcast email.  
   **Acceptance Criteria:**  
   - Send triggers queued delivery.  
   - Status moves to Sent.  
   - Delivery summary available.

4. **Story:** Admin schedules email for future time.  
   **Acceptance Criteria:**  
   - Scheduler accepts date/time in tenant timezone.  
   - Email placed in scheduled queue.  
   - Can cancel before send time.

5. **Story:** Admin manages email templates.  
   **Acceptance Criteria:**  
   - Create/edit/save template with placeholders.  
   - Templates listed with last modified.  
   - Can clone existing template.

6. **Story:** System sends payment reminder email.  
   **Acceptance Criteria:**  
   - Triggered by billing reminder rule.  
   - Includes invoice link and due date.  
   - Logged in communication history.

7. **Story:** System sends event reminder email.  
   **Acceptance Criteria:**  
   - Sent X days before event per config.  
   - Includes event date/time/location.  
   - Logged with timestamp.

8. **Story:** Admin views communication history for a member.  
   **Acceptance Criteria:**  
   - Lists sent emails with subject/date/status.  
   - Filter by type (reminder/broadcast).  
   - Read-only access.

9. **Story:** Admin pauses a scheduled campaign.  
   **Acceptance Criteria:**  
   - Pause prevents future deliveries.  
   - Status shows Paused.  
   - Can resume or cancel.

10. **Story:** Member unsubscribes from non-critical emails.  
    **Acceptance Criteria:**  
    - Unsubscribe link updates preferences.  
    - Critical emails (billing/security) still allowed.  
    - Confirmation displayed.

11. **Story:** Admin previews email before sending.  
    **Acceptance Criteria:**  
    - Preview shows rendered template with sample data.  
    - Send test email to specified address.  
    - No change to campaign status.

