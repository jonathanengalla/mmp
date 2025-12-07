# Golden Path Slice 1 – Rotary (End-to-End, Minimal)
End-to-end slice from tenant setup to first member onboarded and logged in.

## 1) Admin creates and configures the Rotary tenant
- Config Center 1: Admin updates organization profile
- Config Center 2: Admin sets tenant timezone and locale
- Config Center 6: Admin defines payment categories (optional for later billing)
- Config Center 9: Admin enables/disables modules via feature flags (ensure Membership active)

## 2) Admin logs in
- (Auth flow implied; no story ID in stories files)

## 3) Admin defines at least one membership type/tier
- Config Center 3: Admin creates membership type

## 4) Admin invites a new member
- Membership 3: Admin creates a member manually
- Membership 4: Admin approves pending member (if approval flow is manual)

## 5) Member registers, verifies email, logs in, and sees profile dashboard
- Membership 1: Member submits self-registration form (if invite/self-serve used)
- Membership 2: Member verifies email via link
- (Auth: member login implied)
- Membership 6: Member updates profile contact info (post-login profile confirmation)

