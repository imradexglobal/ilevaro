import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAgency, useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { EmptyState, Spinner } from "@/components/ui/States";
import {
  createTenantDoc,
  getAgencyDoc,
  updateAgencyDoc,
} from "@/lib/firestore";
import type { Tenant } from "@/lib/types";

const MANAGE_ROLES = ["agency_owner", "agency_admin", "property_manager", "platform_admin"];

const TENANT_STATUSES: { value: Tenant["status"]; label: string }[] = [
  { value: "prospect", label: "Prospect" },
  { value: "active", label: "Active" },
  { value: "former", label: "Former" },
  { value: "blacklisted", label: "Blacklisted" },
];

interface TenantForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  status: Tenant["status"];
}

const emptyForm: TenantForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  status: "prospect",
};

type Tab = "profile" | "emergency";

const TABS: { id: Tab; label: string; subtitle: string }[] = [
  {
    id: "profile",
    label: "Tenant Profile",
    subtitle: "Name, contact details, address and current status.",
  },
  {
    id: "emergency",
    label: "Emergency Contact",
    subtitle: "A person to contact in case of emergency.",
  },
];

export function TenantFormPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const isEdit = Boolean(tenantId);
  const { user, agencyId } = useAuth();
  const { agencyRole } = useAgency();
  const navigate = useNavigate();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("profile");
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TenantForm>(emptyForm);

  const canManage = MANAGE_ROLES.includes(agencyRole ?? "");

  const load = useCallback(async () => {
    if (!agencyId || !tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const doc = await getAgencyDoc(agencyId, "tenants", tenantId);
      if (!doc) {
        toast.error("Tenant not found");
        navigate("/tenants", { replace: true });
        return;
      }
      const tenant = doc as unknown as Tenant;
      setForm({
        firstName: tenant.firstName ?? "",
        lastName: tenant.lastName ?? "",
        email: tenant.email ?? "",
        phone: tenant.phone ?? "",
        address: tenant.address ?? "",
        emergencyContactName: tenant.emergencyContactName ?? "",
        emergencyContactPhone: tenant.emergencyContactPhone ?? "",
        status: tenant.status ?? "prospect",
      });
    } catch (err) {
      toast.error("Failed to load tenant");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [agencyId, tenantId, navigate, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const goBack = () => navigate("/tenants");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyId) return;
    if (!form.firstName.trim() || !form.lastName.trim() || !form.phone.trim()) {
      setTab("profile");
      toast.error("First name, last name and phone are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        agencyId,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim(),
        address: form.address.trim() || undefined,
        emergencyContactName: form.emergencyContactName.trim() || undefined,
        emergencyContactPhone: form.emergencyContactPhone.trim() || undefined,
        status: form.status,
      };
      if (isEdit && tenantId) {
        await updateAgencyDoc(agencyId, "tenants", tenantId, payload);
        toast.success("Tenant updated");
      } else {
        await createTenantDoc(agencyId, crypto.randomUUID(), payload);
        toast.success("Tenant added");
      }
      navigate("/tenants");
    } catch (err) {
      toast.error("Failed to save tenant");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-xl font-bold text-slate-900">Sign in to manage tenants</h2>
        <p className="mt-2 text-slate-500">Please sign in to access tenant management.</p>
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
          message="Create your agency before adding tenants."
          action={<Button onClick={() => navigate("/agency-profile")}>Create agency</Button>}
        />
      </Card>
    );
  }

  if (!canManage) {
    return (
      <Card className="p-8">
        <EmptyState
          title="You don't have permission to manage tenants"
          message="Only owners, admins and property managers can add or edit tenants."
          action={<Button onClick={goBack}>Back to tenants</Button>}
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
  const saveLabel = isEdit ? "Save Changes" : "Add Tenant";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={goBack}
            className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            ← Back to tenants
          </button>
          <h2 className="text-2xl font-bold text-slate-900">
            {isEdit ? "Edit Tenant" : "Add Tenant"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {isEdit
              ? "Update the tenant's profile and contact details."
              : "Register a new tenant with their contact and status."}
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
        {tab === "profile" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="First Name"
                required
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                placeholder="e.g. Ada"
              />
              <Input
                label="Last Name"
                required
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                placeholder="e.g. Eze"
              />
            </div>
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
                placeholder="ada@example.com"
              />
            </div>
            <Input
              label="Address (optional)"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="e.g. 4B Marina Road, Lagos"
            />
            <Select
              label="Status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as Tenant["status"] })}
              options={TENANT_STATUSES}
            />
          </div>
        )}

        {tab === "emergency" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Emergency Contact Name (optional)"
                value={form.emergencyContactName}
                onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
                placeholder="e.g. Mr. Emeka Okonkwo"
              />
              <Input
                label="Emergency Contact Phone (optional)"
                value={form.emergencyContactPhone}
                onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })}
                placeholder="e.g. +234-801-234-5679"
              />
            </div>
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
