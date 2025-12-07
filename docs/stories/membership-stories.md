# Membership User Stories (Thin-Sliced)

1. **Story:** Member submits self-registration form.  
   **Acceptance Criteria (MVP):**  
   - Given I am not logged in, when I visit `/register`, I see a registration form.  
   - Required fields: email, first name, last name.  
   - Optional fields: phone, address, LinkedIn URL, other socials (free text).  
   - Client-side validation blocks empty required fields and clearly invalid email; LinkedIn URL must be a valid `http/https` URL if provided.  
   - On submit with valid data (with or without optional fields), the system creates a pending registration and returns success.  
   - If the email already exists as a member or pending registration, I see a duplicate error.  
   - On success, I see a confirmation state telling me to check email to verify (no auto-login).

2. **Story:** Member verifies email via link.  
   **Acceptance Criteria:**  
   - Verification link marks account as verified.  
   - User is redirected to login page.  
   - Error shown for expired/invalid link.

3. **Story:** Admin creates a member manually.  
   **Acceptance Criteria:**  
   - Admin can input email and name.  
   - Role defaults to Member.  
   - New member appears in directory.

4. **Story:** Admin approves pending member.  
   **Acceptance Criteria:**  
   - Pending list shows awaiting approvals.  
   - Approve action moves member to Active.  
   - Confirmation toast displayed.

5. **Story:** Admin rejects pending member.  
   **Acceptance Criteria:**  
   - Reject action moves member to Rejected/Inactive.  
   - Optional note captured.  
   - Member hidden from active roster.

6. **Story:** Member updates profile contact info.  
   **Acceptance Criteria:**  
   - Editable fields: phone, address.  
   - Validation on format (phone/email).  
   - Changes saved and visible on reload.

7. **Story:** Member uploads profile photo.  
   **Acceptance Criteria:**  
   - Accepts JPEG/PNG under size limit.  
   - Preview shown before save.  
   - Stored URL displayed on profile.

8. **Story:** Member changes password.  
   **Acceptance Criteria:**  
   - Requires current password.  
   - Enforces complexity rules.  
   - Success confirmation shown.

9. **Story:** Admin resets member password.  
   **Acceptance Criteria:**  
   - Admin trigger sends reset email.  
   - Member token expires after configured time.  
   - Audit entry recorded.

10. **Story:** Admin assigns role to member.  
    **Acceptance Criteria:**  
    - Role list shows available roles.  
    - Assign action updates RBAC immediately.  
    - Assignment visible in member detail.

11. **Story:** Admin bulk imports members via CSV.  
    **Acceptance Criteria:**  
    - CSV template validated (required columns).  
    - Errors reported per row.  
    - Successful rows created; failed rows not created.

12. **Story:** Member searches directory by name/email.  
    **Acceptance Criteria:**  
    - Search input returns matching members.  
    - Empty search shows recent or all (paginated).  
    - Debounced queries to avoid spam.

13. **Story:** Admin deactivates member.  
    **Acceptance Criteria:**  
    - Deactivate action sets status to Inactive.  
    - Inactive members cannot log in.  
    - Status visible in roster.

14. **Story:** Admin views audit log for a member.  
    **Acceptance Criteria:**  
    - Log entries show action, actor, timestamp.  
    - Filters by action type/date.  
    - Read-only view.

