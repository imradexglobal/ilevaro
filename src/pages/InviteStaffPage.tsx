import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, Spinner } from "@/components/ui/States";
import { ConfirmDialog } from "@/components/ui/Modal";
import {
  createInvitation,
  deleteInvitation,
  getInvitations,
  updateInvitationStatus,
  type Invitation,
} from "@/lib/invitations";
import { formatDateTime } from "@/lib/format";

const ROLES = [
  "agency_admin",
  "property_manager",
  "accountant",
  "field_agent",
  "auditor",
  "landlord",
  "tenant",
];

const ROLE_LABELS: Record<string, string> = {
  agency_owner: "Agency Owner",
  agency_admin: "Agency Admin",
  property_manager: "Property Manager",
  accountant: "Accountant",
  field_agent: "Field Agent",
  auditor: "Auditor",
  landlord: "Landlord",
  tenant: "Tenant",
};

const statusVariant: Record<string, "warning" | "success" | "default"> = {
  pending: "warning",
  accepted: "success",
  revoked: "default",
};

export function InviteStaffPage() {
  const { user, agencyId, agencyRole } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("property_manager");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [revokeTarget, setRevokeTarget] = useState<Invitation | null>(null);
  const [revoking, setRevoking] = useState(false);

  const canInvite = agencyRole === "agency_owner" || agencyRole === "agency_admin";

  const loadInvitations = useCallback(async () => {
    if (!agencyId) {
      setListLoading(false);
      return;
    }
    setListLoading(true);
    try {
      setInvitations(await getInvitations(agencyId));
    } catch (err) {
      toast.error("Failed to load invitations");
      console.error(err);
    } finally {
      setListLoading(false);
    }
  }, [agencyId, toast]);

  useEffect(() => {
    void loadInvitations();
  }, [loadInvitations]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!agencyId || !user) {
      setError("Your session has expired. Please sign in again.");
      return;
    }
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !role) {
      setError("Email and role are required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }
    if (invitations.some((i) => i.email === trimmed && i.status === "pending")) {
      setError("That email already has a pending invitation.");
      return;
    }

    setLoading(true);
    try {
      await createInvitation(agencyId, {
        email: trimmed,
        role,
        invitedBy: user.uid,
        invitedByName: user.displayName || user.email || "",
      });
      toast.success(`Invitation created for ${trimmed} as ${ROLE_LABELS[role] ?? role}.`);
      setEmail("");
      setRole("property_manager");
      await loadInvitations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invitation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!agencyId || !revokeTarget) return;
    setRevoking(true);
    try {
      await updateInvitationStatus(agencyId, revokeTarget.id, "revoked");
      toast.success("Invitation revoked");
      setRevokeTarget(null);
      await loadInvitations();
    } catch (err) {
      toast.error("Failed to revoke invitation");
      console.error(err);
    } finally {
      setRevoking(false);
    }
  };

  const handleDelete = async (invitation: Invitation) => {
    if (!agencyId) return;
    try {
      await deleteInvitation(agencyId, invitation.id);
      toast.success("Invitation removed");
      await loadInvitations();
    } catch (err) {
      toast.error("Failed to remove invitation");
      console.error(err);
    }
  };

  if (!canInvite) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-bold text-slate-900">Access Denied</h2>
        <p className="mt-2 text-sm text-slate-500">
          Only agency owners and admins can invite staff.
        </p>
        <Button
          onClick={() => navigate("/dashboard")}
          className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Invite Staff Members</h2>
        <p className="mt-1 text-sm text-slate-500">
          Invite your team to help manage properties, tenants and finances.
        </p>
      </div>

      <Card title="New Invitation" subtitle="The invitee joins with the role you choose">
        {error && (
          <div
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="max-w-md space-y-4">
          <Input
            label="Email address"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="staff@agency.example.com"
          />

          <Select
            label="Role"
            required
            value={role}
            onChange={(e) => setRole(e.target.value)}
            options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] ?? r }))}
          />

          <Button type="submit" loading={loading} className="w-full" size="lg">
            Send invitation
          </Button>
        </form>
      </Card>

      <Card
        title="Invitations"
        subtitle={`${invitations.filter((i) => i.status === "pending").length} pending invitation(s)`}
      >
        {listLoading ? (
          <Spinner />
        ) : invitations.length === 0 ? (
          <EmptyState
            title="No invitations yet"
            message="Invitations you send will be listed here until they are accepted or revoked."
          />
        ) : (
          <Table>
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Email</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Role</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Status</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Invited</th>
                <th className="text-right text-xs font-medium text-slate-500 px-6 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((invitation) => (
                <tr key={invitation.id} className="border-b hover:bg-slate-50">
                  <td className="text-xs px-6 py-3 text-slate-700">{invitation.email}</td>
                  <td className="text-xs px-6 py-3">
                    <Badge variant="info">
                      {ROLE_LABELS[invitation.role] ?? invitation.role}
                    </Badge>
                  </td>
                  <td className="text-xs px-6 py-3">
                    <Badge variant={statusVariant[invitation.status] ?? "default"}>
                      {invitation.status}
                    </Badge>
                  </td>
                  <td className="text-xs px-6 py-3 text-slate-700">
                    {formatDateTime(invitation.createdAt)}
                  </td>
                  <td className="text-right px-6 py-3 whitespace-nowrap">
                    {invitation.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mr-2"
                        onClick={() => setRevokeTarget(invitation)}
                      >
                        Revoke
                      </Button>
                    )}
                    <Button size="sm" variant="danger" onClick={() => handleDelete(invitation)}>
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <p className="text-sm text-slate-500">
        <a href="/agency-profile" className="font-medium text-brand-600 hover:text-brand-700">
          Agency profile
        </a>
        — complete your agency setup first.
      </p>

      <ConfirmDialog
        open={!!revokeTarget}
        title="Revoke invitation"
        message={`Revoke the pending invitation for "${revokeTarget?.email ?? ""}"?`}
        confirmLabel="Revoke"
        danger
        loading={revoking}
        onConfirm={handleRevoke}
        onCancel={() => setRevokeTarget(null)}
      />
    </div>
  );
}
