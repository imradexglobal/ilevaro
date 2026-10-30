import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAgency, useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Card, StatCard } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { EmptyState, Spinner } from "@/components/ui/States";
import {
  createRemittanceDoc,
  deleteAgencyDoc,
  queryAgencyCollection,
} from "@/lib/firestore";
import type { Owner, Remittance } from "@/lib/types";
import { formatCurrency, formatDate, generateReference } from "@/lib/format";

const WRITE_ROLES = ["agency_owner", "agency_admin", "accountant", "platform_admin"];

const METHODS: { value: Remittance["method"]; label: string }[] = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "check", label: "Cheque" },
  { value: "other", label: "Other" },
];

const methodLabels: Record<string, string> = {
  bank_transfer: "Bank Transfer",
  check: "Cheque",
  other: "Other",
};

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const maybe = value as { toDate?: () => Date };
  return typeof maybe.toDate === "function" ? maybe.toDate() : null;
}

export function RemittancesPage() {
  const { user, agencyId } = useAuth();
  const { agencyRole } = useAgency();
  const navigate = useNavigate();
  const toast = useToast();

  const [remittances, setRemittances] = useState<Remittance[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Remittance | null>(null);
  const [deleting, setDeleting] = useState(false);
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
      setRemittances([]);
      setOwners([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [remittanceDocs, ownerDocs] = await Promise.all([
        queryAgencyCollection(agencyId, "remittances"),
        queryAgencyCollection(agencyId, "owners"),
      ]);
      setRemittances(remittanceDocs as unknown as Remittance[]);
      setOwners(ownerDocs as unknown as Owner[]);
    } catch (err) {
      toast.error("Failed to load remittances");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [agencyId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const ownerLabel = useCallback(
    (ownerId: string) => {
      const owner = owners.find((o) => o.id === ownerId);
      if (!owner) return "Unknown landlord";
      return owner.businessName?.trim() || owner.fullName || "Unnamed landlord";
    },
    [owners]
  );

  const handleCreate = async () => {
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
      setFormOpen(false);
      setForm({
        ownerId: "",
        amount: "",
        paymentDate: new Date().toISOString().slice(0, 10),
        method: "bank_transfer",
        reference: "",
        period: new Date().toISOString().slice(0, 7),
        notes: "",
      });
      await load();
    } catch (err) {
      toast.error("Failed to record remittance");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!agencyId || !deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAgencyDoc(agencyId, "remittances", deleteTarget.id);
      toast.success("Remittance deleted");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error("Failed to delete remittance");
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const total = remittances.reduce((sum, r) => sum + (r.amount ?? 0), 0);
    const thisMonth = remittances
      .filter((r) => {
        const d = toDate(r.paymentDate);
        return d ? d.getTime() >= monthStart.getTime() : false;
      })
      .reduce((sum, r) => sum + (r.amount ?? 0), 0);
    const recipients = new Set(remittances.map((r) => r.ownerId)).size;
    return { total, thisMonth, recipients };
  }, [remittances]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...remittances]
      .sort(
        (a, b) =>
          (toDate(b.paymentDate)?.getTime() ?? 0) - (toDate(a.paymentDate)?.getTime() ?? 0)
      )
      .filter((r) => {
        if (!q) return true;
        return (
          ownerLabel(r.ownerId).toLowerCase().includes(q) ||
          (r.reference ?? "").toLowerCase().includes(q) ||
          (r.period ?? "").toLowerCase().includes(q)
        );
      });
  }, [remittances, search, ownerLabel]);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Remittances</h2>
          <p className="mt-1 text-sm text-slate-500">
            Rent disbursements paid out to landlords.
          </p>
        </div>
        {canWrite && (
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            + Record Remittance
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Remitted" value={formatCurrency(stats.total)} />
        <StatCard label="Remitted This Month" value={formatCurrency(stats.thisMonth)} />
        <StatCard label="Landlords Paid" value={String(stats.recipients)} />
      </div>

      <Card className="p-4">
        <Input
          placeholder="Search by landlord, reference or period..."
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
            title={remittances.length === 0 ? "No remittances yet" : "No matches"}
            message={
              remittances.length === 0
                ? "Record a remittance once rent has been collected on behalf of a landlord."
                : "Try a different search."
            }
            action={
              canWrite && remittances.length === 0 ? (
                <Button onClick={() => setFormOpen(true)}>+ Record Remittance</Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card className="p-0">
          <Table>
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">
                  Payment Date
                </th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">
                  Landlord
                </th>
                <th className="text-right text-xs font-medium text-slate-500 px-6 py-3">
                  Amount
                </th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Method</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">
                  Reference
                </th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Period</th>
                {canWrite && (
                  <th className="text-right text-xs font-medium text-slate-500 px-6 py-3">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((remittance) => {
                const date = toDate(remittance.paymentDate);
                return (
                  <tr key={remittance.id} className="border-b hover:bg-slate-50">
                    <td className="text-xs px-6 py-3 text-slate-700">
                      {date ? formatDate(date) : "—"}
                    </td>
                    <td className="text-xs px-6 py-3 text-slate-700">
                      {ownerLabel(remittance.ownerId)}
                    </td>
                    <td className="text-xs px-6 py-3 text-right font-medium text-slate-700">
                      {formatCurrency(remittance.amount ?? 0)}
                    </td>
                    <td className="text-xs px-6 py-3">
                      <Badge variant="info">
                        {methodLabels[remittance.method] ?? remittance.method}
                      </Badge>
                    </td>
                    <td className="text-xs px-6 py-3 text-slate-700">
                      <p>{remittance.reference || "—"}</p>
                      {remittance.notes && (
                        <p className="text-slate-400">{remittance.notes}</p>
                      )}
                    </td>
                    <td className="text-xs px-6 py-3 text-slate-700">
                      {remittance.period || "—"}
                    </td>
                    {canWrite && (
                      <td className="text-right px-6 py-3">
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setDeleteTarget(remittance)}
                        >
                          Delete
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
        title="Record Remittance"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} onClick={handleCreate}>
              Record Remittance
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => { e.preventDefault(); void handleCreate(); }} className="space-y-4">
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
          {owners.length === 0 && (
            <p className="text-xs text-slate-500">
              No landlords recorded yet. Add a landlord from the Landlords page first.
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Amount"
              type="number"
              required
              min="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="e.g. 450000"
            />
            <Input
              label="Payment date"
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

          <button type="submit" className="hidden" aria-hidden="true" />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete remittance"
        message={`Delete the remittance of ${formatCurrency(
          deleteTarget?.amount ?? 0
        )} to ${deleteTarget ? ownerLabel(deleteTarget.ownerId) : ""}?`}
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
