import React, { useEffect, useMemo, useState } from "react";
import { Button } from "./Button";
import { getActiveTenant, setActiveTenant, TenantId } from "../theme/tenantTheme";
import { getCurrentTheme, setTheme, ThemeMode } from "../theme/themeToggle";

const TENANTS: TenantId[] = ["rcme", "royalpalm", "bellagio"];
const THEMES: ThemeMode[] = ["light", "dark"];

/**
 * Lightweight inline control to switch tenant + theme.
 * Frontend-only; delegates persistence to tenantTheme/themeToggle helpers.
 */
export const TenantThemeSwitcher: React.FC = () => {
  const [tenant, setTenant] = useState<TenantId>(() => getActiveTenant());
  const [theme, setThemeState] = useState<ThemeMode>(() => getCurrentTheme());

  useEffect(() => {
    // Ensure DOM attributes match on mount
    setActiveTenant(tenant);
    setTheme(theme);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTenantChange = (next: TenantId) => {
    setTenant(next);
    setActiveTenant(next);
  };

  const handleThemeChange = (next: ThemeMode) => {
    setThemeState(next);
    setTheme(next);
  };

  const themeButtons = useMemo(
    () =>
      THEMES.map((mode) => (
        <Button
          key={mode}
          variant={mode === theme ? "primary" : "ghost"}
          size="sm"
          onClick={() => handleThemeChange(mode)}
        >
          {mode === "light" ? "Light" : "Dark"}
        </Button>
      )),
    [theme]
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "var(--space-2)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-border)",
        background: "var(--color-surface-1)",
      }}
    >
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          fontSize: "var(--font-body-sm)",
          color: "var(--color-text-secondary)",
        }}
      >
        Tenant
        <select
          value={tenant}
          onChange={(e) => handleTenantChange(e.target.value as TenantId)}
          style={{
            background: "var(--color-surface)",
            color: "var(--color-text-primary)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            padding: "6px 10px",
            fontSize: "var(--font-body-sm)",
          }}
        >
          {TENANTS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          marginLeft: "var(--space-2)",
        }}
      >
        <span
          style={{
            fontSize: "var(--font-body-sm)",
            color: "var(--color-text-secondary)",
          }}
        >
          Theme
        </span>
        <div style={{ display: "flex", gap: "var(--space-1)" }}>{themeButtons}</div>
      </div>
    </div>
  );
};

