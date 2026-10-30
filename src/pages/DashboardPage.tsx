import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  Circle,
  KeyRound,
  PiggyBank,
  Receipt,
  Wallet,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { signOut } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Card, StatCard } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, Spinner } from "@/components/ui/States";
import { calculateChargeStatus, getAgencySettings, queryAgencyCollection } from "@/lib/firestore";
import { DEFAULT_DUE_SOON_DAYS } from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";

type Doc = Record<string, unknown> & { id: string };

const DAY_MS = 1000 * 60 * 60 * 24;

const roleLabels: Record<string, string> = {
  agency_owner: "Agency Owner",
  agency_admin: "Agency Admin",
  property_manager: "Property Manager",
  accountant: "Accountant",
  field_agent: "Field Agent",
  auditor: "Auditor",
  landlord: "Landlord",
  tenant: "Tenant",
  platform_admin: "Platform Admin",
};

const paymentVariant: Record<string, "default" | "success" | "warning" | "danger"> = {
  verified: "success",
  pending: "warning",
  failed: "danger",
  reversed: "default",
};

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const maybe = value as { toDate?: () => Date };
  return typeof maybe.toDate === "function" ? maybe.toDate() : null;
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function DashboardPage() {
  const { user, agencyId, agencyRole } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [dueSoonDays, setDueSoonDays] = useState(DEFAULT_DUE_SOON_DAYS);
  const [data, setData] = useState<{
    properties: Doc[];
    tenancies: Doc[];
    tenants: Doc[];
    charges: Doc[];
    payments: Doc[];
    expenses: Doc[];
    deposits: Doc[];
    activity: Doc[];
  }>({
    properties: [],
    tenancies: [],
    tenants: [],
    charges: [],
    payments: [],
    expenses: [],
    deposits: [],
    activity: [],
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
        charges,
        payments,
        expenses,
        deposits,
        activity,
        settings,
      ] = await Promise.all([
        queryAgencyCollection(agencyId, "properties"),
        queryAgencyCollection(agencyId, "tenancies"),
        queryAgencyCollection(agencyId, "tenants"),
        queryAgencyCollection(agencyId, "rent_charges"),
        queryAgencyCollection(agencyId, "payments"),
        queryAgencyCollection(agencyId, "expenses"),
        queryAgencyCollection(agencyId, "deposits"),
        queryAgencyCollection(agencyId, "activity_events"),
        getAgencySettings(agencyId),
      ]);
      setData({ properties, tenancies, tenants, charges, payments, expenses, deposits, activity });
      setDueSoonDays(settings.dueSoonDays);
    } catch (err) {
      toast.error("Failed to load dashboard data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [agencyId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const tenantNameForTenancy = useCallback(
    (tenancyId: string) => {
      const tenancy = data.tenancies.find((t) => t.id === tenancyId);
      if (!tenancy) return "—";
      const tenant = data.tenants.find((t) => t.id === str(tenancy.tenantId));
      if (!tenant) return "Unknown tenant";
      return `${str(tenant.firstName)} ${str(tenant.lastName)}`.trim() || "Unnamed tenant";
    },
    [data.tenancies, data.tenants]
  );

  const propertyNameForTenancy = useCallback(
    (tenancyId: string) => {
      const tenancy = data.tenancies.find((t) => t.id === tenancyId);
      if (!tenancy) return "—";
      const property = data.properties.find((p) => p.id === str(tenancy.propertyId));
      if (!property) return "Unknown property";
      const unit = str(tenancy.unitLabel) || str(tenancy.unitId);
      return unit ? `${str(property.name)} · Unit ${unit}` : str(property.name);
    },
    [data.tenancies, data.properties]
  );

  const summary = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const activeProperties = data.properties.filter((p) => str(p.status) !== "archived").length;
    const totalUnits = data.properties.reduce((sum, p) => sum + num(p.unitCount), 0);
    const activeTenancies = data.tenancies.filter((t) => str(t.status) === "active").length;

    const billedThisMonth = data.charges
      .filter((c) => {
        const d = toDate(c.dueDate);
        return d ? d.getTime() >= monthStart.getTime() : false;
      })
      .reduce((sum, c) => sum + num(c.amountDue), 0);

    const collectedThisMonth = data.payments
      .filter((p) => {
        const d = toDate(p.paymentDate);
        return d ? d.getTime() >= monthStart.getTime() : false;
      })
      .reduce((sum, p) => sum + num(p.amount), 0);

    const outstanding = data.charges.reduce((sum, c) => sum + Math.max(0, num(c.outstanding)), 0);

    let overdueAmount = 0;
    let overdueCount = 0;
    for (const charge of data.charges) {
      const status = str(charge.status);
      if (status === "waived" || status === "cancelled") continue;
      const due = toDate(charge.dueDate);
      if (!due) continue;
      const computed = calculateChargeStatus(
        due,
        num(charge.amountDue),
        num(charge.amountPaid),
        num(charge.gracePeriodDays) || 7
      );
      if (computed === "overdue") {
        overdueAmount += Math.max(0, num(charge.outstanding));
        overdueCount += 1;
      }
    }

    const depositsHeld = data.deposits.reduce(
      (sum, d) => sum + Math.max(0, num(d.amountReceived) - num(d.amountRefunded)),
      0
    );

    // Rent falling due within the agency's configured window and still unpaid.
    const dueSoon = data.charges
      .filter((c) => {
        const status = str(c.status);
        if (status === "waived" || status === "cancelled") return false;
        if (num(c.outstanding) <= 0) return false;
        const due = toDate(c.dueDate);
        if (!due) return false;
        const computed = calculateChargeStatus(
          due,
          num(c.amountDue),
          num(c.amountPaid),
          num(c.gracePeriodDays) || 7
        );
        if (computed === "overdue" || computed === "paid") return false;
        const daysUntil = Math.ceil((due.getTime() - now.getTime()) / DAY_MS);
        return daysUntil >= 0 && daysUntil <= dueSoonDays;
      })
      .map((c) => {
        const due = toDate(c.dueDate)!;
        return {
          id: c.id,
          tenancyId: str(c.tenancyId),
          outstanding: Math.max(0, num(c.outstanding)),
          dueDateObj: due,
          daysUntil: Math.ceil((due.getTime() - now.getTime()) / DAY_MS),
        };
      })
      .sort((a, b) => a.dueDateObj.getTime() - b.dueDateObj.getTime());

    const dueSoonAmount = dueSoon.reduce((sum, c) => sum + c.outstanding, 0);

    const expensesThisMonth = data.expenses
      .filter((e) => {
        const d = toDate(e.expenseDate) ?? toDate(e.createdAt);
        return d ? d.getTime() >= monthStart.getTime() : false;
      })
      .reduce((sum, e) => sum + num(e.amount), 0);

    const occupancyRate =
      totalUnits > 0 ? Math.round((activeTenancies / totalUnits) * 100) : 0;

    const collectionRate =
      billedThisMonth > 0 ? Math.round((collectedThisMonth / billedThisMonth) * 100) : 0;

    const recentPayments = [...data.payments]
      .sort((a, b) => (toDate(b.paymentDate)?.getTime() ?? 0) - (toDate(a.paymentDate)?.getTime() ?? 0))
      .slice(0, 6);

    const recentActivity = [...data.activity]
      .sort((a, b) => (toDate(b.timestamp)?.getTime() ?? 0) - (toDate(a.timestamp)?.getTime() ?? 0))
      .slice(0, 8);

    return {
      activeProperties,
      totalUnits,
      activeTenancies,
      tenantCount: data.tenants.length,
      billedThisMonth,
      collectedThisMonth,
      outstanding,
      overdueAmount,
      overdueCount,
      dueSoon,
      dueSoonAmount,
      dueSoonDays,
      depositsHeld,
      expensesThisMonth,
      occupancyRate,
      collectionRate,
      recentPayments,
      recentActivity,
    };
  }, [data, dueSoonDays]);

  const checklist = useMemo(
    () => [
      { label: "Create your agency", done: !!agencyId, to: "/agency-profile", cta: "Set up" },
      {
        label: "Add your first property",
        done: data.properties.length > 0,
        to: "/properties",
        cta: "Add property",
      },
      { label: "Add a tenant", done: data.tenants.length > 0, to: "/tenants", cta: "Add tenant" },
      {
        label: "Create a tenancy",
        done: data.tenancies.length > 0,
        to: "/tenancies",
        cta: "Create tenancy",
      },
      {
        label: "Record your first payment",
        done: data.payments.length > 0,
        to: "/payments",
        cta: "Record payment",
      },
    ],
    [agencyId, data.properties.length, data.tenancies.length, data.tenants.length, data.payments.length]
  );

  const completedSteps = checklist.filter((step) => step.done).length;

  if (!agencyId) {
    return (
      <Card className="p-8">
        <EmptyState
          title="No agency linked to this account"
          message="Your account is signed in but is not attached to an agency yet. Create your agency to start managing properties."
          action={
            <div className="flex gap-3">
              <Link to="/agency-profile">
                <Button size="sm">Create your agency</Button>
              </Link>
              <Button size="sm" variant="outline" onClick={handleSignOut}>
                Sign out
              </Button>
            </div>
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
          <p className="mt-1 text-sm text-slate-500">
            Signed in as{" "}
            <span className="font-medium text-slate-700">
              {user?.displayName || user?.email}
            </span>{" "}
            — {roleLabels[agencyRole ?? ""] ?? agencyRole}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <>
          {completedSteps < checklist.length && (
            <Card
              title="Getting started"
              subtitle={`${completedSteps} of ${checklist.length} steps complete`}
            >
              <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-brand-600 transition-all"
                  style={{ width: `${(completedSteps / checklist.length) * 100}%` }}
                />
              </div>
              <ul className="space-y-3">
                {checklist.map((step) => (
                  <li key={step.label} className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {step.done ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                      ) : (
                        <Circle className="h-5 w-5 shrink-0 text-slate-300" />
                      )}
                      <span
                        className={`truncate text-sm ${
                          step.done ? "text-slate-400 line-through" : "text-slate-700"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                    {!step.done && (
                      <Link to={step.to} className="shrink-0">
                        <Button size="sm" variant="outline">
                          {step.cta}
                        </Button>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Active Properties"
              value={String(summary.activeProperties)}
              icon={<Building2 className="h-5 w-5" />}
            />
            <StatCard label="Total Units" value={String(summary.totalUnits)} />
            <StatCard
              label="Active Tenancies"
              value={String(summary.activeTenancies)}
              icon={<KeyRound className="h-5 w-5" />}
            />
            <StatCard
              label="Occupancy Rate"
              value={`${summary.occupancyRate}%`}
              trend={{
                value:
                  summary.totalUnits === 0
                    ? "No units recorded yet"
                    : `${summary.activeTenancies} of ${summary.totalUnits} units let`,
                direction: "neutral",
              }}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Rent Billed (This Month)"
              value={formatCurrency(summary.billedThisMonth)}
              icon={<Wallet className="h-5 w-5" />}
            />
            <StatCard
              label="Collected (This Month)"
              value={formatCurrency(summary.collectedThisMonth)}
              trend={{
                value:
                  summary.billedThisMonth > 0
                    ? `${summary.collectionRate}% of this month's billing`
                    : "No billing yet this month",
                direction: "neutral",
              }}
            />
            <StatCard
              label="Outstanding Rent"
              value={formatCurrency(summary.outstanding)}
              icon={<Receipt className="h-5 w-5" />}
            />
            <StatCard
              label="Overdue"
              value={formatCurrency(summary.overdueAmount)}
              icon={<AlertTriangle className="h-5 w-5" />}
              trend={{
                value:
                  summary.overdueCount === 0
                    ? "Nothing overdue"
                    : `${summary.overdueCount} charge${summary.overdueCount === 1 ? "" : "s"} overdue`,
                direction: summary.overdueCount === 0 ? "neutral" : "down",
              }}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Deposits Held"
              value={formatCurrency(summary.depositsHeld)}
              icon={<PiggyBank className="h-5 w-5" />}
            />
            <StatCard
              label="Expenses (This Month)"
              value={formatCurrency(summary.expensesThisMonth)}
              icon={<Wrench className="h-5 w-5" />}
            />
            <StatCard
              label="Rent Due Soon"
              value={String(summary.dueSoon.length)}
              icon={<CalendarClock className="h-5 w-5" />}
              trend={{
                value:
                  summary.dueSoon.length === 0
                    ? `Nothing due in the next ${summary.dueSoonDays} days`
                    : `${formatCurrency(summary.dueSoonAmount)} due within ${summary.dueSoonDays} days`,
                direction: summary.dueSoon.length === 0 ? "neutral" : "down",
              }}
            />
          </div>

          <Card
            title="Rent Due Soon"
            subtitle={`Tenants with rent falling due in the next ${summary.dueSoonDays} days`}
            actions={
              <Link to="/arrears">
                <Button size="sm" variant="outline">
                  Review arrears
                </Button>
              </Link>
            }
          >
            {summary.dueSoon.length === 0 ? (
              <EmptyState
                title="Nothing due soon"
                message={`No unpaid rent falls due in the next ${summary.dueSoonDays} day(s).`}
              />
            ) : (
              <Table>
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">
                      Tenant
                    </th>
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">
                      Property
                    </th>
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">
                      Due Date
                    </th>
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">
                      Days Left
                    </th>
                    <th className="text-right text-xs font-medium text-slate-500 px-6 py-3">
                      Outstanding
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.dueSoon.map((charge) => (
                    <tr
                      key={charge.id}
                      className="border-b hover:bg-slate-50 cursor-pointer"
                      onClick={() => navigate("/rent")}
                    >
                      <td className="text-xs px-6 py-3 font-medium text-slate-700">
                        {tenantNameForTenancy(charge.tenancyId)}
                      </td>
                      <td className="text-xs px-6 py-3 text-slate-700">
                        {propertyNameForTenancy(charge.tenancyId)}
                      </td>
                      <td className="text-xs px-6 py-3 text-slate-700">
                        {formatDate(charge.dueDateObj)}
                      </td>
                      <td className="text-xs px-6 py-3">
                        <Badge variant={charge.daysUntil <= 2 ? "warning" : "info"}>
                          {charge.daysUntil === 0 ? "Today" : `${charge.daysUntil} day(s)`}
                        </Badge>
                      </td>
                      <td className="text-xs px-6 py-3 text-right text-slate-700">
                        {formatCurrency(charge.outstanding)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card title="Quick Actions" subtitle="Jump straight into the most common tasks">
            <div className="flex flex-wrap gap-3">
              <Link to="/properties">
                <Button size="sm" variant="outline">
                  Add property
                </Button>
              </Link>
              <Link to="/tenancies">
                <Button size="sm" variant="outline">
                  Create tenancy
                </Button>
              </Link>
              <Link to="/rent">
                <Button size="sm" variant="outline">
                  Generate rent charges
                </Button>
              </Link>
              <Link to="/payments">
                <Button size="sm" variant="outline">
                  Record payment
                </Button>
              </Link>
              <Link to="/arrears">
                <Button size="sm" variant="outline">
                  Review arrears
                </Button>
              </Link>
            </div>
          </Card>

          <Card
            title="Recent Payments"
            subtitle="Latest payments recorded in this agency"
            actions={
              <Link to="/payments">
                <Button size="sm" variant="outline">
                  View all
                </Button>
              </Link>
            }
          >
            {summary.recentPayments.length === 0 ? (
              <EmptyState
                title="No payments yet"
                message="Recorded payments will appear here."
                action={
                  <Link to="/payments">
                    <Button size="sm">Record payment</Button>
                  </Link>
                }
              />
            ) : (
              <Table>
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">
                      Reference
                    </th>
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">
                      Tenant
                    </th>
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Date</th>
                    <th className="text-right text-xs font-medium text-slate-500 px-6 py-3">
                      Amount
                    </th>
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recentPayments.map((payment) => {
                    const status = str(payment.status);
                    return (
                      <tr
                        key={payment.id}
                        className="border-b hover:bg-slate-50 cursor-pointer"
                        onClick={() => navigate("/payments")}
                      >
                        <td className="text-xs px-6 py-3 font-medium text-slate-700">
                          {str(payment.reference) || payment.id}
                        </td>
                        <td className="text-xs px-6 py-3 text-slate-700">
                          {tenantNameForTenancy(str(payment.tenancyId))}
                        </td>
                        <td className="text-xs px-6 py-3 text-slate-700">
                          {toDate(payment.paymentDate)
                            ? formatDate(toDate(payment.paymentDate)!)
                            : "—"}
                        </td>
                        <td className="text-xs px-6 py-3 text-right text-slate-700">
                          {formatCurrency(num(payment.amount))}
                        </td>
                        <td className="text-xs px-6 py-3">
                          <Badge variant={paymentVariant[status] ?? "default"}>
                            {status || "unknown"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Card>

          <Card
            title="Recent Activity"
            subtitle="Latest actions recorded against this agency"
            actions={
              <Link to="/reports">
                <Button size="sm" variant="outline">
                  Reports
                </Button>
              </Link>
            }
          >
            {summary.recentActivity.length === 0 ? (
              <EmptyState
                title="No activity recorded"
                message="Actions such as verifying rent charges will show up here."
              />
            ) : (
              <ul className="space-y-3">
                {summary.recentActivity.map((event) => (
                  <li key={event.id} className="flex items-start gap-3">
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                    <div className="min-w-0">
                      <p className="text-sm text-slate-700">
                        <span className="font-medium">{str(event.actorName) || "System"}</span>{" "}
                        {str(event.action) || "performed an action"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {toDate(event.timestamp)
                          ? formatDateTime(toDate(event.timestamp)!)
                          : "—"}
                        {str(event.entityType) ? ` · ${str(event.entityType)}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
