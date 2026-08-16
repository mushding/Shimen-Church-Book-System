import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import "./index.css";
import { router } from "./router";
import { ToastProvider } from "./ui";

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } } });
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <ToastProvider><RouterProvider router={router} /></ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
