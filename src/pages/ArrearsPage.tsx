import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, StatCard } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, Spinner } from "@/components/ui/States";
import { calculateChargeStatus, queryAgencyCollection } from "@/lib/firestore";
import { createNotification } from "@/lib/notifications";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Tenant } from "@/lib/types";

interface RentChargeRecord {
  id: string;
  tenancyId: string;
  reference: string;
  amountDue: number;
  amountPaid: number;
  outstanding: number;
  dueDate?: { toDate: () => Date };
  gracePeriodDays?: number;
  status: string;
}

interface TenancyRecord {
  id: string;
  tenantId: string;
  dueDay?: number;
}

export function ArrearsPage() {
  const { user, agencyId } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [charges, setCharges] = useState<RentChargeRecord[]>([]);
  const [tenancies, setTenancies] = useState<TenancyRecord[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showOverdueOnly, setShowOverdueOnly] = useState(true);
  const [reminding, setReminding] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!agencyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [chargeDocs, tenancyDocs, tenantDocs] = await Promise.all([
        queryAgencyCollection(agencyId, "rent_charges"),
        queryAgencyCollection(agencyId, "tenancies"),
        queryAgencyCollection(agencyId, "tenants"),
      ]);
      setCharges(chargeDocs as unknown as RentChargeRecord[]);
      setTenancies(tenancyDocs as unknown as TenancyRecord[]);
      setTenants(tenantDocs as unknown as Tenant[]);
    } catch (err) {
      toast.error("Failed to load arrears");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [agencyId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const tenantName = useCallback(
    (tenancyId: string) => {
      const tenancy = tenancies.find((t) => t.id === tenancyId);
      if (!tenancy) return "Unknown tenancy";
      const tenant = tenants.find((t) => t.id === tenancy.tenantId);
      return tenant ? `${tenant.firstName} ${tenant.lastName}`.trim() : "Unknown tenant";
    },
    [tenancies, tenants]
  );

  const rows = useMemo(() => {
    const now = new Date();
    return charges
      .filter((c) => (c.outstanding ?? 0) > 0)
      .map((c) => {
        const dueDate = c.dueDate ? c.dueDate.toDate() : new Date();
        const grace = c.gracePeriodDays ?? 7;
        const computed = calculateChargeStatus(
          dueDate,
          c.amountDue,
          c.amountPaid,
          grace
        );
        const daysOverdue = Math.max(
          0,
          Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        );
        return {
          ...c,
          dueDateObj: dueDate,
          computedStatus: computed,
          daysOverdue,
          isOverdue: computed === "overdue",
        };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [charges]);

  const filtered = rows.filter((r) => {
    if (showOverdueOnly && !r.isOverdue) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      r.reference?.toLowerCase().includes(q) ||
      tenantName(r.tenancyId).toLowerCase().includes(q)
    );
  });

  const totalOutstanding = rows.reduce((sum, r) => sum + (r.outstanding ?? 0), 0);
  const totalOverdue = rows
    .filter((r) => r.isOverdue)
    .reduce((sum, r) => sum + (r.outstanding ?? 0), 0);

  const handleRemind = async (row: (typeof rows)[number]) => {
    if (!agencyId) return;
    setReminding(row.id);
    try {
      await createNotification(agencyId, {
        type: "rent_due",
        title: "Rent arrears reminder",
        message: `Outstanding ${formatCurrency(row.outstanding)} for charge ${row.reference} (${tenantName(
          row.tenancyId
        )}).`,
        severity: "urgent",
        agencyId,
        actionUrl: "/arrears",
      });
      toast.success("Reminder created");
    } catch (err) {
      toast.error("Failed to create reminder");
      console.error(err);
    } finally {
      setReminding(null);
    }
  };

  if (!user) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-xl font-bold text-slate-900">Sign in to view arrears</h2>
        <p className="mt-2 text-slate-500">Please sign in to access arrears tracking.</p>
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
          message="Create your agency to start tracking arrears."
          action={<Button onClick={() => navigate("/agency-profile")}>Create agency</Button>}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Arrears</h2>
        <p className="mt-1 text-sm text-slate-500">
          Outstanding and overdue rent derived from rent charges.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Outstanding" value={formatCurrency(totalOutstanding)} />
        <StatCard label="Overdue" value={formatCurrency(totalOverdue)} />
        <StatCard label="Accounts in Arrears" value={String(rows.filter((r) => r.isOverdue).length)} />
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder="Search by charge reference or tenant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full"
          />
          <Button
            variant={showOverdueOnly ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowOverdueOnly((v) => !v)}
          >
            {showOverdueOnly ? "Showing: Overdue" : "Showing: All Outstanding"}
          </Button>
        </div>
      </Card>

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title="No arrears"
            message={
              rows.length === 0
                ? "There are no outstanding rent charges right now."
                : "No charges match the current filter."
            }
          />
        </Card>
      ) : (
        <Card className="p-0">
          <Table>
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Charge</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Tenant</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Due Date</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Outstanding</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Days Overdue</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Status</th>
                <th className="text-right text-xs font-medium text-slate-500 px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b hover:bg-slate-50">
                  <td className="text-xs px-6 py-3 font-medium text-slate-700">{row.reference}</td>
                  <td className="text-xs px-6 py-3 text-slate-700">{tenantName(row.tenancyId)}</td>
                  <td className="text-xs px-6 py-3 text-slate-700">{formatDate(row.dueDateObj)}</td>
                  <td className="text-xs px-6 py-3 text-slate-700">
                    {formatCurrency(row.outstanding)}
                  </td>
                  <td className="text-xs px-6 py-3 text-slate-700">
                    {row.isOverdue ? row.daysOverdue : "-"}
                  </td>
                  <td className="text-xs px-6 py-3">
                    <Badge variant={row.isOverdue ? "danger" : "warning"}>
                      {row.isOverdue ? "Overdue" : row.computedStatus.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="text-right px-6 py-3 whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="outline"
                      loading={reminding === row.id}
                      onClick={() => handleRemind(row)}
                    >
                      Send Reminder
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      className="ml-2"
                      onClick={() => navigate("/payments")}
                    >
                      Record Payment
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
