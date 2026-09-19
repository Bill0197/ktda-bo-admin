import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ToastProvider } from "./ui";
import { ContentProvider } from "./mock";
import "./index.css";
import App from "./App.tsx";

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
