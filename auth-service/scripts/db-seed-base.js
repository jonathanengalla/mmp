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
  const baseEvents = [
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

  const now = new Date();
  const demoEvents = [];
  for (let i = 0; i < 12; i++) {
    const start = new Date(now);
    start.setMonth(now.getMonth() - i);
    start.setDate(15);
    start.setHours(18, 0, 0, 0);
    const end = new Date(start);
    end.setHours(start.getHours() + 3);
    const ym = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
    demoEvents.push({
      id: `event-${ym}`,
      title: `RCME Monthly Meeting ${start.toLocaleString("default", { month: "short" })} ${start.getFullYear()}`,
      description: `Regular RCME club meeting for ${start.toLocaleString("default", { month: "long" })} ${start.getFullYear()}.`,
      location: "Makati, Metro Manila",
      status: "PUBLISHED",
      bannerUrl: "/media/demo/monthly-meeting.jpg",
      startsAt: start,
      endsAt: end,
      price: 1200,
      currency: "PHP",
      tags: ["demo", "monthly"],
    });
  }

  const allEvents = [...baseEvents, ...demoEvents];

  for (const e of allEvents) {
    await prisma.event.upsert({
      where: { id: e.id },
      update: {
        title: e.title,
        description: e.description,
        location: e.location,
        status: e.status,
        bannerUrl: e.bannerUrl,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        price: e.price ?? null,
        currency: e.currency ?? null,
        tags: e.tags || [],
      },
      create: e,
    });
  }
  return allEvents;
};

const seedInvoices = async (eventsSeeded) => {
  const members = await prisma.member.findMany({
    where: { email: { in: ["admin@test.local", "president@rcme.demo", "secretary@rcme.demo", "member1@rcme.demo"] } },
  });
  const memberByEmail = Object.fromEntries(members.map((m) => [m.email.toLowerCase(), m]));
  const member1 = memberByEmail["member1@rcme.demo"];
  if (!member1) {
    console.warn("[seed:base] member1@rcme.demo not found, skipping invoices");
  }

  const baseInvoices = [];
  if (member1) {
    baseInvoices.push(
      {
        invoiceNumber: "INV-2025-0001",
        amount: 2500,
        currency: "PHP",
        status: "PAID",
        issuedAt: new Date("2025-01-01T10:00:00+08:00"),
        dueAt: new Date("2025-01-15T23:59:59+08:00"),
        paidAt: new Date("2025-01-10T14:30:00+08:00"),
        description: "Annual membership dues 2025",
        memberId: member1.id,
      },
      {
        invoiceNumber: "INV-2025-0002",
        amount: 1500,
        currency: "PHP",
        status: "PENDING",
        issuedAt: new Date("2025-02-01T10:00:00+08:00"),
        dueAt: new Date("2025-02-28T23:59:59+08:00"),
        description: "Global Insights event fees",
        memberId: member1.id,
      }
    );
  }

  const cycle = ["PAID", "PAID", "PENDING", "OVERDUE", "PENDING"];
  let invoiceCounter = 200;
  const eventInvoices = [];
  for (const ev of eventsSeeded || []) {
    const issuedBase = new Date(ev.startsAt);
    issuedBase.setDate(ev.startsAt.getDate() - 7);
    const dueBase = new Date(ev.startsAt);
    dueBase.setDate(ev.startsAt.getDate() - 1);
    const forMembers = ["admin@test.local", "president@rcme.demo", "secretary@rcme.demo", "member1@rcme.demo"]
      .map((e) => memberByEmail[e])
      .filter(Boolean);
    for (const m of forMembers) {
      invoiceCounter += 1;
      const status = cycle[invoiceCounter % cycle.length];
      const invoiceNumber = `INV-${ev.startsAt.getFullYear()}-${String(ev.startsAt.getMonth() + 1).padStart(2, "0")}-${String(invoiceCounter).padStart(4, "0")}`;
      const issuedAt = new Date(issuedBase);
      const dueAt = new Date(dueBase);
      const paidAt = status === "PAID" ? new Date(ev.startsAt) : null;
      eventInvoices.push({
        invoiceNumber,
        amount: 1000 + ((invoiceCounter % 5) * 100),
        currency: "PHP",
        status,
        issuedAt,
        dueAt,
        paidAt,
        description: `${ev.title} registration`,
        memberId: m.id,
        eventId: ev.id,
      });
    }
  }

  const invoices = [...baseInvoices, ...eventInvoices];

  for (const inv of invoices) {
    await prisma.invoice.upsert({
      where: { invoiceNumber: inv.invoiceNumber },
      update: {
        status: inv.status,
        amount: inv.amount,
        issuedAt: inv.issuedAt,
        dueAt: inv.dueAt,
        paidAt: inv.paidAt ?? null,
        description: inv.description,
        eventId: inv.eventId ?? null,
        memberId: inv.memberId,
      },
      create: inv,
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
  const eventsSeeded = await seedEvents();
  await seedInvoices(eventsSeeded);
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

