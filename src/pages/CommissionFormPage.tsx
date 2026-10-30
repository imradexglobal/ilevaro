import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAgency, useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { EmptyState, Spinner } from "@/components/ui/States";
import {
  createCommissionDoc,
  queryAgencyCollection,
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

export function CommissionFormPage() {
  const { user, agencyId } = useAuth();
  const { agencyRole } = useAgency();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenancies, setTenancies] = useState<Tenancy[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [form, setForm] = useState({
    type: "management_fee",
    basis: "percentage",
    tenancyId: "",
    rate: "10",
    fixedAmount: "",
    period: new Date().toISOString().slice(0, 7),
  });

  const canWrite = WRITE_ROLES.includes(agencyRole ?? "");

  const load = useCallback(async () => {
    if (!agencyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [tenancyDocs, tenantDocs] = await Promise.all([
        queryAgencyCollection(agencyId, "tenancies"),
        queryAgencyCollection(agencyId, "tenants"),
      ]);
      const loadedTenancies = tenancyDocs as unknown as Tenancy[];
      setTenancies(loadedTenancies);
      setTenants(tenantDocs as unknown as Tenant[]);
      // Pre-select first tenancy
      if (loadedTenancies.length > 0) {
        setForm((prev) => ({ ...prev, tenancyId: loadedTenancies[0].id }));
      }
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

  const goBack = () => navigate("/commissions");

  const handleSubmit = async (e: React.FormEvent) => {
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
      navigate("/commissions");
    } catch (err) {
      toast.error("Failed to create commission");
      console.error(err);
    } finally {
      setSaving(false);
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

  if (!canWrite) {
    return (
      <Card className="p-8">
        <EmptyState
          title="You don't have permission to create commissions"
          message="Only owners, admins and property managers can create commissions."
          action={<Button onClick={goBack}>Back to commissions</Button>}
        />
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="p-8">
        <Spinner />
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={goBack}
            className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            ← Back to commissions
          </button>
          <h2 className="text-2xl font-bold text-slate-900">Create Commission</h2>
          <p className="mt-1 text-sm text-slate-500">
            Record an agency fee earned from a letting, renewal or management arrangement.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={goBack} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            Create Commission
          </Button>
        </div>
      </div>

      <Card title="Commission Details" subtitle="Select the type, basis and tenancy for this commission.">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          </div>

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
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={goBack} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          Create Commission
        </Button>
      </div>
    </form>
  );
}
