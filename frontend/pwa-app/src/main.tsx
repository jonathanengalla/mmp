import React from "react";
import ReactDOM from "react-dom/client";
import { AppRouter } from "./router";
import { ThemeProvider } from "./theme/ThemeProvider";
import { SessionProvider } from "./session";
import "./theme/rcme-theme.css";
import "./theme/app-theme-aliases.css";
import "./theme/tenant-rcme.css";
import "./theme/tenant-royalpalm.css";
import "./theme/tenant-bellagio.css";
import { getCurrentTheme, setTheme as applyTheme } from "./theme/themeToggle";
import { getActiveTenant, setActiveTenant } from "./theme/tenantTheme";

console.log("MAIN.TSX MINIMAL ENTRY LOADED");

// Ensure data-tenant and data-theme are set on the root element before mounting
try {
  const tenant = getActiveTenant();
  setActiveTenant(tenant);
  applyTheme(getCurrentTheme());
} catch (err) {
  console.warn("Failed to initialize theme attributes", err);
}

const rootEl = document.getElementById("root");

if (!rootEl) {
  console.error("Root element NOT FOUND in index.html");
} else {
  console.log("Root element FOUND, mounting AppRouter...");

  try {
    ReactDOM.createRoot(rootEl).render(
      <React.StrictMode>
        <SessionProvider>
          <ThemeProvider>
            <AppRouter />
          </ThemeProvider>
        </SessionProvider>
      </React.StrictMode>
    );
    console.log("App mounted successfully.");
  } catch (err) {
    console.error("React render error:", err);
  }
}