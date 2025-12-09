# DPL-02 — Node/tooling version pin and lockstep install

- **Problem summary**: Node versions differ across services/environments; no root engine pin, risking build/runtime drift.
- **Goal**: Pin Node/tooling versions and enforce lockstep installs for local, Render, and Vercel.
- **Scope**
  - Add root `.nvmrc`/engines to align on Node 20.x (matching Prisma support).
  - Update service package.json engines where missing; document nvm usage.
  - Switch CI/deploy to `npm ci` (or pnpm lock if adopted) for deterministic installs.
- **Out of scope**
  - Yarn/pnpm migration.
- **Acceptance criteria**
  - Engines declared and respected in all services; Render/Vercel configured to use pinned Node.
  - CI/deploy logs show `npm ci` with no engine warnings.
  - Local dev guide updated with version pin.
- **Dependencies**: None (but aligns with DPL-01/03).


