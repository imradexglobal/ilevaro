import { useLocation, Link } from "react-router-dom";
import { Menu, Search, Bell } from "lucide-react";
import { useSidebar } from "@/context/SidebarContext";

const routeTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/properties": "Properties",
  "/landlords": "Landlords",
  "/tenants": "Tenants",
  "/tenancies": "Tenancies",
  "/rent": "Rent & Charges",
  "/payments": "Payments",
  "/arrears": "Arrears",
  "/deposits": "Deposits",
  "/expenses": "Expenses",
  "/commissions": "Commissions",
  "/accounting": "Accounting",
  "/documents": "Documents",
  "/notifications": "Notifications",
  "/reports": "Reports",
  "/settings": "Settings",
};

export function Header() {
  const { setMobileOpen } = useSidebar();
  const { pathname } = useLocation();
  const title = routeTitles[pathname] || "ILEVARO";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/80 px-4 backdrop-blur-sm sm:px-6">
      <button
        onClick={() => setMobileOpen(true)}
        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1">
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
      </div>

      <div className="hidden items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 md:flex">
        <Search className="mr-2 h-4 w-4 text-slate-400" />
        <input
          type="search"
          placeholder="Search properties, tenants, payments..."
          className="w-64 bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none"
          aria-label="Global search"
        />
      </div>

      <Link
        to="/notifications"
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
      </Link>
    </header>
  );
}
