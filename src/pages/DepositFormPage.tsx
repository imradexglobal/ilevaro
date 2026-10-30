import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAgency, useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { EmptyState, Spinner } from "@/components/ui/States";
import {
  createDepositDoc,
  queryAgencyCollection,
} from "@/lib/firestore";
import type { Tenancy, Tenant } from "@/lib/types";
import { formatCurrency } from "@/lib/format";

const MANAGE_ROLES = ["agency_owner", "agency_admin", "accountant", "platform_admin"];

export function DepositFormPage() {
  const { user, agencyId } = useAuth();
  const { agencyRole } = useAgency();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenancies, setTenancies] = useState<Tenancy[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [form, setForm] = useState({
    tenancyId: "",
    amountReceived: "",
    receivedDate: new Date().toISOString().slice(0, 10),
  });

  const canManage = MANAGE_ROLES.includes(agencyRole ?? "");

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

  const goBack = () => navigate("/deposits");

  const handleSubmit = async (e: React.FormEvent) => {
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
      navigate("/deposits");
    } catch (err) {
      toast.error("Failed to record deposit");
      console.error(err);
    } finally {
      setSaving(false);
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

  if (!canManage) {
    return (
      <Card className="p-8">
        <EmptyState
          title="You don't have permission to record deposits"
          message="Only owners, admins and accountants can record deposits."
          action={<Button onClick={goBack}>Back to deposits</Button>}
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
            ← Back to deposits
          </button>
          <h2 className="text-2xl font-bold text-slate-900">Record Deposit</h2>
          <p className="mt-1 text-sm text-slate-500">
            Record a security deposit received from a tenant.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={goBack} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            Record Deposit
          </Button>
        </div>
      </div>

      <Card title="Deposit Details" subtitle="Link the deposit to a tenancy and enter the amount received.">
        <div className="space-y-4">
          {tenancies.length === 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
              No tenancies exist yet.{" "}
              <button
                type="button"
                className="font-medium underline"
                onClick={() => navigate("/tenancies/new")}
              >
                Create a tenancy first
              </button>{" "}
              before recording a deposit.
            </div>
          ) : (
            <Select
              label="Tenancy"
              required
              value={form.tenancyId}
              onChange={(e) => setForm({ ...form, tenancyId: e.target.value })}
              options={[
                { value: "", label: "Select tenancy" },
                ...tenancies.map((t) => ({
                  value: t.id,
                  label: `${tenancyLabel(t.id)} — rent ${formatCurrency(t.rentAmount || 0)}`,
                })),
              ]}
            />
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={goBack} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          Record Deposit
        </Button>
      </div>
    </form>
  );
}
