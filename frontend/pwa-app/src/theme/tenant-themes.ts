/**
 * Tenant Theme Configuration
 * 
 * White-label theme system supporting multiple organization types.
 * Each tenant can have a fully customized theme.
 */

import { Theme, defaultTheme, rcmeTheme } from "./tokens";

// =============================================================================
// HOA THEME (Homeowners Association)
// =============================================================================

export const hoaTheme: Theme = {
  name: "hoa",

  colors: {
    primary: "#0d9488",
    primaryHover: "#0f766e",
    primarySoft: "#f0fdfa",
    secondary: "#7c3aed",
    secondaryHover: "#6d28d9",
    secondarySoft: "#f5f3ff",
    accent: "#f97316",
    accentHover: "#ea580c",
    accentSoft: "#fff7ed",

    success: "#22c55e",
    successSoft: "#f0fdf4",
    warning: "#eab308",
    warningSoft: "#fefce8",
    error: "#ef4444",
    errorSoft: "#fef2f2",
    info: "#3b82f6",
    infoSoft: "#eff6ff",

    background: "#fafafa",
    surface0: "#ffffff",
    surface1: "#f4f4f5",
    surface2: "#e4e4e7",

    textPrimary: "#18181b",
    textSecondary: "#52525b",
    textMuted: "#a1a1aa",
    textOnPrimary: "#ffffff",
    textOnDanger: "#ffffff",

    borderDefault: "#e4e4e7",
    borderStrong: "#d4d4d8",
    borderFocus: "#0d9488",
  },

  typography: { ...defaultTheme.typography },
  spacing: { ...defaultTheme.spacing },
  radii: { ...defaultTheme.radii },
  elevation: { ...defaultTheme.elevation },
  motion: { ...defaultTheme.motion },
  layout: { ...defaultTheme.layout },
};

// =============================================================================
// SCHOOL THEME (Educational Institution)
// =============================================================================

export const schoolTheme: Theme = {
  name: "school",

  colors: {
    primary: "#7c3aed",
    primaryHover: "#6d28d9",
    primarySoft: "#f5f3ff",
    secondary: "#ec4899",
    secondaryHover: "#db2777",
    secondarySoft: "#fdf2f8",
    accent: "#06b6d4",
    accentHover: "#0891b2",
    accentSoft: "#ecfeff",

    success: "#10b981",
    successSoft: "#ecfdf5",
    warning: "#f59e0b",
    warningSoft: "#fffbeb",
    error: "#f43f5e",
    errorSoft: "#fff1f2",
    info: "#6366f1",
    infoSoft: "#eef2ff",

    background: "#faf5ff",
    surface0: "#ffffff",
    surface1: "#f3e8ff",
    surface2: "#e9d5ff",

    textPrimary: "#1e1b4b",
    textSecondary: "#4c1d95",
    textMuted: "#a78bfa",
    textOnPrimary: "#ffffff",
    textOnDanger: "#ffffff",

    borderDefault: "#e9d5ff",
    borderStrong: "#c4b5fd",
    borderFocus: "#7c3aed",
  },

  typography: {
    ...defaultTheme.typography,
    fontFamily: "'Nunito', 'Inter', -apple-system, sans-serif",
  },
  spacing: { ...defaultTheme.spacing },
  radii: {
    ...defaultTheme.radii,
    medium: "0.75rem",
    large: "1rem",
  },
  elevation: { ...defaultTheme.elevation },
  motion: { ...defaultTheme.motion },
  layout: { ...defaultTheme.layout },
};

// =============================================================================
// CLINIC THEME (Healthcare / Medical)
// =============================================================================

export const clinicTheme: Theme = {
  name: "clinic",

  colors: {
    primary: "#0891b2",
    primaryHover: "#0e7490",
    primarySoft: "#ecfeff",
    secondary: "#14b8a6",
    secondaryHover: "#0d9488",
    secondarySoft: "#f0fdfa",
    accent: "#f43f5e",
    accentHover: "#e11d48",
    accentSoft: "#fff1f2",

    success: "#22c55e",
    successSoft: "#f0fdf4",
    warning: "#f59e0b",
    warningSoft: "#fffbeb",
    error: "#dc2626",
    errorSoft: "#fef2f2",
    info: "#0ea5e9",
    infoSoft: "#f0f9ff",

    background: "#f0fdfa",
    surface0: "#ffffff",
    surface1: "#e0f2fe",
    surface2: "#bae6fd",

    textPrimary: "#0c4a6e",
    textSecondary: "#0369a1",
    textMuted: "#7dd3fc",
    textOnPrimary: "#ffffff",
    textOnDanger: "#ffffff",

    borderDefault: "#bae6fd",
    borderStrong: "#7dd3fc",
    borderFocus: "#0891b2",
  },

  typography: {
    ...defaultTheme.typography,
    fontFamily: "'IBM Plex Sans', 'Inter', -apple-system, sans-serif",
  },
  spacing: { ...defaultTheme.spacing },
  radii: {
    ...defaultTheme.radii,
    small: "0.25rem",
    medium: "0.375rem",
  },
  elevation: { ...defaultTheme.elevation },
  motion: { ...defaultTheme.motion },
  layout: { ...defaultTheme.layout },
};

// =============================================================================
// THEME REGISTRY
// =============================================================================

export const themeRegistry: Record<string, Theme> = {
  default: defaultTheme,
  rcme: rcmeTheme,
  hoa: hoaTheme,
  school: schoolTheme,
  clinic: clinicTheme,
};

/**
 * Get theme by tenant ID or name.
 * Falls back to default theme if not found.
 */
export const getThemeForTenant = (tenantId?: string | null): Theme => {
  if (!tenantId) return defaultTheme;
  
  // Map tenant IDs to themes
  const tenantThemeMap: Record<string, string> = {
    t1: "rcme",
    rcme: "rcme",
    hoa: "hoa",
    school: "school",
    clinic: "clinic",
  };

  const themeName = tenantThemeMap[tenantId.toLowerCase()] || "default";
  return themeRegistry[themeName] || defaultTheme;
};

// Re-export themes
export { defaultTheme, rcmeTheme };

