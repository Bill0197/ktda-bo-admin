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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ContentProvider app="bo-admin">
        <ToastProvider>
          <App />
        </ToastProvider>
      </ContentProvider>
    </BrowserRouter>
  </StrictMode>,
);
