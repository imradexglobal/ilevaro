import { useCallback, useEffect, useMemo, useState } from "react";
import { Route, Routes, useNavigate } from "react-router-dom";
import { useAgency, useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { EmptyState, Spinner } from "@/components/ui/States";
import {
  deleteTenancyCascade,
  getTenancyDependents,
  queryAgencyCollection,
  setUnitStatus,
  syncPropertyOccupancy,
  updateAgencyDoc,
  type TenancyDependents,
} from "@/lib/firestore";
import type { PropertyRecord } from "@/lib/property";
import {
  TENANCY_STATUS_VARIANT,
  durationLabel,
  sortableTime,
  toDate,
  type TenancyRecord,
} from "@/lib/tenancy";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Tenant, TenancyStatus } from "@/lib/types";
import { TenancyFormPage } from "./TenancyFormPage";

const MANAGE_ROLES = ["agency_owner", "agency_admin", "property_manager", "platform_admin"];

export function TenanciesPage() {
  return (
    <Routes>
      <Route index element={<TenancyListPage />} />
      <Route path="new" element={<TenancyFormPage />} />
      <Route path=":tenancyId/edit" element={<TenancyFormPage />} />
    </Routes>
  );
}

function TenancyListPage() {
  const { user, agencyId } = useAuth();
  const { agencyRole } = useAgency();
  const navigate = useNavigate();
  const toast = useToast();

  const [tenancies, setTenancies] = useState<TenancyRecord[]>([]);
  const [properties, setProperties] = useState<PropertyRecord[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"tenancies" | "history">("tenancies");
  const [search, setSearch] = useState("");
  const [historyProperty, setHistoryProperty] = useState("");

  const [terminateTarget, setTerminateTarget] = useState<TenancyRecord | null>(null);
  const [exitReason, setExitReason] = useState("");
  const [terminating, setTerminating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<TenancyRecord | null>(null);
  const [dependents, setDependents] = useState<TenancyDependents | null>(null);
  const [loadingDeps, setLoadingDeps] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canManage = MANAGE_ROLES.includes(agencyRole ?? "");

  const load = useCallback(async () => {
    if (!agencyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [tenancyDocs, propertyDocs, tenantDocs] = await Promise.all([
        queryAgencyCollection(agencyId, "tenancies"),
        queryAgencyCollection(agencyId, "properties"),
        queryAgencyCollection(agencyId, "tenants"),
      ]);
      setTenancies(tenancyDocs as unknown as TenancyRecord[]);
      setProperties(propertyDocs as unknown as PropertyRecord[]);
      setTenants(tenantDocs as unknown as Tenant[]);
    } catch (err) {
      toast.error("Failed to load tenancies");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [agencyId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep every property that has a tenancy in step with its units/tenancy state
  // so occupancy statuses that drifted before this automation self-correct.
  useEffect(() => {
    if (!agencyId || loading || tenancies.length === 0) return;
    const propertyIds = Array.from(new Set(tenancies.map((t) => t.propertyId).filter(Boolean)));
    void Promise.all(propertyIds.map((id) => syncPropertyOccupancy(agencyId, id)));
  }, [agencyId, loading, tenancies]);

  const propertyById = useCallback(
    (id: string) => properties.find((p) => p.id === id),
    [properties]
  );

  const propertyName = (id: string) => propertyById(id)?.name ?? "Unknown property";

  const tenantName = (id: string) => {
    const t = tenants.find((x) => x.id === id);
    if (!t) return "Unknown tenant";
    return `${t.firstName} ${t.lastName}`.trim() || t.phone || "Unnamed tenant";
  };

  /** Keep the unit's availability in step with the tenancy that occupies it. */
  const syncUnitStatus = async (propertyId: string, unitId: string | undefined, status: string) => {
    if (!agencyId || !propertyId || !unitId) return;
    await setUnitStatus(agencyId, propertyId, unitId, status as never);
  };

  const setStatus = async (
    tenancy: TenancyRecord,
    status: TenancyStatus,
    reason?: string
  ) => {
    if (!agencyId) return;
    try {
      await updateAgencyDoc(agencyId, "tenancies", tenancy.id, {
        status,
        ...(reason ? { exitReason: reason } : {}),
      });
      if (status === "active") {
        await syncUnitStatus(tenancy.propertyId, tenancy.unitId, "occupied");
      } else if (status === "terminated" || status === "expired" || status === "renewed") {
        await syncUnitStatus(tenancy.propertyId, tenancy.unitId, "available");
      }
      await syncPropertyOccupancy(agencyId, tenancy.propertyId);
      toast.success(`Tenancy marked ${status}`);
      await load();
    } catch (err) {
      toast.error("Failed to update tenancy");
      console.error(err);
    }
  };

  const openTerminate = (tenancy: TenancyRecord) => {
    setTerminateTarget(tenancy);
    setExitReason(tenancy.exitReason ?? "");
  };

  const handleTerminate = async () => {
    if (!terminateTarget) return;
    setTerminating(true);
    try {
      await setStatus(terminateTarget, "terminated", exitReason.trim() || undefined);
      setTerminateTarget(null);
      setExitReason("");
    } finally {
      setTerminating(false);
    }
  };

  const openDelete = async (tenancy: TenancyRecord) => {
    setDeleteTarget(tenancy);
    setDependents(null);
    if (!agencyId) return;
    setLoadingDeps(true);
    try {
      const counts = await getTenancyDependents(agencyId, tenancy.id);
      setDependents(counts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDeps(false);
    }
  };

  const handleDelete = async () => {
    if (!agencyId || !deleteTarget) return;
    setDeleting(true);
    try {
      const removed = await deleteTenancyCascade(agencyId, deleteTarget.id);
      await syncUnitStatus(deleteTarget.propertyId, deleteTarget.unitId, "available");
      await syncPropertyOccupancy(agencyId, deleteTarget.propertyId);
      toast.success(
        `Tenancy deleted along with ${removed.rentCharges} rent charge(s), ${removed.deposits} deposit(s) and ${removed.commissions} commission(s)`
      );
      setDeleteTarget(null);
      setDependents(null);
      await load();
    } catch (err) {
      toast.error("Failed to delete tenancy");
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = tenancies.filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      propertyName(t.propertyId).toLowerCase().includes(q) ||
      tenantName(t.tenantId).toLowerCase().includes(q)
    );
  });

  const history = useMemo(() => {
    return tenancies
      .filter((t) => !historyProperty || t.propertyId === historyProperty)
      .slice()
      .sort((a, b) => sortableTime(b.startDate) - sortableTime(a.startDate));
  }, [tenancies, historyProperty]);

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

  const deleteMessage = () => {
    if (!deleteTarget) return "";
    const name = propertyName(deleteTarget.propertyId);
    if (loadingDeps) return `Checking linked records for ${name}...`;
    const d = dependents;
    const parts: string[] = [];
    if (d) {
      if (d.rentCharges) parts.push(`${d.rentCharges} rent charge(s)`);
      if (d.deposits) parts.push(`${d.deposits} deposit(s)`);
      if (d.commissions) parts.push(`${d.commissions} commission(s)`);
    }
    const childText = parts.length
      ? ` It will also delete ${parts.join(", ")}.`
      : " It has no linked records.";
    const paymentText =
      d && d.payments
        ? ` ${d.payments} payment(s) will be kept but unlinked from this tenancy.`
        : "";
    return `Permanently delete the tenancy for ${tenantName(deleteTarget.tenantId)} at ${name}?${childText}${paymentText} This cannot be undone.`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Tenancies</h2>
          <p className="mt-1 text-sm text-slate-500">
            Assign properties to tenants, manage lease terms and track property history.
          </p>
        </div>
        {canManage && (
          <Button variant="primary" onClick={() => navigate("/tenancies/new")}>
            + Assign Property
          </Button>
        )}
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium ${
            tab === "tenancies"
              ? "border-b-2 border-indigo-600 text-indigo-600"
              : "text-slate-500 hover:text-slate-700"
          }`}
          onClick={() => setTab("tenancies")}
        >
          Active Tenancies
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium ${
            tab === "history"
              ? "border-b-2 border-indigo-600 text-indigo-600"
              : "text-slate-500 hover:text-slate-700"
          }`}
          onClick={() => setTab("history")}
        >
          Property History
        </button>
      </div>

      {tab === "tenancies" ? (
        <>
          <Card className="p-4">
            <Input
              placeholder="Search tenancies by property or tenant..."
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
                title={tenancies.length === 0 ? "No tenancies yet" : "No matches"}
                message={
                  tenancies.length === 0
                    ? "Assign a property to a tenant to start generating rent charges."
                    : "Try a different search term."
                }
                action={
                  canManage ? (
                    <Button onClick={() => navigate("/tenancies/new")}>+ Assign Property</Button>
                  ) : undefined
                }
              />
            </Card>
          ) : (
            <Card className="p-0">
              <Table>
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Property</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Tenant</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Rent</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Frequency</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">End Date</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Status</th>
                    {canManage && (
                      <th className="text-right text-xs font-medium text-slate-500 px-6 py-3">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((tenancy) => (
                    <tr key={tenancy.id} className="border-b hover:bg-slate-50">
                      <td className="text-xs px-6 py-3">
                        <p className="font-medium text-slate-700">{propertyName(tenancy.propertyId)}</p>
                        {tenancy.unitLabel || tenancy.unitId ? (
                          <p className="text-slate-400">Unit {tenancy.unitLabel || tenancy.unitId}</p>
                        ) : null}
                      </td>
                      <td className="text-xs px-6 py-3 text-slate-700">
                        {tenantName(tenancy.tenantId)}
                      </td>
                      <td className="text-xs px-6 py-3 text-slate-700">
                        {formatCurrency(tenancy.rentAmount ?? 0)}
                      </td>
                      <td className="text-xs px-6 py-3 text-slate-700">
                        {(tenancy.rentFrequency ?? "-").replace(/_/g, " ")}
                      </td>
                      <td className="text-xs px-6 py-3 text-slate-700">
                        {toDate(tenancy.endDate) ? formatDate(toDate(tenancy.endDate)!) : "-"}
                      </td>
                      <td className="text-xs px-6 py-3">
                        <Badge variant={TENANCY_STATUS_VARIANT[tenancy.status] ?? "default"}>
                          {tenancy.status}
                        </Badge>
                      </td>
                      {canManage && (
                        <td className="text-right px-6 py-3 whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/tenancies/${tenancy.id}/edit`)}
                          >
                            Edit
                          </Button>
                          {tenancy.status !== "active" && (
                            <Button
                              size="sm"
                              variant="success"
                              className="ml-2"
                              onClick={() => setStatus(tenancy, "active")}
                            >
                              Activate
                            </Button>
                          )}
                          {tenancy.status === "active" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="ml-2"
                              onClick={() => openTerminate(tenancy)}
                            >
                              Terminate
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="danger"
                            className="ml-2"
                            onClick={() => openDelete(tenancy)}
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
        </>
      ) : (
        <>
          <Card className="p-4">
            <Select
              value={historyProperty}
              onChange={(e) => setHistoryProperty(e.target.value)}
              options={[
                { value: "", label: "All Properties" },
                ...properties.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
          </Card>

          {loading ? (
            <Spinner />
          ) : history.length === 0 ? (
            <Card className="p-8">
              <EmptyState
                title="No history yet"
                message="Once properties have been assigned to tenants, their occupancy history will appear here."
              />
            </Card>
          ) : (
            <Card className="p-0">
              <Table>
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Property</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Tenant</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Period</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Duration</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Exit Reason</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((tenancy) => (
                    <tr key={tenancy.id} className="border-b hover:bg-slate-50">
                      <td className="text-xs px-6 py-3 font-medium text-slate-700">
                        {propertyName(tenancy.propertyId)}
                        {(tenancy.unitLabel || tenancy.unitId) && (
                          <span className="text-slate-400">
                            {" "}
                            · Unit {tenancy.unitLabel || tenancy.unitId}
                          </span>
                        )}
                      </td>
                      <td className="text-xs px-6 py-3 text-slate-700">
                        {tenantName(tenancy.tenantId)}
                      </td>
                      <td className="text-xs px-6 py-3 text-slate-700">
                        {toDate(tenancy.startDate) ? formatDate(toDate(tenancy.startDate)!) : "-"}
                        {" – "}
                        {toDate(tenancy.endDate) ? formatDate(toDate(tenancy.endDate)!) : "present"}
                      </td>
                      <td className="text-xs px-6 py-3 text-slate-700">
                        {durationLabel(
                          tenancy.startDate,
                          tenancy.status === "active" ? null : tenancy.endDate
                        )}
                      </td>
                      <td className="text-xs px-6 py-3 text-slate-700">
                        {tenancy.exitReason || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="text-xs px-6 py-3">
                        <Badge variant={TENANCY_STATUS_VARIANT[tenancy.status] ?? "default"}>
                          {tenancy.status}
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

      <Modal
        open={!!terminateTarget}
        onClose={() => setTerminateTarget(null)}
        title="Terminate tenancy"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setTerminateTarget(null)} disabled={terminating}>
              Cancel
            </Button>
            <Button variant="danger" loading={terminating} onClick={handleTerminate}>
              Terminate
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-600">
          Mark the tenancy for{" "}
          <span className="font-medium">
            {terminateTarget ? tenantName(terminateTarget.tenantId) : ""}
          </span>{" "}
          as terminated. This is recorded in the property history.
        </p>
        <Textarea
          label="Why did the tenant leave? (optional)"
          value={exitReason}
          onChange={(e) => setExitReason(e.target.value)}
          placeholder="e.g. Lease ended, relocating, rent arrears"
        />
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete tenancy"
        message={deleteMessage()}
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteTarget(null);
          setDependents(null);
        }}
      />
    </div>
  );
}
