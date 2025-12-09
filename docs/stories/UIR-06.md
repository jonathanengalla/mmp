# UIR-06 — Heading/contrast accessibility pass

- **Problem summary**: Headings/subtitles and surfaces risk insufficient contrast, especially in dark mode and across tenants.
- **Goal**: Ensure headings, subtitles, and surface contrasts meet accessibility targets using tokens.
- **Scope**
  - Audit key pages (auth, roster, finance, events, invoices) for text/background contrast and adjust token usage.
  - Standardize subtitle/body copy colors to `app-color-text-muted/secondary` and headings to strong tokens.
  - Add a short accessibility checklist for new pages.
- **Out of scope**
  - Full WCAG AA/AAA certification; focus on primary flows.
- **Acceptance criteria**
  - Contrast for headings/body meets WCAG AA for normal text on both light/dark themes.
  - No inline color overrides remain for headings/subtitles; tokens used instead.
  - Accessibility checklist recorded and linked for future QA.
- **Dependencies**: THE-01/03/05; complements UIR-02.


