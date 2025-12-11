/**
 * Branding Configuration
 * 
 * Centralized branding and navigation configuration.
 * Theme colors are now managed via tokens.ts and ThemeProvider.
 */

export type NavItem = { 
  label: string; 
  path: string;
  icon?: string;
  roles?: string[];
};

export interface BrandingConfig {
  appName: string;
  logoUrl: string | null;
  tagline: string;
  navigation: {
    topNav: NavItem[];
    sideNav: NavItem[];
  };
}

export const branding: BrandingConfig = {
  appName: "RCME Member Portal",
  logoUrl: null,
  tagline: "Events · Members · Dues",
  navigation: {
    topNav: [
      { label: "Profile", path: "/profile" },
      { label: "Directory", path: "/directory" },
  { label: "Events", path: "/events" },
      { label: "Invoices", path: "/invoices" },
      { label: "Payment Methods", path: "/billing/payment-methods" },
    ],
    sideNav: [
      { label: "Profile", path: "/profile" },
      { label: "Directory", path: "/directory" },
  { label: "Events", path: "/events" },
      { label: "Invoices", path: "/invoices" },
      { label: "Payment Methods", path: "/billing/payment-methods" },
    ],
  },
};

// Admin navigation items (shown only for admin users)
export const adminNavItems: NavItem[] = [
  { label: "Events Dashboard", path: "/admin/events", roles: ["admin", "event_manager"] },
  { label: "Create Event", path: "/admin/events/new", roles: ["admin", "event_manager"] },
  { label: "Event Attendance", path: "/admin/reports/events/attendance", roles: ["admin", "event_manager"] },
  { label: "Event Check-in", path: "/admin/events/checkin", roles: ["admin", "event_manager"] },
  { label: "Pending Members", path: "/admin/pending-members" },
  { label: "New Member", path: "/admin/members/new" },
  { label: "Member Roster", path: "/admin/reports/members" },
  { label: "Finance Dashboard", path: "/admin/finance", roles: ["admin", "finance_manager"] },
  { label: "Email Log", path: "/admin/dev/email-log", roles: ["admin", "finance_manager"] },
];

// Config Center navigation items (admin only)
export const configNavItems: NavItem[] = [
  { label: "Organization Profile", path: "/admin/settings/org-profile" },
  { label: "Membership Types", path: "/admin/settings/membership-types" },
  { label: "Profile Custom Fields", path: "/admin/settings/profile-custom-fields" },
  { label: "Approval Workflow", path: "/admin/settings/approval-workflow" },
  { label: "Payment Categories", path: "/admin/settings/payment-categories" },
  { label: "Invoice Template", path: "/admin/settings/invoice-template" },
  { label: "Feature Flags", path: "/admin/settings/feature-flags" },
];

export const useBranding = () => branding;
