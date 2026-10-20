import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";

const roleLabels: Record<string, string> = {
  agency_owner: "Agency Owner",
  agency_admin: "Agency Admin",
  property_manager: "Property Manager",
  accountant: "Accountant",
  field_agent: "Field Agent",
  auditor: "Auditor",
  landlord: "Landlord",
  tenant: "Tenant",
  platform_admin: "Platform Admin",
};

export function DashboardPage() {
  const { user, agencyId, agencyRole } = useAuth();
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  if (!agencyId) {
    return (
      <Card className="p-8">
        <EmptyState
          title="No agency linked to this account"
          message="Your account is signed in but is not attached to an agency yet. Create your agency to start managing properties."
          action={
            <div className="flex gap-3">
              <Link to="/agency-profile">
                <Button size="sm">Create your agency</Button>
              </Link>
              <Button size="sm" variant="outline" onClick={handleSignOut}>
                Sign out
              </Button>
            </div>
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
        <p className="mt-1 text-sm text-slate-500">
          Signed in as{" "}
          <span className="font-medium text-slate-700">
            {user?.displayName || user?.email}
          </span>{" "}
          — {roleLabels[agencyRole ?? ""] ?? agencyRole}
        </p>
      </div>

      <Card className="p-6">
        <h3 className="text-sm font-semibold text-slate-900">Search</h3>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder="Search properties, tenants, payments, expenses..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full"
          />
          <Button variant="outline" size="sm" onClick={() => setQuery("")}>
            Clear
          </Button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Agency ID: <span className="font-mono">{agencyId}</span>
        </p>
      </Card>
    </div>
  );
}
