import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { Card, StatCard } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { EmptyState, Spinner } from "@/components/ui/States";
import { queryAgencyCollection } from "@/lib/firestore";
import { formatCurrency } from "@/lib/format";

type RangeKey = "this_month" | "last_30" | "this_year" | "all";

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  repairs: "Repairs",
  plumbing: "Plumbing",
  electrical: "Electrical",
  cleaning: "Cleaning",
  security: "Security",
  waste: "Waste",
  service_charge: "Service Charge",
  inspection: "Inspection",
  other: "Other",
};

function rangeStart(range: RangeKey): Date | null {
  const now = new Date();
  if (range === "this_month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (range === "last_30") {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d;
  }
  if (range === "this_year") return new Date(now.getFullYear(), 0, 1);
  return null;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const maybe = value as { toDate?: () => Date };
  return typeof maybe.toDate === "function" ? maybe.toDate() : null;
}

function inRange(value: unknown, start: Date | null): boolean {
  if (!start) return true;
  const d = toDate(value);
  return d ? d.getTime() >= start.getTime() : false;
}

function downloadTextFile(fileName: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ReportsPage() {
  const { user, agencyId } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [range, setRange] = useState<RangeKey>("this_month");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    properties: Record<string, unknown>[];
    tenancies: Record<string, unknown>[];
    tenants: Record<string, unknown>[];
    owners: Record<string, unknown>[];
    charges: Record<string, unknown>[];
    payments: Record<string, unknown>[];
    expenses: Record<string, unknown>[];
    deposits: Record<string, unknown>[];
    commissions: Record<string, unknown>[];
  }>({
    properties: [],
    tenancies: [],
    tenants: [],
    owners: [],
    charges: [],
    payments: [],
    expenses: [],
    deposits: [],
    commissions: [],
  });

  const load = useCallback(async () => {
    if (!agencyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [
        properties,
        tenancies,
        tenants,
        owners,
        charges,
        payments,
        expenses,
        deposits,
        commissions,
      ] = await Promise.all([
        queryAgencyCollection(agencyId, "properties"),
        queryAgencyCollection(agencyId, "tenancies"),
        queryAgencyCollection(agencyId, "tenants"),
        queryAgencyCollection(agencyId, "owners"),
        queryAgencyCollection(agencyId, "rent_charges"),
        queryAgencyCollection(agencyId, "payments"),
        queryAgencyCollection(agencyId, "expenses"),
        queryAgencyCollection(agencyId, "deposits"),
        queryAgencyCollection(agencyId, "commissions"),
      ]);
      setData({
        properties,
        tenancies,
        tenants,
        owners,
        charges,
        payments,
        expenses,
        deposits,
        commissions,
      });
    } catch (err) {
      toast.error("Failed to load report data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [agencyId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const report = useMemo(() => {
    const start = rangeStart(range);
    const num = (v: unknown) => (typeof v === "number" ? v : 0);

    const charges = data.charges.filter((c) => inRange(c.createdAt, start));
    const billed = charges.reduce((sum, c) => sum + num(c.amountDue), 0);
    const collectedOnCharges = charges.reduce((sum, c) => sum + num(c.amountPaid), 0);
    const outstanding = charges.reduce((sum, c) => sum + num(c.outstanding), 0);

    const payments = data.payments.filter((p) => inRange(p.paymentDate, start));
    const paymentsTotal = payments.reduce((sum, p) => sum + num(p.amount), 0);
    const verifiedPayments = payments.filter((p) => p.status === "verified").length;

    const expenses = data.expenses.filter((e) => inRange(e.expenseDate, start));
    const expensesTotal = expenses.reduce((sum, e) => sum + num(e.amount), 0);

    const expensesByCategory = Object.entries(
      expenses.reduce<Record<string, number>>((acc, e) => {
        const key = String(e.category ?? "other");
        acc[key] = (acc[key] ?? 0) + num(e.amount);
        return acc;
      }, {})
    )
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    const depositsHeld = data.deposits.reduce((sum, d) => {
      const received = num(d.amountReceived);
      const refunded = num(d.amountRefunded);
      return sum + Math.max(0, received - refunded);
    }, 0);

    const commissionsTotal = data.commissions
      .filter((c) => inRange(c.createdAt, start))
      .reduce((sum, c) => sum + num(c.calculatedAmount), 0);

    return {
      activeProperties: data.properties.filter((p) => p.status !== "archived").length,
      unitCount: data.properties.reduce((sum, p) => sum + num(p.unitCount), 0),
      activeTenancies: data.tenancies.filter((t) => t.status === "active").length,
      tenantCount: data.tenants.length,
      ownerCount: data.owners.length,
      billed,
      collectedOnCharges,
      outstanding,
      paymentCount: payments.length,
      paymentsTotal,
      verifiedPayments,
      expensesTotal,
      expensesByCategory,
      depositsHeld,
      commissionsTotal,
      collectionRate: billed > 0 ? Math.round((collectedOnCharges / billed) * 100) : 0,
    };
  }, [data, range]);

  const handleExport = () => {
    const rows: [string, string][] = [
      ["Report range", range],
      ["Active properties", String(report.activeProperties)],
      ["Total units", String(report.unitCount)],
      ["Active tenancies", String(report.activeTenancies)],
      ["Tenants", String(report.tenantCount)],
      ["Landlords", String(report.ownerCount)],
      ["Rent billed", String(report.billed)],
      ["Rent collected", String(report.collectedOnCharges)],
      ["Rent outstanding", String(report.outstanding)],
      ["Collection rate (%)", String(report.collectionRate)],
      ["Payments recorded", String(report.paymentCount)],
      ["Payments total", String(report.paymentsTotal)],
      ["Verified payments", String(report.verifiedPayments)],
      ["Expenses total", String(report.expensesTotal)],
      ["Deposits held", String(report.depositsHeld)],
      ["Commissions", String(report.commissionsTotal)],
    ];
    const csv = ["metric,value", ...rows.map(([k, v]) => `"${k}","${v}"`)].join("\n");
    downloadTextFile(`report-${range}.csv`, csv, "text/csv;charset=utf-8");
    toast.success("Report exported");
  };

  if (!user) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-xl font-bold text-slate-900">Sign in to view reports</h2>
        <p className="mt-2 text-slate-500">Please sign in to access reports.</p>
        <Button className="mt-4" onClick={() => navigate("/login")}>
          Sign In
        </Button>
      </Card>
    );
  }

  if (!agencyId) {
    return (
      <Card className="p-8">
        <EmptyState
          title="No agency linked to this account"
          message="Create your agency to view reports."
          action={<Button onClick={() => navigate("/agency-profile")}>Create agency</Button>}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Reports</h2>
          <p className="mt-1 text-sm text-slate-500">
            Portfolio, rent performance and expense summary.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={range}
            onChange={(e) => setRange(e.target.value as RangeKey)}
            className="w-44"
            options={[
              { value: "this_month", label: "This month" },
              { value: "last_30", label: "Last 30 days" },
              { value: "this_year", label: "This year" },
              { value: "all", label: "All time" },
            ]}
          />
          <Button variant="outline" onClick={handleExport} disabled={loading}>
            Export CSV
          </Button>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Active Properties" value={String(report.activeProperties)} />
            <StatCard label="Total Units" value={String(report.unitCount)} />
            <StatCard label="Active Tenancies" value={String(report.activeTenancies)} />
            <StatCard label="Tenants" value={String(report.tenantCount)} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Rent Billed" value={formatCurrency(report.billed)} />
            <StatCard label="Rent Collected" value={formatCurrency(report.collectedOnCharges)} />
            <StatCard label="Rent Outstanding" value={formatCurrency(report.outstanding)} />
            <StatCard label="Collection Rate" value={`${report.collectionRate}%`} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Payments Received"
              value={formatCurrency(report.paymentsTotal)}
            />
            <StatCard label="Payments Recorded" value={String(report.paymentCount)} />
            <StatCard label="Expenses" value={formatCurrency(report.expensesTotal)} />
            <StatCard label="Deposits Held" value={formatCurrency(report.depositsHeld)} />
          </div>

          <Card title="Expenses by Category" subtitle="Records within the selected range">
            {report.expensesByCategory.length === 0 ? (
              <EmptyState title="No expenses in range" message="No expenses were recorded in this period." />
            ) : (
              <Table>
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Category</th>
                    <th className="text-right text-xs font-medium text-slate-500 px-6 py-3">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {report.expensesByCategory.map((row) => (
                    <tr key={row.category} className="border-b hover:bg-slate-50">
                      <td className="text-xs px-6 py-3 text-slate-700">
                        {EXPENSE_CATEGORY_LABELS[row.category] ?? row.category}
                      </td>
                      <td className="text-xs px-6 py-3 text-right text-slate-700">
                        {formatCurrency(row.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card title="Other Totals">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Landlords
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{report.ownerCount}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Verified Payments
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {report.verifiedPayments}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Commissions
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {formatCurrency(report.commissionsTotal)}
                </p>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
