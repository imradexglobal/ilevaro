import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Users,
  UserCog,
  KeyRound,
  Wallet,
  Receipt,
  Wrench,
  PiggyBank,
  FileText,
  HandCoins,
  Bell,
  BarChart3,
  Settings,
  Landmark,
  LogOut,
  ChevronLeft,
} from "lucide-react";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import { signOut } from "@/lib/auth";

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  section: string;
  allowedRoles: string[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: <LayoutDashboard className="h-5 w-5" />, section: "Overview", allowedRoles: ["agency_owner", "agency_admin", "property_manager", "accountant", "field_agent", "auditor", "landlord", "tenant", "platform_admin"] },
  { label: "Properties", to: "/properties", icon: <Building2 className="h-5 w-5" />, section: "Portfolio", allowedRoles: ["agency_owner", "agency_admin", "property_manager", "platform_admin"] },
  { label: "Landlords", to: "/landlords", icon: <UserCog className="h-5 w-5" />, section: "Portfolio", allowedRoles: ["agency_owner", "agency_admin", "platform_admin"] },
  { label: "Tenants", to: "/tenants", icon: <Users className="h-5 w-5" />, section: "Portfolio", allowedRoles: ["agency_owner", "agency_admin", "property_manager", "platform_admin"] },
  { label: "Tenancies", to: "/tenancies", icon: <KeyRound className="h-5 w-5" />, section: "Operations", allowedRoles: ["agency_owner", "agency_admin", "property_manager", "platform_admin"] },
  { label: "Rent & Payments", to: "/rent", icon: <Wallet className="h-5 w-5" />, section: "Operations", allowedRoles: ["agency_owner", "agency_admin", "property_manager", "accountant", "platform_admin"] },
  { label: "Arrears", to: "/arrears", icon: <Landmark className="h-5 w-5" />, section: "Operations", allowedRoles: ["agency_owner", "agency_admin", "property_manager", "platform_admin"] },
  { label: "Deposits", to: "/deposits", icon: <PiggyBank className="h-5 w-5" />, section: "Finance", allowedRoles: ["agency_owner", "agency_admin", "accountant", "platform_admin"] },
  { label: "Expenses", to: "/expenses", icon: <Wrench className="h-5 w-5" />, section: "Finance", allowedRoles: ["agency_owner", "agency_admin", "property_manager", "accountant", "platform_admin"] },
  { label: "Commissions", to: "/commissions", icon: <Receipt className="h-5 w-5" />, section: "Finance", allowedRoles: ["agency_owner", "agency_admin", "property_manager", "platform_admin"] },
  { label: "Remittances", to: "/remittances", icon: <HandCoins className="h-5 w-5" />, section: "Finance", allowedRoles: ["agency_owner", "agency_admin", "accountant", "auditor", "platform_admin"] },
  { label: "Accounting", to: "/accounting", icon: <Landmark className="h-5 w-5" />, section: "Finance", allowedRoles: ["agency_owner", "agency_admin", "accountant", "platform_admin"] },
  { label: "Documents", to: "/documents", icon: <FileText className="h-5 w-5" />, section: "Resources", allowedRoles: ["agency_owner", "agency_admin", "property_manager", "platform_admin"] },
  { label: "Notifications", to: "/notifications", icon: <Bell className="h-5 w-5" />, section: "Resources", allowedRoles: ["agency_owner", "agency_admin", "property_manager", "platform_admin"] },
  { label: "Reports", to: "/reports", icon: <BarChart3 className="h-5 w-5" />, section: "Resources", allowedRoles: ["agency_owner", "agency_admin", "property_manager", "accountant", "platform_admin"] },
  { label: "Settings", to: "/settings", icon: <Settings className="h-5 w-5" />, section: "Administration", allowedRoles: ["agency_owner", "platform_admin"] },
];

const sections = ["Overview", "Portfolio", "Operations", "Finance", "Resources", "Administration"];

export function Sidebar() {
  const { collapsed, mobileOpen, toggleCollapsed, setMobileOpen } = useSidebar();
  const { user, agencyRole } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  // Filter nav items based on user role
  const visibleNavItems = navItems.filter((item) => item.allowedRoles.includes(agencyRole ?? ""));

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            I
          </div>
          {!collapsed && (
            <span className="text-lg font-bold tracking-tight text-white">ILEVARO</span>
          )}
        </div>
        <button
          onClick={toggleCollapsed}
          className="hidden rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white lg:block"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft
            className={`h-5 w-5 transition-transform ${collapsed ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Main navigation">
        {sections.map((section) => {
          const sectionItems = visibleNavItems.filter((i) => i.section === section);
          if (sectionItems.length === 0) return null;
          return (
            <div key={section} className="mb-4">
              {!collapsed && (
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {section}
                </p>
              )}
              <ul className="space-y-0.5">
                {sectionItems.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        `sidebar-link ${isActive ? "sidebar-link-active" : "sidebar-link-inactive"} ${collapsed ? "justify-center px-2" : ""}`
                      }
                    >
                      {item.icon}
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-3 py-4">
        {user && !collapsed && (
          <div className="mb-3 px-3">
            <p className="truncate text-sm font-medium text-white">{user.displayName || user.email}</p>
            <p className="truncate text-xs text-slate-400">{user.email}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={`sidebar-link sidebar-link-inactive w-full ${collapsed ? "justify-center px-2" : ""}`}
          aria-label="Sign out"
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden bg-slate-900 transition-all duration-200 lg:block ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 lg:hidden">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
