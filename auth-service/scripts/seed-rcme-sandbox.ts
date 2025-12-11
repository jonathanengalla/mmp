/* eslint-disable no-console */
import { PrismaClient, MemberStatus, InvoiceStatus, PaymentStatus, EventStatus, EventRegistrationStatus, PaymentMethodStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { faker } from "@faker-js/faker";

const prisma = new PrismaClient();

const TENANT_SLUG = "rcme-dev";
const TENANT_NAME = "Rotary Club of Manila Expats";
const ORG_PROFILE = {
  displayName: "Rotary Club of Manila Expats",
  legalName: "Rotary Club of Manila Expats",
  type: "rotary_club",
  currency: "PHP",
  timezone: "Asia/Manila",
  locale: "en-PH",
  billingContactEmail: "treasurer@rcme.com",
  billingContactName: "RCME Treasurer",
  billingAddressLine1: "Makati City",
  billingCity: "Makati",
  billingCountry: "Philippines",
};

const ADMIN_USER = {
  email: "admin@rcme-dev.com",
  password: "Admin123!",
  firstName: "Robert",
  lastName: "Santos",
};

const MEMBER_USER = {
  email: "testmember@rcme-dev.com",
  password: "Member123!",
  firstName: "Maria",
  lastName: "Cruz",
};

const CLASSIFICATIONS = ["Legal", "Real Estate", "Finance", "Consulting", "Healthcare", "Technology", "Education", "Hospitality"];

type SeedOptions = { reset: boolean };

function isProduction() {
  const env = process.env.NODE_ENV || "";
  return env.toLowerCase() === "production";
}

async function hashPassword(plain: string) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

async function deleteTenantData(tenantId: string) {
  if (!tenantId) {
    throw new Error("deleteTenantData called without tenantId");
  }
  // Run deletes sequentially to avoid long-running single transaction timeouts
  await prisma.roleAssignment.deleteMany({ where: { tenantId } });
  await prisma.auditLog.deleteMany({ where: { tenantId } });
  await prisma.payment.deleteMany({ where: { tenantId } });
  await prisma.eventRegistration.deleteMany({ where: { tenantId } });
  await prisma.invoice.deleteMany({ where: { tenantId } });
  await prisma.paymentMethod.deleteMany({ where: { tenantId } });
  await prisma.event.deleteMany({ where: { tenantId } });
  await prisma.user.deleteMany({ where: { tenantId } });
  await prisma.member.deleteMany({ where: { tenantId } });
  await prisma.orgProfile.deleteMany({ where: { tenantId } });
  await prisma.featureFlags.deleteMany({ where: { tenantId } });
  await prisma.membershipType.deleteMany({ where: { tenantId } });
  await prisma.tenant.deleteMany({ where: { id: tenantId } });
}

async function ensureTenant(options: SeedOptions) {
  const existing = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } });
  if (existing && options.reset) {
    console.log("Reset requested: deleting existing RCME tenant data...");
    await deleteTenantData(existing.id);
  }

  const tenant = await prisma.tenant.upsert({
    where: { slug: TENANT_SLUG },
    create: {
      slug: TENANT_SLUG,
      name: TENANT_NAME,
      description: "RCME sandbox tenant for demos/regression",
    },
    update: {
      name: TENANT_NAME,
      description: "RCME sandbox tenant for demos/regression",
    },
  });

  await prisma.featureFlags.upsert({
    where: { tenantId: tenant.id },
    create: {
      tenantId: tenant.id,
      payments: true,
      events: true,
      communications: true,
      reporting: true,
    },
    update: {},
  });

  await prisma.orgProfile.upsert({
    where: { tenantId: tenant.id },
    create: { tenantId: tenant.id, ...ORG_PROFILE, name: ORG_PROFILE.displayName },
    update: { ...ORG_PROFILE, name: ORG_PROFILE.displayName },
  });

  return tenant;
}

async function ensureUserWithMember(tenantId: string, email: string, password: string, firstName: string, lastName: string, roles: string[]) {
  const passwordHash = await hashPassword(password);
  const member = await prisma.member.upsert({
    where: { tenantId_email: { tenantId, email } },
    update: {
      firstName,
      lastName,
      status: MemberStatus.ACTIVE,
    },
    create: {
      tenantId,
      email,
      firstName,
      lastName,
      status: MemberStatus.ACTIVE,
    },
  });

  const user = await prisma.user.upsert({
    where: { tenantId_email: { tenantId, email } },
    update: {
      passwordHash,
      memberId: member.id,
      roles,
    },
    create: {
      tenantId,
      email,
      passwordHash,
      roles,
      memberId: member.id,
      status: MemberStatus.ACTIVE,
    },
  });

  // Reset role assignments to desired set
  await prisma.roleAssignment.deleteMany({ where: { tenantId, userId: user.id } });
  await prisma.roleAssignment.createMany({
    data: roles.map((role) => ({
      tenantId,
      userId: user.id,
      role: role.toUpperCase(),
    })),
    skipDuplicates: true,
  });

  return { user, member };
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function seedDirectory(tenantId: string) {
  const members: { id: string; email: string; status: MemberStatus }[] = [];

  const createMember = async (status: MemberStatus, forcedEmail?: string) => {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    // Use a deterministic email when provided so pending members are guaranteed unique/count-correct.
    const email =
      forcedEmail ||
      faker.internet
        .email({ firstName, lastName, provider: "example.com" })
        .toLowerCase();
    const member = await prisma.member.upsert({
      where: { tenantId_email: { tenantId, email } },
      update: {
        firstName,
        lastName,
        status,
        phone: faker.phone.number(),
        address: faker.location.streetAddress({ useFullAddress: false }),
        tags: [pickRandom(CLASSIFICATIONS)],
      },
      create: {
        tenantId,
        email,
        firstName,
        lastName,
        status,
        phone: faker.phone.number(),
        address: faker.location.streetAddress({ useFullAddress: false }),
        tags: [pickRandom(CLASSIFICATIONS)],
      },
    });
    members.push({ id: member.id, email: member.email, status: member.status });
    return member;
  };

  // 20 Active
  for (let i = 0; i < 20; i++) {
    await createMember(MemberStatus.ACTIVE);
  }
  // 20 Prospective (use PENDING_VERIFICATION) with deterministic emails to avoid accidental drops
  for (let i = 0; i < 20; i++) {
    const email = `pending${i + 1}@${TENANT_SLUG}.com`;
    await createMember(MemberStatus.PENDING_VERIFICATION, email);
  }
  // 2 Honorary -> map to INACTIVE
  for (let i = 0; i < 2; i++) {
    await createMember(MemberStatus.INACTIVE);
  }
  // 1 Resigned -> map to INACTIVE
  await createMember(MemberStatus.INACTIVE);

  return members.filter((m) => m.status === MemberStatus.ACTIVE);
}

async function seedPaymentMethodsForMember(tenantId: string, memberId: string) {
  await prisma.paymentMethod.deleteMany({ where: { tenantId, memberId } });
  await prisma.paymentMethod.createMany({
    data: [
      {
        tenantId,
        memberId,
        brand: "Visa",
        last4: "4242",
        expMonth: 12,
        expYear: 2026,
        label: "Personal Visa",
        token: "tok_visa_test_4242",
        isDefault: true,
        status: PaymentMethodStatus.ACTIVE,
      },
      {
        tenantId,
        memberId,
        brand: "Mastercard",
        last4: "5555",
        expMonth: 6,
        expYear: 2027,
        label: "Corporate Mastercard",
        token: "tok_mc_test_5555",
        isDefault: false,
        status: PaymentMethodStatus.ACTIVE,
      },
    ],
    skipDuplicates: true,
  });
}

async function createInvoiceWithPayments(params: {
  tenantId: string;
  memberId: string;
  invoiceNumber: string;
  amountCents: number;
  currency: string;
  description: string;
  source?: string;
  eventId?: string | null;
  status: InvoiceStatus;
  issuedAt: Date;
  dueAt?: Date | null;
  paidFraction?: number; // 0 to 1 for partial
}) {
  const {
    tenantId,
    memberId,
    invoiceNumber,
    amountCents,
    currency,
    description,
    source,
    eventId,
    status,
    issuedAt,
    dueAt,
    paidFraction,
  } = params;

  const invoice = await prisma.invoice.upsert({
    where: { tenantId_invoiceNumber: { tenantId, invoiceNumber } },
    update: {
      memberId,
      amountCents,
      currency,
      status,
      issuedAt,
      dueAt: dueAt ?? null,
      description,
      eventId: eventId ?? null,
      source: source ?? null,
      paidAt: status === InvoiceStatus.PAID ? new Date() : null,
    },
    create: {
      tenantId,
      memberId,
      invoiceNumber,
      amountCents,
      currency,
      status,
      issuedAt,
      dueAt: dueAt ?? null,
      description,
      eventId: eventId ?? null,
      source: source ?? null,
      paidAt: status === InvoiceStatus.PAID ? new Date() : null,
    },
  });

  if (status === InvoiceStatus.PAID || (paidFraction && paidFraction > 0)) {
    const payAmount =
      paidFraction && paidFraction > 0 && paidFraction < 1 ? Math.floor(amountCents * paidFraction) : amountCents;
    await prisma.payment.create({
      data: {
        tenantId,
        invoiceId: invoice.id,
        memberId,
        amountCents: payAmount,
        currency,
        status: PaymentStatus.SUCCEEDED,
        reference: pickRandom(["BANK-TRANSFER-123", "CASH-001", "GCASH-456"]),
        processedAt: new Date(Math.max(Date.now(), issuedAt.getTime() + 86_400_000)),
      },
    });
    if (paidFraction && paidFraction > 0 && paidFraction < 1) {
      // Optional second partial payment could be added here if needed
    }
  }

  return invoice;
}

async function seedEvents(tenantId: string, memberIds: string[]) {
  // Event definitions (2025 timeline + one upcoming relative)
  const upcomingStart = daysFromNow(30);
  const upcomingEnd = new Date(upcomingStart.getTime() + 2 * 60 * 60 * 1000);

  const eventsData = [
    {
      title: "RCME Annual Gala Dinner 2025",
      slug: "gala-dinner-2025",
      status: EventStatus.COMPLETED,
      startsAt: new Date("2025-06-15T18:00:00+08:00"),
      endsAt: new Date("2025-06-15T22:00:00+08:00"),
      priceCents: 250000,
      currency: "PHP",
      capacity: 100,
      description: "Annual fundraising gala with dinner and awards",
      location: "Makati Shangri-La Hotel",
      registrations: 40,
      paidCount: 35,
    },
    {
      title: "RCME Fellowship Lunch - November 2025",
      slug: "fellowship-lunch-nov-2025",
      status: EventStatus.COMPLETED,
      startsAt: new Date("2025-11-15T12:00:00+08:00"),
      endsAt: new Date("2025-11-15T14:00:00+08:00"),
      priceCents: 150000,
      currency: "PHP",
      capacity: 50,
      description: "Monthly fellowship lunch with guest speaker",
      location: "Diamond Hotel Manila",
      registrations: 30,
      paidCount: 20,
    },
    {
      title: "RCME Coffee Meetup - Upcoming",
      slug: "coffee-meetup-upcoming",
      status: EventStatus.PUBLISHED,
      startsAt: upcomingStart,
      endsAt: upcomingEnd,
      priceCents: 0,
      currency: "PHP",
      capacity: 30,
      description: "Casual coffee networking for members",
      location: "Starbucks BGC",
      registrations: 12,
      paidCount: 0,
    },
  ];

  const createdEvents: { id: string; slug: string; priceCents: number; currency: string; paidCount: number; registrations: number }[] =
    [];

  for (const evt of eventsData) {
    const event = await prisma.event.upsert({
      where: { tenantId_slug: { tenantId, slug: evt.slug } },
      update: {
        title: evt.title,
        status: evt.status,
        startsAt: evt.startsAt,
        endsAt: evt.endsAt,
        priceCents: evt.priceCents,
        currency: evt.currency,
        capacity: evt.capacity,
        description: evt.description,
        location: evt.location,
      },
      create: {
        tenantId,
        slug: evt.slug,
        title: evt.title,
        status: evt.status,
        startsAt: evt.startsAt,
        endsAt: evt.endsAt,
        priceCents: evt.priceCents,
        currency: evt.currency,
        capacity: evt.capacity,
        description: evt.description,
        location: evt.location,
      },
    });
    createdEvents.push({
      id: event.id,
      slug: event.slug,
      priceCents: evt.priceCents,
      currency: evt.currency,
      paidCount: evt.paidCount,
      registrations: evt.registrations,
      startsAt: event.startsAt,
    });
  }

  let invoiceCounter = 1;

  for (const evt of createdEvents) {
    const regs = evt.registrations;
    const paidTarget = evt.paidCount;
    for (let i = 0; i < regs; i++) {
      const memberId = memberIds[i % memberIds.length];
      const isPaid = i < paidTarget && evt.priceCents > 0;

    const registration = await prisma.eventRegistration.upsert({
      where: { tenantId_eventId_memberId: { tenantId, eventId: evt.id, memberId } },
      update: {},
      create: {
        tenantId,
        eventId: evt.id,
        memberId,
        status: isPaid ? EventRegistrationStatus.CONFIRMED : EventRegistrationStatus.PENDING,
        checkInAt:
          evt.slug === "gala-dinner-2025" && isPaid && evt.startsAt
            ? new Date(evt.startsAt.getTime() + 60 * 60 * 1000)
            : null,
      },
    });

      if (evt.priceCents > 0) {
        const invoiceNumber = `${TENANT_SLUG.toUpperCase()}-${String(invoiceCounter).padStart(5, "0")}`;
        invoiceCounter += 1;
        const invoice = await createInvoiceWithPayments({
          tenantId,
          memberId,
          invoiceNumber,
          amountCents: evt.priceCents,
          currency: evt.currency,
          description: `Event fee: ${evt.slug}`,
          source: "event",
          eventId: evt.id,
          status: isPaid ? InvoiceStatus.PAID : InvoiceStatus.UNPAID,
          issuedAt: evt.startsAt,
          dueAt: evt.startsAt,
        });

        await prisma.eventRegistration.update({
          where: { tenantId_eventId_memberId: { tenantId, eventId: evt.id, memberId } },
          data: { invoiceId: invoice.id },
        });
      }
    }
  }
}

async function seedDuesInvoices(tenantId: string, activeMemberIds: string[]) {
  let invoiceCounter = 10_000;
  const duesAmount = 1_500_000; // ₱15,000
  const halfPayment = 0.5;

  const shuffle = [...activeMemberIds].sort(() => Math.random() - 0.5);
  const paidMembers = shuffle.slice(0, 15);
  const unpaidMembers = shuffle.slice(15, 18);
  const partialMembers = shuffle.slice(18, 20);

  for (const memberId of paidMembers) {
    const invoiceNumber = `${TENANT_SLUG.toUpperCase()}-2025-DUES-${invoiceCounter++}`;
    await createInvoiceWithPayments({
      tenantId,
      memberId,
      invoiceNumber,
      amountCents: duesAmount,
      currency: "PHP",
      description: "Annual Membership Dues 2024-2025",
      source: "dues",
      status: InvoiceStatus.PAID,
      issuedAt: new Date("2024-07-01"),
      dueAt: new Date("2024-08-31"),
    });
  }

  for (const memberId of unpaidMembers) {
    const invoiceNumber = `${TENANT_SLUG.toUpperCase()}-2025-DUES-${invoiceCounter++}`;
    await createInvoiceWithPayments({
      tenantId,
      memberId,
      invoiceNumber,
      amountCents: duesAmount,
      currency: "PHP",
      description: "Annual Membership Dues 2024-2025",
      source: "dues",
      status: InvoiceStatus.UNPAID,
      issuedAt: new Date("2024-07-01"),
      dueAt: new Date("2024-08-31"),
    });
  }

  for (const memberId of partialMembers) {
    const invoiceNumber = `${TENANT_SLUG.toUpperCase()}-2025-DUES-${invoiceCounter++}`;
    await createInvoiceWithPayments({
      tenantId,
      memberId,
      invoiceNumber,
      amountCents: duesAmount,
      currency: "PHP",
      description: "Annual Membership Dues 2024-2025",
      source: "dues",
      status: InvoiceStatus.UNPAID,
      issuedAt: new Date("2024-07-01"),
      dueAt: new Date("2024-08-31"),
      paidFraction: halfPayment,
    });
  }
}

async function main() {
  if (isProduction()) {
    throw new Error("Cannot seed sandbox data in production");
  }
  const reset = process.argv.includes("--reset");
  const options: SeedOptions = { reset };

  console.log(`Seeding RCME sandbox (reset=${reset})...`);

  const tenant = await ensureTenant(options);

  // Admin and member accounts
  const admin = await ensureUserWithMember(tenant.id, ADMIN_USER.email, ADMIN_USER.password, ADMIN_USER.firstName, ADMIN_USER.lastName, [
    "ADMIN",
  ]);
  const memberUser = await ensureUserWithMember(
    tenant.id,
    MEMBER_USER.email,
    MEMBER_USER.password,
    MEMBER_USER.firstName,
    MEMBER_USER.lastName,
    ["MEMBER"]
  );

  // Directory
  const activeMembers = await seedDirectory(tenant.id);
  const activeMemberIds = activeMembers.map((m) => m.id);

  // Payment methods for test member
  await seedPaymentMethodsForMember(tenant.id, memberUser.member.id);

  // Events and event invoices
  await seedEvents(tenant.id, activeMemberIds);

  // Dues invoices
  await seedDuesInvoices(tenant.id, activeMemberIds);

  console.log("RCME sandbox seed complete.");
  console.log(`Admin login: ${ADMIN_USER.email} / ${ADMIN_USER.password}`);
  console.log(`Member login: ${MEMBER_USER.email} / ${MEMBER_USER.password}`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

