# Golden Path Wireframes (Registration → Verification → Login → Profile)
Text/ASCII mockups for quick implementation. Branding (logo/colors) is tenant-driven.

## /register
```
+---------------------------------------------+
| [Logo] OneLedger (tenant colors)            |
|                                             |
|  Register                                   |
|  [Email               ] (error below if any)|
|  [Password            ] (strength hint)     |
|  [First name          ]                     |
|  [Last name           ]                     |
|  [Phone (optional)    ]                     |
|  [Address (optional)  ]                     |
|                                             |
|  [ Register ] (disabled if invalid/submitting)
|                                             |
|  Already have an account? [Login]           |
|                                             |
|  Success state: “Check your email to verify.”|
+---------------------------------------------+
States: inline errors per field; button shows spinner while submitting.
```

## /verify/:token
```
+---------------------------------------------+
| [Logo] OneLedger                            |
|                                             |
|  Verifying... (spinner)                     |
|                                             |
|  On success: “Email verified” [Go to Login] |
|  On error: “Link invalid or expired.”       |
|           [Resend] [Register]               |
+---------------------------------------------+
```

## /login
```
+---------------------------------------------+
| [Logo] OneLedger                            |
|                                             |
|  Login                                      |
|  [Email               ]                     |
|  [Password            ]                     |
|  (If MFA required) [MFA code ]              |
|                                             |
|  [ Login ] (disabled if invalid/submitting) |
|                                             |
|  [Forgot password?]  [Register]             |
|                                             |
|  Error bar: show API error if 401/403       |
+---------------------------------------------+
```

## /profile
```
+---------------------------------------------+
| [Logo] OneLedger        [Avatar/Upload]     |
| Name (read-only)   Email (read-only)        |
| Status/Type (read-only)                     |
|                                             |
| Contact Info (editable)                     |
|  [Phone           ]                         |
|  [Address         ]                         |
|                                             |
|  [ Save ] (spinner while saving)            |
|                                             |
| Success toast on save; error toast on fail  |
+---------------------------------------------+
States: skeleton while loading; disable edits offline; show offline banner if no network.
```

Notes for devs:
- Use tenant branding (logo/colors) from config.
- Keep buttons disabled during submit; show spinners.
- Follow standard error envelope; show inline or bar errors.
- PWA: cache shell; allow offline read-only on /profile; disable actions offline.***

