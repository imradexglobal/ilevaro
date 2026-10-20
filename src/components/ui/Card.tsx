import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Card({ title, subtitle, actions, children, className = "", ...props }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
      {...props}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
  trend?: { value: string; direction: "up" | "down" | "neutral" };
}

export function StatCard({ label, value, icon, trend }: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      {trend && (
        <p
          className={`mt-1 text-xs font-medium ${
            trend.direction === "up"
              ? "text-emerald-600"
              : trend.direction === "down"
                ? "text-red-600"
                : "text-slate-500"
          }`}
        >
          {trend.value}
        </p>
      )}
    </div>
  );
}
