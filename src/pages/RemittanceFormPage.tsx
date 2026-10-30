import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAgency, useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { EmptyState, Spinner } from "@/components/ui/States";
import {
  createRemittanceDoc,
  queryAgencyCollection,
} from "@/lib/firestore";
import type { Owner, Remittance } from "@/lib/types";
import { generateReference } from "@/lib/format";

const WRITE_ROLES = ["agency_owner", "agency_admin", "accountant", "platform_admin"];

const METHODS: { value: Remittance["method"]; label: string }[] = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "check", label: "Cheque" },
  { value: "other", label: "Other" },
];

export function RemittanceFormPage() {
  const { user, agencyId } = useAuth();
  const { agencyRole } = useAgency();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [form, setForm] = useState({
    ownerId: "",
    amount: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    method: "bank_transfer" as Remittance["method"],
    reference: "",
    period: new Date().toISOString().slice(0, 7),
    notes: "",
  });

  const canWrite = WRITE_ROLES.includes(agencyRole ?? "");

  const load = useCallback(async () => {
    if (!agencyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const ownerDocs = await queryAgencyCollection(agencyId, "owners");
      setOwners(ownerDocs as unknown as Owner[]);
    } catch (err) {
      toast.error("Failed to load landlords");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [agencyId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const goBack = () => navigate("/remittances");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyId || !user) return;
    if (!form.ownerId) {
      toast.error("Select the landlord receiving the remittance");
      return;
    }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSaving(true);
    try {
      await createRemittanceDoc(agencyId, crypto.randomUUID(), {
        agencyId,
        ownerId: form.ownerId,
        amount,
        paymentDate: form.paymentDate ? new Date(form.paymentDate) : new Date(),
        method: form.method,
        reference: form.reference.trim() || generateReference("REM"),
        period: form.period,
        notes: form.notes.trim() || undefined,
        recordedBy: user.uid,
      });
      toast.success("Remittance recorded");
      navigate("/remittances");
    } catch (err) {
      toast.error("Failed to record remittance");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-xl font-bold text-slate-900">Sign in to view remittances</h2>
        <p className="mt-2 text-slate-500">Please sign in to access remittances.</p>
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
          message="Create your agency to record remittances."
          action={<Button onClick={() => navigate("/agency-profile")}>Create agency</Button>}
        />
      </Card>
    );
  }

  if (!canWrite) {
    return (
      <Card className="p-8">
        <EmptyState
          title="You don't have permission to record remittances"
          message="Only owners, admins and accountants can record remittances."
          action={<Button onClick={goBack}>Back to remittances</Button>}
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
            ← Back to remittances
          </button>
          <h2 className="text-2xl font-bold text-slate-900">Record Remittance</h2>
          <p className="mt-1 text-sm text-slate-500">
            Record a rent disbursement paid out to a landlord.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={goBack} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            Record Remittance
          </Button>
        </div>
      </div>

      <Card title="Remittance Details" subtitle="Select the landlord, enter the amount and payment method.">
        <div className="space-y-4">
          {owners.length === 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
              No landlords recorded yet.{" "}
              <button
                type="button"
                className="font-medium underline"
                onClick={() => navigate("/landlords/new")}
              >
                Add a landlord first
              </button>
              .
            </div>
          ) : (
            <Select
              label="Landlord"
              required
              value={form.ownerId}
              onChange={(e) => setForm({ ...form, ownerId: e.target.value })}
              options={[
                { value: "", label: "Select landlord" },
                ...owners.map((o) => ({
                  value: o.id,
                  label: o.businessName?.trim() || o.fullName || o.id,
                })),
              ]}
            />
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Amount (₦)"
              type="number"
              required
              min="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="e.g. 450000"
            />
            <Input
              label="Payment Date"
              type="date"
              required
              value={form.paymentDate}
              onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Method"
              value={form.method}
              onChange={(e) =>
                setForm({ ...form, method: e.target.value as Remittance["method"] })
              }
              options={METHODS}
            />
            <Input
              label="Period"
              type="month"
              value={form.period}
              onChange={(e) => setForm({ ...form, period: e.target.value })}
            />
          </div>

          <Input
            label="Reference (optional)"
            value={form.reference}
            onChange={(e) => setForm({ ...form, reference: e.target.value })}
            placeholder="Auto-generated if left blank"
          />

          <Textarea
            label="Notes (optional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="e.g. Net of 10% management fee"
          />
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={goBack} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          Record Remittance
        </Button>
      </div>
    </form>
  );
}
