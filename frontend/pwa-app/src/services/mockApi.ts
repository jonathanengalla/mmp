export type EventItem = {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  status: string;
  type: string;
};

export type InvoiceItem = {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  status: string;
};

export const EVENT_STATUS = {
  OPEN: "Open",
  CLOSED: "Closed",
  COMPLETED: "Completed",
} as const;

export const INVOICE_STATUS = {
  PAID: "Paid",
  PENDING: "Pending",
  OVERDUE: "Overdue",
} as const;

const upcomingEvents: EventItem[] = [
  {
    id: "ev-1",
    title: "Club Fellowship Night",
    date: "Feb 10, 2025",
    time: "6:00 PM",
    location: "RCME Clubhouse",
    status: EVENT_STATUS.OPEN,
    type: "Fellowship",
  },
  {
    id: "ev-2",
    title: "Medical Mission",
    date: "Feb 18, 2025",
    time: "8:00 AM",
    location: "Barangay San Isidro",
    status: EVENT_STATUS.OPEN,
    type: "Service",
  },
  {
    id: "ev-3",
    title: "Weekly Meeting",
    date: "Feb 25, 2025",
    time: "7:30 PM",
    location: "Makati Hall",
    status: EVENT_STATUS.OPEN,
    type: "Meeting",
  },
];

const pastEvents: EventItem[] = [
  {
    id: "ev-4",
    title: "Fundraiser Gala",
    date: "Jan 20, 2025",
    time: "7:00 PM",
    location: "Grand Ballroom",
    status: EVENT_STATUS.COMPLETED,
    type: "Fundraiser",
  },
  {
    id: "ev-5",
    title: "Tree Planting",
    date: "Jan 12, 2025",
    time: "6:30 AM",
    location: "La Mesa Eco Park",
    status: EVENT_STATUS.COMPLETED,
    type: "Service",
  },
  {
    id: "ev-6",
    title: "Board Strategy Session",
    date: "Jan 05, 2025",
    time: "5:00 PM",
    location: "RCME HQ",
    status: EVENT_STATUS.CLOSED,
    type: "Meeting",
  },
];

const invoices: InvoiceItem[] = [
  { id: "INV-2025-001", description: "Membership Dues 2025", amount: 15000, dueDate: "Feb 28, 2025", status: INVOICE_STATUS.PENDING },
  { id: "INV-2025-002", description: "Weekly Meeting Fees (Jan)", amount: 3000, dueDate: "Feb 05, 2025", status: INVOICE_STATUS.OVERDUE },
  { id: "INV-2025-003", description: "Christmas Fellowship Dinner", amount: 5000, dueDate: "Dec 15, 2024", status: INVOICE_STATUS.PAID },
  { id: "INV-2025-004", description: "Community Service Donation", amount: 8000, dueDate: "Mar 10, 2025", status: INVOICE_STATUS.PENDING },
  { id: "INV-2025-005", description: "Rotary District Conference", amount: 12000, dueDate: "Apr 01, 2025", status: INVOICE_STATUS.PAID },
];

function simulateLatency<T>(data: T): Promise<T> {
  const delay = 400 + Math.floor(Math.random() * 300); // 400-700ms
  return new Promise((resolve) => {
    setTimeout(() => resolve(data), delay);
  });
}

export async function fetchEvents(): Promise<{ upcoming: EventItem[]; past: EventItem[] }> {
  return simulateLatency({ upcoming: upcomingEvents, past: pastEvents });
}

export async function fetchInvoices(): Promise<InvoiceItem[]> {
  return simulateLatency(invoices);
}

