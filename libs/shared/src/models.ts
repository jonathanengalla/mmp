// Shared DTOs/models (scaffolding only)

// =============================================================================
// Role System
// =============================================================================

/** Supported membership roles */
export type Role = "admin" | "member" | "event_manager" | "finance_manager" | "communications_manager";

/** All available roles in the system */
export const ALL_ROLES: Role[] = ["admin", "member", "event_manager", "finance_manager", "communications_manager"];

/** Human-readable labels for roles */
export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  member: "Member",
  event_manager: "Event Manager",
  finance_manager: "Finance Manager",
  communications_manager: "Communications Manager",
};

/** Check if a string is a valid Role */
export const isValidRole = (role: string): role is Role => ALL_ROLES.includes(role as Role);

// =============================================================================
// Core Entities
// =============================================================================

export interface Tenant {
  id: string;
  name: string;
  timezone?: string;
  locale?: string;
  status?: string;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  roles: Role[];
  status?: string;
}

export interface MembershipType {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  category?: string;
  isDefault?: boolean;
}

export interface Invite {
  id: string;
  tenantId: string;
  email: string;
  membershipTypeId?: string;
  status: "pending" | "accepted" | "expired" | "revoked";
}

export interface Profile {
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  linkedinUrl?: string;
  otherSocials?: string;
  profileFields?: Record<string, unknown>;
  avatarUrl?: string | null;
}

export interface Member extends Profile {
  id: string;
  tenantId: string;
  email: string;
  status: "pending" | "pendingVerification" | "pendingApproval" | "active" | "inactive" | "rejected";
  membershipTypeId?: string;
  roles?: Role[];
  createdAt?: number;
  rejectionReason?: string;
  avatarUrl?: string | null;
  customFields?: Record<string, string | number | boolean | null>;
}

export type MemberStatusType = "ACTIVE" | "PENDING_VERIFICATION" | "INACTIVE" | "SUSPENDED";

export interface MembersAdminSummary {
  totalActive: number;
  pendingApproval: number;
  inactiveOrSuspended: number;
  joinedLast30Days: number;
  supporterOnlyCount?: number;
}

export interface MemberSelfSummary {
  status: MemberStatusType;
  memberSince?: string;
  eventsAttendedThisYear?: number;
  outstandingDuesCents?: number;
}

// =============================================================================
// Role Management Types
// =============================================================================

export interface UpdateMemberRolesPayload {
  roles: Role[];
}

export interface UpdateMemberRolesResponse {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  roles: Role[];
  status: string;
}

// Member directory search types (M-12)
export interface MemberDirectoryEntry {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  status: string;
  created_at?: number | null;
  linkedinUrl?: string | null;
  otherSocials?: string | null;
  avatarUrl?: string | null;
  customFields?: Record<string, string | number | boolean | null>;
}

// Member Avatar Response (M-14, M-15)
export interface MemberAvatarResponse {
  memberId: string;
  avatarUrl: string | null;
}

export interface MemberDirectorySearchResponse {
  items: MemberDirectoryEntry[];
  total: number;
  limit: number;
  offset: number;
}

// Member payment methods types (P-1)
export interface MemberPaymentMethod {
  id: string;
  memberId: string;
  brand: string;           // 'Visa', 'MasterCard', etc.
  last4: string;           // 4 digits only
  expMonth: number;        // 1–12
  expYear: number;         // four-digit year
  label?: string | null;   // optional nickname
  isDefault: boolean;
  createdAt: number;       // timestamp
  devPaymentToken: string; // dev-only token reference
}

export interface MemberPaymentMethodsResponse {
  items: MemberPaymentMethod[];
  defaultId: string | null;
}

export interface CreateMemberPaymentMethodRequest {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  label?: string | null;
}

// =============================================================================
// Custom Profile Fields (M-17, M-18, M-19, M-20)
// =============================================================================

/** Supported custom field types */
export type CustomFieldType = "text" | "textarea" | "number" | "date" | "select" | "checkbox";

/** All available custom field types */
export const CUSTOM_FIELD_TYPES: CustomFieldType[] = ["text", "textarea", "number", "date", "select", "checkbox"];

/** Human-readable labels for custom field types */
export const CUSTOM_FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: "Text",
  textarea: "Text Area",
  number: "Number",
  date: "Date",
  select: "Select (Dropdown)",
  checkbox: "Checkbox",
};

/** Validation rules for a custom field */
export interface CustomFieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;       // for number/date
  max?: number;       // for number/date
  pattern?: string;   // regex string, optional
}

/** Condition for conditional field visibility */
export interface CustomFieldCondition {
  fieldId: string;
  equals?: string | number | boolean | null;
}

/** Option for select/checkbox fields */
export interface CustomFieldOption {
  value: string;
  label: string;
}

/** Definition of a single custom field */
export interface CustomFieldDefinition {
  id: string;                              // stable id for this field (used as value key)
  key: string;                             // human-readable, unique per schema
  label: string;
  type: CustomFieldType;
  helpText?: string;
  groupId?: string;                        // group association
  order?: number;
  options?: CustomFieldOption[];           // for select / checkbox
  validation?: CustomFieldValidation;
  visibleWhen?: CustomFieldCondition[];    // simple AND of conditions
}

/** Group of custom fields for organization */
export interface CustomFieldGroup {
  id: string;
  label: string;
  description?: string;
  order?: number;
}

/** Complete schema for profile custom fields */
export interface ProfileCustomFieldSchema {
  groups: CustomFieldGroup[];
  fields: CustomFieldDefinition[];
  updatedAt: number;
}

/** Values for custom fields - a simple key-value map */
export type ProfileCustomFieldValues = Record<string, string | number | boolean | null>;

/** Response for member custom fields with schema */
export interface MemberCustomFieldsWithSchema {
  schema: ProfileCustomFieldSchema;
  customFields: ProfileCustomFieldValues;
}

/** Validation errors for custom fields */
export interface CustomFieldValidationErrors {
  errors: Record<string, string>;
}

// =============================================================================
// Events
// =============================================================================

export type EventStatus = "draft" | "published" | "cancelled" | "completed";

export interface EventRegistration {
  memberId: string;
  email: string;
  name: string;
  status: "registered" | "cancelled";
  registrationStatus?: "registered" | "cancelled" | "checked_in";
  ticketCode: string;
  registrationId: string;
  paymentStatus?: "unpaid" | "pending" | "paid";
  invoiceId?: string | null;
  createdAt: string;
  checkInStatus?: "not_checked_in" | "checked_in";
  checkedInAt?: number | null;
}

export interface EventRecord {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  startDate: string;
  endDate?: string | null;
  location?: string | null;
  capacity?: number | null;
  price?: number | null; // legacy, prefer priceCents
  priceCents?: number | null; // price in cents
  currency?: string | null; // e.g. "PHP"
  status: EventStatus;
  registrationsCount: number;
  invoiceIds?: string[];
  bannerImageUrl?: string | null;
  tags?: string[];
  registrationMode: "rsvp" | "pay_now";
  registrations: EventRegistration[];
  createdAt: string;
  updatedAt: string;
}

export interface UpcomingEventDto {
  event_id: string;
  slug: string;
  title: string;
  description?: string | null;
  startDate: string;
  endDate?: string | null;
  location?: string | null;
  capacity?: number | null;
  registrationsCount: number;
  priceCents?: number | null;
  currency?: string | null;
  status: EventStatus;
  registrationMode: "rsvp" | "pay_now";
  tags?: string[];
  bannerImageUrl?: string | null;
  isRegistered: boolean;
  registrationStatus?: "registered" | "cancelled" | null;
  ticketCode?: string | null;
  paymentStatus?: "unpaid" | "pending" | "paid" | null;
  invoiceId?: string | null;
}

export interface EventAttendanceReportItem {
  event_id: string;
  title: string;
  startDate: string;
  endDate?: string | null;
  capacity?: number | null;
  registrationsCount: number;
  status: EventStatus;
  bannerImageUrl?: string | null;
  tags?: string[];
  checkInCount?: number;
  paidCount?: number;
  unpaidCount?: number;
  invoiceIds?: string[];
}

export interface EventDetailDto extends UpcomingEventDto {
  id: string;
  bannerImageUrl?: string | null;
  remainingCapacity?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface EventCheckInResult {
  eventId: string;
  registrationId: string;
  checkInStatus: "checked_in";
  checkedInAt: string;
}

export interface EventsAdminSummary {
  upcomingEventsCount: number;
  nextEvent?: {
    id: string;
    title: string;
    startsAt: string;
  } | null;
  registrationsNext30Days: {
    registrationsCount: number;
    capacityTotal?: number | null;
  };
  eventRevenueThisYearCents: number;
  freeEventsCount: number;
  paidEventsCount: number;
}

export interface EventsSelfSummary {
  myUpcomingRegistrations: number;
  eventsAttendedThisYear: number;
  openRegistrationsCount: number;
}

// =============================================================================
// Billing / Invoices
// =============================================================================

export type InvoiceStatus = "draft" | "unpaid" | "pending" | "paid" | "cancelled" | "overdue" | "void";

export interface Invoice {
  id: string;
  memberId: string;
  amountCents: number;
  currency: string;
  status: InvoiceStatus;
  description: string;
  eventId?: string | null;
  eventTitle?: string | null;
  source?: "event" | "dues" | "manual" | string;
  dueDate?: string | null; // ISO
  createdAt: string; // ISO
  paidAt?: string | null; // ISO
  paymentMethod?: string | null; // e.g. "cash", "bank_transfer", "gcash", "card"
  paymentReference?: string | null; // receipt / bank ref / notes
  duesPeriodKey?: string | null;
  duesLabel?: string | null;
  tenantId?: string | null;
}

export interface RecordInvoicePaymentPayload {
  paymentMethod?: string | null;
  paymentReference?: string | null;
  paidAt?: string | null; // if omitted, server sets now
}

export interface EventCheckoutResponse {
  event: EventDetailDto;
  invoice: Invoice | null;
}

export interface DuesSummaryItem {
  periodKey: string;
  label: string;
  currency: string;
  totalCount: number;
  unpaidCount: number;
  paidCount: number;
  amountCentsTotal: number;
  amountCentsUnpaid: number;
  amountCentsPaid: number;
}

export interface DuesSummaryResponse {
  items: DuesSummaryItem[];
}

