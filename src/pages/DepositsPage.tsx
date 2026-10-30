import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAgency, useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Card, StatCard } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { EmptyState, Spinner } from "@/components/ui/States";
import {
  createDepositDoc,
  queryAgencyCollection,
  updateDepositDoc,
  type Deposit,
} from "@/lib/firestore";
import type { Tenancy, Tenant } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/format";

const MANAGE_ROLES = ["agency_owner", "agency_admin", "accountant", "platform_admin"];

const statusVariant: Record<string, "success" | "warning" | "info" | "default"> = {
  held: "info",
  partially_refunded: "warning",
  refunded: "success",
};

export function DepositsPage() {
  const { user, agencyId } = useAuth();
  const { agencyRole } = useAgency();
  const navigate = useNavigate();
  const toast = useToast();

  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [tenancies, setTenancies] = useState<Tenancy[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ tenancyId: "", amountReceived: "", receivedDate: "" });
  const [saving, setSaving] = useState(false);
  const [refundTarget, setRefundTarget] = useState<Deposit | null>(null);
  const [working, setWorking] = useState(false);

  const canManage = MANAGE_ROLES.includes(agencyRole ?? "");

  const load = useCallback(async () => {
    if (!agencyId) {
      setDeposits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [depositDocs, tenancyDocs, tenantDocs] = await Promise.all([
        queryAgencyCollection(agencyId, "deposits"),
        queryAgencyCollection(agencyId, "tenancies"),
        queryAgencyCollection(agencyId, "tenants"),
      ]);
      setDeposits(depositDocs as unknown as Deposit[]);
      setTenancies(tenancyDocs as unknown as Tenancy[]);
      setTenants(tenantDocs as unknown as Tenant[]);
    } catch (err) {
      toast.error("Failed to load deposits");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [agencyId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const tenancyLabel = useCallback(
    (tenancyId: string) => {
      const tenancy = tenancies.find((t) => t.id === tenancyId);
      if (!tenancy) return tenancyId || "-";
      const tenant = tenants.find((t) => t.id === tenancy.tenantId);
      const name = tenant ? `${tenant.firstName} ${tenant.lastName}`.trim() : "Unknown tenant";
      return name;
    },
    [tenancies, tenants]
  );

  const totals = useMemo(() => {
    const held = deposits.reduce((sum, d) => {
      if (d.status === "refunded") return sum;
      const deductions = (d.deductions ?? []).reduce((s, x) => s + (x.amount || 0), 0);
      return sum + Math.max(0, (d.amountReceived || 0) - deductions - (d.amountRefunded || 0));
    }, 0);
    const received = deposits.reduce((sum, d) => sum + (d.amountReceived || 0), 0);
    const refunded = deposits.reduce((sum, d) => sum + (d.amountRefunded || 0), 0);
    return { held, received, refunded };
  }, [deposits]);

  const filtered = deposits.filter((d) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      tenancyLabel(d.tenancyId).toLowerCase().includes(q) ||
      (d.status || "").toLowerCase().includes(q)
    );
  });

  const openRecord = () => {
    setForm({
      tenancyId: tenancies[0]?.id ?? "",
      amountReceived: "",
      receivedDate: new Date().toISOString().slice(0, 10),
    });
    setFormOpen(true);
  };

  const handleRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyId) return;
    if (!form.tenancyId || !form.amountReceived) {
      toast.error("Select a tenancy and enter the amount received");
      return;
    }
    setSaving(true);
    try {
      const tenancy = tenancies.find((t) => t.id === form.tenancyId);
      const amount = Number(form.amountReceived);
      await createDepositDoc(agencyId, crypto.randomUUID(), {
        agencyId,
        tenancyId: form.tenancyId,
        tenantId: tenancy?.tenantId ?? "",
        amountReceived: amount,
        receivedDate: form.receivedDate ? new Date(form.receivedDate) : new Date(),
        amountHeld: amount,
        deductions: [],
        amountRefunded: 0,
        status: "held",
      });
      toast.success("Deposit recorded");
      setFormOpen(false);
      await load();
    } catch (err) {
      toast.error("Failed to record deposit");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleRefund = async () => {
    if (!agencyId || !refundTarget) return;
    setWorking(true);
    try {
      const deductions = (refundTarget.deductions ?? []).reduce(
        (sum, d) => sum + (d.amount || 0),
        0
      );
      const refundable = Math.max(
        0,
        (refundTarget.amountReceived || 0) - deductions - (refundTarget.amountRefunded || 0)
      );
      const totalRefunded = (refundTarget.amountRefunded || 0) + refundable;
      await updateDepositDoc(agencyId, refundTarget.id, {
        amountRefunded: totalRefunded,
        amountHeld: Math.max(0, (refundTarget.amountHeld || 0) - refundable),
        status: totalRefunded >= (refundTarget.amountReceived || 0) ? "refunded" : "partially_refunded",
      });
      toast.success("Deposit refunded");
      setRefundTarget(null);
      await load();
    } catch (err) {
      toast.error("Failed to refund deposit");
      console.error(err);
    } finally {
      setWorking(false);
    }
  };

  if (!user) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-xl font-bold text-slate-900">Sign in to manage deposits</h2>
        <p className="mt-2 text-slate-500">Please sign in to access deposit management.</p>
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
          message="Create your agency before recording deposits."
          action={<Button onClick={() => navigate("/agency-profile")}>Create agency</Button>}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Deposits</h2>
          <p className="mt-1 text-sm text-slate-500">
            Security deposits received, held and refunded per tenancy.
          </p>
        </div>
        {canManage && (
          <Button variant="primary" onClick={openRecord}>
            + Record Deposit
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Received" value={formatCurrency(totals.received)} />
        <StatCard label="Currently Held" value={formatCurrency(totals.held)} />
        <StatCard label="Total Refunded" value={formatCurrency(totals.refunded)} />
      </div>

      <Card className="p-4">
        <Input
          placeholder="Search deposits by tenant or status..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full"
        />
      </Card>

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title={deposits.length === 0 ? "No deposits yet" : "No matches"}
            message={
              deposits.length === 0
                ? "Record a deposit when a tenant pays their security deposit."
                : "Try a different search term."
            }
            action={canManage ? <Button onClick={openRecord}>+ Record Deposit</Button> : undefined}
          />
        </Card>
      ) : (
        <Card className="p-0">
          <Table>
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Tenant</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Received</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Amount</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Deductions</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Refunded</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Status</th>
                {canManage && (
                  <th className="text-right text-xs font-medium text-slate-500 px-6 py-3">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((deposit) => {
                const deductions = (deposit.deductions ?? []).reduce(
                  (sum, d) => sum + (d.amount || 0),
                  0
                );
                return (
                  <tr key={deposit.id} className="border-b hover:bg-slate-50">
                    <td className="text-xs font-medium text-slate-700 px-6 py-3">
                      {tenancyLabel(deposit.tenancyId)}
                    </td>
                    <td className="text-xs text-slate-700 px-6 py-3">
                      {deposit.receivedDate ? formatDate(deposit.receivedDate) : "-"}
                    </td>
                    <td className="text-xs text-slate-700 px-6 py-3">
                      {formatCurrency(deposit.amountReceived || 0)}
                    </td>
                    <td className="text-xs text-slate-700 px-6 py-3">
                      {formatCurrency(deductions)}
                    </td>
                    <td className="text-xs text-slate-700 px-6 py-3">
                      {formatCurrency(deposit.amountRefunded || 0)}
                    </td>
                    <td className="text-xs px-6 py-3">
                      <Badge variant={statusVariant[deposit.status] ?? "default"}>
                        {(deposit.status || "").replace(/_/g, " ")}
                      </Badge>
                    </td>
                    {canManage && (
                      <td className="text-right px-6 py-3">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={deposit.status === "refunded"}
                          onClick={() => setRefundTarget(deposit)}
                        >
                          Refund
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Record Deposit"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} onClick={handleRecord}>
              Record Deposit
            </Button>
          </>
        }
      >
        <form onSubmit={handleRecord} className="space-y-4">
          <Select
            label="Tenancy"
            required
            value={form.tenancyId}
            onChange={(e) => setForm({ ...form, tenancyId: e.target.value })}
            options={[
              { value: "", label: tenancies.length ? "Select tenancy" : "No tenancies available" },
              ...tenancies.map((t) => ({
                value: t.id,
                label: `${tenancyLabel(t.id)} — rent ${formatCurrency(t.rentAmount || 0)}`,
              })),
            ]}
          />
          <Input
            label="Amount Received (₦)"
            type="number"
            required
            value={form.amountReceived}
            onChange={(e) => setForm({ ...form, amountReceived: e.target.value })}
            placeholder="e.g. 500000"
          />
          <Input
            label="Date Received"
            type="date"
            value={form.receivedDate}
            onChange={(e) => setForm({ ...form, receivedDate: e.target.value })}
          />
          <button type="submit" className="hidden" aria-hidden="true" />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!refundTarget}
        title="Refund deposit"
        message="Release the remaining held amount for this tenancy back to the tenant? This records the deposit as fully refunded."
        confirmLabel="Refund"
        loading={working}
        onConfirm={handleRefund}
        onCancel={() => setRefundTarget(null)}
      />
    </div>
  );
}
