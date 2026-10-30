import { useCallback, useEffect, useMemo, useState } from "react";
import { Route, Routes, useNavigate } from "react-router-dom";
import { useAgency, useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/Modal";
import { EmptyState, Spinner } from "@/components/ui/States";
import {
  archivePropertyDoc,
  deleteAgencyDoc,
  deleteUnitDoc,
  getAgencySettings,
  queryAgencyCollection,
  queryProperties,
  queryUnits,
  updatePropertyDoc,
  type Property,
  type UnitRecord,
  type UnitStatus,
} from "@/lib/firestore";
import {
  OCCUPANCY_BADGE_VARIANT,
  OCCUPANCY_LABELS,
  PROPERTY_TYPE_LABELS,
  UNIT_STATUS_BADGE_VARIANT,
  UNIT_STATUS_LABELS,
} from "@/lib/property";
import { DEFAULT_PROPERTY_TYPES, NIGERIAN_STATES } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import type { Owner } from "@/lib/types";
import { PropertyFormPage } from "./PropertyFormPage";

const MANAGE_ROLES = ["agency_owner", "agency_admin", "property_manager", "platform_admin"];

interface Vacancy {
  key: string;
  propertyId: string;
  propertyName: string;
  reference: string;
  location: string;
  landlordId?: string;
  label: string;
  type: string;
  rent?: number;
  status: UnitStatus;
}

export function PropertiesPage() {
  return (
    <Routes>
      <Route index element={<PropertyListPage />} />
      <Route path="new" element={<PropertyFormPage />} />
      <Route path=":propertyId/edit" element={<PropertyFormPage />} />
    </Routes>
  );
}

function PropertyListPage() {
  const { user, agencyId } = useAuth();
  const { agencyRole } = useAgency();
  const navigate = useNavigate();
  const toast = useToast();

  const [properties, setProperties] = useState<Property[]>([]);
  const [landlords, setLandlords] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"portfolio" | "vacancies">("portfolio");
  const [propertyTypes, setPropertyTypes] = useState<string[]>([...DEFAULT_PROPERTY_TYPES]);

  // Portfolio filters (applied client-side so the vacancies tab can reuse the
  // complete property list).
  const [search, setSearch] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterOccupancy, setFilterOccupancy] = useState("");
  const [filterLandlord, setFilterLandlord] = useState("");

  // Vacancy filters
  const [unitsByProperty, setUnitsByProperty] = useState<Record<string, UnitRecord[]>>({});
  const [vacancySearch, setVacancySearch] = useState("");
  const [vacancyState, setVacancyState] = useState("");
  const [vacancyType, setVacancyType] = useState("");
  const [vacancyStatus, setVacancyStatus] = useState("");

  const [archiveTarget, setArchiveTarget] = useState<Property | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Property | null>(null);
  const [working, setWorking] = useState(false);

  const canManage = MANAGE_ROLES.includes(agencyRole ?? "");

  const loadProperties = useCallback(async () => {
    if (!agencyId) {
      setProperties([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const docs = await queryProperties(agencyId);
      setProperties(docs as unknown as Property[]);
    } catch (err) {
      toast.error("Failed to load properties");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [agencyId, toast]);

  useEffect(() => {
    void loadProperties();
  }, [loadProperties]);

  const loadLandlords = useCallback(async () => {
    if (!agencyId) {
      setLandlords([]);
      return;
    }
    try {
      const docs = await queryAgencyCollection(agencyId, "owners");
      setLandlords(docs as unknown as Owner[]);
    } catch (err) {
      console.error(err);
    }
  }, [agencyId]);

  useEffect(() => {
    void loadLandlords();
  }, [loadLandlords]);

  const loadPropertyTypes = useCallback(async () => {
    if (!agencyId) {
      setPropertyTypes([...DEFAULT_PROPERTY_TYPES]);
      return;
    }
    try {
      const settings = await getAgencySettings(agencyId);
      setPropertyTypes(settings.propertyTypes);
    } catch (err) {
      console.error(err);
    }
  }, [agencyId]);

  useEffect(() => {
    void loadPropertyTypes();
  }, [loadPropertyTypes]);

  // Units are only needed for the vacancies finder, so they are fetched when the
  // tab is opened rather than on every portfolio load.
  useEffect(() => {
    if (tab !== "vacancies" || !agencyId || properties.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const entries = await Promise.all(
          properties.map(async (p) => [p.id, await queryUnits(agencyId, p.id)] as const)
        );
        if (!cancelled) setUnitsByProperty(Object.fromEntries(entries));
      } catch (err) {
        console.error(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, properties, agencyId]);

  const landlordLabel = (owner: Owner) =>
    owner.businessName ? `${owner.fullName} (${owner.businessName})` : owner.fullName;

  const landlordLabelById = (id?: string) => {
    if (!id) return null;
    const owner = landlords.find((l) => l.id === id);
    return owner ? landlordLabel(owner) : null;
  };

  const visibleProperties = useMemo(() => {
    const q = search.trim().toLowerCase();
    return properties.filter((p) => {
      if (filterState && p.state !== filterState) return false;
      if (filterType && p.type !== filterType) return false;
      if (filterOccupancy && p.occupancyStatus !== filterOccupancy) return false;
      if (filterLandlord && !(p.ownerIds ?? []).includes(filterLandlord)) return false;
      if (q) {
        const haystack = [p.name, p.reference, p.description, p.address]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [properties, search, filterState, filterType, filterOccupancy, filterLandlord]);

  const vacancies = useMemo(() => {
    const list: Vacancy[] = [];
    for (const prop of properties) {
      if (prop.status === "archived") continue;
      const units = unitsByProperty[prop.id] ?? [];
      const location = [prop.lga, prop.state].filter(Boolean).join(", ");
      if (units.length > 0) {
        for (const unit of units) {
          const status = (unit.status as UnitStatus) ?? "available";
          if (status === "occupied" || status === "inactive") continue;
          list.push({
            key: `${prop.id}_${unit.id}`,
            propertyId: prop.id,
            propertyName: prop.name,
            reference: prop.reference ?? "",
            location,
            landlordId: (prop.ownerIds ?? [])[0],
            label: unit.label || "Unit",
            type: unit.type || prop.unitType || PROPERTY_TYPE_LABELS[prop.type] || "-",
            rent: unit.annualRent,
            status,
          });
        }
      } else if (prop.occupancyStatus === "vacant") {
        list.push({
          key: prop.id,
          propertyId: prop.id,
          propertyName: prop.name,
          reference: prop.reference ?? "",
          location,
          landlordId: (prop.ownerIds ?? [])[0],
          label: "Whole property",
          type: prop.unitType || PROPERTY_TYPE_LABELS[prop.type] || "-",
          rent: prop.askingRent,
          status: "available",
        });
      }
    }
    return list;
  }, [properties, unitsByProperty]);

  const visibleVacancies = useMemo(() => {
    const q = vacancySearch.trim().toLowerCase();
    return vacancies.filter((v) => {
      if (vacancyState && !v.location.toLowerCase().includes(vacancyState.toLowerCase())) return false;
      if (vacancyType && v.type !== vacancyType) return false;
      if (vacancyStatus && v.status !== vacancyStatus) return false;
      if (q) {
        const haystack = [v.propertyName, v.reference, v.label, v.type, v.location]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [vacancies, vacancySearch, vacancyState, vacancyType, vacancyStatus]);

  const handleArchiveToggle = async () => {
    if (!agencyId || !archiveTarget) return;
    setWorking(true);
    try {
      if (archiveTarget.status === "archived") {
        await updatePropertyDoc(agencyId, archiveTarget.id, { status: "active" });
        toast.success("Property restored");
      } else {
        await archivePropertyDoc(agencyId, archiveTarget.id);
        toast.success("Property archived");
      }
      setArchiveTarget(null);
      await loadProperties();
    } catch (err) {
      toast.error("Failed to update property status");
      console.error(err);
    } finally {
      setWorking(false);
    }
  };

  const handleDelete = async () => {
    if (!agencyId || !deleteTarget) return;
    setWorking(true);
    try {
      const units = await queryUnits(agencyId, deleteTarget.id);
      await Promise.all(units.map((unit) => deleteUnitDoc(agencyId, deleteTarget.id, unit.id)));
      await deleteAgencyDoc(agencyId, "properties", deleteTarget.id);
      toast.success("Property deleted");
      setDeleteTarget(null);
      await loadProperties();
    } catch (err) {
      toast.error("Failed to delete property");
      console.error(err);
    } finally {
      setWorking(false);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Properties</h2>
          <p className="mt-1 text-sm text-slate-500">
            Portfolio of buildings, units and land under management.
          </p>
        </div>
        {canManage && tab === "portfolio" && (
          <Button onClick={() => navigate("/properties/new")} variant="primary">
            + New Property
          </Button>
        )}
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium ${
            tab === "portfolio"
              ? "border-b-2 border-indigo-600 text-indigo-600"
              : "text-slate-500 hover:text-slate-700"
          }`}
          onClick={() => setTab("portfolio")}
        >
          Portfolio
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium ${
            tab === "vacancies"
              ? "border-b-2 border-indigo-600 text-indigo-600"
              : "text-slate-500 hover:text-slate-700"
          }`}
          onClick={() => setTab("vacancies")}
        >
          Vacancies
          {vacancies.length > 0 && (
            <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              {vacancies.length}
            </span>
          )}
        </button>
      </div>

      {tab === "portfolio" ? (
        <>
          <Card className="p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Input
                placeholder="Search properties, reference, or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select
                value={filterState}
                onChange={(e) => setFilterState(e.target.value)}
                options={[
                  { value: "", label: "All States" },
                  ...NIGERIAN_STATES.map((s) => ({ value: s, label: s })),
                ]}
              />
              <Select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                options={[
                  { value: "", label: "All Types" },
                  ...Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => ({ value, label })),
                ]}
              />
              <Select
                value={filterOccupancy}
                onChange={(e) => setFilterOccupancy(e.target.value)}
                options={[
                  { value: "", label: "All Occupancy" },
                  ...Object.entries(OCCUPANCY_LABELS).map(([value, label]) => ({ value, label })),
                ]}
              />
              <Select
                value={filterLandlord}
                onChange={(e) => setFilterLandlord(e.target.value)}
                options={[
                  { value: "", label: "All Landlords" },
                  ...landlords.map((l) => ({ value: l.id, label: landlordLabel(l) })),
                ]}
              />
            </div>
          </Card>

          {loading ? (
            <Spinner />
          ) : visibleProperties.length === 0 ? (
            <Card className="p-8">
              <EmptyState
                title="No properties found"
                message={
                  properties.length === 0
                    ? "Create your first property to start tracking units, tenancies and rent."
                    : "No properties match the current filters."
                }
                action={
                  canManage ? (
                    <Button onClick={() => navigate("/properties/new")}>+ New Property</Button>
                  ) : undefined
                }
              />
            </Card>
          ) : (
            <Card className="p-0">
              <Table>
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Reference</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Name</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Type</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Location</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Landlord</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Occupancy</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Units</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Asking Rent</th>
                    <th className="text-right text-xs font-medium text-slate-500 px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProperties.map((prop) => (
                    <tr key={prop.id} className="border-b hover:bg-slate-50">
                      <td className="text-xs px-6 py-3">
                        <p className="font-medium text-slate-700">{prop.reference}</p>
                        {prop.status === "archived" && <Badge variant="default">Archived</Badge>}
                      </td>
                      <td className="text-xs px-6 py-3">
                        <p className="font-medium text-slate-700">{prop.name}</p>
                        {prop.description && (
                          <p className="text-slate-400 line-clamp-1">{prop.description}</p>
                        )}
                      </td>
                      <td className="text-xs text-slate-700 px-6 py-3">
                        <p>{PROPERTY_TYPE_LABELS[prop.type] || prop.type}</p>
                        {prop.unitType && <p className="text-slate-400">{prop.unitType}</p>}
                      </td>
                      <td className="text-xs text-slate-700 px-6 py-3">
                        <p>{prop.address || "-"}</p>
                        <p className="text-slate-400">
                          {[prop.lga, prop.state].filter(Boolean).join(", ") || "-"}
                        </p>
                      </td>
                      <td className="text-xs text-slate-700 px-6 py-3">
                        {landlordLabelById((prop.ownerIds ?? [])[0]) ?? (
                          <span className="text-amber-600">Unassigned</span>
                        )}
                      </td>
                      <td className="text-xs px-6 py-3">
                        <Badge variant={OCCUPANCY_BADGE_VARIANT[prop.occupancyStatus] ?? "default"}>
                          {OCCUPANCY_LABELS[prop.occupancyStatus] || prop.occupancyStatus}
                        </Badge>
                      </td>
                      <td className="text-xs text-slate-700 px-6 py-3">{prop.unitCount ?? 0}</td>
                      <td className="text-xs text-slate-700 px-6 py-3">
                        {prop.askingRent ? formatCurrency(prop.askingRent) : "-"}
                      </td>
                      <td className="text-right px-6 py-3 whitespace-nowrap">
                        {canManage ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/properties/${prop.id}/edit`)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="ml-2"
                              onClick={() => setArchiveTarget(prop)}
                            >
                              {prop.status === "archived" ? "Restore" : "Archive"}
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              className="ml-2"
                              onClick={() => setDeleteTarget(prop)}
                            >
                              Delete
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">View only</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}
        </>
      ) : (
        <>
          <Card className="p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                placeholder="Search vacant property, unit or reference..."
                value={vacancySearch}
                onChange={(e) => setVacancySearch(e.target.value)}
              />
              <Select
                value={vacancyState}
                onChange={(e) => setVacancyState(e.target.value)}
                options={[
                  { value: "", label: "All States" },
                  ...NIGERIAN_STATES.map((s) => ({ value: s, label: s })),
                ]}
              />
              <Select
                value={vacancyType}
                onChange={(e) => setVacancyType(e.target.value)}
                options={[
                  { value: "", label: "All Unit Types" },
                  ...propertyTypes.map((t) => ({ value: t, label: t })),
                ]}
              />
              <Select
                value={vacancyStatus}
                onChange={(e) => setVacancyStatus(e.target.value)}
                options={[
                  { value: "", label: "All Availability" },
                  { value: "available", label: "Available" },
                  { value: "reserved", label: "Reserved" },
                  { value: "under_maintenance", label: "Under Maintenance" },
                ]}
              />
            </div>
          </Card>

          {loading ? (
            <Spinner />
          ) : visibleVacancies.length === 0 ? (
            <Card className="p-8">
              <EmptyState
                title="No vacancies"
                message={
                  vacancies.length === 0
                    ? "Every unit is currently occupied. Vacant units and unlet properties will appear here."
                    : "No vacancies match the current filters."
                }
              />
            </Card>
          ) : (
            <Card className="p-0">
              <Table>
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Property</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Unit</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Type</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Location</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Landlord</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Rent</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Availability</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleVacancies.map((v) => (
                    <tr key={v.key} className="border-b hover:bg-slate-50">
                      <td className="text-xs px-6 py-3">
                        <p className="font-medium text-slate-700">{v.propertyName}</p>
                        <p className="text-slate-400">{v.reference}</p>
                      </td>
                      <td className="text-xs text-slate-700 px-6 py-3">{v.label}</td>
                      <td className="text-xs text-slate-700 px-6 py-3">{v.type}</td>
                      <td className="text-xs text-slate-700 px-6 py-3">{v.location || "-"}</td>
                      <td className="text-xs text-slate-700 px-6 py-3">
                        {landlordLabelById(v.landlordId) ?? (
                          <span className="text-amber-600">Unassigned</span>
                        )}
                      </td>
                      <td className="text-xs text-slate-700 px-6 py-3">
                        {v.rent ? formatCurrency(v.rent) : "-"}
                      </td>
                      <td className="text-xs px-6 py-3">
                        <Badge variant={UNIT_STATUS_BADGE_VARIANT[v.status] ?? "default"}>
                          {UNIT_STATUS_LABELS[v.status] ?? v.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!archiveTarget}
        title={archiveTarget?.status === "archived" ? "Restore property" : "Archive property"}
        message={
          archiveTarget?.status === "archived"
            ? `Restore ${archiveTarget?.name ?? "this property"} to the active portfolio?`
            : `Archive ${archiveTarget?.name ?? "this property"}? It will be hidden from active listings.`
        }
        confirmLabel={archiveTarget?.status === "archived" ? "Restore" : "Archive"}
        loading={working}
        onConfirm={handleArchiveToggle}
        onCancel={() => setArchiveTarget(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete property"
        message={`Permanently delete ${deleteTarget?.name ?? "this property"} and its units? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={working}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
