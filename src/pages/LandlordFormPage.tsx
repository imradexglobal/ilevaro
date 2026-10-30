import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAgency, useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { EmptyState, Spinner } from "@/components/ui/States";
import {
  createOwnerDoc,
  getAgencyDoc,
  updateOwnerDoc,
} from "@/lib/firestore";
import type { Owner } from "@/lib/types";

const MANAGE_ROLES = ["agency_owner", "agency_admin", "platform_admin"];

interface OwnerForm {
  fullName: string;
  businessName: string;
  email: string;
  phone: string;
  address: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
}

const emptyForm: OwnerForm = {
  fullName: "",
  businessName: "",
  email: "",
  phone: "",
  address: "",
  bankName: "",
  bankAccountNumber: "",
  bankAccountName: "",
};

type Tab = "details" | "banking";

const TABS: { id: Tab; label: string; subtitle: string }[] = [
  {
    id: "details",
    label: "Contact Details",
    subtitle: "Name, phone, email and postal address of the landlord.",
  },
  {
    id: "banking",
    label: "Bank Account",
    subtitle: "Payout bank account for remittances to this landlord.",
  },
];

export function LandlordFormPage() {
  const { landlordId } = useParams<{ landlordId: string }>();
  const isEdit = Boolean(landlordId);
  const { user, agencyId } = useAuth();
  const { agencyRole } = useAgency();
  const navigate = useNavigate();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("details");
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<OwnerForm>(emptyForm);

  const canManage = MANAGE_ROLES.includes(agencyRole ?? "");

  const load = useCallback(async () => {
    if (!agencyId || !landlordId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const doc = await getAgencyDoc(agencyId, "owners", landlordId);
      if (!doc) {
        toast.error("Landlord not found");
        navigate("/landlords", { replace: true });
        return;
      }
      const owner = doc as unknown as Owner;
      setForm({
        fullName: owner.fullName ?? "",
        businessName: owner.businessName ?? "",
        email: owner.email ?? "",
        phone: owner.phone ?? "",
        address: owner.address ?? "",
        bankName: owner.bankName ?? "",
        bankAccountNumber: owner.bankAccountNumber ?? "",
        bankAccountName: owner.bankAccountName ?? "",
      });
    } catch (err) {
      toast.error("Failed to load landlord");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [agencyId, landlordId, navigate, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const goBack = () => navigate("/landlords");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyId) {
      toast.error("No agency linked to this account");
      return;
    }
    if (!form.fullName.trim() || !form.phone.trim()) {
      setTab("details");
      toast.error("Name and phone are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        agencyId,
        fullName: form.fullName.trim(),
        businessName: form.businessName.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim(),
        address: form.address.trim() || undefined,
        bankName: form.bankName.trim() || undefined,
        bankAccountNumber: form.bankAccountNumber.trim() || undefined,
        bankAccountName: form.bankAccountName.trim() || undefined,
        status: "active" as const,
      };

      if (isEdit && landlordId) {
        await updateOwnerDoc(agencyId, landlordId, payload);
        toast.success("Landlord updated");
      } else {
        await createOwnerDoc(agencyId, crypto.randomUUID(), payload);
        toast.success("Landlord added");
      }
      navigate("/landlords");
    } catch (err) {
      toast.error("Failed to save landlord");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-xl font-bold text-slate-900">Sign in to manage landlords</h2>
        <p className="mt-2 text-slate-500">Please sign in to access landlord records.</p>
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
          message="Create your agency before adding landlords."
          action={<Button onClick={() => navigate("/agency-profile")}>Create agency</Button>}
        />
      </Card>
    );
  }

  if (!canManage) {
    return (
      <Card className="p-8">
        <EmptyState
          title="You don't have permission to manage landlords"
          message="Only owners and admins can add or edit landlords."
          action={<Button onClick={goBack}>Back to landlords</Button>}
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

  const activeTab = TABS.find((t) => t.id === tab)!;
  const saveLabel = isEdit ? "Save Changes" : "Add Landlord";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={goBack}
            className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            ← Back to landlords
          </button>
          <h2 className="text-2xl font-bold text-slate-900">
            {isEdit ? "Edit Landlord" : "Add Landlord"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {isEdit
              ? "Update the landlord's contact and banking details."
              : "Register a property owner with their contact and payout details."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={goBack} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            {saveLabel}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`px-4 py-2 text-sm font-medium ${
              tab === t.id
                ? "border-b-2 border-indigo-600 text-indigo-600"
                : "text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card title={activeTab.label} subtitle={activeTab.subtitle}>
        {tab === "details" && (
          <div className="space-y-4">
            <Input
              label="Full Name"
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              placeholder="e.g. Chief Chukwuemeka"
            />
            <Input
              label="Business Name (optional)"
              value={form.businessName}
              onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              placeholder="e.g. Chukwuemeka Properties"
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Phone"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="e.g. +234-801-234-5678"
              />
              <Input
                label="Email (optional)"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="owner@example.com"
              />
            </div>
            <Input
              label="Address (optional)"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="e.g. 12 Marina Road, Lagos"
            />
          </div>
        )}

        {tab === "banking" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Bank Name (optional)"
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                placeholder="e.g. First Bank of Nigeria"
              />
              <Input
                label="Bank Account Number (optional)"
                value={form.bankAccountNumber}
                onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })}
                placeholder="e.g. 0012345678"
              />
            </div>
            <Input
              label="Bank Account Name (optional)"
              value={form.bankAccountName}
              onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })}
              placeholder="e.g. Chukwuemeka Properties Ltd"
            />
          </div>
        )}
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={goBack} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          {saveLabel}
        </Button>
      </div>
    </form>
  );
}
