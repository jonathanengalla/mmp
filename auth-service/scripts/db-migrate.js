#!/usr/bin/env node
const { execSync } = require("child_process");

try {
  console.log("[db:migrate] Running prisma migrate deploy");
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
  console.log("[db:migrate] Success");
} catch (err) {
  console.error("[db:migrate] Failed", err);
  process.exit(1);
}

