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
import { RemittancesPage } from "@/pages/RemittancesPage";
import { PlatformAdminPage } from "@/pages/PlatformAdminPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PropertiesPage } from "@/pages/PropertiesPage";
import { TenanciesPage } from "@/pages/TenanciesPage";
import { RentPage } from "@/pages/RentPage";
import { TenantsPage } from "@/pages/TenantsPage";
import { AccountingPage } from "@/pages/AccountingPage";
import { LandlordsPage } from "@/pages/LandlordsPage";
import { ArrearsPage } from "@/pages/ArrearsPage";
import { DocumentsPage } from "@/pages/DocumentsPage";
import { NotificationsPage } from "@/pages/NotificationsPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { SearchPage } from "@/pages/SearchPage";

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

          {/* Core Property Management Modules */}
          <Route path="/properties/*" element={<PropertiesPage />} />
          <Route path="/landlords/*" element={<LandlordsPage />} />
          <Route path="/tenants/*" element={<TenantsPage />} />
          <Route path="/tenancies/*" element={<TenanciesPage />} />
          <Route path="/rent/*" element={<RentPage />} />
          {/* Payments are now handled on the combined Rent & Payments page. */}
          <Route path="/payments/*" element={<Navigate to="/rent" replace />} />
          <Route path="/arrears/*" element={<ArrearsPage />} />

          {/* Financial Modules */}
          <Route path="/deposits/*" element={<DepositsPage />} />
          <Route path="/expenses/*" element={<ExpensesPage />} />
          <Route path="/commissions/*" element={<CommissionsPage />} />
          <Route path="/remittances/*" element={<RemittancesPage />} />
          <Route path="/accounting/*" element={<AccountingPage />} />

          {/* Remaining modules */}
          <Route path="/documents/*" element={<DocumentsPage />} />
          <Route path="/notifications/*" element={<NotificationsPage />} />
          <Route path="/reports/*" element={<ReportsPage />} />
          <Route path="/settings/*" element={<SettingsPage />} />
          <Route path="/search" element={<SearchPage />} />

          <Route path="/agency-profile" element={<AgencyProfilePage />} />
          <Route path="/invite-staff" element={<InviteStaffPage />} />
          <Route path="/platform-admin/*" element={<PlatformAdminPage />} />

          {/* Legacy aliases — the full landlord and tenant modules live at
              /landlords and /tenants. */}
          <Route path="/owner/*" element={<Navigate to="/landlords" replace />} />
          <Route path="/tenant/*" element={<Navigate to="/tenants" replace />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}