# UIR-02 — Global typography token adoption

- **Problem summary**: Pages mix ad-hoc font sizes/weights; headings and body text can fail contrast/scale expectations.
- **Goal**: Apply global typography tokens to headings, body text, labels across key pages.
- **Scope**
  - Map Page/PageShell titles, subtitles, and section headers to typography tokens.
  - Update buttons/tags/inputs to ensure font sizes align with design tokens.
  - Remove inline font sizes where tokens exist.
- **Out of scope**
  - New type scale creation; reuse existing tokens.
- **Acceptance criteria**
  - Headings and body text use defined typography tokens; no inline px sizes remain where tokens exist.
  - Visual regression check passes in light/dark; contrast meets WCAG AA for text on surfaces.
  - Token usage documented for future components.
- **Dependencies**: THE-01/05; complements UIR-01.


