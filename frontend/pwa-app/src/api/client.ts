import { getSessionTokens, clearSessionTokens } from "../session";
import {
  EventAttendanceReportItem,
  EventCheckInResult,
  EventDetailDto,
  UpcomingEventDto,
  Invoice,
  EventCheckoutResponse,
  RecordInvoicePaymentPayload,
  DuesSummaryItem,
  DuesSummaryResponse,
} from "../../../../libs/shared/src/models";

const normalizeApiBaseUrl = (raw?: string): string => {
  if (!raw) return "/api";
  let base = raw.trim();
  if (!base) return "/api";
  base = base.replace(/\/+$/, "");
  const lower = base.toLowerCase();
  if (lower.endsWith("/api")) {
    base = base.slice(0, -4);
    base = base.replace(/\/+$/, "");
  }
  return base || "/api";
};

const rawEnvBase = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
export const API_BASE_URL = normalizeApiBaseUrl(rawEnvBase);

const json = async (res: Response) => {
  if (res.status === 401 || res.status === 403) {
    clearSessionTokens();
    const body = await res.json().catch(() => ({}));
    const error = new Error(body?.error?.message || "Unauthorized");
    (error as any).status = res.status;
    throw error;
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const error = new Error(body?.error?.message || "Request failed");
    (error as any).error = body?.error;
    (error as any).status = res.status;
    throw error;
  }
  return res.json();
};

const authHeaders = (): Record<string, string> => {
  const tokens = getSessionTokens();
  const headers: Record<string, string> = {};
  if (tokens?.access_token) headers.Authorization = `Bearer ${tokens.access_token}`;
  if (tokens?.tenant_id) headers["X-Tenant-Id"] = tokens.tenant_id;
  return headers;
};

export interface RegisterMemberPayload {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
  linkedinUrl?: string;
  otherSocials?: string;
}

export const registerMember = async (payload: RegisterMemberPayload) => {
  const res = await fetch(`${API_BASE_URL}/membership/members/registrations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return json(res);
};

export const verifyEmail = async (token: string) => {
  const res = await fetch(`${API_BASE_URL}/membership/members/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  return json(res);
};

export const requestVerification = async (email: string) => {
  const res = await fetch(`${API_BASE_URL}/membership/members/verify-request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return json(res);
};

const DEFAULT_TENANT_ID = (import.meta as any).env?.VITE_DEFAULT_TENANT_ID;

export const login = async (payload: { email: string; password: string; tenantId?: string; mfa_code?: string }) => {
  const effectiveTenantId = (payload.tenantId ?? DEFAULT_TENANT_ID ?? "").trim();
  if (!effectiveTenantId) {
    throw new Error("Missing tenantId. Set VITE_DEFAULT_TENANT_ID in your env or pass tenantId explicitly.");
  }
  const body = { email: payload.email, password: payload.password, tenantId: effectiveTenantId, mfaCode: payload.mfa_code };
  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    console.log("[client] auth/login", res.status, data);
    return {
      success: res.ok && data?.success !== false,
      status: res.status,
      token: data?.token,
      access_token: data?.accessToken || data?.access_token,
      refresh_token: data?.refreshToken || data?.refresh_token,
      tenant_id: data?.tenant_id,
      member_id: data?.member_id,
      roles: data?.roles as Role[] | undefined,
      user: data?.user as { id?: string; email?: string; roles?: Role[] } | undefined,
      error: data?.error,
    };
  } catch (err: any) {
    console.error("[client] auth/login network error", err);
    return { success: false, error: err?.message || "Network error" };
  }
};

export const getSession = async (token: string) => {
  const res = await fetch(`${API_BASE_URL}/auth/session`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return json(res);
};

export const getProfile = async (token: string, memberId: string) => {
  const res = await fetch(`${API_BASE_URL}/membership/members/${memberId}`, {
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  return json(res);
};

export const updateProfile = async (token: string, memberId: string, payload: any) => {
  const res = await fetch(`${API_BASE_URL}/membership/members/${memberId}`, {
    method: "PATCH",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return json(res);
};

export const listInvoices = async (token: string, filters: { status?: string; page?: number; page_size?: number } = {}) => {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.page_size) params.set("page_size", String(filters.page_size));
  const res = await fetch(`${API_BASE_URL}/billing/invoices?${params.toString()}`, {
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  return json(res);
};

export const downloadInvoicePdf = async (token: string, invoiceId: string) => {
  const res = await fetch(`${API_BASE_URL}/billing/invoices/${invoiceId}/pdf`, {
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 || res.status === 403) {
    clearSessionTokens();
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const error = new Error(body?.error?.message || "Download failed");
    (error as any).status = res.status;
    throw error;
  }
  return res.blob();
};

export interface CreateEventPayload {
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  capacity?: number | null;
  priceCents?: number | null;
  currency?: string | null;
  tags?: string[];
  registrationMode?: "rsvp" | "pay_now";
  location?: string | null;
}

export const createEventDraft = async (token: string, payload: CreateEventPayload): Promise<EventDetailDto> => {
  const res = await fetch(`${API_BASE_URL}/events`, {
    method: "POST",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return json(res);
};

export const publishEvent = async (token: string, eventId: string): Promise<EventDetailDto> => {
  const res = await fetch(`${API_BASE_URL}/events/${eventId}/publish`, {
    method: "POST",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  return json(res);
};

export const updateEventCapacity = async (token: string, eventId: string, capacity: number | null): Promise<EventDetailDto> => {
  const res = await fetch(`${API_BASE_URL}/events/${eventId}/capacity`, {
    method: "PATCH",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ capacity }),
  });
  return json(res);
};

export const updateEventPricing = async (
  token: string,
  eventId: string,
  payload: { priceCents: number | null; currency: string | null }
): Promise<EventDetailDto> => {
  const res = await fetch(`${API_BASE_URL}/events/${eventId}/pricing`, {
    method: "PATCH",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return json(res);
};

export const updateEventBasics = async (
  token: string,
  eventId: string,
  payload: { title?: string; description?: string; startDate?: string; endDate?: string | null; location?: string | null }
): Promise<EventDetailDto> => {
  const res = await fetch(`${API_BASE_URL}/events/${eventId}`, {
    method: "PATCH",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return json(res);
};

export const listUpcomingEvents = async (token: string): Promise<UpcomingEventDto[]> => {
  const res = await fetch(`${API_BASE_URL}/events/upcoming`, {
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  const data = await json(res);
  return data.items || [];
};

export const listEvents = async (
  token: string,
  params: { limit?: number; offset?: number } = {}
): Promise<{ items: EventDetailDto[]; total: number; limit: number; offset: number }> => {
  const search = new URLSearchParams();
  if (params.limit) search.set("limit", String(params.limit));
  if (params.offset) search.set("offset", String(params.offset));
  const query = search.toString();
  const res = await fetch(`${API_BASE_URL}/events${query ? `?${query}` : ""}`, {
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  return json(res);
};

export const getEventDetail = async (token: string | null, idOrSlug: string): Promise<EventDetailDto> => {
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  let res = await fetch(`${API_BASE_URL}/events/slug/${idOrSlug}`, { headers });
  if (res.status === 404) {
    res = await fetch(`${API_BASE_URL}/events/${idOrSlug}`, { headers });
  }
  return json(res);
};

export const registerForEvent = async (
  token: string,
  eventId: string,
  mode?: "rsvp" | "pay_now"
): Promise<EventDetailDto> => {
  const res = await fetch(`${API_BASE_URL}/events/${eventId}/register`, {
    method: "POST",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(mode ? { mode } : {}),
  });
  return json(res);
};

export const cancelEventRegistration = async (token: string, eventId: string): Promise<EventDetailDto> => {
  const res = await fetch(`${API_BASE_URL}/events/${eventId}/register`, {
    method: "DELETE",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  return json(res);
};

export const eventCheckout = async (token: string, eventId: string): Promise<EventCheckoutResponse> => {
  const res = await fetch(`${API_BASE_URL}/events/${eventId}/checkout`, {
    method: "POST",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  return json(res);
};

export const listMyInvoices = async (
  token: string,
  params: { status?: "all" | "outstanding" | "paid"; page?: number; pageSize?: number } = {}
) => {
  const search = new URLSearchParams();
  if (params.status && params.status !== "all") search.set("status", params.status);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  const res = await fetch(`${API_BASE_URL}/invoices/me?${search.toString()}`, {
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  return json(res);
};

export const listTenantInvoices = async (
  token: string,
  params: { status?: string; search?: string; page?: number; pageSize?: number } = {}
) => {
  const search = new URLSearchParams();
  if (params.status && params.status !== "all") search.set("status", params.status);
  if (params.search) search.set("search", params.search);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  const res = await fetch(`${API_BASE_URL}/billing/invoices/tenant?${search.toString()}`, {
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  return json(res);
};

export const getFinanceSummary = async (token: string) => {
  const res = await fetch(`${API_BASE_URL}/billing/admin/finance/summary`, {
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  return json(res);
};

export const recordInvoicePayment = async (
  token: string,
  invoiceId: string,
  payload: RecordInvoicePaymentPayload
): Promise<Invoice> => {
  const res = await fetch(`${API_BASE_URL}/invoices/${encodeURIComponent(invoiceId)}/record-payment`, {
    method: "POST",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to record invoice payment");
  }
  return res.json();
};

export interface CreateDuesRunPayload {
  periodKey: string;
  label: string;
  amountCents: number;
  currency: string;
  dueDate?: string | null;
}

export interface CreateDuesRunResult {
  periodKey: string;
  label: string;
  createdCount: number;
  skippedExistingCount: number;
  amountCentsPerInvoice: number;
  currency: string;
}

export interface DuesSummaryResponseClient extends DuesSummaryResponse {}

export interface DevEmailLogEntry {
  id: string;
  to: string;
  subject: string;
  template: string;
  payload: unknown;
  createdAt: string;
}

export interface DevEmailLogResponse {
  items: DevEmailLogEntry[];
}

export const fetchDevEmailLog = async (token: string): Promise<DevEmailLogEntry[]> => {
  const res = await fetch(`${API_BASE_URL}/dev/email-log`, {
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to load email log");
  }
  const data = (await res.json()) as DevEmailLogResponse | { items?: DevEmailLogEntry[] };
  return data.items || [];
};

export const createDuesRun = async (token: string, payload: CreateDuesRunPayload): Promise<CreateDuesRunResult> => {
  const res = await fetch(`${API_BASE_URL}/billing/dues/runs`, {
    method: "POST",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to create dues run");
  }
  return res.json();
};

export const getDuesSummary = async (token: string): Promise<DuesSummaryResponse> => {
  const res = await fetch(`${API_BASE_URL}/billing/dues/summary`, {
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to load dues summary");
  }
  return res.json();
};

export const updateEventBanner = async (
  token: string,
  eventId: string,
  bannerImageUrl: string | null
): Promise<EventDetailDto> => {
  const res = await fetch(`${API_BASE_URL}/events/${eventId}/banner`, {
    method: "PATCH",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ bannerImageUrl }),
  });
  return json(res);
};

export const updateEventTags = async (token: string, eventId: string, tags: string[]): Promise<EventDetailDto> => {
  const res = await fetch(`${API_BASE_URL}/events/${eventId}/tags`, {
    method: "PATCH",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ tags }),
  });
  return json(res);
};

export const updateEventRegistrationMode = async (
  token: string,
  eventId: string,
  mode: "rsvp" | "pay_now"
): Promise<EventDetailDto> => {
  const res = await fetch(`${API_BASE_URL}/events/${eventId}/registration-mode`, {
    method: "PATCH",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  return json(res);
};

export const checkInByCode = async (token: string, code: string): Promise<EventCheckInResult> => {
  const res = await fetch(`${API_BASE_URL}/events/checkin`, {
    method: "POST",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  return json(res);
};

export const listEventsAdmin = async (token: string): Promise<EventDetailDto[]> => {
  const res = await fetch(`${API_BASE_URL}/events`, {
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  const data = await json(res);
  return data.items || [];
};

// Communications
export const createBroadcastDraft = async (token: string, payload: { subject: string; body: string; audience_segment_id?: string; tags?: string[] }) => {
  const res = await fetch(`${API_BASE_URL}/communications/broadcasts`, {
    method: "POST",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return json(res);
};

export const listBroadcastDrafts = async (token: string, params: { page?: number; page_size?: number; status?: string } = {}) => {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.page) search.set("page", String(params.page));
  if (params.page_size) search.set("page_size", String(params.page_size));
  const res = await fetch(`${API_BASE_URL}/communications/broadcasts?${search.toString()}`, {
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  return json(res);
};

export const listSegments = async (token: string) => {
  const res = await fetch(`${API_BASE_URL}/communications/segments`, {
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  return json(res);
};

export const updateBroadcastDraft = async (
  token: string,
  id: string,
  payload: { subject: string; body: string; audience_segment_id?: string; tags?: string[] }
) => {
  const res = await fetch(`${API_BASE_URL}/communications/broadcasts/${id}`, {
    method: "PATCH",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return json(res);
};

export const getBroadcastPreview = async (token: string, id: string) => {
  const res = await fetch(`${API_BASE_URL}/communications/broadcasts/${id}/preview`, {
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  return json(res);
};

// Reporting
export const listMembersReport = async (token: string, params: { page?: number; page_size?: number; status?: string } = {}) => {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.page) search.set("page", String(params.page));
  if (params.page_size) search.set("page_size", String(params.page_size));
  const res = await fetch(`${API_BASE_URL}/reporting/reports/members?${search.toString()}`, {
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  return json(res);
};

export const listDuesSummary = async (token: string) => {
  const res = await fetch(`${API_BASE_URL}/reporting/reports/dues-summary`, {
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  return json(res);
};

export const listEventAttendanceReport = async (
  token: string,
  params: { page?: number; page_size?: number; status?: string } = {}
): Promise<{ items: EventAttendanceReportItem[] }> => {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.page) search.set("page", String(params.page));
  if (params.page_size) search.set("page_size", String(params.page_size));
  const res = await fetch(`${API_BASE_URL}/reporting/reports/events/attendance?${search.toString()}`, {
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  return json(res);
};

// Config Center
export const getOrgProfile = async (token: string) => {
  const res = await fetch(`${API_BASE_URL}/config/org-profile`, {
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  return json(res);
};

export const updateOrgProfile = async (
  token: string,
  payload: { name: string; description?: string; logoUrl?: string; timezone?: string; locale?: string }
) => {
  const res = await fetch(`${API_BASE_URL}/config/org-profile`, {
    method: "PATCH",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return json(res);
};

export const createMembershipType = async (
  token: string,
  payload: { name: string; description?: string; price: number; period: "monthly" | "annual" }
) => {
  const res = await fetch(`${API_BASE_URL}/config/membership-types`, {
    method: "POST",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return json(res);
};

export const listMembershipTypes = async (token: string) => {
  const res = await fetch(`${API_BASE_URL}/config/membership-types`, {
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  return json(res);
};

export const getApprovalWorkflow = async (token: string) => {
  const res = await fetch(`${API_BASE_URL}/config/approval-workflow`, {
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  return json(res);
};

export const updateApprovalWorkflow = async (
  token: string,
  payload: { requireApproval: boolean; approverRoles?: string[] }
) => {
  const res = await fetch(`${API_BASE_URL}/config/approval-workflow`, {
    method: "PATCH",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return json(res);
};

export const listPaymentCategories = async (token: string) => {
  const res = await fetch(`${API_BASE_URL}/config/payment-categories`, {
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  return json(res);
};

export const createPaymentCategory = async (
  token: string,
  payload: { code: string; name: string; type: "dues" | "event" | "other"; description?: string }
) => {
  const res = await fetch(`${API_BASE_URL}/config/payment-categories`, {
    method: "POST",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return json(res);
};

export const updatePaymentCategory = async (
  token: string,
  id: string,
  payload: { name?: string; description?: string; type?: "dues" | "event" | "other"; active?: boolean }
) => {
  const res = await fetch(`${API_BASE_URL}/config/payment-categories/${id}`, {
    method: "PATCH",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return json(res);
};

export const getInvoiceTemplate = async (token: string) => {
  const res = await fetch(`${API_BASE_URL}/config/invoice-template`, {
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  return json(res);
};

export const updateInvoiceTemplate = async (token: string, payload: { subject?: string; body?: string }) => {
  const res = await fetch(`${API_BASE_URL}/config/invoice-template`, {
    method: "PATCH",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return json(res);
};

export const getFeatureFlags = async (token: string) => {
  const res = await fetch(`${API_BASE_URL}/config/feature-flags`, {
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  return json(res);
};

export const updateFeatureFlags = async (token: string, payload: { payments?: boolean; events?: boolean; communications?: boolean; reporting?: boolean }) => {
  const res = await fetch(`${API_BASE_URL}/config/feature-flags`, {
    method: "PATCH",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return json(res);
};

// Pending members (Admin)
export const listPendingMembers = async (token: string, params: { page?: number; page_size?: number } = {}) => {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.page_size) search.set("page_size", String(params.page_size));
  const res = await fetch(`${API_BASE_URL}/membership/members/pending?${search.toString()}`, {
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  return json(res);
};

export const approveMember = async (token: string, memberId: string) => {
  const res = await fetch(`${API_BASE_URL}/membership/members/${memberId}/approve`, {
    method: "POST",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  return json(res);
};

export const rejectMember = async (token: string, memberId: string, reason?: string) => {
  const res = await fetch(`${API_BASE_URL}/membership/members/${memberId}/reject`, {
    method: "POST",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  return json(res);
};

// Role type for frontend (mirrors backend Role type)
export type Role = "admin" | "member" | "event_manager" | "finance_manager" | "communications_manager";

export const ALL_ROLES: Role[] = ["admin", "member", "event_manager", "finance_manager", "communications_manager"];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  member: "Member",
  event_manager: "Event Manager",
  finance_manager: "Finance Manager",
  communications_manager: "Communications Manager",
};

// Current member profile (for logged-in user)
export interface MemberProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  address: string | null;
  linkedinUrl: string | null;
  otherSocials: string | null;
  avatarUrl: string | null;
  customFields?: Record<string, string | number | boolean | null> | null;
  status: string;
  membership_type_id: string | null;
  created_at: number | null;
  roles?: Role[];
}

export interface UpdateMemberProfilePayload {
  phone?: string;
  address?: string;
  linkedinUrl?: string;
  otherSocials?: string;
}

export const getCurrentMember = async (token: string): Promise<MemberProfile> => {
  const res = await fetch(`${API_BASE_URL}/membership/members/me`, {
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  return json(res);
};

export const updateCurrentMember = async (token: string, payload: UpdateMemberProfilePayload): Promise<MemberProfile> => {
  const res = await fetch(`${API_BASE_URL}/membership/members/me`, {
    method: "PATCH",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return json(res);
};

// Member directory search (M-12)
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
  customFields?: Record<string, string | number | boolean | null> | null;
}

export interface MemberDirectorySearchResponse {
  items: MemberDirectoryEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface SearchMembersParams {
  q?: string;
  limit?: number;
  offset?: number;
}

export const searchDirectoryMembers = async (
  token: string,
  params: SearchMembersParams = {}
): Promise<MemberDirectorySearchResponse> => {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.offset !== undefined) search.set("offset", String(params.offset));

  const res = await fetch(`${API_BASE_URL}/membership/members/search?${search.toString()}`, {
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  return json(res);
};

// Member Payment Methods (P-1)
export interface MemberPaymentMethod {
  id: string;
  memberId: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  label?: string | null;
  isDefault: boolean;
  createdAt: number;
  token?: string | null; // non-sensitive reference; PAN/CVC never stored
  status?: string;
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

export const getMemberPaymentMethods = async (token: string): Promise<MemberPaymentMethodsResponse> => {
  const res = await fetch(`${API_BASE_URL}/membership/members/me/payment-methods`, {
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  const data = await json(res);
  const items = Array.isArray(data?.items) ? data.items : [];
  const defaultId =
    data?.defaultId ??
    (items.find((m: MemberPaymentMethod) => (m as any).isDefault)?.id ?? null);
  return { items, defaultId };
};

export const createMemberPaymentMethod = async (
  token: string,
  payload: CreateMemberPaymentMethodRequest
): Promise<MemberPaymentMethodsResponse> => {
  const res = await fetch(`${API_BASE_URL}/membership/members/me/payment-methods`, {
    method: "POST",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await json(res);
  const items = Array.isArray(data?.items) ? data.items : [];
  const defaultId =
    data?.defaultId ??
    (items.find((m: MemberPaymentMethod) => (m as any).isDefault)?.id ?? null);
  return { items, defaultId };
};

export const deleteMemberPaymentMethod = async (token: string, id: string): Promise<MemberPaymentMethodsResponse> => {
  const res = await fetch(`${API_BASE_URL}/membership/members/me/payment-methods/${id}`, {
    method: "DELETE",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  const data = await json(res);
  const items = Array.isArray(data?.items) ? data.items : [];
  const defaultId =
    data?.defaultId ??
    (items.find((m: MemberPaymentMethod) => (m as any).isDefault)?.id ?? null);
  return { items, defaultId };
};

// Admin Manual Member Creation (M-3)
export interface CreateMemberAdminPayload {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  address?: string;
  linkedinUrl?: string;
  otherSocials?: string;
  roles?: Role[];
}

export interface CreateMemberAdminResponse {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  address: string | null;
  linkedinUrl: string | null;
  otherSocials: string | null;
  status: string;
  roles?: Role[];
  created_at: number;
}

export const createMemberAdmin = async (
  token: string,
  payload: CreateMemberAdminPayload
): Promise<CreateMemberAdminResponse> => {
  const res = await fetch(`${API_BASE_URL}/membership/members/admin`, {
    method: "POST",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return json(res);
};

// =============================================================================
// Admin Role Management (M-13)
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

export const updateMemberRoles = async (
  token: string,
  memberId: string,
  roles: Role[]
): Promise<UpdateMemberRolesResponse> => {
  const res = await fetch(`${API_BASE_URL}/membership/members/${memberId}/roles`, {
    method: "PUT",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ roles }),
  });
  return json(res);
};

// Get member by ID (for admin to view/edit member details)
export interface MemberWithRoles {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  address?: string | null;
  linkedinUrl?: string | null;
  otherSocials?: string | null;
  status: string;
  roles?: Role[];
  membership_type_id?: string | null;
  created_at?: number | null;
}

export const getMemberById = async (token: string, memberId: string): Promise<MemberWithRoles> => {
  const res = await fetch(`${API_BASE_URL}/membership/members/${memberId}`, {
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  return json(res);
};

// =============================================================================
// Avatar Management (M-14, M-15)
// =============================================================================

export interface UpdateAvatarPayload {
  avatarUrl: string | null;
}

export interface MemberAvatarResponse {
  memberId: string;
  avatarUrl: string | null;
}

export const updateMyAvatar = async (
  token: string,
  payload: UpdateAvatarPayload
): Promise<MemberAvatarResponse> => {
  const res = await fetch(`${API_BASE_URL}/membership/members/me/avatar`, {
    method: "PATCH",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return json(res);
};

export const adminUpdateMemberAvatar = async (
  token: string,
  memberId: string,
  payload: UpdateAvatarPayload
): Promise<MemberAvatarResponse> => {
  const res = await fetch(`${API_BASE_URL}/membership/members/${memberId}/avatar`, {
    method: "PATCH",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return json(res);
};

// =============================================================================
// Custom Profile Fields (M-17, M-18, M-19, M-20)
// =============================================================================

/** Supported custom field types */
export type CustomFieldType = "text" | "textarea" | "number" | "date" | "select" | "checkbox";

export const CUSTOM_FIELD_TYPES: CustomFieldType[] = ["text", "textarea", "number", "date", "select", "checkbox"];

export const CUSTOM_FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: "Text",
  textarea: "Text Area",
  number: "Number",
  date: "Date",
  select: "Select (Dropdown)",
  checkbox: "Checkbox",
};

export interface CustomFieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
}

export interface CustomFieldCondition {
  fieldId: string;
  equals?: string | number | boolean | null;
}

export interface CustomFieldOption {
  value: string;
  label: string;
}

export interface CustomFieldDefinition {
  id: string;
  key: string;
  label: string;
  type: CustomFieldType;
  helpText?: string;
  groupId?: string;
  order?: number;
  options?: CustomFieldOption[];
  validation?: CustomFieldValidation;
  visibleWhen?: CustomFieldCondition[];
}

export interface CustomFieldGroup {
  id: string;
  label: string;
  description?: string;
  order?: number;
}

export interface ProfileCustomFieldSchema {
  groups: CustomFieldGroup[];
  fields: CustomFieldDefinition[];
  updatedAt: number;
}

export type ProfileCustomFieldValues = Record<string, string | number | boolean | null>;

export interface MemberCustomFieldsResponse {
  customFields: ProfileCustomFieldValues;
}

export interface MemberCustomFieldsWithSchema {
  schema: ProfileCustomFieldSchema;
  customFields: ProfileCustomFieldValues;
}

/** Get the profile custom field schema */
export const getProfileCustomFieldSchema = async (token: string): Promise<ProfileCustomFieldSchema> => {
  const res = await fetch(`${API_BASE_URL}/membership/custom-fields/profile-schema`, {
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  return json(res);
};

/** Save/update the profile custom field schema (admin only) */
export const saveProfileCustomFieldSchema = async (
  token: string,
  schema: { groups: CustomFieldGroup[]; fields: CustomFieldDefinition[] }
): Promise<ProfileCustomFieldSchema> => {
  const res = await fetch(`${API_BASE_URL}/membership/custom-fields/profile-schema`, {
    method: "PUT",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(schema),
  });
  return json(res);
};

/** Get current member's custom fields */
export const getMyCustomFields = async (token: string): Promise<MemberCustomFieldsResponse> => {
  const res = await fetch(`${API_BASE_URL}/membership/members/me/custom-fields`, {
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  return json(res);
};

/** Update current member's custom fields */
export const updateMyCustomFields = async (
  token: string,
  customFields: ProfileCustomFieldValues
): Promise<MemberCustomFieldsResponse> => {
  const res = await fetch(`${API_BASE_URL}/membership/members/me/custom-fields`, {
    method: "PATCH",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ customFields }),
  });
  return json(res);
};

/** Admin: get a member's custom fields with schema */
export const adminGetMemberCustomFields = async (
  token: string,
  memberId: string
): Promise<MemberCustomFieldsWithSchema> => {
  const res = await fetch(`${API_BASE_URL}/membership/members/${memberId}/custom-fields`, {
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
  });
  return json(res);
};

/** Admin: update a member's custom fields */
export const adminUpdateMemberCustomFields = async (
  token: string,
  memberId: string,
  customFields: ProfileCustomFieldValues
): Promise<MemberCustomFieldsWithSchema> => {
  const res = await fetch(`${API_BASE_URL}/membership/members/${memberId}/custom-fields`, {
    method: "PATCH",
    headers: { ...authHeaders(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ customFields }),
  });
  return json(res);
};

