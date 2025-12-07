import type { Invoice, EventDetailDto } from "../../../libs/shared/src/models";

interface MemberContact {
  email: string;
  name?: string | null;
}

export function buildDuesInvoiceEmail({ member, invoice }: { member: MemberContact; invoice: Invoice }) {
  const amount = (invoice.amountCents / 100).toFixed(2);
  const namePart = member.name ? `Hi ${member.name},` : "Hi there,";
  const subject = `Dues invoice for ${invoice.description || "membership"}`;
  const text = [
    namePart,
    "",
    `We’ve created a new dues invoice for you:`,
    `Amount: ${amount} ${invoice.currency || "PHP"}`,
    `Status: ${invoice.status}`,
    invoice.dueDate ? `Due date: ${invoice.dueDate}` : "",
    "",
    `Description: ${invoice.description || "Membership dues"}`,
    "",
    `You can view and pay this invoice under Invoices.`,
    "",
    `Thank you.`,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <p>${namePart}</p>
    <p>We’ve created a new dues invoice for you:</p>
    <ul>
      <li><strong>Amount:</strong> ${amount} ${invoice.currency || "PHP"}</li>
      <li><strong>Status:</strong> ${invoice.status}</li>
      ${invoice.dueDate ? `<li><strong>Due date:</strong> ${invoice.dueDate}</li>` : ""}
      <li><strong>Description:</strong> ${invoice.description || "Membership dues"}</li>
    </ul>
    <p>You can view and pay this invoice under <strong>Invoices</strong>.</p>
    <p>Thank you.</p>
  `;
  return { subject, text, html };
}

export function buildEventInvoiceEmail({
  member,
  invoice,
  event,
}: {
  member: MemberContact;
  invoice: Invoice;
  event?: EventDetailDto | null;
}) {
  const amount = (invoice.amountCents / 100).toFixed(2);
  const namePart = member.name ? `Hi ${member.name},` : "Hi there,";
  const eventTitle = event?.title || invoice.eventTitle || "your event";
  const eventDate = event?.startDate ? `on ${event.startDate}` : "";
  const subject = `Invoice for ${eventTitle}`;
  const text = [
    namePart,
    "",
    `You’re registered for ${eventTitle} ${eventDate}.`,
    "",
    `Invoice details:`,
    `Amount: ${amount} ${invoice.currency || "PHP"}`,
    `Status: ${invoice.status}`,
    "",
    `You can pay this invoice under Invoices.`,
    "",
    `Thank you.`,
  ].join("\n");

  const html = `
    <p>${namePart}</p>
    <p>You’re registered for <strong>${eventTitle}</strong> ${eventDate}.</p>
    <p>Invoice details:</p>
    <ul>
      <li><strong>Amount:</strong> ${amount} ${invoice.currency || "PHP"}</li>
      <li><strong>Status:</strong> ${invoice.status}</li>
    </ul>
    <p>You can pay this invoice under <strong>Invoices</strong>.</p>
    <p>Thank you.</p>
  `;
  return { subject, text, html };
}

export function buildEventRsvpEmail({ member, event }: { member: MemberContact; event: EventDetailDto }) {
  const namePart = member.name ? `Hi ${member.name},` : "Hi there,";
  const eventDate = event.startDate ? `on ${event.startDate}` : "";
  const venue = event.location ? ` at ${event.location}` : "";
  const subject = `RSVP confirmed for ${event.title}`;
  const text = [namePart, "", `Your RSVP is confirmed for ${event.title} ${eventDate}${venue}.`, "", `We look forward to seeing you.`].join("\n");

  const html = `
    <p>${namePart}</p>
    <p>Your RSVP is confirmed for <strong>${event.title}</strong> ${eventDate}${venue}.</p>
    <p>We look forward to seeing you.</p>
  `;
  return { subject, text, html };
}


