import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAgency, useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { EmptyState, Spinner } from "@/components/ui/States";
import {
  createAgencyDoc,
  getAgencyDoc,
  queryAgencyCollection,
  queryUnits,
  setUnitStatus,
  syncPropertyOccupancy,
  updateAgencyDoc,
  type UnitRecord,
  type UnitStatus,
} from "@/lib/firestore";
import { OCCUPANCY_LABELS, PROPERTY_TYPE_LABELS, UNIT_STATUS_LABELS, type PropertyRecord } from "@/lib/property";
import {
  EMPTY_TENANCY_FORM,
  FREQUENCIES,
  TENANCY_STATUS_OPTIONS,
  tenancyToForm,
  type TenancyForm,
  type TenancyRecord,
} from "@/lib/tenancy";
import { formatCurrency } from "@/lib/format";
import type { Owner, Tenant, TenancyStatus } from "@/lib/types";

const MANAGE_ROLES = ["agency_owner", "agency_admin", "property_manager", "platform_admin"];

type Tab = "assignment" | "billing" | "terms";

const TABS: { id: Tab; label: string; subtitle: string }[] = [
  {
    id: "assignment",
    label: "Assignment",
    subtitle: "Which property and unit is being let, to whom, and for how long.",
  },
  {
    id: "billing",
    label: "Rent & Billing",
    subtitle: "The rent amount, how often it is billed, and when payment is due.",
  },
  {
    id: "terms",
    label: "Deposits, Fees & Status",
    subtitle: "Upfront charges, the tenancy status and any notes or exit reason.",
  },
];

export function TenancyFormPage() {
  const { tenancyId } = useParams<{ tenancyId: string }>();
  const isEdit = Boolean(tenancyId);
  const { user, agencyId } = useAuth();
  const { agencyRole } = useAgency();
  const navigate = useNavigate();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("assignment");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [properties, setProperties] = useState<PropertyRecord[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [form, setForm] = useState<TenancyForm>(EMPTY_TENANCY_FORM);
  const [editing, setEditing] = useState<TenancyRecord | null>(null);
  const [propertyUnits, setPropertyUnits] = useState<UnitRecord[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);

  const canManage = MANAGE_ROLES.includes(agencyRole ?? "");

  const loadUnitsFor = useCallback(
    async (propertyId: string) => {
      if (!agencyId || !propertyId) {
        setPropertyUnits([]);
        return;
      }
      setLoadingUnits(true);
      try {
        setPropertyUnits(await queryUnits(agencyId, propertyId));
      } catch (err) {
        console.error("Failed to load property units", err);
        setPropertyUnits([]);
      } finally {
        setLoadingUnits(false);
      }
    },
    [agencyId]
  );

  const load = useCallback(async () => {
    if (!agencyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [propertyDocs, tenantDocs, ownerDocs] = await Promise.all([
        queryAgencyCollection(agencyId, "properties"),
        queryAgencyCollection(agencyId, "tenants"),
        queryAgencyCollection(agencyId, "owners"),
      ]);
      setProperties(propertyDocs as unknown as PropertyRecord[]);
      setTenants(tenantDocs as unknown as Tenant[]);
      setOwners(ownerDocs as unknown as Owner[]);

      if (tenancyId) {
        const doc = await getAgencyDoc(agencyId, "tenancies", tenancyId);
        if (!doc) {
          toast.error("Tenancy not found");
          navigate("/tenancies", { replace: true });
          return;
        }
        const record = doc as unknown as TenancyRecord;
        setEditing(record);
        setForm(tenancyToForm(record));
        await loadUnitsFor(record.propertyId ?? "");
      }
    } catch (err) {
      toast.error("Failed to load tenancy");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [agencyId, tenancyId, navigate, toast, loadUnitsFor]);

  useEffect(() => {
    void load();
  }, [load]);

  const propertyById = (id: string) => properties.find((p) => p.id === id);

  const selectedProperty = form.propertyId ? propertyById(form.propertyId) : undefined;

  const landlordLabel = (id: string) => {
    const o = owners.find((x) => x.id === id);
    if (!o) return null;
    return o.businessName ? `${o.fullName} (${o.businessName})` : o.fullName;
  };

  const unitOptions = useMemo(() => {
    const options = propertyUnits.map((u) => ({
      value: u.id,
      label: `${u.label || "Unit"}${u.type ? ` · ${u.type}` : ""}${
        u.status && u.status !== "available" ? ` (${UNIT_STATUS_LABELS[u.status] ?? u.status})` : ""
      }`,
    }));
    if (form.unitId && !options.some((o) => o.value === form.unitId)) {
      options.unshift({ value: form.unitId, label: `${form.unitId} (existing)` });
    }
    return [{ value: "", label: "Select unit..." }, ...options];
  }, [propertyUnits, form.unitId]);

  const handleSelectProperty = (propertyId: string) => {
    const prop = propertyById(propertyId);
    setForm((prev) => ({
      ...prev,
      propertyId,
      unitId: "",
      rentAmount: prev.rentAmount || !prop?.askingRent ? prev.rentAmount : String(prop.askingRent),
    }));
    void loadUnitsFor(propertyId);
  };

  const handleSelectUnit = (unitId: string) => {
    const unit = propertyUnits.find((u) => u.id === unitId);
    setForm((prev) => ({
      ...prev,
      unitId,
      rentAmount: prev.rentAmount || !unit?.annualRent ? prev.rentAmount : String(unit.annualRent),
    }));
  };

  const goBack = () => navigate("/tenancies");

  /** Keep the unit's availability and the property's occupancy in step. */
  const syncOccupancy = async (
    propertyId: string,
    unitId: string | undefined,
    status: UnitStatus
  ) => {
    if (!agencyId || !propertyId) return;
    if (unitId) await setUnitStatus(agencyId, propertyId, unitId, status);
    await syncPropertyOccupancy(agencyId, propertyId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyId) return;
    if (!form.propertyId || !form.tenantId) {
      setTab("assignment");
      toast.error("Select the property and the tenant");
      return;
    }
    if (!form.startDate || !form.endDate) {
      setTab("assignment");
      toast.error("Start and end dates are required");
      return;
    }
    if (!form.rentAmount) {
      setTab("billing");
      toast.error("Rent amount is required");
      return;
    }
    if (!loadingUnits && propertyUnits.length > 0 && !form.unitId) {
      setTab("assignment");
      toast.error("Select the unit being rented out");
      return;
    }
    setSaving(true);
    try {
      const selectedUnit = propertyUnits.find((u) => u.id === form.unitId);
      const unitId = form.unitId.trim() || undefined;
      const unitLabel = selectedUnit?.label || unitId;
      const payload = {
        agencyId,
        propertyId: form.propertyId,
        unitId,
        unitLabel,
        tenantId: form.tenantId,
        status: form.status,
        startDate: new Date(form.startDate),
        endDate: new Date(form.endDate),
        rentCommencementDate: new Date(form.startDate),
        rentAmount: Number(form.rentAmount),
        rentFrequency: form.rentFrequency,
        billingFrequency: form.billingFrequency,
        dueDay: Number(form.dueDay) || 1,
        gracePeriodDays: Number(form.gracePeriodDays) || 7,
        securityDeposit: Number(form.securityDeposit) || 0,
        agencyFee: Number(form.agencyFee) || 0,
        otherCharges: Number(form.otherCharges) || 0,
        exitReason: form.exitReason.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };

      if (isEdit && tenancyId) {
        await updateAgencyDoc(agencyId, "tenancies", tenancyId, payload);
        toast.success("Tenancy updated");
      } else {
        await createAgencyDoc(agencyId, "tenancies", crypto.randomUUID(), payload);
        toast.success("Property assigned to tenant");
      }

      // An active tenancy occupies its unit; a closed one frees it again.
      if (unitId) {
        if (form.status === "active") {
          await syncOccupancy(form.propertyId, unitId, "occupied");
        } else if (form.status === "terminated" || form.status === "expired") {
          await syncOccupancy(form.propertyId, unitId, "available");
        } else {
          await syncPropertyOccupancy(agencyId, form.propertyId);
        }
      } else {
        await syncPropertyOccupancy(agencyId, form.propertyId);
      }

      // The previous unit/property may have been swapped on an edit.
      if (
        editing &&
        (editing.propertyId !== form.propertyId || (editing.unitId ?? "") !== (unitId ?? ""))
      ) {
        await syncOccupancy(editing.propertyId, editing.unitId, "available");
      }

      navigate("/tenancies");
    } catch (err) {
      toast.error("Failed to save tenancy");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-xl font-bold text-slate-900">Sign in to manage tenancies</h2>
        <p className="mt-2 text-slate-500">Please sign in to access tenancy management.</p>
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
          message="Create your agency before creating tenancies."
          action={<Button onClick={() => navigate("/agency-profile")}>Create agency</Button>}
        />
      </Card>
    );
  }

  if (!canManage) {
    return (
      <Card className="p-8">
        <EmptyState
          title="You don't have permission to manage tenancies"
          message="Only owners, admins and property managers can assign or edit tenancies."
          action={<Button onClick={goBack}>Back to tenancies</Button>}
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
  const saveLabel = isEdit ? "Save Changes" : "Assign Property";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={goBack}
            className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            ← Back to tenancies
          </button>
          <h2 className="text-2xl font-bold text-slate-900">
            {isEdit ? "Edit Tenancy" : "Assign Property to Tenant"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {isEdit
              ? "Update the tenancy terms, unit and billing details."
              : "Link a property or unit to a tenant and set the lease terms."}
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
        {tab === "assignment" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Property"
                required
                value={form.propertyId}
                onChange={(e) => handleSelectProperty(e.target.value)}
                options={[
                  { value: "", label: "Select property..." },
                  ...properties.map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
              <Select
                label="Tenant"
                required
                value={form.tenantId}
                onChange={(e) => setForm({ ...form, tenantId: e.target.value })}
                options={[
                  { value: "", label: "Select tenant..." },
                  ...tenants.map((t) => ({
                    value: t.id,
                    label: `${t.firstName} ${t.lastName}`.trim() || t.phone,
                  })),
                ]}
              />
            </div>

            {properties.length === 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                No properties exist yet.{" "}
                <button
                  type="button"
                  className="font-medium underline"
                  onClick={() => navigate("/properties/new")}
                >
                  Create a property
                </button>{" "}
                before assigning it to a tenant.
              </div>
            )}

            {selectedProperty && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Property details
                </p>
                <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-slate-400">Reference</p>
                    <p className="text-sm text-slate-700">{selectedProperty.reference || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Type</p>
                    <p className="text-sm text-slate-700">
                      {PROPERTY_TYPE_LABELS[selectedProperty.type ?? ""] ||
                        selectedProperty.type ||
                        "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Occupancy</p>
                    <p className="text-sm text-slate-700">
                      {OCCUPANCY_LABELS[selectedProperty.occupancyStatus ?? ""] ||
                        selectedProperty.occupancyStatus ||
                        "-"}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-slate-400">Location</p>
                    <p className="text-sm text-slate-700">
                      {selectedProperty.address || "-"}
                      {selectedProperty.lga || selectedProperty.state
                        ? `, ${[selectedProperty.lga, selectedProperty.state].filter(Boolean).join(", ")}`
                        : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Units</p>
                    <p className="text-sm text-slate-700">{selectedProperty.unitCount ?? 0}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-slate-400">Landlord / Owner</p>
                    <p className="text-sm text-slate-700">
                      {(selectedProperty.ownerIds ?? []).map(landlordLabel).filter(Boolean).join(", ") ||
                        "Unassigned"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Asking Rent</p>
                    <p className="text-sm text-slate-700">
                      {selectedProperty.askingRent ? formatCurrency(selectedProperty.askingRent) : "-"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {propertyUnits.length > 0 ? (
                <Select
                  label="Unit"
                  required
                  value={form.unitId}
                  onChange={(e) => handleSelectUnit(e.target.value)}
                  options={unitOptions}
                />
              ) : (
                <Input
                  label="Unit (optional)"
                  value={form.unitId}
                  onChange={(e) => setForm({ ...form, unitId: e.target.value })}
                  placeholder={loadingUnits ? "Loading units..." : "e.g. 4B"}
                />
              )}
              <Input
                label="Start Date"
                type="date"
                required
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
              <Input
                label="End Date"
                type="date"
                required
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
            {propertyUnits.length > 0 && (
              <p className="text-xs text-slate-500">
                This property has {propertyUnits.length} unit{propertyUnits.length === 1 ? "" : "s"} —
                select the exact unit being rented out. Taking a unit marks it occupied; terminating
                or deleting the tenancy frees it again.
              </p>
            )}
          </div>
        )}

        {tab === "billing" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Rent Amount (₦)"
                type="number"
                required
                value={form.rentAmount}
                onChange={(e) => setForm({ ...form, rentAmount: e.target.value })}
                placeholder="e.g. 2500000"
              />
              <Select
                label="Rent Frequency"
                value={form.rentFrequency}
                onChange={(e) => setForm({ ...form, rentFrequency: e.target.value })}
                options={FREQUENCIES}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input
                label="Due Day"
                type="number"
                value={form.dueDay}
                onChange={(e) => setForm({ ...form, dueDay: e.target.value })}
              />
              <Input
                label="Grace Period (days)"
                type="number"
                value={form.gracePeriodDays}
                onChange={(e) => setForm({ ...form, gracePeriodDays: e.target.value })}
              />
              <Input
                label="Other Charges (₦)"
                type="number"
                value={form.otherCharges}
                onChange={(e) => setForm({ ...form, otherCharges: e.target.value })}
              />
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <span className="text-slate-500">Total due per billing period: </span>
              <span className="font-semibold text-slate-900">
                {formatCurrency((Number(form.rentAmount) || 0) + (Number(form.otherCharges) || 0))}
              </span>
              <span className="text-slate-400"> (rent + other charges)</span>
            </div>
          </div>
        )}

        {tab === "terms" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input
                label="Security Deposit (₦)"
                type="number"
                value={form.securityDeposit}
                onChange={(e) => setForm({ ...form, securityDeposit: e.target.value })}
              />
              <Input
                label="Agency Fee (₦)"
                type="number"
                value={form.agencyFee}
                onChange={(e) => setForm({ ...form, agencyFee: e.target.value })}
              />
              <Select
                label="Status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as TenancyStatus })}
                options={TENANCY_STATUS_OPTIONS}
              />
            </div>
            {(form.status === "terminated" || form.exitReason) && (
              <Input
                label="Exit Reason"
                value={form.exitReason}
                onChange={(e) => setForm({ ...form, exitReason: e.target.value })}
                placeholder="e.g. Relocated, lease not renewed"
              />
            )}
            <Textarea
              label="Notes (optional)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="e.g. Renewal expected after 12 months"
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
