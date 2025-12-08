#!/usr/bin/env node
/**
 * db:seed:base (idempotent, safe for local+demo)
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

const seedMembers = async () => {
  const members = [
    { email: "admin@test.local", firstName: "Admin", lastName: "User", membershipType: "regular", roles: ["admin", "member", "event_manager", "finance_manager", "communications_manager"] },
    { email: "president@rcme.demo", firstName: "Alex", lastName: "Santos", membershipType: "regular" },
    { email: "secretary@rcme.demo", firstName: "Mia", lastName: "Reyes", membershipType: "regular" },
    { email: "member1@rcme.demo", firstName: "Carlos", lastName: "Tan", membershipType: "associate" },
  ];

  for (const m of members) {
    await prisma.member.upsert({
      where: { email: m.email },
      update: {},
      create: {
        email: m.email,
        firstName: m.firstName,
        lastName: m.lastName,
        membershipType: m.membershipType,
        status: "ACTIVE",
        roles: m.roles || [],
      },
    });
  }
};

const seedEvents = async () => {
  const events = [
    {
      id: "event-global-insights",
      title: "Global Insights Mixer",
      description: "Monthly networking and learning session for Rotary Club of Manila Expats.",
      location: "Makati, Metro Manila",
      status: "PUBLISHED",
      bannerUrl: "/media/demo/global-insights-banner.jpg",
      startsAt: new Date("2025-01-15T18:00:00+08:00"),
      endsAt: new Date("2025-01-15T21:00:00+08:00"),
      price: 1500,
      currency: "PHP",
    },
    {
      id: "event-christmas-party",
      title: "RCME Christmas Party",
      description: "Year end celebration with raffle prizes and sponsor recognition.",
      location: "BGC, Taguig",
      status: "PUBLISHED",
      bannerUrl: "/media/demo/christmas-party-banner.jpg",
      startsAt: new Date("2025-12-10T19:00:00+08:00"),
      endsAt: new Date("2025-12-10T22:00:00+08:00"),
      price: 2500,
      currency: "PHP",
    },
  ];

  for (const e of events) {
    await prisma.event.upsert({
      where: { id: e.id },
      update: {},
      create: e,
    });
  }
};

const seedInvoices = async () => {
  const member = await prisma.member.findUnique({ where: { email: "member1@rcme.demo" } });
  if (!member) {
    console.warn("[seed:base] member1@rcme.demo not found, skipping invoices");
    return;
  }

  const invoices = [
    {
      invoiceNumber: "INV-2025-0001",
      amount: 2500,
      currency: "PHP",
      status: "PAID",
      issuedAt: new Date("2025-01-01T10:00:00+08:00"),
      dueAt: new Date("2025-01-15T23:59:59+08:00"),
      paidAt: new Date("2025-01-10T14:30:00+08:00"),
      description: "Annual membership dues 2025",
    },
    {
      invoiceNumber: "INV-2025-0002",
      amount: 1500,
      currency: "PHP",
      status: "PENDING",
      issuedAt: new Date("2025-02-01T10:00:00+08:00"),
      dueAt: new Date("2025-02-28T23:59:59+08:00"),
      description: "Global Insights event fees",
    },
  ];

  for (const inv of invoices) {
    await prisma.invoice.upsert({
      where: { invoiceNumber: inv.invoiceNumber },
      update: {},
      create: {
        ...inv,
        memberId: member.id,
      },
    });
  }
};

const seedUsers = async () => {
  const adminMember = await prisma.member.findUnique({ where: { email: "admin@test.local" } });
  const passwordHash = bcrypt.hashSync("password123", 10);
  await prisma.user.upsert({
    where: { email: "admin@test.local" },
    update: {
      roles: ["admin", "member", "event_manager", "finance_manager", "communications_manager"],
      memberId: adminMember?.id || null,
      passwordHash,
    },
    create: {
      email: "admin@test.local",
      passwordHash,
      roles: ["admin", "member", "event_manager", "finance_manager", "communications_manager"],
      tenantId: "t1",
      memberId: adminMember?.id || null,
      status: "ACTIVE",
    },
  });
};

async function main() {
  console.log("[seed:base] starting");
  await seedMembers();
  await seedUsers();
  await seedEvents();
  await seedInvoices();
  console.log("[seed:base] done");
}

main()
  .catch((err) => {
    console.error("[seed:base] failed", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

