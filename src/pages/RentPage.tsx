import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useAgency, useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input, SearchableSelect, Select } from "@/components/ui/Input";
import { Card, StatCard } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { EmptyState, Spinner } from "@/components/ui/States";
import {
  addTenantCredit,
  allocatePayment,
  calculateChargeStatus,
  createAgencyDoc,
  deletePayment,
  deleteRentCharge,
  generateRentCharges,
  getPaymentCredits,
  queryAgencyCollection,
  recordPayment,
  releasePaymentAllocations,
  reversePaymentCredit,
  updateAgencyDoc,
  type RentCharge,
  type RentChargeStatus,
} from "@/lib/firestore";
import type { PaymentMethod, PaymentStatus, Tenant } from "@/lib/types";
import { formatCurrency, formatDate, generateReference } from "@/lib/format";

const MANAGE_ROLES = ["agency_owner", "agency_admin", "accountant", "platform_admin"];
const GENERATE_ROLES = ["agency_owner", "agency_admin", "platform_admin"];

const rentChargeStatusLabels: Record<string, string> = {
  upcoming: "Upcoming",
  due: "Due",
  partially_paid: "Partially Paid",
  paid: "Paid",
  overdue: "Overdue",
  waived: "Waived",
  cancelled: "Cancelled",
};

const chargeStatusVariant: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
  paid: "success",
  partially_paid: "warning",
  overdue: "danger",
  due: "warning",
  upcoming: "info",
  waived: "default",
  cancelled: "default",
};

const paymentStatusVariant: Record<string, "success" | "warning" | "danger" | "default"> = {
  pending: "warning",
  verified: "success",
  reversed: "default",
  failed: "danger",
};

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "card", label: "Card" },
  { value: "ussd", label: "USSD" },
  { value: "other", label: "Other" },
];

interface TenancyRecord {
  id: string;
  tenantId: string;
  status: string;
  rentAmount?: number;
}

interface PaymentRecord {
  id: string;
  tenantId?: string;
  tenancyId?: string;
  reference: string;
  amount: number;
  paymentDate?: { toDate?: () => Date } | Date;
  method: PaymentMethod;
  transactionRef?: string;
  status: PaymentStatus;
  notes?: string;
}

interface AllocationRecord {
  id: string;
  paymentId: string;
  rentChargeId: string;
  tenancyId?: string;
  amountAllocated: number;
}

interface ChargeForm {
  reference: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  amountDue: string;
  outstanding: string;
  status: RentChargeStatus;
}

interface PaymentForm {
  tenantId: string;
  amount: string;
  method: PaymentMethod;
  transactionRef: string;
  notes: string;
}

interface PaymentEditForm {
  amount: string;
  method: PaymentMethod;
  transactionRef: string;
  notes: string;
  paymentDate: string;
}

function toDateInput(value?: { toDate?: () => Date } | Date): string {
  if (!value) return "";
  const d = value instanceof Date ? value : value.toDate ? value.toDate() : null;
  return d ? d.toISOString().slice(0, 10) : "";
}

function paymentDateLabel(value?: { toDate?: () => Date } | Date): string {
  if (!value) return "-";
  const d = value instanceof Date ? value : value.toDate ? value.toDate() : null;
  return d ? formatDate(d) : "-";
}

const emptyPaymentForm: PaymentForm = {
  tenantId: "",
  amount: "",
  method: "bank_transfer",
  transactionRef: "",
  notes: "",
};

/**
 * Rent & Payments — one page for the whole billing cycle: the rent charges
 * raised against tenancies (with the payments applied to each one inline) and
 * the payment receipts that fund them. Money received beyond a tenant's
 * outstanding balance is held as tenant credit.
 */
export function RentPage() {
  const { user, agencyId } = useAuth();
  const { agencyRole } = useAgency();
  const navigate = useNavigate();
  const toast = useToast();

  const [rentCharges, setRentCharges] = useState<RentCharge[]>([]);
  const [tenancies, setTenancies] = useState<TenancyRecord[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [allocations, setAllocations] = useState<AllocationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedChargeId, setExpandedChargeId] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(emptyPaymentForm);

  const [reverseTarget, setReverseTarget] = useState<RentCharge | null>(null);
  const [editTarget, setEditTarget] = useState<RentCharge | null>(null);
  const [editForm, setEditForm] = useState<ChargeForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteChargeTarget, setDeleteChargeTarget] = useState<RentCharge | null>(null);

  const [paymentEditTarget, setPaymentEditTarget] = useState<PaymentRecord | null>(null);
  const [paymentEditForm, setPaymentEditForm] = useState<PaymentEditForm | null>(null);
  const [savingPaymentEdit, setSavingPaymentEdit] = useState(false);
  const [deletePaymentTarget, setDeletePaymentTarget] = useState<PaymentRecord | null>(null);
  const [working, setWorking] = useState(false);

  const canManage = MANAGE_ROLES.includes(agencyRole ?? "");
  const canGenerate = GENERATE_ROLES.includes(agencyRole ?? "");

  const load = useCallback(async () => {
    if (!agencyId) {
      setRentCharges([]);
      setPayments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [chargeDocs, tenancyDocs, tenantDocs, paymentDocs, allocationDocs] = await Promise.all([
        queryAgencyCollection(agencyId, "rent_charges"),
        queryAgencyCollection(agencyId, "tenancies"),
        queryAgencyCollection(agencyId, "tenants"),
        queryAgencyCollection(agencyId, "payments"),
        queryAgencyCollection(agencyId, "payment_allocations"),
      ]);
      setRentCharges(
        (chargeDocs as unknown as RentCharge[]).sort(
          (a, b) => b.dueDate.toDate().getTime() - a.dueDate.toDate().getTime()
        )
      );
      setTenancies(tenancyDocs as unknown as TenancyRecord[]);
      setTenants(tenantDocs as unknown as Tenant[]);
      setPayments(paymentDocs as unknown as PaymentRecord[]);
      setAllocations(allocationDocs as unknown as AllocationRecord[]);
    } catch (err) {
      toast.error("Failed to load rent and payments");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [agencyId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const tenantName = useCallback(
    (tenantId?: string) => {
      if (!tenantId) return "-";
      const tenant = tenants.find((t) => t.id === tenantId);
      return tenant ? `${tenant.firstName} ${tenant.lastName}`.trim() : "Unknown tenant";
    },
    [tenants]
  );

  const tenancyLabel = useCallback(
    (tenancyId: string) => {
      const tenancy = tenancies.find((t) => t.id === tenancyId);
      if (!tenancy) return tenancyId || "-";
      return tenantName(tenancy.tenantId);
    },
    [tenancies, tenantName]
  );

  /** Payment allocations grouped by rent charge, for the inline expansion. */
  const allocationsByCharge = useMemo(() => {
    const map = new Map<string, AllocationRecord[]>();
    for (const allocation of allocations) {
      const list = map.get(allocation.rentChargeId) ?? [];
      list.push(allocation);
      map.set(allocation.rentChargeId, list);
    }
    return map;
  }, [allocations]);

  const allocatedByPayment = useMemo(() => {
    const map = new Map<string, number>();
    for (const allocation of allocations) {
      map.set(allocation.paymentId, (map.get(allocation.paymentId) ?? 0) + allocation.amountAllocated);
    }
    return map;
  }, [allocations]);

  const chargeRows = useMemo(
    () =>
      rentCharges.map((charge) => {
        const dueDate = charge.dueDate.toDate();
        const stored = charge.status;
        const computed: RentChargeStatus =
          stored === "waived" || stored === "cancelled"
            ? stored
            : calculateChargeStatus(dueDate, charge.amountDue, charge.amountPaid);
        return { charge, computed };
      }),
    [rentCharges]
  );

  const chargeTotals = useMemo(() => {
    let billed = 0;
    let collected = 0;
    let outstanding = 0;
    let overdue = 0;
    for (const { charge, computed } of chargeRows) {
      billed += charge.amountDue || 0;
      collected += charge.amountPaid || 0;
      outstanding += charge.outstanding || 0;
      if (computed === "overdue") overdue += charge.outstanding || 0;
    }
    return { billed, collected, outstanding, overdue };
  }, [chargeRows]);

  const totalCredit = useMemo(
    () => tenants.reduce((sum, tenant) => sum + (tenant.creditBalance ?? 0), 0),
    [tenants]
  );

  const filteredCharges = chargeRows.filter(({ charge, computed }) => {
    if (statusFilter && computed !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (charge.reference || "").toLowerCase().includes(q) ||
      tenancyLabel(charge.tenancyId).toLowerCase().includes(q)
    );
  });

  const sortedPayments = useMemo(
    () =>
      [...payments].sort((a, b) => {
        const da = toDateInput(a.paymentDate) || "";
        const db = toDateInput(b.paymentDate) || "";
        return db.localeCompare(da);
      }),
    [payments]
  );

  const filteredPayments = sortedPayments.filter((payment) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      payment.reference?.toLowerCase().includes(q) ||
      payment.transactionRef?.toLowerCase().includes(q) ||
      tenantName(payment.tenantId).toLowerCase().includes(q)
    );
  });

  const openPaymentForm = () => {
    setPaymentForm(emptyPaymentForm);
    setPaymentFormOpen(true);
  };

  const handleGenerateCharges = async () => {
    if (!agencyId) return;
    setGenerating(true);
    try {
      const created = await generateRentCharges(agencyId);
      if (created.length === 0) {
        toast.info("No new charges generated — every active tenancy already has a charge.");
      } else {
        toast.success(`Generated ${created.length} rent charge${created.length === 1 ? "" : "s"}`);
      }
      await load();
    } catch (err) {
      toast.error("Failed to generate rent charges");
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  /**
   * Allocate a receipt across the tenant's open rent charges (oldest first),
   * reading charges fresh from Firestore so balances are current. Anything left
   * over is returned as the unallocated amount.
   */
  const runWaterfall = async (
    payment: PaymentRecord,
    amount: number
  ): Promise<{ allocated: number; leftover: number }> => {
    if (!agencyId) return { allocated: 0, leftover: 0 };
    const tenancy =
      tenancies.find((t) => t.id === payment.tenancyId) ||
      tenancies.find((t) => t.tenantId === payment.tenantId);
    if (!tenancy) return { allocated: 0, leftover: amount };

    const freshDocs = await queryAgencyCollection(agencyId, "rent_charges");
    const open = (freshDocs as unknown as RentCharge[])
      .filter((c) => c.tenancyId === tenancy.id && (c.outstanding ?? 0) > 0)
      .sort((a, b) => a.dueDate.toDate().getTime() - b.dueDate.toDate().getTime());

    let remaining = amount;
    const chargeIds: string[] = [];
    const amounts: number[] = [];
    for (const charge of open) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, charge.outstanding);
      chargeIds.push(charge.id);
      amounts.push(take);
      remaining -= take;
    }

    if (chargeIds.length === 0) return { allocated: 0, leftover: amount };

    const result = await allocatePayment(agencyId, payment.id, tenancy.id, chargeIds, amounts);
    const allocated = result.success
      ? result.allocated.reduce((sum, a) => sum + a.amount, 0)
      : 0;
    return { allocated, leftover: amount - allocated };
  };

  /** Park a payment's unallocated balance as tenant credit (once only). */
  const parkOverpayment = async (payment: PaymentRecord, leftover: number) => {
    if (!agencyId || leftover <= 0 || !payment.tenantId) return 0;
    const existing = await getPaymentCredits(agencyId, payment.id);
    if (existing.length > 0) return 0;
    await addTenantCredit(agencyId, payment.tenantId, leftover, {
      paymentId: payment.id,
      notes: "Unallocated balance — held as tenant credit",
    });
    return leftover;
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyId) return;
    if (!paymentForm.tenantId || !paymentForm.amount) {
      toast.error("Select a tenant and enter an amount");
      return;
    }
    const amount = Number(paymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSaving(true);
    try {
      const paymentId = await recordPayment({
        agencyId,
        tenantId: paymentForm.tenantId,
        reference: generateReference("PAY"),
        amount,
        method: paymentForm.method,
        transactionRef: paymentForm.transactionRef || undefined,
        notes: paymentForm.notes || undefined,
      });

      const receipt: PaymentRecord = {
        id: paymentId,
        tenantId: paymentForm.tenantId,
        reference: "new receipt",
        amount,
        method: paymentForm.method,
        status: "pending",
      };
      const { allocated, leftover } = await runWaterfall(receipt, amount);
      const credited = await parkOverpayment(receipt, leftover);

      const parts: string[] = [];
      if (allocated > 0) parts.push(`${formatCurrency(allocated)} applied to charges`);
      if (credited > 0) parts.push(`${formatCurrency(credited)} held as tenant credit`);
      toast.success(parts.length > 0 ? `Payment recorded — ${parts.join(", ")}` : "Payment recorded");

      setPaymentFormOpen(false);
      setPaymentForm(emptyPaymentForm);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleAllocatePayment = async (payment: PaymentRecord) => {
    if (!agencyId) return;
    setBusyId(payment.id);
    try {
      const { allocated, leftover } = await runWaterfall(payment, payment.amount);
      const credited = await parkOverpayment(payment, leftover);
      if (allocated === 0 && credited === 0) {
        toast.info("No outstanding rent charges to allocate to");
      } else {
        const parts: string[] = [];
        if (allocated > 0) parts.push(`${formatCurrency(allocated)} allocated`);
        if (credited > 0) parts.push(`${formatCurrency(credited)} held as credit`);
        toast.success(parts.join(", "));
      }
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Allocation failed");
      console.error(err);
    } finally {
      setBusyId(null);
    }
  };

  const handleVerifyPayment = async (payment: PaymentRecord) => {
    if (!agencyId || !user) return;
    setBusyId(payment.id);
    try {
      await updateAgencyDoc(agencyId, "payments", payment.id, {
        status: "verified" as PaymentStatus,
        verifiedBy: user.uid,
        verifiedAt: new Date(),
      });
      toast.success("Payment verified");
      await load();
    } catch (err) {
      toast.error("Failed to verify payment");
      console.error(err);
    } finally {
      setBusyId(null);
    }
  };

  const handleReversePayment = async (payment: PaymentRecord) => {
    if (!agencyId) return;
    setBusyId(payment.id);
    try {
      const released = await releasePaymentAllocations(agencyId, payment.id);
      const creditRemoved = await reversePaymentCredit(agencyId, payment.id);
      await updateAgencyDoc(agencyId, "payments", payment.id, {
        status: "reversed" as PaymentStatus,
      });
      const parts: string[] = [];
      if (released > 0) parts.push(`${released} charge allocation(s) restored`);
      if (creditRemoved > 0) parts.push(`${formatCurrency(creditRemoved)} credit withdrawn`);
      toast.success(parts.length > 0 ? `Payment reversed — ${parts.join(", ")}` : "Payment reversed");
      await load();
    } catch (err) {
      toast.error("Failed to reverse payment");
      console.error(err);
    } finally {
      setBusyId(null);
    }
  };

  const handleVerifyCharge = async (charge: RentCharge) => {
    if (!agencyId || !user) return;
    setBusyId(charge.id);
    try {
      const newAmountPaid = (charge.amountPaid || 0) + (charge.outstanding || 0);
      await updateAgencyDoc(agencyId, "rent_charges", charge.id, {
        amountPaid: newAmountPaid,
        outstanding: 0,
        status: "paid",
      });
      try {
        await createAgencyDoc(agencyId, "activity_events", crypto.randomUUID(), {
          agencyId,
          actorId: user.uid,
          actorName: user.displayName || user.email || "Unknown",
          action: "payment.verified",
          entityType: "rent_charge",
          entityId: charge.id,
          before: {
            status: charge.status,
            amountPaid: charge.amountPaid,
            outstanding: charge.outstanding,
          },
          after: { status: "paid", amountPaid: newAmountPaid, outstanding: 0 },
          timestamp: new Date(),
        });
      } catch (err) {
        console.error("Failed to write activity log:", err);
      }
      toast.success("Charge verified and marked as paid");
      await load();
    } catch (err) {
      toast.error("Failed to verify charge");
      console.error(err);
    } finally {
      setBusyId(null);
    }
  };

  const handleReverseCharge = async () => {
    if (!agencyId || !reverseTarget) return;
    setWorking(true);
    try {
      const restoredStatus = calculateChargeStatus(
        reverseTarget.dueDate.toDate(),
        reverseTarget.amountDue,
        0
      );
      await updateAgencyDoc(agencyId, "rent_charges", reverseTarget.id, {
        amountPaid: 0,
        outstanding: reverseTarget.amountDue,
        status: restoredStatus,
      });
      toast.success("Charge reversed");
      setReverseTarget(null);
      await load();
    } catch (err) {
      toast.error("Failed to reverse charge");
      console.error(err);
    } finally {
      setWorking(false);
    }
  };

  const openChargeEdit = (charge: RentCharge) => {
    setEditTarget(charge);
    setEditForm({
      reference: charge.reference ?? "",
      periodStart: toDateInput(charge.periodStart),
      periodEnd: toDateInput(charge.periodEnd),
      dueDate: toDateInput(charge.dueDate),
      amountDue: String(charge.amountDue ?? 0),
      outstanding: String(charge.outstanding ?? 0),
      status: charge.status,
    });
  };

  const handleSaveChargeEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyId || !editTarget || !editForm) return;
    if (!editForm.amountDue) {
      toast.error("Amount due is required");
      return;
    }
    setSavingEdit(true);
    try {
      const amountDue = Number(editForm.amountDue) || 0;
      const outstanding = Math.max(0, Number(editForm.outstanding) || 0);
      const amountPaid = Math.max(0, amountDue - outstanding);
      await updateAgencyDoc(agencyId, "rent_charges", editTarget.id, {
        reference: editForm.reference.trim() || editTarget.reference,
        periodStart: new Date(editForm.periodStart),
        periodEnd: new Date(editForm.periodEnd),
        dueDate: new Date(editForm.dueDate),
        amountDue,
        outstanding,
        amountPaid,
        status: editForm.status,
      });
      toast.success("Rent charge updated");
      setEditTarget(null);
      setEditForm(null);
      await load();
    } catch (err) {
      toast.error("Failed to update rent charge");
      console.error(err);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteCharge = async () => {
    if (!agencyId || !deleteChargeTarget) return;
    setWorking(true);
    try {
      await deleteRentCharge(agencyId, deleteChargeTarget.id);
      toast.success("Rent charge deleted");
      setDeleteChargeTarget(null);
      await load();
    } catch (err) {
      toast.error("Failed to delete rent charge");
      console.error(err);
    } finally {
      setWorking(false);
    }
  };

  const openPaymentEdit = (payment: PaymentRecord) => {
    setPaymentEditTarget(payment);
    setPaymentEditForm({
      amount: String(payment.amount ?? ""),
      method: payment.method,
      transactionRef: payment.transactionRef ?? "",
      notes: payment.notes ?? "",
      paymentDate: toDateInput(payment.paymentDate),
    });
  };

  const handleSavePaymentEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyId || !paymentEditTarget || !paymentEditForm) return;
    if (!paymentEditForm.amount) {
      toast.error("Amount is required");
      return;
    }
    setSavingPaymentEdit(true);
    try {
      const newAmount = Number(paymentEditForm.amount);
      await updateAgencyDoc(agencyId, "payments", paymentEditTarget.id, {
        amount: newAmount,
        method: paymentEditForm.method,
        transactionRef: paymentEditForm.transactionRef.trim() || undefined,
        notes: paymentEditForm.notes.trim() || undefined,
        paymentDate: paymentEditForm.paymentDate ? new Date(paymentEditForm.paymentDate) : undefined,
      });

      // Re-run the money trail so charges and credit stay correct.
      if (newAmount !== paymentEditTarget.amount && paymentEditTarget.status !== "reversed") {
        await releasePaymentAllocations(agencyId, paymentEditTarget.id);
        await reversePaymentCredit(agencyId, paymentEditTarget.id);
        const { leftover } = await runWaterfall(
          { ...paymentEditTarget, amount: newAmount },
          newAmount
        );
        await parkOverpayment(paymentEditTarget, leftover);
      }

      toast.success("Payment updated");
      setPaymentEditTarget(null);
      setPaymentEditForm(null);
      await load();
    } catch (err) {
      toast.error("Failed to update payment");
      console.error(err);
    } finally {
      setSavingPaymentEdit(false);
    }
  };

  const handleDeletePayment = async () => {
    if (!agencyId || !deletePaymentTarget) return;
    setWorking(true);
    try {
      const { releasedCharges, releasedCredit } = await deletePayment(agencyId, deletePaymentTarget.id);
      const parts: string[] = [];
      if (releasedCharges > 0) parts.push(`${releasedCharges} charge(s) restored`);
      if (releasedCredit > 0) parts.push(`${formatCurrency(releasedCredit)} credit withdrawn`);
      toast.success(parts.length > 0 ? `Payment deleted — ${parts.join(", ")}` : "Payment deleted");
      setDeletePaymentTarget(null);
      await load();
    } catch (err) {
      toast.error("Failed to delete payment");
      console.error(err);
    } finally {
      setWorking(false);
    }
  };

  if (!user) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-xl font-bold text-slate-900">Sign in to manage rent</h2>
        <p className="mt-2 text-slate-500">Please sign in to access rent and payments.</p>
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
          message="Create your agency before managing rent and payments."
          action={<Button onClick={() => navigate("/agency-profile")}>Create agency</Button>}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Rent &amp; Payments</h2>
          <p className="mt-1 text-sm text-slate-500">
            Billed rent, the receipts against it and any credit held on tenant accounts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canGenerate && (
            <Button variant="outline" loading={generating} onClick={handleGenerateCharges}>
              + Generate Charges
            </Button>
          )}
          {canManage && (
            <Button variant="primary" onClick={openPaymentForm}>
              + Record Payment
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total Billed" value={formatCurrency(chargeTotals.billed)} />
        <StatCard label="Collected" value={formatCurrency(chargeTotals.collected)} />
        <StatCard label="Outstanding" value={formatCurrency(chargeTotals.outstanding)} />
        <StatCard label="Overdue" value={formatCurrency(chargeTotals.overdue)} />
        <StatCard label="Tenant Credit" value={formatCurrency(totalCredit)} />
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            placeholder="Search by reference, tenant or transaction ref..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: "", label: "All charge statuses" },
              ...Object.entries(rentChargeStatusLabels).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
          />
        </div>
      </Card>

      {/* ---- Rent charges ---- */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-900">Rent Charges</h3>
        {loading ? (
          <Spinner />
        ) : filteredCharges.length === 0 ? (
          <Card className="p-8">
            <EmptyState
              title={rentCharges.length === 0 ? "No rent charges yet" : "No matches"}
              message={
                rentCharges.length === 0
                  ? "Generate charges from your active tenancies to start billing rent."
                  : "Try a different search term or status filter."
              }
              action={
                rentCharges.length === 0 && canGenerate ? (
                  <Button onClick={handleGenerateCharges}>+ Generate Charges</Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <Card className="p-0">
            <Table>
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Reference</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Tenant</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Period</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Due</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Amount Due</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Paid</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Outstanding</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Status</th>
                  <th className="text-right text-xs font-medium text-slate-500 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCharges.map(({ charge, computed }) => {
                  const expanded = expandedChargeId === charge.id;
                  const chargeAllocations = allocationsByCharge.get(charge.id) ?? [];
                  return (
                    <Fragment key={charge.id}>
                      <tr className="border-b hover:bg-slate-50">
                        <td className="text-xs font-medium text-slate-700 px-4 py-3">
                          <button
                            type="button"
                            className="flex items-center gap-1 text-left"
                            onClick={() => setExpandedChargeId(expanded ? null : charge.id)}
                          >
                            {expanded ? (
                              <ChevronDown className="h-4 w-4 text-slate-400" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-slate-400" />
                            )}
                            {charge.reference}
                          </button>
                        </td>
                        <td className="text-xs text-slate-700 px-4 py-3">
                          {tenancyLabel(charge.tenancyId)}
                        </td>
                        <td className="text-xs text-slate-700 px-4 py-3">
                          {formatDate(charge.periodStart)} – {formatDate(charge.periodEnd)}
                        </td>
                        <td className="text-xs text-slate-700 px-4 py-3">
                          {formatDate(charge.dueDate)}
                        </td>
                        <td className="text-xs text-slate-700 px-4 py-3">
                          {formatCurrency(charge.amountDue || 0)}
                        </td>
                        <td className="text-xs text-slate-700 px-4 py-3">
                          {formatCurrency(charge.amountPaid || 0)}
                        </td>
                        <td className="text-xs text-slate-700 px-4 py-3">
                          {formatCurrency(charge.outstanding || 0)}
                        </td>
                        <td className="text-xs px-4 py-3">
                          <Badge variant={chargeStatusVariant[computed] ?? "default"}>
                            {rentChargeStatusLabels[computed] || computed}
                          </Badge>
                        </td>
                        <td className="text-right px-4 py-3 whitespace-nowrap">
                          {canManage ? (
                            <>
                              {computed !== "paid" && computed !== "waived" && computed !== "cancelled" ? (
                                <Button
                                  size="sm"
                                  variant="success"
                                  loading={busyId === charge.id}
                                  onClick={() => handleVerifyCharge(charge)}
                                >
                                  Verify
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setReverseTarget(charge)}
                                >
                                  Reverse
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="ml-2"
                                onClick={() => openChargeEdit(charge)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                className="ml-2"
                                onClick={() => setDeleteChargeTarget(charge)}
                              >
                                Delete
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-slate-400">Accountant+ required</span>
                          )}
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="border-b bg-slate-50/70">
                          <td colSpan={9} className="px-4 py-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Payments applied to this charge
                            </p>
                            {chargeAllocations.length === 0 ? (
                              <p className="text-xs text-slate-400">
                                No payments have been applied to this charge yet.
                              </p>
                            ) : (
                              <ul className="space-y-1">
                                {chargeAllocations.map((allocation) => {
                                  const payment = payments.find((p) => p.id === allocation.paymentId);
                                  return (
                                    <li
                                      key={allocation.id}
                                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs"
                                    >
                                      <span className="font-medium text-slate-700">
                                        {payment?.reference ?? "Unknown payment"}
                                      </span>
                                      <span className="text-slate-500">
                                        {paymentDateLabel(payment?.paymentDate)}
                                      </span>
                                      <span className="text-slate-500">
                                        {PAYMENT_METHODS.find((m) => m.value === payment?.method)?.label ??
                                          payment?.method ??
                                          "-"}
                                      </span>
                                      <span className="text-slate-500">{tenantName(payment?.tenantId)}</span>
                                      <span className="font-semibold text-slate-900">
                                        {formatCurrency(allocation.amountAllocated)}
                                      </span>
                                      {payment && (
                                        <Badge variant={paymentStatusVariant[payment.status] ?? "default"}>
                                          {payment.status}
                                        </Badge>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        )}
      </div>

      {/* ---- Payments ---- */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-slate-900">Payment Receipts</h3>
          {canManage && (
            <Button size="sm" variant="outline" onClick={openPaymentForm}>
              + Record Payment
            </Button>
          )}
        </div>
        {loading ? (
          <Spinner />
        ) : filteredPayments.length === 0 ? (
          <Card className="p-8">
            <EmptyState
              title={payments.length === 0 ? "No payments recorded" : "No matches"}
              message={
                payments.length === 0
                  ? "Record a receipt — it is applied to the tenant's oldest charges first, and any excess is held as credit."
                  : "Try a different search term."
              }
              action={canManage ? <Button onClick={openPaymentForm}>+ Record Payment</Button> : undefined}
            />
          </Card>
        ) : (
          <Card className="p-0">
            <Table>
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Date</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Reference</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Tenant</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Amount</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Allocated</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Credit</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Method</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Status</th>
                  <th className="text-right text-xs font-medium text-slate-500 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment) => {
                  const allocated = allocatedByPayment.get(payment.id) ?? 0;
                  const unallocated = Math.max(0, (payment.amount || 0) - allocated);
                  return (
                    <tr key={payment.id} className="border-b hover:bg-slate-50">
                      <td className="text-xs px-4 py-3 text-slate-700">
                        {paymentDateLabel(payment.paymentDate)}
                      </td>
                      <td className="text-xs px-4 py-3 font-medium text-slate-700">
                        {payment.reference}
                      </td>
                      <td className="text-xs px-4 py-3 text-slate-700">
                        {tenantName(payment.tenantId)}
                      </td>
                      <td className="text-xs px-4 py-3 text-slate-700">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="text-xs px-4 py-3 text-slate-700">
                        {formatCurrency(allocated)}
                      </td>
                      <td className="text-xs px-4 py-3 text-slate-700">
                        {unallocated > 0 ? formatCurrency(unallocated) : "—"}
                      </td>
                      <td className="text-xs px-4 py-3 text-slate-700">
                        {PAYMENT_METHODS.find((m) => m.value === payment.method)?.label ?? payment.method}
                      </td>
                      <td className="text-xs px-4 py-3">
                        <Badge variant={paymentStatusVariant[payment.status] ?? "default"}>
                          {payment.status}
                        </Badge>
                      </td>
                      <td className="text-right px-4 py-3 whitespace-nowrap">
                        {canManage ? (
                          <>
                            {payment.status === "pending" && (
                              <Button
                                size="sm"
                                variant="success"
                                loading={busyId === payment.id}
                                onClick={() => handleVerifyPayment(payment)}
                              >
                                Verify
                              </Button>
                            )}
                            {payment.status !== "reversed" && allocated === 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                className={payment.status === "pending" ? "ml-2" : ""}
                                loading={busyId === payment.id}
                                onClick={() => handleAllocatePayment(payment)}
                              >
                                Allocate
                              </Button>
                            )}
                            {payment.status !== "reversed" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="ml-2"
                                loading={busyId === payment.id}
                                onClick={() => handleReversePayment(payment)}
                              >
                                Reverse
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="ml-2"
                              onClick={() => openPaymentEdit(payment)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              className="ml-2"
                              onClick={() => setDeletePaymentTarget(payment)}
                            >
                              Delete
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">Read only</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        )}
      </div>

      {/* ---- Charge edit ---- */}
      <Modal
        open={!!editTarget}
        onClose={() => {
          setEditTarget(null);
          setEditForm(null);
        }}
        title="Edit Rent Charge"
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setEditTarget(null);
                setEditForm(null);
              }}
              disabled={savingEdit}
            >
              Cancel
            </Button>
            <Button variant="primary" loading={savingEdit} onClick={handleSaveChargeEdit}>
              Save Changes
            </Button>
          </>
        }
      >
        {editForm && (
          <form onSubmit={handleSaveChargeEdit} className="space-y-4">
            <Input
              label="Reference"
              value={editForm.reference}
              onChange={(e) => setEditForm({ ...editForm, reference: e.target.value })}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Period Start"
                type="date"
                value={editForm.periodStart}
                onChange={(e) => setEditForm({ ...editForm, periodStart: e.target.value })}
              />
              <Input
                label="Period End"
                type="date"
                value={editForm.periodEnd}
                onChange={(e) => setEditForm({ ...editForm, periodEnd: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input
                label="Due Date"
                type="date"
                value={editForm.dueDate}
                onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
              />
              <Input
                label="Amount Due (₦)"
                type="number"
                required
                value={editForm.amountDue}
                onChange={(e) => setEditForm({ ...editForm, amountDue: e.target.value })}
              />
              <Input
                label="Outstanding (₦)"
                type="number"
                value={editForm.outstanding}
                onChange={(e) => setEditForm({ ...editForm, outstanding: e.target.value })}
              />
            </div>
            <Select
              label="Status"
              value={editForm.status}
              onChange={(e) =>
                setEditForm({ ...editForm, status: e.target.value as RentChargeStatus })
              }
              options={Object.entries(rentChargeStatusLabels).map(([value, label]) => ({
                value,
                label,
              }))}
            />
            <p className="text-xs text-slate-400">
              Amount paid is recalculated as amount due minus outstanding.
            </p>
            <button type="submit" className="hidden" aria-hidden="true" />
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!reverseTarget}
        title="Reverse charge"
        message={`Reverse ${reverseTarget?.reference ?? "this charge"}? Recorded payments against it will be cleared and the full balance restored.`}
        confirmLabel="Reverse"
        danger
        loading={working}
        onConfirm={handleReverseCharge}
        onCancel={() => setReverseTarget(null)}
      />

      <ConfirmDialog
        open={!!deleteChargeTarget}
        title="Delete rent charge"
        message={`Permanently delete ${deleteChargeTarget?.reference ?? "this rent charge"}? Any payment allocations against it will be removed (the payments themselves are kept). This cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={working}
        onConfirm={handleDeleteCharge}
        onCancel={() => setDeleteChargeTarget(null)}
      />

      {/* ---- Record payment ---- */}
      <Modal
        open={paymentFormOpen}
        onClose={() => setPaymentFormOpen(false)}
        title="Record Payment"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setPaymentFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} onClick={handleRecordPayment}>
              Record Payment
            </Button>
          </>
        }
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <SearchableSelect
            label="Tenant"
            value={paymentForm.tenantId}
            onChange={(value) => setPaymentForm({ ...paymentForm, tenantId: value })}
            placeholder="Search and select the tenant..."
            options={tenants.map((t) => ({
              value: t.id,
              label: `${t.firstName} ${t.lastName}`.trim() || t.phone,
            }))}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Amount (₦)"
              type="number"
              required
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
              placeholder="e.g. 500000"
            />
            <Select
              label="Method"
              value={paymentForm.method}
              onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value as PaymentMethod })}
              options={PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label }))}
            />
          </div>
          <Input
            label="Transaction Reference (optional)"
            value={paymentForm.transactionRef}
            onChange={(e) => setPaymentForm({ ...paymentForm, transactionRef: e.target.value })}
            placeholder="e.g. TRF-8892013"
          />
          <Input
            label="Notes (optional)"
            value={paymentForm.notes}
            onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
            placeholder="e.g. Part payment for Q1 rent"
          />
          <p className="text-xs text-slate-400">
            The receipt is applied to the tenant's oldest outstanding charges first. Any amount
            above what is owed is held as tenant credit and applied to future charges.
          </p>
          <button type="submit" className="hidden" aria-hidden="true" />
        </form>
      </Modal>

      {/* ---- Payment edit ---- */}
      <Modal
        open={!!paymentEditTarget}
        onClose={() => {
          setPaymentEditTarget(null);
          setPaymentEditForm(null);
        }}
        title="Edit Payment"
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setPaymentEditTarget(null);
                setPaymentEditForm(null);
              }}
              disabled={savingPaymentEdit}
            >
              Cancel
            </Button>
            <Button variant="primary" loading={savingPaymentEdit} onClick={handleSavePaymentEdit}>
              Save Changes
            </Button>
          </>
        }
      >
        {paymentEditForm && paymentEditTarget && (
          <form onSubmit={handleSavePaymentEdit} className="space-y-4">
            <p className="text-sm text-slate-500">
              {paymentEditTarget.reference} · {tenantName(paymentEditTarget.tenantId)}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Amount (₦)"
                type="number"
                required
                value={paymentEditForm.amount}
                onChange={(e) => setPaymentEditForm({ ...paymentEditForm, amount: e.target.value })}
              />
              <Select
                label="Method"
                value={paymentEditForm.method}
                onChange={(e) =>
                  setPaymentEditForm({ ...paymentEditForm, method: e.target.value as PaymentMethod })
                }
                options={PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label }))}
              />
            </div>
            <Input
              label="Payment Date"
              type="date"
              value={paymentEditForm.paymentDate}
              onChange={(e) => setPaymentEditForm({ ...paymentEditForm, paymentDate: e.target.value })}
            />
            <Input
              label="Transaction Reference (optional)"
              value={paymentEditForm.transactionRef}
              onChange={(e) => setPaymentEditForm({ ...paymentEditForm, transactionRef: e.target.value })}
              placeholder="e.g. TRF-8892013"
            />
            <Input
              label="Notes (optional)"
              value={paymentEditForm.notes}
              onChange={(e) => setPaymentEditForm({ ...paymentEditForm, notes: e.target.value })}
              placeholder="e.g. Part payment for Q1 rent"
            />
            <p className="text-xs text-slate-400">
              Changing the amount re-applies this payment to the tenant's outstanding charges and
              recalculates any credit.
            </p>
            <button type="submit" className="hidden" aria-hidden="true" />
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deletePaymentTarget}
        title="Delete payment"
        message={`Permanently delete ${deletePaymentTarget?.reference ?? "this payment"}? Any rent charge allocations from it will be released, the charges' payment status reversed, and any credit it created withdrawn. This cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={working}
        onConfirm={handleDeletePayment}
        onCancel={() => setDeletePaymentTarget(null)}
      />
    </div>
  );
}
