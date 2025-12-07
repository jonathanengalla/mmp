import React from "react";
import ReactDOM from "react-dom/client";
import { AppRouter } from "./router";
import { ThemeProvider } from "./theme/ThemeProvider";
import { SessionProvider } from "./session";

console.log("MAIN.TSX MINIMAL ENTRY LOADED");

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