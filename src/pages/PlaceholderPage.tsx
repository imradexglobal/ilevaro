import { Link } from "react-router-dom";

const moduleList = [
  { to: "/properties", title: "Properties", desc: "Register and manage your property portfolio." },
  { to: "/landlords", title: "Landlords", desc: "Owner records, agreements, and remittances." },
  { to: "/tenants", title: "Tenants", desc: "Tenant profiles, applications, and history." },
  { to: "/tenancies", title: "Tenancies", desc: "Lease terms, renewals, and lifecycle." },
  { to: "/rent", title: "Rent & Charges", desc: "Rent schedules, due dates, and obligations." },
  { to: "/payments", title: "Payments", desc: "Record, allocate, verify, and reverse payments." },
  { to: "/arrears", title: "Arrears", desc: "Track overdue rent and manage recovery." },
  { to: "/deposits", title: "Deposits", desc: "Refundable deposits and reconciliation." },
  { to: "/expenses", title: "Expenses", desc: "Property expenses and maintenance costs." },
  { to: "/commissions", title: "Commissions", desc: "Agency fees, management commissions, and owner payouts." },
  { to: "/accounting", title: "Accounting", desc: "Chart of accounts, journals, and financial reports." },
  { to: "/documents", title: "Documents", desc: "Secure storage for agreements and records." },
  { to: "/reports", title: "Reports", desc: "Dashboards, exports, and statements." },
];

export function PlaceholderPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Modules</h2>
        <p className="text-sm text-slate-500">
          Each module will be implemented in a dedicated phase. Click a module to view its status.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {moduleList.map((m) => (
          <Link
            key={m.to}
            to={m.to}
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 group-hover:text-brand-600">
                {m.title}
              </h3>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                Planned
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">{m.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
