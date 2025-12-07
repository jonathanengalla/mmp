# Events User Stories (Thin-Sliced)

1. **Story:** Admin creates a new event draft.  
   **Acceptance Criteria:**  
   - Required fields: title, start/end, location/virtual link.  
   - Default status Draft.  
   - Draft visible only to admins.

2. **Story:** Admin publishes an event.  
   **Acceptance Criteria:**  
   - Publish sets status to Published.  
   - Event appears in attendee-facing list.  
   - Timestamp of publish recorded.

3. **Story:** Admin sets event capacity.  
   **Acceptance Criteria:**  
   - Capacity number saved.  
   - Registrations blocked when capacity reached.  
   - Waitlist option toggle available.

4. **Story:** Member registers for an event.  
   **Acceptance Criteria:**  
   - Registration captures member identity.  
   - Confirmation screen shown.  
   - Registration record created.

5. **Story:** Member cancels event registration.  
   **Acceptance Criteria:**  
   - Cancel action available before cutoff.  
   - Seat freed for waitlist.  
   - Member receives confirmation.

6. **Story:** System promotes waitlisted member when spot opens.  
   **Acceptance Criteria:**  
   - Promotion happens FIFO.  
   - Member notified of successful promotion.  
   - Registration status updated.

7. **Story:** Admin checks in attendee.  
   **Acceptance Criteria:**  
   - Check-in toggles status to Present.  
   - Timestamp stored.  
   - Can undo check-in.

8. **Story:** Admin exports attendee list.  
   **Acceptance Criteria:**  
   - Export includes name, status, timestamps.  
   - Respects filters (registered/checked-in).  
   - CSV downloads successfully.

9. **Story:** Admin creates recurring event series (basic).  
   **Acceptance Criteria:**  
   - Frequency options: weekly/monthly.  
   - Series generates individual event instances.  
   - Instances editable individually.

10. **Story:** Member views upcoming events list.  
    **Acceptance Criteria:**  
    - Sorted by start date ascending.  
    - Shows capacity/availability.  
    - Pagination or infinite scroll.

11. **Story:** Admin attaches agenda to event.  
    **Acceptance Criteria:**  
    - Upload or text agenda stored.  
    - Visible to registered members.  
    - Editable while event is Draft/Published.

12. **Story:** Admin sets event pricing.  
    **Acceptance Criteria:**  
    - Price field supports free/paid.  
    - If paid, integrates with Payments Hub at registration.  
    - Currency follows tenant setting.

