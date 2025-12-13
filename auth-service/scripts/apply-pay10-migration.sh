#!/bin/bash
# PAY-10 Migration Application Script
# 
# This script applies the PAY-10 migration and runs the backfill script.
# Run this on rcme-dev first, then production after verification.

set -e

echo "=========================================="
echo "PAY-10 Migration Application"
echo "=========================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set"
  echo "Please set it before running this script"
  exit 1
fi

echo "Step 1: Generating Prisma client..."
npm run prisma:generate

echo ""
echo "Step 2: Applying database migration..."
npm run migrate:deploy

echo ""
echo "Step 3: Running backfill script..."
npm run migrate:pay10-backfill

echo ""
echo "=========================================="
echo "Migration complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Verify FIN-01 totals match before/after"
echo "2. Spot-check 10 invoices for correct balances"
echo "3. Run unit tests: npm run test:pay10-status npm run test:pay10-balance"
echo "4. Run regression tests: npm run test:pay10-regression"
