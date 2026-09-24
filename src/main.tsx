import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthProvider";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{ className: "!rounded-2xl !font-sans", duration: 4500 }}
        />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
