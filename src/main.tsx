import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ToastProvider } from "./ui";
import { ContentProvider } from "./mock";
import "./index.css";
import App from "./App.tsx";
import { applyTheme, storedTheme } from "./lib/theme";

// Before the first paint, so a dark-theme user never sees a light flash.
applyTheme(storedTheme());

// The path the app is served under: "/" in dev and on Cloudflare Pages, or the
// Vite base (e.g. "/admin") when built for the UAT box behind the shared ALB.
// Vite exposes it as BASE_URL (with a trailing slash); React Router wants it
// without one.
const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <ContentProvider app="bo-admin">
        <ToastProvider>
          <App />
        </ToastProvider>
      </ContentProvider>
    </BrowserRouter>
  </StrictMode>,
);
