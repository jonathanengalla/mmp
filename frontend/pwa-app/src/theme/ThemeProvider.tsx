/**
 * Theme Provider
 * 
 * Applies theme tokens as CSS custom properties throughout the app.
 * Supports tenant-based theme injection for white-label deployments.
 */

import React, { useMemo, createContext, useContext } from "react";
import { Theme, themeToCssVars, rcmeTheme } from "./tokens";
import { getThemeForTenant } from "./tenant-themes";
import "./base.css";

// =============================================================================
// THEME CONTEXT
// =============================================================================

type ThemeContextValue = {
  theme: Theme;
  themeName: string;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: rcmeTheme,
  themeName: "rcme",
});

export const useTheme = () => useContext(ThemeContext);

// =============================================================================
// THEME PROVIDER COMPONENT
// =============================================================================

type Props = {
  /** Override theme directly */
  theme?: Theme;
  /** Tenant ID to auto-select theme */
  tenantId?: string | null;
  children: React.ReactNode;
};

export const ThemeProvider: React.FC<Props> = ({ 
  theme: themeProp, 
  tenantId, 
  children 
}) => {
  // Resolve theme: prop > tenant > default (rcme)
  const resolvedTheme = useMemo(() => {
    if (themeProp) return themeProp;
    if (tenantId) return getThemeForTenant(tenantId);
    return rcmeTheme;
  }, [themeProp, tenantId]);

  // Convert theme tokens to CSS custom properties
  const styleVars = useMemo(() => {
    return themeToCssVars(resolvedTheme) as React.CSSProperties;
  }, [resolvedTheme]);

  const contextValue = useMemo(() => ({
    theme: resolvedTheme,
    themeName: resolvedTheme.name,
  }), [resolvedTheme]);

  return (
    <ThemeContext.Provider value={contextValue}>
      <div className="ol-theme-root" style={styleVars}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
};
