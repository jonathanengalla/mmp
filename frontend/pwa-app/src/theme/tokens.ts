/**
 * OneLedger Design System Tokens
 * 
 * Modern, Stripe-level design tokens for white-label membership portals.
 * All values are theme-driven with no hardcoded colors.
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type Theme = {
  name: string;
  
  colors: {
    // Primary palette
    primary: string;
    primaryHover: string;
    primarySoft: string;
    secondary: string;
    secondaryHover: string;
    secondarySoft: string;
    accent: string;
    accentHover: string;
    accentSoft: string;

    // Semantic colors
    success: string;
    successSoft: string;
    warning: string;
    warningSoft: string;
    error: string;
    errorSoft: string;
    info: string;
    infoSoft: string;

    // Surface levels
    background: string;
    surface0: string;
    surface1: string;
    surface2: string;

    // Text colors
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    textOnPrimary: string;
    textOnDanger: string;

    // Border colors
    borderDefault: string;
    borderStrong: string;
    borderFocus: string;
  };

  typography: {
    fontFamily: string;
    fontFamilyMono: string;
    
    // Heading sizes
    heading1: string;
    heading2: string;
    heading3: string;
    heading4: string;

    // Body sizes
    bodyLg: string;
    bodyMd: string;
    bodySm: string;

    // Label & caption
    label: string;
    caption: string;

    // Line heights
    lineHeightTight: string;
    lineHeightNormal: string;
    lineHeightRelaxed: string;

    // Weights
    weightRegular: number;
    weightMedium: number;
    weightSemibold: number;
    weightBold: number;
  };

  spacing: {
    space1: string;
    space2: string;
    space3: string;
    space4: string;
    space5: string;
    space6: string;
    space7: string;
    space8: string;
    space9: string;
    space10: string;
  };

  radii: {
    none: string;
    small: string;
    medium: string;
    large: string;
    xl: string;
    full: string;
  };

  elevation: {
    level1: string;
    level2: string;
    level3: string;
  };

  motion: {
    fast: string;
    medium: string;
    slow: string;
    easing: string;
    easingOut: string;
  };

  layout: {
    maxContentWidth: string;
    sidebarWidth: string;
    headerHeight: string;
  };
};

// =============================================================================
// DEFAULT THEME (Neutral White-Label)
// =============================================================================

export const defaultTheme: Theme = {
  name: "default",

  colors: {
    // Primary palette - Professional blue
    primary: "#2563eb",
    primaryHover: "#1d4ed8",
    primarySoft: "#eff6ff",
    secondary: "#6366f1",
    secondaryHover: "#4f46e5",
    secondarySoft: "#eef2ff",
    accent: "#10b981",
    accentHover: "#059669",
    accentSoft: "#ecfdf5",

    // Semantic colors
    success: "#16a34a",
    successSoft: "#f0fdf4",
    warning: "#d97706",
    warningSoft: "#fffbeb",
    error: "#dc2626",
    errorSoft: "#fef2f2",
    info: "#0ea5e9",
    infoSoft: "#f0f9ff",

    // Surface levels
    background: "#f8fafc",
    surface0: "#ffffff",
    surface1: "#f1f5f9",
    surface2: "#e2e8f0",

    // Text colors
    textPrimary: "#0f172a",
    textSecondary: "#475569",
    textMuted: "#94a3b8",
    textOnPrimary: "#ffffff",
    textOnDanger: "#ffffff",

    // Border colors
    borderDefault: "#e2e8f0",
    borderStrong: "#cbd5e1",
    borderFocus: "#2563eb",
  },

  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontFamilyMono: "'SF Mono', 'Fira Code', 'Consolas', monospace",

    heading1: "2rem",
    heading2: "1.5rem",
    heading3: "1.25rem",
    heading4: "1.125rem",

    bodyLg: "1rem",
    bodyMd: "0.9375rem",
    bodySm: "0.875rem",

    label: "0.8125rem",
    caption: "0.75rem",

    lineHeightTight: "1.25",
    lineHeightNormal: "1.5",
    lineHeightRelaxed: "1.75",

    weightRegular: 400,
    weightMedium: 500,
    weightSemibold: 600,
    weightBold: 700,
  },

  spacing: {
    space1: "0.25rem",   // 4px
    space2: "0.5rem",    // 8px
    space3: "0.75rem",   // 12px
    space4: "1rem",      // 16px
    space5: "1.25rem",   // 20px
    space6: "1.5rem",    // 24px
    space7: "2rem",      // 32px
    space8: "2.5rem",    // 40px
    space9: "3rem",      // 48px
    space10: "4rem",     // 64px
  },

  radii: {
    none: "0",
    small: "0.375rem",
    medium: "0.5rem",
    large: "0.75rem",
    xl: "1rem",
    full: "9999px",
  },

  elevation: {
    level1: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    level2: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    level3: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  },

  motion: {
    fast: "100ms",
    medium: "200ms",
    slow: "300ms",
    easing: "cubic-bezier(0.4, 0, 0.2, 1)",
    easingOut: "cubic-bezier(0, 0, 0.2, 1)",
  },

  layout: {
    maxContentWidth: "1200px",
    sidebarWidth: "240px",
    headerHeight: "64px",
  },
};

// =============================================================================
// RCME THEME (Rotary Club of Manila Expats)
// =============================================================================

export const rcmeTheme: Theme = {
  name: "rcme",

  colors: {
    // Primary palette - RCME Blue
    primary: "#0f4c81",
    primaryHover: "#0a3a63",
    primarySoft: "#e8f4fd",
    secondary: "#2bb673",
    secondaryHover: "#229a5f",
    secondarySoft: "#e6f9f0",
    accent: "#f59e0b",
    accentHover: "#d97706",
    accentSoft: "#fef3c7",

    // Semantic colors
    success: "#16a34a",
    successSoft: "#f0fdf4",
    warning: "#f59e0b",
    warningSoft: "#fef3c7",
    error: "#dc2626",
    errorSoft: "#fef2f2",
    info: "#0ea5e9",
    infoSoft: "#f0f9ff",

    // Surface levels
    background: "#f7f9fc",
    surface0: "#ffffff",
    surface1: "#f1f5f9",
    surface2: "#e4e9ef",

    // Text colors
    textPrimary: "#111827",
    textSecondary: "#4b5563",
    textMuted: "#9ca3af",
    textOnPrimary: "#ffffff",
    textOnDanger: "#ffffff",

    // Border colors
    borderDefault: "#e5e7eb",
    borderStrong: "#d1d5db",
    borderFocus: "#0f4c81",
  },

  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontFamilyMono: "'SF Mono', 'Fira Code', 'Consolas', monospace",

    heading1: "2rem",
    heading2: "1.5rem",
    heading3: "1.25rem",
    heading4: "1.125rem",

    bodyLg: "1rem",
    bodyMd: "0.9375rem",
    bodySm: "0.875rem",

    label: "0.8125rem",
    caption: "0.75rem",

    lineHeightTight: "1.25",
    lineHeightNormal: "1.5",
    lineHeightRelaxed: "1.75",

    weightRegular: 400,
    weightMedium: 500,
    weightSemibold: 600,
    weightBold: 700,
  },

  spacing: {
    space1: "0.25rem",
    space2: "0.5rem",
    space3: "0.75rem",
    space4: "1rem",
    space5: "1.25rem",
    space6: "1.5rem",
    space7: "2rem",
    space8: "2.5rem",
    space9: "3rem",
    space10: "4rem",
  },

  radii: {
    none: "0",
    small: "0.375rem",
    medium: "0.625rem",
    large: "0.75rem",
    xl: "1rem",
    full: "9999px",
  },

  elevation: {
    level1: "0 1px 3px 0 rgb(0 0 0 / 0.06)",
    level2: "0 4px 12px -2px rgb(0 0 0 / 0.08)",
    level3: "0 12px 24px -4px rgb(0 0 0 / 0.12)",
  },

  motion: {
    fast: "100ms",
    medium: "200ms",
    slow: "300ms",
    easing: "cubic-bezier(0.4, 0, 0.2, 1)",
    easingOut: "cubic-bezier(0, 0, 0.2, 1)",
  },

  layout: {
    maxContentWidth: "1200px",
    sidebarWidth: "240px",
    headerHeight: "64px",
  },
};

// =============================================================================
// CSS VARIABLE MAPPING HELPER
// =============================================================================

export const themeToCssVars = (theme: Theme): Record<string, string> => ({
  // Colors - Primary
  "--color-primary": theme.colors.primary,
  "--color-primary-hover": theme.colors.primaryHover,
  "--color-primary-soft": theme.colors.primarySoft,
  "--color-secondary": theme.colors.secondary,
  "--color-secondary-hover": theme.colors.secondaryHover,
  "--color-secondary-soft": theme.colors.secondarySoft,
  "--color-accent": theme.colors.accent,
  "--color-accent-hover": theme.colors.accentHover,
  "--color-accent-soft": theme.colors.accentSoft,

  // Colors - Semantic
  "--color-success": theme.colors.success,
  "--color-success-soft": theme.colors.successSoft,
  "--color-warning": theme.colors.warning,
  "--color-warning-soft": theme.colors.warningSoft,
  "--color-error": theme.colors.error,
  "--color-error-soft": theme.colors.errorSoft,
  "--color-info": theme.colors.info,
  "--color-info-soft": theme.colors.infoSoft,

  // Colors - Surfaces
  "--color-bg": theme.colors.background,
  "--color-surface": theme.colors.surface0,
  "--color-surface-0": theme.colors.surface0,
  "--color-surface-1": theme.colors.surface1,
  "--color-surface-2": theme.colors.surface2,

  // Colors - Text
  "--color-text-primary": theme.colors.textPrimary,
  "--color-text-secondary": theme.colors.textSecondary,
  "--color-text-muted": theme.colors.textMuted,
  "--color-text-on-primary": theme.colors.textOnPrimary,
  "--color-text-on-danger": theme.colors.textOnDanger,
  // Legacy aliases
  "--color-text": theme.colors.textPrimary,
  "--color-text-muted-legacy": theme.colors.textMuted,

  // Colors - Borders
  "--color-border": theme.colors.borderDefault,
  "--color-border-strong": theme.colors.borderStrong,
  "--color-border-focus": theme.colors.borderFocus,

  // Legacy color aliases for backward compatibility
  "--color-danger": theme.colors.error,
  "--color-background": theme.colors.background,
  "--color-surface-muted": theme.colors.surface1,

  // Typography
  "--font-family": theme.typography.fontFamily,
  "--font-family-mono": theme.typography.fontFamilyMono,
  "--font-h1": theme.typography.heading1,
  "--font-h2": theme.typography.heading2,
  "--font-h3": theme.typography.heading3,
  "--font-h4": theme.typography.heading4,
  "--font-body-lg": theme.typography.bodyLg,
  "--font-body-md": theme.typography.bodyMd,
  "--font-body-sm": theme.typography.bodySm,
  "--font-label": theme.typography.label,
  "--font-caption": theme.typography.caption,
  "--font-label-sm": theme.typography.caption,
  "--font-label-md": theme.typography.label,
  "--line-height-tight": theme.typography.lineHeightTight,
  "--line-height-normal": theme.typography.lineHeightNormal,
  "--line-height-relaxed": theme.typography.lineHeightRelaxed,
  "--font-weight-regular": theme.typography.weightRegular.toString(),
  "--font-weight-medium": theme.typography.weightMedium.toString(),
  "--font-weight-semibold": theme.typography.weightSemibold.toString(),
  "--font-weight-bold": theme.typography.weightBold.toString(),
  // Legacy weight aliases
  "--font-regular": theme.typography.weightRegular.toString(),
  "--font-medium": theme.typography.weightMedium.toString(),
  "--font-bold": theme.typography.weightBold.toString(),

  // Spacing
  "--space-1": theme.spacing.space1,
  "--space-2": theme.spacing.space2,
  "--space-3": theme.spacing.space3,
  "--space-4": theme.spacing.space4,
  "--space-5": theme.spacing.space5,
  "--space-6": theme.spacing.space6,
  "--space-7": theme.spacing.space7,
  "--space-8": theme.spacing.space8,
  "--space-9": theme.spacing.space9,
  "--space-10": theme.spacing.space10,
  // Legacy spacing aliases
  "--space-xs": theme.spacing.space1,
  "--space-sm": theme.spacing.space2,
  "--space-md": theme.spacing.space3,
  "--space-lg": theme.spacing.space4,
  "--space-xl": theme.spacing.space6,

  // Radii
  "--radius-none": theme.radii.none,
  "--radius-sm": theme.radii.small,
  "--radius-md": theme.radii.medium,
  "--radius-lg": theme.radii.large,
  "--radius-xl": theme.radii.xl,
  "--radius-full": theme.radii.full,
  // Legacy alias
  "--radius": theme.radii.medium,
  "--radius-pill": theme.radii.full,

  // Elevation
  "--elevation-1": theme.elevation.level1,
  "--elevation-2": theme.elevation.level2,
  "--elevation-3": theme.elevation.level3,
  // Legacy aliases
  "--shadow-sm": theme.elevation.level1,
  "--shadow-md": theme.elevation.level2,
  "--card-shadow": theme.elevation.level2,

  // Motion
  "--motion-fast": theme.motion.fast,
  "--motion-medium": theme.motion.medium,
  "--motion-slow": theme.motion.slow,
  "--motion-easing": theme.motion.easing,
  "--motion-easing-out": theme.motion.easingOut,

  // Layout
  "--max-width": theme.layout.maxContentWidth,
  "--sidebar-width": theme.layout.sidebarWidth,
  "--header-height": theme.layout.headerHeight,
});
