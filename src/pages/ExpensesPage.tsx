import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAgency, useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Card, StatCard } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, Spinner } from "@/components/ui/States";
import {
  createExpenseDoc,
  queryAgencyCollection,
  updateExpenseDoc,
  type Expense,
  type Property,
} from "@/lib/firestore";
import { formatCurrency, formatDate } from "@/lib/format";

const WRITE_ROLES = ["agency_owner", "agency_admin", "property_manager", "accountant", "platform_admin"];
const APPROVE_ROLES = ["agency_owner", "agency_admin", "accountant", "platform_admin"];

const EXPENSE_CATEGORIES = [
  "repairs",
  "plumbing",
  "electrical",
  "cleaning",
  "security",
  "waste",
  "service_charge",
  "inspection",
  "other",
];

const categoryLabels: Record<string, string> = {
  repairs: "Repairs",
  plumbing: "Plumbing",
  electrical: "Electrical",
  cleaning: "Cleaning",
  security: "Security",
  waste: "Waste",
  service_charge: "Service Charge",
  inspection: "Inspection",
  other: "Other",
};

const approvalVariant: Record<string, "success" | "warning" | "danger"> = {
  approved: "success",
  pending: "warning",
  rejected: "danger",
};

export function ExpensesPage() {
  const { user, agencyId } = useAuth();
  const { agencyRole } = useAgency();
  const navigate = useNavigate();
  const toast = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const canWrite = WRITE_ROLES.includes(agencyRole ?? "");
  const canApprove = APPROVE_ROLES.includes(agencyRole ?? "");

  const load = useCallback(async () => {
    if (!agencyId) {
      setExpenses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [expenseDocs, propertyDocs] = await Promise.all([
        queryAgencyCollection(agencyId, "expenses"),
        queryAgencyCollection(agencyId, "properties"),
      ]);
      setExpenses(expenseDocs as unknown as Expense[]);
      setProperties(propertyDocs as unknown as Property[]);
    } catch (err) {
      toast.error("Failed to load expenses");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [agencyId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPending = useMemo(
    () =>
      expenses
        .filter((e) => e.approvalStatus === "pending")
        .reduce((sum, e) => sum + (e.amount || 0), 0),
    [expenses]
  );

  const totalApproved = useMemo(
    () =>
      expenses
        .filter((e) => e.approvalStatus === "approved")
        .reduce((sum, e) => sum + (e.amount || 0), 0),
    [expenses]
  );

  const propertyName = useCallback(
    (id?: string) => {
      if (!id) return "-";
      return properties.find((p) => p.id === id)?.name ?? id;
    },
    [properties]
  );

  const filtered = expenses.filter((exp) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (categoryLabels[exp.category] || exp.category || "").toLowerCase().includes(q) ||
      (exp.vendorId || "").toLowerCase().includes(q) ||
      propertyName(exp.propertyId).toLowerCase().includes(q) ||
      (exp.notes || "").toLowerCase().includes(q)
    );
  });

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyId || !user) return;
    if (!category || !amount) {
      toast.error("Select a category and enter an amount");
      return;
    }
    setSaving(true);
    try {
      await createExpenseDoc(agencyId, crypto.randomUUID(), {
        agencyId,
        propertyId: propertyId || undefined,
        category,
        amount: Number(amount),
        expenseDate: new Date(),
        vendorId: vendor.trim() || undefined,
        paymentMethod: "bank_transfer",
        fundedBy: "owner",
        approvalStatus: "pending",
        notes: description.trim() || undefined,
      });
      toast.success("Expense recorded");
      setAmount("");
      setVendor("");
      setDescription("");
      setCategory("");
      await load();
    } catch (err) {
      toast.error("Failed to record expense");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const setApproval = async (expense: Expense, approvalStatus: "approved" | "rejected") => {
    if (!agencyId || !user) return;
    try {
      await updateExpenseDoc(agencyId, expense.id, {
        approvalStatus,
        approvedBy: user.uid,
      });
      toast.success(`Expense ${approvalStatus}`);
      await load();
    } catch (err) {
      toast.error("Failed to update expense");
      console.error(err);
    }
  };

  if (!user) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-xl font-bold text-slate-900">Sign in to manage expenses</h2>
        <p className="mt-2 text-slate-500">Please sign in to access expense management.</p>
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
          message="Create your agency before recording expenses."
          action={<Button onClick={() => navigate("/agency-profile")}>Create agency</Button>}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Expenses</h2>
        <p className="mt-1 text-sm text-slate-500">
          Maintenance and operating costs recorded against properties.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Expenses" value={formatCurrency(totalPending + totalApproved)} />
        <StatCard label="Approved" value={formatCurrency(totalApproved)} />
        <StatCard label="Pending Approval" value={formatCurrency(totalPending)} />
      </div>

      {canWrite && (
        <Card title="Record Expense">
          <form onSubmit={handleCreateExpense} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                options={[
                  { value: "", label: "Select category" },
                  ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: categoryLabels[c] })),
                ]}
              />
              <Input
                label="Amount (₦)"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                placeholder="e.g. 45000"
              />
            </div>
            <Select
              label="Property (optional)"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              options={[
                { value: "", label: "Not linked to a property" },
                ...properties.map((p) => ({ value: p.id, label: `${p.name} (${p.reference})` })),
              ]}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Vendor (optional)"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="e.g. ABC Construction Company"
              />
              <Input
                label="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Emergency plumbing repair"
              />
            </div>
            <Button type="submit" variant="primary" loading={saving}>
              Record Expense
            </Button>
          </form>
        </Card>
      )}

      <Card className="p-4">
        <Input
          placeholder="Search expenses..."
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
            title={expenses.length === 0 ? "No expenses yet" : "No matches"}
            message={
              expenses.length === 0
                ? "Record your first expense to start tracking operating costs."
                : "Try a different search term."
            }
          />
        </Card>
      ) : (
        <Card className="p-0">
          <Table>
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Category</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Amount</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Property</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Vendor</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Date</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Status</th>
                {canApprove && (
                  <th className="text-right text-xs font-medium text-slate-500 px-6 py-3">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((exp) => (
                <tr key={exp.id} className="border-b hover:bg-slate-50">
                  <td className="text-xs px-6 py-3">
                    <p className="font-medium text-slate-700">
                      {categoryLabels[exp.category] || exp.category}
                    </p>
                    {exp.notes && <p className="text-slate-400">{exp.notes}</p>}
                  </td>
                  <td className="text-xs text-slate-700 px-6 py-3">
                    {formatCurrency(exp.amount || 0)}
                  </td>
                  <td className="text-xs text-slate-700 px-6 py-3">
                    {propertyName(exp.propertyId)}
                  </td>
                  <td className="text-xs text-slate-700 px-6 py-3">{exp.vendorId || "-"}</td>
                  <td className="text-xs text-slate-700 px-6 py-3">
                    {exp.expenseDate ? formatDate(exp.expenseDate) : "-"}
                  </td>
                  <td className="text-xs px-6 py-3">
                    <Badge variant={approvalVariant[exp.approvalStatus] ?? "default"}>
                      {exp.approvalStatus}
                    </Badge>
                  </td>
                  {canApprove && (
                    <td className="text-right px-6 py-3 whitespace-nowrap">
                      {exp.approvalStatus === "pending" ? (
                        <>
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => setApproval(exp, "approved")}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            className="ml-2"
                            onClick={() => setApproval(exp, "rejected")}
                          >
                            Reject
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">Decided</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
