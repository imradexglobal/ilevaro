import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAgency, useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { EmptyState, Spinner } from "@/components/ui/States";
import {
  createOwnerDoc,
  deleteAgencyDoc,
  queryAgencyCollection,
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

export function LandlordsPage() {
  const { user, agencyId } = useAuth();
  const { agencyRole } = useAgency();
  const navigate = useNavigate();
  const toast = useToast();

  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Owner | null>(null);
  const [form, setForm] = useState<OwnerForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Owner | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canManage = MANAGE_ROLES.includes(agencyRole ?? "");

  const loadOwners = useCallback(async () => {
    if (!agencyId) {
      setOwners([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const docs = await queryAgencyCollection(agencyId, "owners");
      const list = (docs as unknown as Owner[]).sort((a, b) =>
        (a.fullName || "").localeCompare(b.fullName || "")
      );
      setOwners(list);
    } catch (err) {
      toast.error("Failed to load landlords");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [agencyId, toast]);

  useEffect(() => {
    void loadOwners();
  }, [loadOwners]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (owner: Owner) => {
    setEditing(owner);
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
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyId) {
      toast.error("No agency linked to this account");
      return;
    }
    if (!form.fullName.trim() || !form.phone.trim()) {
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

      if (editing) {
        await updateOwnerDoc(agencyId, editing.id, payload);
        toast.success("Landlord updated");
      } else {
        await createOwnerDoc(agencyId, crypto.randomUUID(), payload);
        toast.success("Landlord added");
      }
      setFormOpen(false);
      await loadOwners();
    } catch (err) {
      toast.error("Failed to save landlord");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!agencyId || !deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAgencyDoc(agencyId, "owners", deleteTarget.id);
      toast.success("Landlord removed");
      setDeleteTarget(null);
      await loadOwners();
    } catch (err) {
      toast.error("Failed to remove landlord");
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleStatus = async (owner: Owner) => {
    if (!agencyId) return;
    try {
      const next = owner.status === "archived" ? "active" : "archived";
      await updateOwnerDoc(agencyId, owner.id, { status: next });
      toast.success(next === "archived" ? "Landlord archived" : "Landlord restored");
      await loadOwners();
    } catch (err) {
      toast.error("Failed to update status");
      console.error(err);
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

  const filtered = owners.filter((o) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      o.fullName?.toLowerCase().includes(q) ||
      o.businessName?.toLowerCase().includes(q) ||
      o.email?.toLowerCase().includes(q) ||
      o.phone?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Landlords</h2>
          <p className="mt-1 text-sm text-slate-500">
            Property owners, their contact details and payout accounts.
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate} variant="primary">
            + Add Landlord
          </Button>
        )}
      </div>

      <Card className="p-4">
        <Input
          placeholder="Search landlords by name, business, email or phone..."
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
            title={owners.length === 0 ? "No landlords yet" : "No matches"}
            message={
              owners.length === 0
                ? "Add your first landlord to start managing owner records."
                : "Try a different search term."
            }
            action={canManage ? <Button onClick={openCreate}>+ Add Landlord</Button> : undefined}
          />
        </Card>
      ) : (
        <Card className="p-0">
          <Table>
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Name</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Contact</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Bank Account</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Status</th>
                {canManage && (
                  <th className="text-right text-xs font-medium text-slate-500 px-6 py-3">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((owner) => (
                <tr key={owner.id} className="border-b hover:bg-slate-50">
                  <td className="text-xs px-6 py-3">
                    <p className="font-medium text-slate-700">{owner.fullName}</p>
                    {owner.businessName && (
                      <p className="text-slate-400">{owner.businessName}</p>
                    )}
                  </td>
                  <td className="text-xs px-6 py-3">
                    <p className="text-slate-700">{owner.phone || "-"}</p>
                    {owner.email && <p className="text-slate-400">{owner.email}</p>}
                  </td>
                  <td className="text-xs px-6 py-3 text-slate-700">
                    {owner.bankName ? (
                      <>
                        <p>{owner.bankName}</p>
                        <p className="text-slate-400">{owner.bankAccountNumber || "-"}</p>
                      </>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="text-xs px-6 py-3">
                    <Badge variant={owner.status === "archived" ? "default" : "success"}>
                      {owner.status === "archived" ? "Archived" : "Active"}
                    </Badge>
                  </td>
                  {canManage && (
                    <td className="text-right px-6 py-3 whitespace-nowrap">
                      <Button size="sm" variant="outline" onClick={() => openEdit(owner)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-2"
                        onClick={() => handleToggleStatus(owner)}
                      >
                        {owner.status === "archived" ? "Restore" : "Archive"}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        className="ml-2"
                        onClick={() => setDeleteTarget(owner)}
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
        title={editing ? "Edit Landlord" : "Add Landlord"}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} onClick={handleSubmit}>
              {editing ? "Save Changes" : "Add Landlord"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <button type="submit" className="hidden" aria-hidden="true" />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete landlord"
        message={`Remove ${deleteTarget?.fullName ?? "this landlord"}? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
