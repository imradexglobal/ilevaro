import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { SidebarProvider } from "@/context/SidebarContext";
import { ToastProvider } from "@/components/ui/Toast";
import { AppRoutes } from "@/router/AppRoutes";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <SidebarProvider>
          <BrowserRouter>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </BrowserRouter>
        </SidebarProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
