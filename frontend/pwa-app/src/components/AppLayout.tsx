import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../hooks/useSession";
import { useBranding, adminNavItems, NavItem } from "../config/branding";

interface AppLayoutProps {
  children: React.ReactNode;
}

/**
 * Modern responsive layout with sidebar navigation.
 * Uses theme tokens for all styling.
 */
export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { authed, user, logout } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const branding = useBranding();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    try {
      if (logout) {
        logout();
      }
    } finally {
      navigate("/login");
    }
  };

  if (!authed) {
    return <>{children}</>;
  }

  const isActive = (path: string) => {
    if (path === "/profile" && location.pathname === "/profile") return true;
    if (path !== "/profile" && location.pathname.startsWith(path)) return true;
    return false;
  };

  const nav = branding.navigation;
  const isAdmin = user?.roles?.includes("admin") ?? false;

  // Get user initials for avatar
  const getInitials = () => {
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return "U";
  };

  const NavLink: React.FC<{ item: NavItem }> = ({ item }) => (
    <Link
      to={item.path}
      onClick={() => setSidebarOpen(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-2) var(--space-3)",
        borderRadius: "var(--radius-md)",
        textDecoration: "none",
        fontSize: "var(--font-body-sm)",
        fontWeight: isActive(item.path) ? "var(--font-weight-semibold)" : "var(--font-weight-medium)",
        color: isActive(item.path) ? "var(--color-primary)" : "var(--color-text-secondary)",
        background: isActive(item.path) ? "var(--color-primary-soft)" : "transparent",
        transition: "all var(--motion-fast) var(--motion-easing)",
      }}
      onMouseEnter={(e) => {
        if (!isActive(item.path)) {
          e.currentTarget.style.background = "var(--color-surface-1)";
          e.currentTarget.style.color = "var(--color-text-primary)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive(item.path)) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--color-text-secondary)";
        }
      }}
    >
      {item.label}
    </Link>
  );

  return (
    <div style={{ 
      minHeight: "100vh", 
      background: "var(--color-bg)",
      display: "flex",
    }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            backdropFilter: "blur(4px)",
            zIndex: 98,
            display: "none",
          }}
          className="mobile-overlay"
        />
      )}

      {/* Sidebar */}
      <aside
        style={{
          width: "var(--sidebar-width)",
          background: "var(--color-surface)",
          borderRight: "1px solid var(--color-border)",
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          transform: sidebarOpen ? "translateX(0)" : undefined,
          transition: "transform var(--motion-medium) var(--motion-easing)",
        }}
        className="sidebar"
      >
        {/* Logo / Brand */}
        <div style={{
          padding: "var(--space-5) var(--space-4)",
          borderBottom: "1px solid var(--color-border)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: "var(--radius-md)",
              background: "var(--color-primary)",
              color: "var(--color-text-on-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "var(--font-weight-bold)",
              fontSize: "var(--font-body-sm)",
            }}>
              {branding.appName.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontWeight: "var(--font-weight-semibold)",
                fontSize: "var(--font-body-md)",
                color: "var(--color-text-primary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>
                {branding.appName}
              </div>
              <div style={{
                fontSize: "var(--font-caption)",
                color: "var(--color-text-muted)",
              }}>
                Member Portal
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{
          flex: 1,
          padding: "var(--space-4)",
          overflowY: "auto",
        }}>
          {/* Main nav items */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            {nav.sideNav.map((item) => (
              <NavLink key={item.path} item={item} />
            ))}
          </div>

          {/* Admin section */}
          {isAdmin && adminNavItems.length > 0 && (
            <div style={{ marginTop: "var(--space-6)" }}>
              <div style={{
                padding: "var(--space-2) var(--space-3)",
                fontSize: "var(--font-caption)",
                fontWeight: "var(--font-weight-semibold)",
                color: "var(--color-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}>
                Admin
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", marginTop: "var(--space-1)" }}>
                {adminNavItems.map((item) => (
                  <NavLink key={item.path} item={item} />
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* User section at bottom */}
        <div style={{
          padding: "var(--space-4)",
          borderTop: "1px solid var(--color-border)",
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            padding: "var(--space-2)",
            borderRadius: "var(--radius-md)",
            background: "var(--color-surface-1)",
          }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: "var(--radius-full)",
              background: "var(--color-primary-soft)",
              color: "var(--color-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "var(--font-weight-semibold)",
              fontSize: "var(--font-caption)",
            }}>
              {getInitials()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: "var(--font-body-sm)",
                fontWeight: "var(--font-weight-medium)",
                color: "var(--color-text-primary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>
                {user?.email ?? "User"}
              </div>
              <button
                onClick={handleLogout}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontSize: "var(--font-caption)",
                  color: "var(--color-text-muted)",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div style={{
        flex: 1,
        marginLeft: "var(--sidebar-width)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
      className="main-container"
      >
        {/* Header */}
        <header style={{
          height: "var(--header-height)",
          background: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 var(--space-6)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}>
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="mobile-menu-btn"
            style={{
              display: "none",
              background: "none",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-2)",
              cursor: "pointer",
              color: "var(--color-text-primary)",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>

          {/* Breadcrumb / Page context */}
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "var(--space-2)",
            color: "var(--color-text-secondary)",
            fontSize: "var(--font-body-sm)",
          }}>
            <span style={{ color: "var(--color-text-muted)" }}>
              {branding.appName}
            </span>
            <span style={{ color: "var(--color-text-muted)" }}>/</span>
            <span style={{ 
              color: "var(--color-text-primary)", 
              fontWeight: "var(--font-weight-medium)" 
            }}>
              {getCurrentPageTitle(location.pathname, nav.sideNav, adminNavItems)}
            </span>
          </div>

          {/* Right side actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            {/* Quick actions could go here */}
          </div>
        </header>

        {/* Page content */}
        <main style={{
          flex: 1,
          padding: "var(--space-6)",
          maxWidth: "var(--max-width)",
          width: "100%",
          margin: "0 auto",
        }}>
          {children}
        </main>
      </div>

      {/* Responsive styles injected */}
      <style>{`
        @media (max-width: 1024px) {
          .sidebar {
            transform: translateX(-100%);
          }
          .sidebar.open {
            transform: translateX(0);
          }
          .main-container {
            margin-left: 0 !important;
          }
          .mobile-menu-btn {
            display: flex !important;
          }
          .mobile-overlay {
            display: block !important;
          }
        }
        @media (max-width: 640px) {
          .main-container main {
            padding: var(--space-4) !important;
          }
        }
      `}</style>
    </div>
  );
};

// Helper to get current page title from nav items
function getCurrentPageTitle(pathname: string, sideNav: NavItem[], adminNav: NavItem[]): string {
  const allItems = [...sideNav, ...adminNav];
  
  // Find exact match first
  const exactMatch = allItems.find((item) => item.path === pathname);
  if (exactMatch) return exactMatch.label;
  
  // Find prefix match
  const prefixMatch = allItems.find((item) => 
    item.path !== "/" && pathname.startsWith(item.path)
  );
  if (prefixMatch) return prefixMatch.label;
  
  // Default
  return "Dashboard";
}
