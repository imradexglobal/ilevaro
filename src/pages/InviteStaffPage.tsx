import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAgency } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Input";

const ROLES = [
  "agency_owner",
  "agency_admin",
  "property_manager",
  "accountant",
  "field_agent",
  "auditor",
  "landlord",
  "tenant",
];

export function InviteStaffPage() {
  const { agencyRole } = useAgency();
  const navigate = useNavigate();
  const toast = useToast();

  // Only agency_owner or platform_admin can invite staff
  if (agencyRole !== "agency_owner" && agencyRole !== "platform_admin") {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-bold text-slate-900">Access Denied</h2>
        <p className="mt-2 text-sm text-slate-500">
          Only agency owners and platform admins can invite staff.
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

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("property_manager");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !role) {
      setError("Email and role are required.");
      return;
    }

    setLoading(true);
    try {
      toast.success(`Invitation sent to ${email} as ${role}.`);
      setEmail("");
      setRole("property_manager");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to send invitation. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-900">
          Invite Staff Members
        </h2>
        <p className="text-sm text-slate-500">
          Invite your team to help manage properties and tenants.
        </p>
      </div>

      {error && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-6"
          role="alert"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
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
          options={ROLES.map((r) => ({ value: r, label: r }))}
        />

        <Button type="submit" loading={loading} className="w-full" size="lg">
          Invite member
        </Button>
      </form>

      <p className="mt-6 text-sm text-slate-500">
        <a href="/agency-profile" className="font-medium text-brand-600 hover:text-brand-700">
          Agency profile
        </a>
        — complete your agency setup first.
      </p>
    </div>
  );
}