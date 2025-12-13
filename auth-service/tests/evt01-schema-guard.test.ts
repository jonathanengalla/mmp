import assert from "node:assert/strict";
import test from "node:test";
import { RegistrationMode, EventType, Prisma } from "@prisma/client";

/**
 * EVT-01 Schema Guard
 * 
 * Lightweight structural tests to catch accidental schema changes
 * that would break events, registrations, or attendance features.
 * 
 * These tests verify that critical fields exist at the TypeScript/Prisma type level
 * without requiring a database connection.
 */

test("Event model has registrationMode field with RSVP and PAY_NOW enum values", () => {
  // Verify enum exists and has expected values
  assert.strictEqual(RegistrationMode.RSVP, "RSVP", "RegistrationMode.RSVP should be 'RSVP'");
  assert.strictEqual(RegistrationMode.PAY_NOW, "PAY_NOW", "RegistrationMode.PAY_NOW should be 'PAY_NOW'");
  
  // Verify enum can be used in Prisma query types (type-level check)
  // If the field doesn't exist, TypeScript will fail here
  const validQuery: Prisma.EventWhereInput = {
    registrationMode: { in: [RegistrationMode.RSVP, RegistrationMode.PAY_NOW] },
  };
  assert.ok(validQuery.registrationMode, "registrationMode field exists in Event model");
});

test("EventRegistration model has checkedInAt as nullable DateTime", () => {
  // Verify checkedInAt can be used in Prisma query types
  // If the field doesn't exist or is wrong type, TypeScript will fail
  const nullQuery: Prisma.EventRegistrationWhereInput = {
    checkedInAt: null,
  };
  assert.ok(nullQuery.hasOwnProperty("checkedInAt"), "checkedInAt field exists in EventRegistration model");
  
  const notNullQuery: Prisma.EventRegistrationWhereInput = {
    checkedInAt: { not: null },
  };
  assert.ok(notNullQuery.checkedInAt, "checkedInAt accepts null and not-null queries (nullable field)");
  
  // Verify it accepts DateTime values
  const dateQuery: Prisma.EventRegistrationWhereInput = {
    checkedInAt: { gte: new Date() },
  };
  assert.ok(dateQuery.checkedInAt, "checkedInAt accepts DateTime comparison queries");
});

test("Event model has eventType field with IN_PERSON and ONLINE enum values", () => {
  // Verify enum exists and has expected values
  assert.strictEqual(EventType.IN_PERSON, "IN_PERSON", "EventType.IN_PERSON should be 'IN_PERSON'");
  assert.strictEqual(EventType.ONLINE, "ONLINE", "EventType.ONLINE should be 'ONLINE'");
  
  // Verify enum can be used in Prisma query types
  const validQuery: Prisma.EventWhereInput = {
    eventType: { in: [EventType.IN_PERSON, EventType.ONLINE] },
  };
  assert.ok(validQuery.eventType, "eventType field exists in Event model");
});

