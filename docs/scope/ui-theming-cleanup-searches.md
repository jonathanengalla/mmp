# UI Theming Cleanup – Search Patterns

Goal: find legacy styling in the codebase and migrate to theme driven primitives.

Run these searches from the repo root using ripgrep (rg) or your editor.

## 1. Hex colors

Find:

- `#[0-9a-fA-F]{3,6}`

Action:

- Replace with CSS variables from the theme, by using primitives or utility classes that already map to those variables.

## 2. Inline font sizes and families

Find:

- `font-size:\s*\d+(px|rem)`
- `font-family:\s*["']?[^"']+["']?`

Action:

- Remove inline font styling and rely on Page, Card, FormField, Heading, and body typography that are already mapped to the theme.

## 3. Inline spacing

Find:

- `margin(-[a-z]+)?:\s*\d+px`
- `padding(-[a-z]+)?:\s*\d+px`

Action:

- Move spacing to primitives or layout wrappers that use spacing tokens, or to small CSS classes that consume spacing variables.

## 4. Border radius and shadow

Find:

- `border-radius:\s*\d+px`
- `box-shadow:\s*.+;`

Action:

- Use the theme driven border radius and cardShadow via Card, Surface, or Page containers.

## 5. Old button and tag classes

Find:

- `className=.*\bbtn-`
- `className=.*\btag-`

Action:

- Replace with the shared <Button> and <Tag> primitives and pass variant props instead of custom classes.

Checklist:

- [ ] Run the searches on frontend/pwa-app/src
- [ ] For each match, decide to migrate to a primitive or move styles into theme based CSS variables
- [ ] When in doubt, prefer using Page, Card, Button, FormField, Table, Tag

