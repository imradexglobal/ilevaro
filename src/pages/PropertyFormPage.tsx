import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAgency, useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input, SearchableSelect, Select, Textarea } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { EmptyState, Spinner } from "@/components/ui/States";
import {
  createPropertyDoc,
  createUnitDoc,
  deleteUnitDoc,
  getAgencySettings,
  getPropertyDoc,
  queryAgencyCollection,
  queryUnits,
  updatePropertyDoc,
  updateUnitDoc,
  type Property,
  type UnitRecord,
  type UnitStatus,
} from "@/lib/firestore";
import type { Owner } from "@/lib/types";
import {
  EMPTY_PROPERTY_FORM,
  OCCUPANCY_LABELS,
  PROPERTY_TYPE_LABELS,
  UNIT_STATUS_LABELS,
  deriveOccupancy,
  unitToDraft,
  type PropertyFormValues,
  type UnitDraft,
} from "@/lib/property";
import { DEFAULT_PROPERTY_TYPES, NIGERIAN_STATES } from "@/lib/constants";
import { generateReference } from "@/lib/format";

const MANAGE_ROLES = ["agency_owner", "agency_admin", "property_manager", "platform_admin"];

type Tab = "details" | "units" | "ownership";

const TABS: { id: Tab; label: string; subtitle: string }[] = [
  {
    id: "details",
    label: "Property Details",
    subtitle: "Core details and location of the property.",
  },
  {
    id: "units",
    label: "Units",
    subtitle: "Break the property into the individual units that can be let out.",
  },
  {
    id: "ownership",
    label: "Ownership & Pricing",
    subtitle: "Who owns the property and the rent you expect for it.",
  },
];

export function PropertyFormPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const isEdit = Boolean(propertyId);
  const { user, agencyId } = useAuth();
  const { agencyRole } = useAgency();
  const navigate = useNavigate();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("details");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [landlords, setLandlords] = useState<Owner[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<string[]>([...DEFAULT_PROPERTY_TYPES]);
  const [originalUnits, setOriginalUnits] = useState<UnitRecord[]>([]);
  const [form, setForm] = useState<PropertyFormValues>(() => ({
    ...EMPTY_PROPERTY_FORM,
    reference: generateReference("PROP"),
  }));

  const canManage = MANAGE_ROLES.includes(agencyRole ?? "");

  const load = useCallback(async () => {
    if (!agencyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [ownerDocs, settings] = await Promise.all([
        queryAgencyCollection(agencyId, "owners"),
        getAgencySettings(agencyId),
      ]);
      setLandlords(ownerDocs as unknown as Owner[]);
      setPropertyTypes(settings.propertyTypes);

      if (propertyId) {
        const property = (await getPropertyDoc(agencyId, propertyId)) as unknown as Property | null;
        if (!property) {
          toast.error("Property not found");
          navigate("/properties", { replace: true });
          return;
        }
        const units = await queryUnits(agencyId, propertyId);
        setOriginalUnits(units);
        setForm({
          name: property.name ?? "",
          reference: property.reference ?? "",
          type: property.type ?? "residential_house",
          unitType: property.unitType ?? "",
          address: property.address ?? "",
          state: property.state ?? "",
          lga: property.lga ?? "",
          unitCount: String(property.unitCount ?? 1),
          occupancyStatus: property.occupancyStatus ?? "vacant",
          askingRent: property.askingRent != null ? String(property.askingRent) : "",
          description: property.description ?? "",
          landlordId: (property.ownerIds ?? [])[0] ?? "",
          units: units.map(unitToDraft),
        });
      }
    } catch (err) {
      toast.error("Failed to load property");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [agencyId, propertyId, navigate, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const landlordLabel = (owner: Owner) =>
    owner.businessName ? `${owner.fullName} (${owner.businessName})` : owner.fullName;

  const typeOptions = (current?: string) => {
    const opts = propertyTypes.map((t) => ({ value: t, label: t }));
    if (current && !propertyTypes.includes(current)) {
      opts.unshift({ value: current, label: current });
    }
    return [{ value: "", label: "Select type" }, ...opts];
  };

  const addUnit = () => {
    setForm((prev) => ({
      ...prev,
      units: [
        ...prev.units,
        {
          key: crypto.randomUUID(),
          label: `Unit ${prev.units.length + 1}`,
          type: prev.unitType || "",
          annualRent: "",
          status: "available",
        },
      ],
    }));
  };

  const updateUnitDraft = (key: string, patch: Partial<UnitDraft>) => {
    setForm((prev) => ({
      ...prev,
      units: prev.units.map((u) => (u.key === key ? { ...u, ...patch } : u)),
    }));
  };

  const removeUnitDraft = (key: string) => {
    setForm((prev) => ({ ...prev, units: prev.units.filter((u) => u.key !== key) }));
  };

  const goBack = () => navigate("/properties");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyId || !user) return;
    if (!form.name.trim() || !form.address.trim() || !form.state) {
      setTab("details");
      toast.error("Name, address and state are required");
      return;
    }
    if (!form.landlordId) {
      setTab("ownership");
      toast.error("Select the landlord (property owner)");
      return;
    }
    for (const unit of form.units) {
      if (!unit.label.trim()) {
        setTab("units");
        toast.error("Every unit needs a label");
        return;
      }
      if (!unit.type) {
        setTab("units");
        toast.error(`Select a type for unit "${unit.label}"`);
        return;
      }
    }
    setSaving(true);
    try {
      const hasUnits = form.units.length > 0;
      const id = propertyId ?? crypto.randomUUID();
      const payload = {
        agencyId,
        name: form.name.trim(),
        reference: form.reference.trim() || generateReference("PROP"),
        type: form.type,
        unitType: form.unitType || undefined,
        address: form.address.trim(),
        state: form.state,
        lga: form.lga.trim() || undefined,
        unitCount: hasUnits ? form.units.length : Number(form.unitCount) || 1,
        occupancyStatus: hasUnits ? deriveOccupancy(form.units) : form.occupancyStatus,
        askingRent: form.askingRent ? Number(form.askingRent) : undefined,
        description: form.description.trim() || undefined,
        ownerIds: [form.landlordId],
        status: "active",
      };

      if (isEdit) {
        await updatePropertyDoc(agencyId, id, payload);
      } else {
        await createPropertyDoc(agencyId, id, { ...payload, createdBy: user.uid });
      }

      // Units removed in the form are deleted so no orphaned unit is left behind.
      const removed = originalUnits.filter((u) => !form.units.some((d) => d.id === u.id));
      await Promise.all(removed.map((unit) => deleteUnitDoc(agencyId, id, unit.id)));

      await Promise.all(
        form.units.map((unit) => {
          const unitData = {
            label: unit.label.trim(),
            type: unit.type,
            annualRent: Number(unit.annualRent) || 0,
            status: unit.status,
          };
          return unit.id
            ? updateUnitDoc(agencyId, id, unit.id, unitData)
            : createUnitDoc(agencyId, id, crypto.randomUUID(), unitData);
        })
      );

      toast.success(isEdit ? "Property updated" : "Property created");
      navigate("/properties");
    } catch (err) {
      toast.error("Failed to save property");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-xl font-bold text-slate-900">Sign in to manage properties</h2>
        <p className="mt-2 text-slate-500">Please sign in to access your agency portfolio.</p>
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
          message="Create your agency before adding properties."
          action={<Button onClick={() => navigate("/agency-profile")}>Create agency</Button>}
        />
      </Card>
    );
  }

  if (!canManage) {
    return (
      <Card className="p-8">
        <EmptyState
          title="You don't have permission to edit properties"
          message="Only owners, admins and property managers can add or edit properties."
          action={<Button onClick={goBack}>Back to properties</Button>}
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

  const saveLabel = isEdit ? "Save Changes" : "Create Property";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={goBack}
            className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            ← Back to properties
          </button>
          <h2 className="text-2xl font-bold text-slate-900">
            {isEdit ? "Edit Property" : "New Property"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {isEdit
              ? "Update the property details, its units and ownership."
              : "Register a property, its units and the landlord who owns it."}
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
            {t.id === "units" && form.units.length > 0 && (
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {form.units.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <Card title={activeTab.label} subtitle={activeTab.subtitle}>
        {tab === "details" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Property Name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Marina Court"
              />
              <Input
                label="Reference"
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                placeholder="e.g. PROP-001"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Property Category"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                options={Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
              <Select
                label="Unit / Property Type"
                value={form.unitType}
                onChange={(e) => setForm({ ...form, unitType: e.target.value })}
                options={typeOptions(form.unitType)}
              />
            </div>
            <Input
              label="Address"
              required
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="e.g. 12 Marina Road"
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="State"
                required
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                options={[
                  { value: "", label: "Select state" },
                  ...NIGERIAN_STATES.map((s) => ({ value: s, label: s })),
                ]}
              />
              <Input
                label="LGA (optional)"
                value={form.lga}
                onChange={(e) => setForm({ ...form, lga: e.target.value })}
                placeholder="e.g. Eti-Osa"
              />
            </div>
            <Textarea
              label="Description (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Notes about the property, amenities or condition"
            />
          </div>
        )}

        {tab === "units" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-800">Units</p>
                <p className="text-xs text-slate-500">
                  Add a row for each lettable unit (e.g. a building with several flats). Leave empty
                  for a single-unit property.
                </p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={addUnit}>
                + Add unit
              </Button>
            </div>

            {form.units.length === 0 ? (
              <p className="rounded-md border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
                No units added — this property is treated as a single lettable space.
              </p>
            ) : (
              <div className="space-y-3">
                {form.units.map((unit) => (
                  <div
                    key={unit.key}
                    className="grid grid-cols-1 gap-3 rounded-md bg-slate-50 p-3 sm:grid-cols-4"
                  >
                    <Input
                      label="Label"
                      value={unit.label}
                      onChange={(e) => updateUnitDraft(unit.key, { label: e.target.value })}
                      placeholder="e.g. Flat 1"
                    />
                    <Select
                      label="Type"
                      value={unit.type}
                      onChange={(e) => updateUnitDraft(unit.key, { type: e.target.value })}
                      options={typeOptions(unit.type)}
                    />
                    <Input
                      label="Annual Rent (₦)"
                      type="number"
                      value={unit.annualRent}
                      onChange={(e) => updateUnitDraft(unit.key, { annualRent: e.target.value })}
                      placeholder="e.g. 1200000"
                    />
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Select
                          label="Status"
                          value={unit.status}
                          onChange={(e) =>
                            updateUnitDraft(unit.key, { status: e.target.value as UnitStatus })
                          }
                          options={Object.entries(UNIT_STATUS_LABELS).map(([value, label]) => ({
                            value,
                            label,
                          }))}
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        onClick={() => removeUnitDraft(unit.key)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
              {form.units.length === 0 ? (
                <Input
                  label="Unit Count"
                  type="number"
                  min={0}
                  value={form.unitCount}
                  onChange={(e) => setForm({ ...form, unitCount: e.target.value })}
                />
              ) : (
                <div className="space-y-1">
                  <span className="block text-sm font-medium text-slate-700">Unit Count</span>
                  <p className="flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
                    {form.units.length} (from units)
                  </p>
                </div>
              )}
              <Select
                label="Occupancy Status"
                value={form.units.length > 0 ? deriveOccupancy(form.units) : form.occupancyStatus}
                disabled={form.units.length > 0}
                onChange={(e) => setForm({ ...form, occupancyStatus: e.target.value })}
                options={
                  form.units.length > 0
                    ? [
                        {
                          value: deriveOccupancy(form.units),
                          label: `${OCCUPANCY_LABELS[deriveOccupancy(form.units)]} (from units)`,
                        },
                      ]
                    : Object.entries(OCCUPANCY_LABELS).map(([value, label]) => ({ value, label }))
                }
              />
              {form.units.length > 0 && (
                <p className="text-xs text-slate-400 sm:col-span-2">
                  Unit count and occupancy are calculated from the units above.
                </p>
              )}
            </div>
          </div>
        )}

        {tab === "ownership" && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Landlord / Owner <span className="text-red-500">*</span>
              </label>
              {landlords.length === 0 ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                  No landlords exist yet.{" "}
                  <button
                    type="button"
                    className="font-medium underline"
                    onClick={() => navigate("/landlords")}
                  >
                    Create a landlord first
                  </button>{" "}
                  before adding properties.
                </div>
              ) : (
                <SearchableSelect
                  value={form.landlordId}
                  onChange={(value) => setForm({ ...form, landlordId: value })}
                  placeholder="Search and select the property owner..."
                  emptyMessage="No landlord matches that search"
                  options={landlords.map((o) => ({
                    value: o.id,
                    label: `${landlordLabel(o)}${o.status === "archived" ? " (archived)" : ""}`,
                  }))}
                />
              )}
              <p className="mt-1 text-xs text-slate-400">
                Each property has one landlord. A landlord can own many properties.
              </p>
            </div>
            <Input
              label="Asking Rent (₦, optional)"
              type="number"
              value={form.askingRent}
              onChange={(e) => setForm({ ...form, askingRent: e.target.value })}
              placeholder="e.g. 2500000"
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
