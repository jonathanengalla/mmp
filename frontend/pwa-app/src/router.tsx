import React from "react";
// Fixed admin event routing: /admin/events/new now renders AdminNewEventPage and is role-guarded for admin/event_manager.
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import { RegisterPage } from "./pages/RegisterPage";
import { VerifyPage } from "./pages/VerifyPage";
import { LoginPage } from "./pages/LoginPage";
import { ProfilePage } from "./pages/ProfilePage";
import { DirectoryPage } from "./pages/DirectoryPage";
import { PaymentMethodsPage } from "./pages/PaymentMethodsPage";

import { UpcomingEventsPage } from "./pages/UpcomingEventsPage";
import { AdminNewEventPage } from "./pages/AdminNewEventPage";
import EventsPage from "./pages/EventsPage";
import EventDetailPage from "./pages/EventDetailPage";
import InvoicesPage from "./pages/InvoicesPage";
import AdminInvoicesPage from "./pages/AdminInvoicesPage";
import AdminInvoiceDetailPage from "./pages/AdminInvoiceDetailPage";
import MemberInvoiceDetailPage from "./pages/MemberInvoiceDetailPage";
import EventCheckoutPage from "./pages/EventCheckoutPage";

import { AdminBroadcastsPage } from "./pages/AdminBroadcastsPage";
import { AdminBroadcastEditPage } from "./pages/AdminBroadcastEditPage";

import { AdminMemberReportPage } from "./pages/AdminMemberReportPage";
import { AdminDuesSummaryPage } from "./pages/AdminDuesSummaryPage";
import { AdminEventAttendanceReportPage } from "./pages/AdminEventAttendanceReportPage";

import { AdminOrgProfilePage } from "./pages/AdminOrgProfilePage";
import { AdminMembershipTypesPage } from "./pages/AdminMembershipTypesPage";
import { AdminApprovalWorkflowPage } from "./pages/AdminApprovalWorkflowPage";
import { AdminPaymentCategoriesPage } from "./pages/AdminPaymentCategoriesPage";
import { AdminInvoiceTemplatePage } from "./pages/AdminInvoiceTemplatePage";
import { AdminFeatureFlagsPage } from "./pages/AdminFeatureFlagsPage";
import { AdminPendingMembersPage } from "./pages/AdminPendingMembersPage";
import { AdminCreateMemberPage } from "./pages/AdminCreateMemberPage";
import { AdminProfileCustomFieldsPage } from "./pages/AdminProfileCustomFieldsPage";
import AdminEventsDashboardPage from "./pages/AdminEventsDashboardPage";
import AdminEventCheckInPage from "./pages/AdminEventCheckInPage";
import AdminEditEventPage from "./pages/AdminEditEventPage";
import AdminEmailLogPage from "./pages/AdminEmailLogPage";
import AdminFinanceDashboardPage from "./pages/AdminFinanceDashboardPage";

import { ThemeProvider } from "./theme/ThemeProvider";
import { useSession } from "./hooks/useSession";
import { AppLayout } from "./components/AppLayout";

// -------------------------------
// Protected Route Wrapper
// -------------------------------
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authed } = useSession();
  const location = useLocation();

  if (!authed) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  return <AppLayout>{children}</AppLayout>;
};

// -------------------------------
// Admin Route Wrapper (requires admin role)
// -------------------------------
const AdminRoute: React.FC<{ children: React.ReactNode; roles?: string[] }> = ({ children, roles }) => {
  const { authed, user } = useSession();
  const location = useLocation();

  if (!authed) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  // Check if user has admin role
  const userRoles = (user as { roles?: string[] })?.roles || [];
  const allowed = roles && roles.length > 0 ? roles : ["admin"];
  const hasRole = userRoles.includes("super_admin") || allowed.some((r) => userRoles.includes(r));
  if (!hasRole) {
    return <Navigate to="/profile" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
};

// -------------------------------
// Main App Router
// -------------------------------
export const AppRouter: React.FC = () => (
  <ThemeProvider>
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify" element={<VerifyPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Member Profile */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        {/* Member Directory (M-12) */}
        <Route
          path="/directory"
          element={
            <ProtectedRoute>
              <DirectoryPage />
            </ProtectedRoute>
          }
        />

        {/* Payment Methods (P-1) */}
        <Route
          path="/billing/payment-methods"
          element={
            <ProtectedRoute>
              <PaymentMethodsPage />
            </ProtectedRoute>
          }
        />

        {/* Admin: Pending Members */}
        <Route
          path="/admin/pending-members"
          element={
            <AdminRoute>
              <AdminPendingMembersPage />
            </AdminRoute>
          }
        />

        {/* Admin: Create Member Manually (M-3) */}
        <Route
          path="/admin/members/new"
          element={
            <AdminRoute>
              <AdminCreateMemberPage />
            </AdminRoute>
          }
        />

        {/* Events */}
        <Route
          path="/events"
          element={
            <ProtectedRoute>
              <EventsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/events/upcoming"
          element={
            <ProtectedRoute>
              <EventsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/events/:slugOrId/checkout"
          element={
            <ProtectedRoute>
              <EventCheckoutPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/events/:slugOrId"
          element={
            <ProtectedRoute>
              <EventDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/events/new"
          element={
            <AdminRoute roles={["admin", "event_manager"]}>
              <AdminNewEventPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/events"
          element={
            <AdminRoute roles={["admin", "event_manager"]}>
              <AdminEventsDashboardPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/events/:id/edit"
          element={
            <AdminRoute roles={["admin", "event_manager"]}>
              <AdminEditEventPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/events/:eventId/attendance"
          element={
            <AdminRoute roles={["admin", "event_manager"]}>
              <AdminEventAttendanceReportPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/events/checkin"
          element={
            <AdminRoute roles={["admin", "event_manager"]}>
              <AdminEventCheckInPage />
            </AdminRoute>
          }
        />

        <Route
          path="/invoices"
          element={
            <ProtectedRoute>
              <InvoicesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/invoices/:id"
          element={
            <ProtectedRoute>
              <MemberInvoiceDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/invoices"
          element={
            <AdminRoute roles={["admin", "finance_manager", "officer"]}>
              <AdminInvoicesPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/invoices/:id"
          element={
            <AdminRoute roles={["admin", "finance_manager", "officer"]}>
              <AdminInvoiceDetailPage />
            </AdminRoute>
          }
        />

        {/* Communications */}
        <Route
          path="/admin/broadcasts"
          element={
            <AdminRoute roles={["admin"]}>
              <AdminBroadcastsPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/broadcasts/:id/edit"
          element={
            <AdminRoute roles={["admin"]}>
              <AdminBroadcastEditPage />
            </AdminRoute>
          }
        />

        {/* Reporting */}
        <Route
          path="/admin/reports/members"
          element={
            <AdminRoute roles={["admin"]}>
              <AdminMemberReportPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/reports/dues-summary"
          element={
            <AdminRoute roles={["admin"]}>
              <AdminDuesSummaryPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/reports/events/attendance"
          element={
            <AdminRoute roles={["admin", "event_manager"]}>
              <AdminEventAttendanceReportPage />
            </AdminRoute>
          }
        />

        {/* Config Center */}
        <Route
          path="/admin/settings/org-profile"
          element={
            <AdminRoute roles={["admin"]}>
              <AdminOrgProfilePage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/settings/membership-types"
          element={
            <AdminRoute roles={["admin"]}>
              <AdminMembershipTypesPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/settings/approval-workflow"
          element={
            <AdminRoute roles={["admin"]}>
              <AdminApprovalWorkflowPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/settings/payment-categories"
          element={
            <AdminRoute roles={["admin"]}>
              <AdminPaymentCategoriesPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/settings/invoice-template"
          element={
            <AdminRoute roles={["admin"]}>
              <AdminInvoiceTemplatePage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/settings/feature-flags"
          element={
            <AdminRoute roles={["admin"]}>
              <AdminFeatureFlagsPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/finance"
          element={
            <AdminRoute roles={["admin"]}>
              <AdminFinanceDashboardPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/dev/email-log"
          element={
            <AdminRoute roles={["admin"]}>
              <AdminEmailLogPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/settings/profile-custom-fields"
          element={
            <AdminRoute>
              <AdminProfileCustomFieldsPage />
            </AdminRoute>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  </ThemeProvider>
);

