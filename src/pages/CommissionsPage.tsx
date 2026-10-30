import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAgency, useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Card, StatCard } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, Spinner } from "@/components/ui/States";
import {
  createCommissionDoc,
  queryAgencyCollection,
  updateCommissionDoc,
  type Commission,
} from "@/lib/firestore";
import type { Tenancy, Tenant } from "@/lib/types";
import { formatCurrency } from "@/lib/format";

const WRITE_ROLES = ["agency_owner", "agency_admin", "property_manager", "platform_admin"];

const COMMISSION_TYPES = ["management_fee", "letting_commission", "renewal_fee", "other"];

const commissionTypeLabels: Record<string, string> = {
  management_fee: "Management Fee",
  letting_commission: "Letting Commission",
  renewal_fee: "Renewal Fee",
  other: "Other",
};

const basisLabels: Record<string, string> = {
  percentage: "Percentage of rent",
  fixed: "Fixed amount",
};

const statusVariant: Record<string, "info" | "warning" | "success"> = {
  calculated: "info",
  approved: "warning",
  paid: "success",
};

export function CommissionsPage() {
  const { user, agencyId } = useAuth();
  const { agencyRole } = useAgency();
  const navigate = useNavigate();
  const toast = useToast();

  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [tenancies, setTenancies] = useState<Tenancy[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: "management_fee",
    basis: "percentage",
    tenancyId: "",
    rate: "",
    fixedAmount: "",
    period: new Date().toISOString().slice(0, 7),
  });

  const canWrite = WRITE_ROLES.includes(agencyRole ?? "");

  const load = useCallback(async () => {
    if (!agencyId) {
      setCommissions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [commissionDocs, tenancyDocs, tenantDocs] = await Promise.all([
        queryAgencyCollection(agencyId, "commissions"),
        queryAgencyCollection(agencyId, "tenancies"),
        queryAgencyCollection(agencyId, "tenants"),
      ]);
      setCommissions(commissionDocs as unknown as Commission[]);
      setTenancies(tenancyDocs as unknown as Tenancy[]);
      setTenants(tenantDocs as unknown as Tenant[]);
    } catch (err) {
      toast.error("Failed to load commissions");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [agencyId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const tenancyLabel = useCallback(
    (tenancyId?: string) => {
      if (!tenancyId) return "-";
      const tenancy = tenancies.find((t) => t.id === tenancyId);
      if (!tenancy) return tenancyId;
      const tenant = tenants.find((t) => t.id === tenancy.tenantId);
      return tenant ? `${tenant.firstName} ${tenant.lastName}`.trim() : "Unknown tenant";
    },
    [tenancies, tenants]
  );

  const selectedTenancyRent = useMemo(() => {
    const tenancy = tenancies.find((t) => t.id === form.tenancyId);
    return tenancy?.rentAmount ?? 0;
  }, [tenancies, form.tenancyId]);

  const previewAmount = useMemo(() => {
    if (form.basis === "fixed") return Number(form.fixedAmount) || 0;
    return (selectedTenancyRent * (Number(form.rate) || 0)) / 100;
  }, [form.basis, form.fixedAmount, form.rate, selectedTenancyRent]);

  const totals = useMemo(() => {
    const byStatus = (status: string) =>
      commissions
        .filter((c) => c.status === status)
        .reduce((sum, c) => sum + (c.calculatedAmount || 0), 0);
    return {
      total: commissions.reduce((sum, c) => sum + (c.calculatedAmount || 0), 0),
      approved: byStatus("approved"),
      paid: byStatus("paid"),
    };
  }, [commissions]);

  const filtered = commissions.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (commissionTypeLabels[c.type] || c.type || "").toLowerCase().includes(q) ||
      tenancyLabel(c.tenancyId).toLowerCase().includes(q) ||
      (c.period || "").toLowerCase().includes(q) ||
      (c.status || "").toLowerCase().includes(q)
    );
  });

  const openCreate = () => {
    setForm({
      type: "management_fee",
      basis: "percentage",
      tenancyId: tenancies[0]?.id ?? "",
      rate: "10",
      fixedAmount: "",
      period: new Date().toISOString().slice(0, 7),
    });
    setFormOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyId) return;
    if (form.basis === "percentage" && !form.tenancyId) {
      toast.error("Select a tenancy to calculate a percentage commission");
      return;
    }
    if (previewAmount <= 0) {
      toast.error("Commission amount must be greater than zero");
      return;
    }
    setSaving(true);
    try {
      await createCommissionDoc(agencyId, crypto.randomUUID(), {
        agencyId,
        tenancyId: form.tenancyId || undefined,
        type: form.type,
        basis: form.basis,
        rate: form.basis === "percentage" ? Number(form.rate) || 0 : undefined,
        fixedAmount: form.basis === "fixed" ? Number(form.fixedAmount) || 0 : undefined,
        calculatedAmount: previewAmount,
        period: form.period,
        status: "calculated",
      });
      toast.success("Commission created");
      setFormOpen(false);
      await load();
    } catch (err) {
      toast.error("Failed to create commission");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (commission: Commission, status: "approved" | "paid") => {
    if (!agencyId) return;
    try {
      await updateCommissionDoc(agencyId, commission.id, { status });
      toast.success(`Commission marked ${status}`);
      await load();
    } catch (err) {
      toast.error("Failed to update commission");
      console.error(err);
    }
  };

  if (!user) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-xl font-bold text-slate-900">Sign in to manage commissions</h2>
        <p className="mt-2 text-slate-500">Please sign in to access commission management.</p>
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
          message="Create your agency before tracking commissions."
          action={<Button onClick={() => navigate("/agency-profile")}>Create agency</Button>}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Commissions</h2>
          <p className="mt-1 text-sm text-slate-500">
            Agency fees earned from lettings, renewals and management.
          </p>
        </div>
        {canWrite && (
          <Button variant="primary" onClick={openCreate}>
            + Create Commission
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Commission" value={formatCurrency(totals.total)} />
        <StatCard label="Approved" value={formatCurrency(totals.approved)} />
        <StatCard label="Paid" value={formatCurrency(totals.paid)} />
      </div>

      <Card className="p-4">
        <Input
          placeholder="Search commissions..."
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
            title={commissions.length === 0 ? "No commissions yet" : "No matches"}
            message={
              commissions.length === 0
                ? "Create a commission to bill your agency fee."
                : "Try a different search term."
            }
            action={canWrite ? <Button onClick={openCreate}>+ Create Commission</Button> : undefined}
          />
        </Card>
      ) : (
        <Card className="p-0">
          <Table>
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Type</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Tenant</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Basis</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Period</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Amount</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Status</th>
                {canWrite && (
                  <th className="text-right text-xs font-medium text-slate-500 px-6 py-3">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((com) => (
                <tr key={com.id} className="border-b hover:bg-slate-50">
                  <td className="text-xs font-medium text-slate-700 px-6 py-3">
                    {commissionTypeLabels[com.type] || com.type}
                  </td>
                  <td className="text-xs text-slate-700 px-6 py-3">
                    {tenancyLabel(com.tenancyId)}
                  </td>
                  <td className="text-xs text-slate-700 px-6 py-3">
                    {com.basis === "fixed"
                      ? `Fixed ${formatCurrency(com.fixedAmount || 0)}`
                      : `${com.rate ?? 0}%`}
                  </td>
                  <td className="text-xs text-slate-700 px-6 py-3">{com.period || "-"}</td>
                  <td className="text-xs text-slate-700 px-6 py-3">
                    {formatCurrency(com.calculatedAmount || 0)}
                  </td>
                  <td className="text-xs px-6 py-3">
                    <Badge variant={statusVariant[com.status] ?? "default"}>{com.status}</Badge>
                  </td>
                  {canWrite && (
                    <td className="text-right px-6 py-3 whitespace-nowrap">
                      {com.status === "calculated" && (
                        <Button size="sm" variant="outline" onClick={() => setStatus(com, "approved")}>
                          Approve
                        </Button>
                      )}
                      {com.status === "approved" && (
                        <Button size="sm" variant="success" onClick={() => setStatus(com, "paid")}>
                          Mark Paid
                        </Button>
                      )}
                      {com.status === "paid" && (
                        <span className="text-xs text-slate-400">Settled</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Create Commission"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} onClick={handleCreate}>
              Create Commission
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Select
            label="Commission Type"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            options={COMMISSION_TYPES.map((t) => ({ value: t, label: commissionTypeLabels[t] }))}
          />
          <Select
            label="Basis"
            value={form.basis}
            onChange={(e) => setForm({ ...form, basis: e.target.value })}
            options={Object.entries(basisLabels).map(([value, label]) => ({ value, label }))}
          />
          <Select
            label="Tenancy"
            value={form.tenancyId}
            onChange={(e) => setForm({ ...form, tenancyId: e.target.value })}
            options={[
              { value: "", label: tenancies.length ? "Not linked to a tenancy" : "No tenancies available" },
              ...tenancies.map((t) => ({
                value: t.id,
                label: `${tenancyLabel(t.id)} — rent ${formatCurrency(t.rentAmount || 0)}`,
              })),
            ]}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {form.basis === "percentage" ? (
              <Input
                label="Rate (%)"
                type="number"
                value={form.rate}
                onChange={(e) => setForm({ ...form, rate: e.target.value })}
                placeholder="e.g. 10"
              />
            ) : (
              <Input
                label="Fixed Amount (₦)"
                type="number"
                value={form.fixedAmount}
                onChange={(e) => setForm({ ...form, fixedAmount: e.target.value })}
                placeholder="e.g. 150000"
              />
            )}
            <Input
              label="Period"
              type="month"
              value={form.period}
              onChange={(e) => setForm({ ...form, period: e.target.value })}
            />
          </div>
          <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Calculated amount:{" "}
            <span className="font-semibold text-slate-900">{formatCurrency(previewAmount)}</span>
          </div>
          <button type="submit" className="hidden" aria-hidden="true" />
        </form>
      </Modal>
    </div>
  );
}
