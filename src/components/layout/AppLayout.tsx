import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useSidebar } from "@/context/SidebarContext";

export function AppLayout() {
  const { collapsed } = useSidebar();

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <div
        className={`transition-all duration-200 ${collapsed ? "lg:pl-16" : "lg:pl-64"}`}
      >
        <Header />
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
