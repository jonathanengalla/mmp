#!/usr/bin/env node
/**
 * db:reset:test (destructive, test-only)
 * Implement drop/recreate/seed for TEST only when DB is wired.
 */
const { execSync } = require("child_process");

try {
  console.log("[db:reset:test] Dropping and recreating test schema (if configured)");
  // Adjust these commands when a dedicated test DB is available.
  execSync("npx prisma migrate reset --force --skip-seed", { stdio: "inherit", env: { ...process.env, NODE_ENV: "test" } });
  console.log("[db:reset:test] Reset complete");
} catch (err) {
  console.error("[db:reset:test] Failed", err);
  process.exit(1);
}

