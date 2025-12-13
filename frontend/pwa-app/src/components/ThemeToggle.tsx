import React from "react";
import { useTheme, ThemeMode } from "../theme/themeToggle";

/**
 * Theme Toggle Component
 * Allows users to switch between light and dark themes
 */
export const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    const newTheme: ThemeMode = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
  };

  return (
    <button
      onClick={toggleTheme}
      title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
      style={{
        background: "var(--app-color-surface-1)",
        border: "1px solid var(--app-color-border-subtle)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-2)",
        cursor: "pointer",
        color: "var(--app-color-text-primary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "36px",
        height: "36px",
        transition: "all var(--motion-fast) var(--motion-easing)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--app-color-surface-2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--app-color-surface-1)";
      }}
    >
      {theme === "light" ? (
        // Moon icon for dark mode (when currently light)
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        // Sun icon for light mode (when currently dark)
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      )}
    </button>
  );
};

