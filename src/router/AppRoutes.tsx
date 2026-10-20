import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute, PublicOnlyRoute } from "@/components/ProtectedRoute";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { AgencyProfilePage } from "@/pages/AgencyProfilePage";
import { InviteStaffPage } from "@/pages/InviteStaffPage";
import { ExpensesPage } from "@/pages/ExpensesPage";
import { DepositsPage } from "@/pages/DepositsPage";
import { CommissionsPage } from "@/pages/CommissionsPage";
import { PlatformAdminPage } from "@/pages/PlatformAdminPage";
import { OwnerPage } from "@/pages/OwnerPage";
import { TenantPage } from "@/pages/TenantPage";
import { PlaceholderPage } from "@/pages/PlaceholderPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/properties/*" element={<PlaceholderPage />} />
          <Route path="/landlords/*" element={<PlaceholderPage />} />
          <Route path="/tenants/*" element={<PlaceholderPage />} />
          <Route path="/tenancies/*" element={<PlaceholderPage />} />
          <Route path="/rent/*" element={<PlaceholderPage />} />
          <Route path="/payments/*" element={<PlaceholderPage />} />
          <Route path="/arrears/*" element={<PlaceholderPage />} />
          <Route path="/deposits/*" element={<DepositsPage />} />
          <Route path="/expenses/*" element={<ExpensesPage />} />
          <Route path="/commissions/*" element={<CommissionsPage />} />
          <Route path="/accounting/*" element={<PlaceholderPage />} />
          <Route path="/documents/*" element={<PlaceholderPage />} />
          <Route path="/notifications/*" element={<PlaceholderPage />} />
          <Route path="/reports/*" element={<PlaceholderPage />} />
          <Route path="/settings/*" element={<PlaceholderPage />} />
          <Route path="/agency-profile" element={<AgencyProfilePage />} />
          <Route path="/invite-staff" element={<InviteStaffPage />} />
          <Route path="/platform-admin/*" element={<PlatformAdminPage />} />
          <Route path="/owner/*" element={<OwnerPage />} />
          <Route path="/tenant/*" element={<TenantPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
