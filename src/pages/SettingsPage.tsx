import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAgency, useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, Spinner } from "@/components/ui/States";
import { Input } from "@/components/ui/Input";
import {
  getAgencyDoc,
  getAgencySettings,
  queryAgencyCollection,
  updateAgencySettings,
} from "@/lib/firestore";
import {
  PLAN_TIERS,
  createSubscription,
  getSubscriptionByAgency,
  upgradePlan,
  type AgencySubscription,
  type PlanTier,
} from "@/lib/subscriptions";
import {
  getInvitations,
  updateInvitationStatus,
  type Invitation,
} from "@/lib/invitations";
import { formatDate } from "@/lib/format";

const ROLE_DESCRIPTIONS: { role: string; description: string }[] = [
  { role: "agency_owner", description: "Full access within the agency, billing and settings." },
  { role: "agency_admin", description: "Manage portfolio, operations and staff." },
  { role: "property_manager", description: "Manage assigned properties and record expenses." },
  { role: "accountant", description: "Payments, expenses, deposits and reporting." },
  { role: "field_agent", description: "Read assigned properties and tenancies." },
  { role: "auditor", description: "Read-only access to agency data." },
  { role: "landlord", description: "Read their own properties and tenancies." },
  { role: "tenant", description: "Read their own tenancy and rent." },
  { role: "platform_admin", description: "Platform-wide administration." },
];

interface StaffRecord {
  id: string;
  email?: string;
  displayName?: string;
  role?: string;
  status?: string;
}

export function SettingsPage() {
  const { user, agencyId } = useAuth();
  const { agencyRole } = useAgency();
  const navigate = useNavigate();
  const toast = useToast();

  const [agency, setAgency] = useState<Record<string, unknown> | null>(null);
  const [subscription, setSubscription] = useState<AgencySubscription | null>(null);
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyTier, setBusyTier] = useState<PlanTier | null>(null);
  const [busyInvite, setBusyInvite] = useState<string | null>(null);
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [newType, setNewType] = useState("");
  const [dueSoonDays, setDueSoonDays] = useState("7");
  const [savingTypes, setSavingTypes] = useState(false);
  const [savingDays, setSavingDays] = useState(false);

  const canManage = agencyRole === "agency_owner" || agencyRole === "platform_admin";

  const load = useCallback(async () => {
    if (!agencyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [meta, sub, staffDocs, inviteDocs, settings] = await Promise.all([
        getAgencyDoc(agencyId, "meta", agencyId),
        getSubscriptionByAgency(agencyId),
        queryAgencyCollection(agencyId, "users"),
        getInvitations(agencyId),
        getAgencySettings(agencyId),
      ]);
      setAgency(meta);
      setSubscription(sub);
      setStaff(staffDocs as unknown as StaffRecord[]);
      setInvitations(inviteDocs);
      setPropertyTypes(settings.propertyTypes);
      setDueSoonDays(String(settings.dueSoonDays));
    } catch (err) {
      toast.error("Failed to load settings");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [agencyId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingInvitations = invitations.filter((i) => i.status === "pending");

  const handleRevokeInvitation = async (invitation: Invitation) => {
    if (!agencyId) return;
    setBusyInvite(invitation.id);
    try {
      await updateInvitationStatus(agencyId, invitation.id, "revoked");
      toast.success("Invitation revoked");
      await load();
    } catch (err) {
      toast.error("Failed to revoke invitation");
      console.error(err);
    } finally {
      setBusyInvite(null);
    }
  };

  const handleSelectPlan = async (tier: PlanTier) => {
    if (!agencyId) return;
    setBusyTier(tier);
    try {
      if (subscription) {
        await upgradePlan(subscription.id, tier);
        toast.success(`Plan changed to ${PLAN_TIERS[tier].name}`);
      } else {
        await createSubscription(agencyId, tier);
        toast.success(`${PLAN_TIERS[tier].name} plan activated`);
      }
      await load();
    } catch (err) {
      toast.error("Failed to update plan");
      console.error(err);
    } finally {
      setBusyTier(null);
    }
  };

  const persistTypes = async (next: string[]) => {
    if (!agencyId) return;
    setSavingTypes(true);
    try {
      await updateAgencySettings(agencyId, { propertyTypes: next });
      setPropertyTypes(next);
      toast.success("Property types updated");
    } catch (err) {
      toast.error("Failed to save property types");
      console.error(err);
    } finally {
      setSavingTypes(false);
    }
  };

  const handleAddType = async () => {
    const value = newType.trim();
    if (!value || savingTypes) return;
    if (propertyTypes.some((t) => t.toLowerCase() === value.toLowerCase())) {
      toast.error("That type already exists");
      return;
    }
    await persistTypes([...propertyTypes, value]);
    setNewType("");
  };

  const handleRemoveType = async (value: string) => {
    if (savingTypes) return;
    await persistTypes(propertyTypes.filter((t) => t !== value));
  };

  const handleSaveDays = async () => {
    if (!agencyId || savingDays) return;
    const days = Number(dueSoonDays);
    if (!Number.isFinite(days) || days <= 0) {
      toast.error("Enter a valid number of days");
      return;
    }
    setSavingDays(true);
    try {
      await updateAgencySettings(agencyId, { dueSoonDays: Math.round(days) });
      toast.success("Due-soon window saved");
    } catch (err) {
      toast.error("Failed to save the due-soon window");
      console.error(err);
    } finally {
      setSavingDays(false);
    }
  };

  if (!user) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-xl font-bold text-slate-900">Sign in to manage settings</h2>
        <p className="mt-2 text-slate-500">Please sign in to access settings.</p>
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
          message="Create your agency before configuring settings."
          action={<Button onClick={() => navigate("/agency-profile")}>Create agency</Button>}
        />
      </Card>
    );
  }

  if (loading) return <Spinner />;

  const str = (key: string) => {
    const v = agency?.[key];
    return typeof v === "string" && v ? v : "-";
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Settings</h2>
        <p className="mt-1 text-sm text-slate-500">Agency configuration, plan and staff.</p>
      </div>

      <Card
        title="Agency Profile"
        subtitle="Legal and contact details used across the app"
        actions={
          <Link to="/agency-profile">
            <Button size="sm" variant="outline">
              Edit
            </Button>
          </Link>
        }
      >
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Agency Name", str("name")],
            ["Email", str("email")],
            ["Phone", str("phone")],
            ["Address", str("address")],
            ["State", str("state")],
            ["Country", str("country")],
            ["Currency", str("currency")],
            ["Timezone", str("timezone")],
            ["Financial Year Start", str("financialYearStart")],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {label}
              </dt>
              <dd className="mt-1 text-sm text-slate-800 break-words">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card
        title="Property & Unit Types"
        subtitle="Lettable types offered as a dropdown when adding a property or unit, e.g. 2 Bedroom Flat, Duplex"
      >
        {propertyTypes.length === 0 ? (
          <EmptyState
            title="No types configured"
            message="Add the unit types your agency deals in so they appear on the property form."
          />
        ) : (
          <div className="mb-4 flex flex-wrap gap-2">
            {propertyTypes.map((type) => (
              <span
                key={type}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700"
              >
                {type}
                {canManage && (
                  <button
                    type="button"
                    aria-label={`Remove ${type}`}
                    className="text-slate-400 hover:text-red-600 disabled:opacity-50"
                    disabled={savingTypes}
                    onClick={() => void handleRemoveType(type)}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
        {canManage ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                label="Add a type"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleAddType();
                  }
                }}
                placeholder="e.g. 3 Bedroom Flat"
              />
            </div>
            <Button variant="outline" loading={savingTypes} onClick={() => void handleAddType()}>
              Add type
            </Button>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Only the agency owner can edit the type list.</p>
        )}
      </Card>

      <Card title="Operations" subtitle="How the portfolio and rent screens behave">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="sm:w-72">
            <Input
              label="Due-soon window (days)"
              type="number"
              min={1}
              value={dueSoonDays}
              disabled={!canManage}
              onChange={(e) => setDueSoonDays(e.target.value)}
              hint="Tenants whose rent falls due within this many days are flagged as due soon."
            />
          </div>
          {canManage && (
            <Button variant="outline" loading={savingDays} onClick={() => void handleSaveDays()}>
              Save
            </Button>
          )}
        </div>
      </Card>

      <Card
        title="Subscription"
        subtitle={
          subscription
            ? `${PLAN_TIERS[subscription.tier]?.name ?? subscription.tier} plan — ${subscription.status}${
                subscription.trialEndsAt ? ` (trial ends ${formatDate(subscription.trialEndsAt)})` : ""
              }`
            : "No subscription on record"
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {(Object.keys(PLAN_TIERS) as PlanTier[]).map((tier) => {
            const plan = PLAN_TIERS[tier];
            const isCurrent = subscription?.tier === tier;
            return (
              <div
                key={tier}
                className={`rounded-xl border p-4 ${
                  isCurrent ? "border-brand-500 bg-brand-50" : "border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-900">{plan.name}</h4>
                  {isCurrent && <Badge variant="success">Current</Badge>}
                </div>
                <p className="mt-2 text-lg font-bold text-slate-900">
                  ₦{(plan.priceMonthly / 100).toLocaleString()}
                  <span className="text-xs font-normal text-slate-500">/month</span>
                </p>
                <ul className="mt-3 space-y-1 text-xs text-slate-600">
                  <li>Up to {plan.maxProperties.toLocaleString()} properties</li>
                  <li>Up to {plan.maxUnits.toLocaleString()} units</li>
                  <li>Up to {plan.maxStaff.toLocaleString()} staff</li>
                </ul>
                {canManage && !isCurrent && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4 w-full"
                    loading={busyTier === tier}
                    onClick={() => handleSelectPlan(tier)}
                  >
                    {subscription ? "Switch to this plan" : "Activate"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        {!canManage && (
          <p className="mt-4 text-xs text-slate-500">
            Only the agency owner can change the subscription plan.
          </p>
        )}
      </Card>

      <Card
        title="Staff & Roles"
        subtitle={`${staff.length} member(s) in this agency`}
        actions={
          <Link to="/invite-staff">
            <Button size="sm" variant="outline">
              Invite Staff
            </Button>
          </Link>
        }
      >
        {staff.length === 0 ? (
          <EmptyState
            title="No staff records"
            message="Invite team members to collaborate on this agency."
          />
        ) : (
          <Table>
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Name</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Email</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Role</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <tr key={member.id} className="border-b hover:bg-slate-50">
                  <td className="text-xs px-6 py-3 text-slate-700">
                    {member.displayName || "-"}
                  </td>
                  <td className="text-xs px-6 py-3 text-slate-700">{member.email || "-"}</td>
                  <td className="text-xs px-6 py-3">
                    <Badge variant="info">
                      {(member.role ?? "").replace(/_/g, " ") || "unknown"}
                    </Badge>
                  </td>
                  <td className="text-xs px-6 py-3 text-slate-700">{member.status || "-"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card
        title="Pending Invitations"
        subtitle={
          pendingInvitations.length === 0
            ? "No outstanding invitations"
            : `${pendingInvitations.length} awaiting acceptance`
        }
        actions={
          <Link to="/invite-staff">
            <Button size="sm" variant="outline">
              Invite Staff
            </Button>
          </Link>
        }
      >
        {pendingInvitations.length === 0 ? (
          <EmptyState
            title="Nothing pending"
            message="Invitations you send from the Invite Staff screen appear here until accepted or revoked."
          />
        ) : (
          <Table>
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Email</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Role</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">
                  Invited
                </th>
                <th className="text-right text-xs font-medium text-slate-500 px-6 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {pendingInvitations.map((invitation) => (
                <tr key={invitation.id} className="border-b hover:bg-slate-50">
                  <td className="text-xs px-6 py-3 text-slate-700">{invitation.email}</td>
                  <td className="text-xs px-6 py-3">
                    <Badge variant="info">
                      {(invitation.role ?? "").replace(/_/g, " ") || "unknown"}
                    </Badge>
                  </td>
                  <td className="text-xs px-6 py-3 text-slate-700">
                    {formatDate(invitation.createdAt)}
                  </td>
                  <td className="text-right px-6 py-3">
                    {canManage && (
                      <Button
                        size="sm"
                        variant="outline"
                        loading={busyInvite === invitation.id}
                        onClick={() => handleRevokeInvitation(invitation)}
                      >
                        Revoke
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card title="Role Reference" subtitle="What each role can do">
        <Table>
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Role</th>
              <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Description</th>
            </tr>
          </thead>
          <tbody>
            {ROLE_DESCRIPTIONS.map((entry) => (
              <tr key={entry.role} className="border-b hover:bg-slate-50">
                <td className="text-xs px-6 py-3">
                  <Badge>{entry.role.replace(/_/g, " ")}</Badge>
                </td>
                <td className="text-xs px-6 py-3 text-slate-700">{entry.description}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
