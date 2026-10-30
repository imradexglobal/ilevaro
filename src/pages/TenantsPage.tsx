import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAgency, useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { EmptyState, Spinner } from "@/components/ui/States";
import {
  createTenantDoc,
  deleteAgencyDoc,
  queryAgencyCollection,
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

const statusVariant: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  prospect: "info",
  active: "success",
  former: "default",
  blacklisted: "danger",
};

interface TenancyRecord {
  id: string;
  tenantId: string;
  propertyId: string;
  status: string;
}

interface PropertyRecord {
  id: string;
  name: string;
  reference?: string;
}

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

export function TenantsPage() {
  const { user, agencyId } = useAuth();
  const { agencyRole } = useAgency();
  const navigate = useNavigate();
  const toast = useToast();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenancies, setTenancies] = useState<TenancyRecord[]>([]);
  const [properties, setProperties] = useState<PropertyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [form, setForm] = useState<TenantForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canManage = MANAGE_ROLES.includes(agencyRole ?? "");

  const load = useCallback(async () => {
    if (!agencyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [tenantDocs, tenancyDocs, propertyDocs] = await Promise.all([
        queryAgencyCollection(agencyId, "tenants"),
        queryAgencyCollection(agencyId, "tenancies"),
        queryAgencyCollection(agencyId, "properties"),
      ]);
      setTenants(tenantDocs as unknown as Tenant[]);
      setTenancies(tenancyDocs as unknown as TenancyRecord[]);
      setProperties(propertyDocs as unknown as PropertyRecord[]);
    } catch (err) {
      toast.error("Failed to load tenants");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [agencyId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const propertyForTenant = useCallback(
    (tenantId: string) => {
      const tenancy = tenancies.find(
        (t) => t.tenantId === tenantId && (t.status === "active" || t.status === "proposed")
      );
      if (!tenancy) return null;
      const property = properties.find((p) => p.id === tenancy.propertyId);
      return property?.name ?? null;
    },
    [tenancies, properties]
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (tenant: Tenant) => {
    setEditing(tenant);
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
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyId) return;
    if (!form.firstName.trim() || !form.lastName.trim() || !form.phone.trim()) {
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
      if (editing) {
        await updateAgencyDoc(agencyId, "tenants", editing.id, payload);
        toast.success("Tenant updated");
      } else {
        await createTenantDoc(agencyId, crypto.randomUUID(), payload);
        toast.success("Tenant added");
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      toast.error("Failed to save tenant");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!agencyId || !deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAgencyDoc(agencyId, "tenants", deleteTarget.id);
      toast.success("Tenant removed");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error("Failed to remove tenant");
      console.error(err);
    } finally {
      setDeleting(false);
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

  const filtered = tenants.filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      `${t.firstName} ${t.lastName}`.toLowerCase().includes(q) ||
      (t.email ?? "").toLowerCase().includes(q) ||
      t.phone.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Tenants</h2>
          <p className="mt-1 text-sm text-slate-500">
            Tenant profiles, contact details and current property.
          </p>
        </div>
        {canManage && (
          <Button variant="primary" onClick={openCreate}>
            + Add Tenant
          </Button>
        )}
      </div>

      <Card className="p-4">
        <Input
          placeholder="Search tenants by name, email or phone..."
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
            title={tenants.length === 0 ? "No tenants yet" : "No matches"}
            message={
              tenants.length === 0
                ? "Add your first tenant to get started."
                : "Try a different search term."
            }
            action={canManage ? <Button onClick={openCreate}>+ Add Tenant</Button> : undefined}
          />
        </Card>
      ) : (
        <Card className="p-0">
          <Table>
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Name</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Contact</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Property</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Status</th>
                {canManage && (
                  <th className="text-right text-xs font-medium text-slate-500 px-6 py-3">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((tenant) => (
                <tr key={tenant.id} className="border-b hover:bg-slate-50">
                  <td className="text-xs px-6 py-3 font-medium text-slate-700">
                    {tenant.firstName} {tenant.lastName}
                  </td>
                  <td className="text-xs px-6 py-3">
                    <p className="text-slate-700">{tenant.phone}</p>
                    {tenant.email && <p className="text-slate-400">{tenant.email}</p>}
                  </td>
                  <td className="text-xs px-6 py-3 text-slate-700">
                    {propertyForTenant(tenant.id) ?? "-"}
                  </td>
                  <td className="text-xs px-6 py-3">
                    <Badge variant={statusVariant[tenant.status] ?? "default"}>
                      {tenant.status}
                    </Badge>
                  </td>
                  {canManage && (
                    <td className="text-right px-6 py-3 whitespace-nowrap">
                      <Button size="sm" variant="outline" onClick={() => openEdit(tenant)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        className="ml-2"
                        onClick={() => setDeleteTarget(tenant)}
                      >
                        Delete
                      </Button>
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
        title={editing ? "Edit Tenant" : "Add Tenant"}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} onClick={handleSubmit}>
              {editing ? "Save Changes" : "Add Tenant"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as Tenant["status"] })}
            options={TENANT_STATUSES}
          />
          <button type="submit" className="hidden" aria-hidden="true" />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete tenant"
        message={`Remove ${deleteTarget?.firstName ?? ""} ${deleteTarget?.lastName ?? ""}? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
