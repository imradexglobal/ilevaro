import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useAgency } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Card, StatCard } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, Spinner } from "@/components/ui/States";
import {
  queryAgencyCollection,
  calculateChargeStatus,
  getTenancyDependents,
  type RentCharge,
  type RentChargeStatus,
  type TenancyRecord,
  type TenancyStatus,
} from "@/lib/firestore";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Tenant } from "@/lib/types";

const MANAGE_ROLES = ["agency_owner", "agency_admin", "property_manager", "platform_admin"];

interface TenancyPaymentInfo {
  tenancy: TenancyRecord;
  rentAmount: number;
  totalPaid: number;
  outstanding: number;
  monthsOverdue: number;
  paymentStatus: "Paid" | "Partially Paid" | "Unpaid" | "Overdue";
  statusVariant: "success" | "warning" | "danger" | "default" | "info";
  dueDate: Date;
  isExpired: boolean;
}

interface ChargeSummary {
  totalDue: number;
  totalPaid: number;
  outstanding: number;
  overdue: number;
}

function getPaymentStatus(
  rentAmount: number,
  totalPaid: number,
  dueDate: Date,
  gracePeriodDays: number = 7
): "Paid" | "Partially Paid" | "Unpaid" | "Overdue" {
  if (rentAmount <= 0) return "Paid";
  if (totalPaid >= rentAmount) return "Paid";

  const today = new Date();
  const daysOverdue = Math.max(
    0,
    Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
  );
  const monthsOverdue = Math.max(0, Math.ceil(daysOverdue / 30.44));

  if (daysOverdue > gracePeriodDays) {
    return "Overdue";
  }

  if (totalPaid > 0) {
    return "Partially Paid";
  }

  return "Unpaid";
}

function getStatusVariant(status: "Paid" | "Partially Paid" | "Unpaid" | "Overdue"): "success" | "warning" | "danger" | "default" | "info" {
  switch (status) {
    case "Paid":
      return "success";
    case "Partially Paid":
      return "warning";
    case "Overdue":
      return "danger";
    case "Unpaid":
      return "default";
    default:
      return "default";
  }
}

interface TenancySummary {
  tenancy: TenancyRecord;
  paymentStatus: "Paid" | "Partially Paid" | "Unpaid" | "Overdue";
  outstanding: number;
  monthsOverdue: number;
  isCurrent: boolean;
}

export function RentAndPaymentsPage() {
  const { user, agencyId } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { agencyRole } = useAgency();

  const canManage = MANAGE_ROLES.includes(agencyRole ?? "");

  const [tenancies, setTenancies] = useState<TenancyRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!agencyId) {
      setTenancies([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [tenancyDocs, chargeDocs, paymentDocs] = await Promise.all([
        queryAgencyCollection(agencyId, "tenancies"),
        queryAgencyCollection(agencyId, "rent_charges"),
        queryAgencyCollection(agencyId, "payments"),
      ]);
      setTenancies(tenancyDocs as unknown as TenancyRecord[]);
    } catch (err) {
      toast.error("Failed to load tenancies");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [agencyId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const tenantName = useCallback(
    (tenantId?: string) => {
      if (!tenantId) return "-";
      return `Tenant ${tenantId}`;
    },
    []
  );

  const propertyName = useCallback(
    (propertyId: string) => `Property ${propertyId}`,
    []
  );

const tenancyPaymentInfo = useMemo(() => {
    if (!agencyId || tenancies.length === 0) return [];

    // Build a map of tenancyId -> rent charges
    const chargeMap = new Map<string, RentCharge[]>();
    // Note: charge data is derived from the tenancies and their associated rent charges
    // For simplicity in the unified page, we compute payment status from tenancy rentAmount
    // and existing payment data stored in the tenancy records

    return tenancies
      .filter((t) => t.status === "active" || t.status === "expired" || t.status === "renewed")
      .map((tenancy) => {
        const rentAmount = tenancy.rentAmount || 0;
        const charges = chargeMap.get(tenancy.id) || [];
        const totalPaidFromCharges = charges.reduce(
          (sum, c) => sum + (c.amountPaid || 0),
          0
        );
        const totalPaidFromPayments = 0; // paymentMap removed - no longer tracking payments separately
        const totalPaid = Math.max(totalPaidFromCharges, totalPaidFromPayments);
        const outstanding = Math.max(0, rentAmount - totalPaid);

        // Find the most recent due date from charges
        let dueDate = new Date();
        let isExpired = false;

        if (charges.length > 0) {
          const latestCharge = charges.reduce(
            (latest, current) =>
              current.dueDate.toDate().getTime() > latest.dueDate.toDate().getTime()
                ? current
                : latest,
            charges[0]
          );
          dueDate = latestCharge.dueDate.toDate();

          // Check if this tenancy is expired/renewed and its charges are past due
          if (tenancy.status !== "active") {
            isExpired = true;
            // Calculate months overdue from the end date or latest due date
            const termEnd = tenancy.endDate
              ? (tenancy.endDate.toDate ? tenancy.endDate.toDate() : new Date(tenancy.endDate))
              : null;
            const chargeDueDate = dueDate;

            if (termEnd) {
              const daysSinceEnd = Math.max(
                0,
                Math.ceil((now.getTime() - termEnd.getTime()) / (1000 * 60 * 60 * 24))
              );
              monthsOverdue = Math.ceil(daysSinceEnd / 30.44);
            } else if (chargeDueDate) {
              const daysSinceDue = Math.max(
                0,
                Math.ceil((now.getTime() - chargeDueDate.getTime()) / (1000 * 60 * 60 * 24))
              );
              monthsOverdue = Math.ceil(daysSinceDue / 30.44);
            }
          } else {
            // Active tenancy - calculate months overdue from due date
            const daysOverdue = Math.max(
              0,
              Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
            );
            monthsOverdue = Math.max(0, Math.ceil(daysOverdue / 30.44));
          }
        } else {
          // No charges - check tenancy status
          if (tenancy.status !== "active") {
            isExpired = true;
            // No charges but tenancy is expired/renewed
            monthsOverdue = 0;
          }
        }

        const paymentStatus = getPaymentStatus(
          rentAmount,
          totalPaid,
          dueDate,
          7
        );

        return {
          tenancy,
          rentAmount,
          totalPaid,
          outstanding,
          monthsOverdue,
          paymentStatus,
          statusVariant: getStatusVariant(paymentStatus),
          dueDate,
          isExpired,
        };
      });
  }, [agencyId, tenancies]);

  const [search, setSearch] = useState("");

  const filteredTenancies = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tenancies.filter((t) => {
      if (!q) return true;
      return (
        propertyName(t.propertyId).toLowerCase().includes(q) ||
        tenantName(t.tenantId).toLowerCase().includes(q)
      );
    });
  }, [tenancies, search]);

  if (!user) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-xl font-bold text-slate-900">Sign in to manage rent</h2>
        <p className="mt-2 text-slate-500">Please sign in to access rent and payments.</p>
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
          message="Create your agency before managing rent and payments."
          action={<Button onClick={() => navigate("/agency-profile")}>Create agency</Button>}
        />
      </Card>
    );
  }

  // Dashboard stats - include both active and expired tenancies
  const stats = useMemo(() => {
    let totalActive = 0;
    let fullyPaid = 0;
    let partiallyPaid = 0;
    let unpaid = 0;
    let overdue = 0;
    let historicalUnpaid = 0; // Outstanding from expired tenancies

    for (const info of tenancyPaymentInfo) {
      if (info.isExpired) {
        // Count as historical unpaid rent
        historicalUnpaid += info.outstanding;
        continue; // Don't count in active stats
      }
      totalActive++;
      switch (info.paymentStatus) {
        case "Paid":
          fullyPaid++;
          break;
        case "Partially Paid":
          partiallyPaid++;
          break;
        case "Unpaid":
          unpaid++;
          break;
        case "Overdue":
          overdue++;
          break;
      }
    }

    return {
      totalActive,
      fullyPaid,
      partiallyPaid,
      unpaid,
      overdue,
      historicalUnpaid,
    };
  }, [tenancyPaymentInfo]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Rent & Payments</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage rent collection and track payments for all active tenancies.
          </p>
        </div>
        {canManage && (
          <Button variant="primary" onClick={() => navigate("/tenancies/new")}>
            + Assign Property
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-7">
        <StatCard label="Active Tenancies" value={stats.totalActive.toString()} />
        <StatCard label="Fully Paid" value={stats.fullyPaid.toString()} />
        <StatCard label="Partially Paid" value={stats.partiallyPaid.toString()} />
        <StatCard label="Unpaid" value={stats.unpaid.toString()} />
        <StatCard label="Overdue" value={stats.overdue.toString()} />
        <StatCard label="Historical Unpaid" value={formatCurrency(stats.historicalUnpaid)} />
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium ${
            search === "" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-slate-500 hover:text-slate-700"
          }`}
          onClick={() => setSearch("")}
        >
          All Tenancies
        </button>
      </div>

      <Card className="p-4">
        <Input
          placeholder="Search tenancies by property or tenant..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full"
        />
      </Card>

      {loading ? (
        <Spinner />
      ) : filteredTenancies.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title="No tenancies found"
            message="No tenancies found. Assign a property to a tenant to start tracking rent."
            action={canManage ? (
              <Button onClick={() => navigate("/tenancies/new")}>+ Assign Property</Button>
            ) : undefined}
          />
        </Card>
      ) : (
        <Card className="p-0">
          <Table>
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Property</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Tenant</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Rent Amount</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Total Paid</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Outstanding</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Months Overdue</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Payment Status</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Tenancy Status</th>
                {canManage && (
                  <th className="text-right text-xs font-medium text-slate-500 px-6 py-3">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredTenancies.map((tenancy) => {
                const info = tenancyPaymentInfo.find((i) => i.tenancy.id === tenancy.id);
                const rentAmount = info?.rentAmount ?? tenancy.rentAmount ?? 0;
                const totalPaid = info?.totalPaid ?? 0;
                const outstanding = info?.outstanding ?? rentAmount;
                const monthsOverdue = info?.monthsOverdue ?? 0;
                const paymentStatus = info?.paymentStatus ?? "Unpaid";
                const statusVariant = info?.statusVariant ?? "default";
                const dueDate = info?.dueDate ?? new Date();
                const isExpired = info?.isExpired ?? false;

                // Determine tenancy status display
const tenancyStatusDisplay = tenancy.status
      .replace("_", " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

                return (
                  <tr
                    key={tenancy.id}
                    className="border-b hover:bg-slate-50"
                    onClick={() => navigate(`/tenancies/${tenancy.id}`)}
                  >
                    <td className="text-xs px-6 py-3">
                      <p className="font-medium text-slate-700">{propertyName(tenancy.propertyId)}</p>
                    </td>
                    <td className="text-xs px-6 py-3 text-slate-700">
                      {tenantName(tenancy.tenantId)}
                    </td>
                    <td className="text-xs px-6 py-3 text-slate-700">
                      {formatCurrency(rentAmount)}
                    </td>
                    <td className="text-xs px-6 py-3 text-slate-700">
                      {formatCurrency(totalPaid)}
                    </td>
                    <td className="text-xs px-6 py-3 text-slate-700">
                      {formatCurrency(outstanding)}
                    </td>
                    <td className="text-xs px-6 py-3 text-slate-700">
                      {monthsOverdue > 0 ? `${monthsOverdue} month${monthsOverdue > 1 ? "s" : ""}` : "—"}
                    </td>
                    <td className="text-xs px-6 py-3">
                      <Badge variant={statusVariant}>
                        {paymentStatus}
                      </Badge>
                    </td>
                    <td className="text-xs px-6 py-3">
                      <Badge
                        variant={isExpired ? "warning" : "success"}
                        className="text-nowrap"
                      >
                        {tenancyStatusDisplay}
                      </Badge>
                    </td>
                    {canManage && (
                      <td className="text-right px-6 py-3 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          className="mr-1"
                          onClick={() => navigate(`/tenancies/${tenancy.id}/edit`)}
                        >
                          Edit
                        </Button>
                        {paymentStatus !== "Paid" && !isExpired && (
                          <Button
                            size="sm"
                            variant="primary"
                            className="mr-1"
                            onClick={() => markAsFullyPaid(tenancy.id, rentAmount)}
                          >
                            Mark as Fully Paid
                          </Button>
                        )}
                        {paymentStatus !== "Paid" && !isExpired && (
                          <Button
                            size="sm"
                            variant="warning"
                            className="mr-1"
                            onClick={() => openPartialPaymentModal(tenancy.id, rentAmount, totalPaid)}
                          >
                            Partial Payment
                          </Button>
                        )}
                        {tenancy.status === "active" && (
                          <Button
                            size="sm"
                            variant="danger"
                            className="ml-1"
                            onClick={() => openEvict(tenancy)}
                          >
                            Evict
                          </Button>
                        )}
                        {tenancy.status === "active" && (
                          <Button
                            size="sm"
                            variant="info"
                            className="ml-1"
                            onClick={() => openRenew(tenancy)}
                          >
                            Renew
                          </Button>
                        )}
                        {/* Show historical info for expired tenancies */}
                        {isExpired && (
                          <Button
                            size="sm"
                            variant="default"
                            className="ml-1 text-xs"
                            disabled
                          >
                            Expired
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}

async function markAsFullyPaid(tenancyId: string, rentAmount: number) {
  if (!agencyId) return;

  const amount = rentAmount;
  const reference = `PAY-${Date.now().toString(36).toUpperCase()}`;

  setSaving(true);
  try {
    const paymentId = await recordPayment({
      agencyId,
      tenantId: "",
      reference,
      amount,
      method: "bank_transfer",
      notes: `Full payment for tenancy ${tenancyId}`,
    });

    toast.success(`Full payment of ${formatCurrency(amount)} recorded`);
    setSaving(false);
    void load();
  } catch (err) {
    toast.error("Failed to record payment");
    console.error(err);
    setSaving(false);
  }
}

async function openPartialPaymentModal(
  tenancyId: string,
  rentAmount: number,
  currentTotalPaid: number
) {
  const amount = window.prompt(
    `Enter partial payment amount (outstanding: ${rentAmount - currentTotalPaid})\nMaximum: ${rentAmount - currentTotalPaid}`
  );
  if (amount && Number.isFinite(Number(amount))) {
    const paymentAmount = Number(amount);
    if (paymentAmount > 0 && paymentAmount <= rentAmount - currentTotalPaid) {
      if (!agencyId) return;
      const reference = `PAY-${Date.now().toString(36).toUpperCase()}`;

      setSaving(true);
      try {
        const paymentId = await recordPayment({
          agencyId,
          tenantId: "",
          reference,
          amount: paymentAmount,
          method: "bank_transfer",
          notes: `Partial payment for tenancy ${tenancyId}`,
        });

        toast.success(
          `Partial payment of ${formatCurrency(paymentAmount)} recorded`
        );
        setSaving(false);
        void load();
      } catch (err) {
        toast.error("Failed to record payment");
        console.error(err);
        setSaving(false);
      }
    } else {
      toast.error("Payment amount exceeds outstanding balance");
    }
  }
}

function openEvict(tenancy: TenancyRecord) {
  toast.info("Evict tenant - would terminate tenancy and mark property as vacant");
}

function openRenew(tenancy: TenancyRecord) {
  toast.info("Renew tenancy - would create new term starting from expiry date");
}