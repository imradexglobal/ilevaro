import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/context/AuthContext";
import { createAgencyForUser } from "@/lib/agency";
import { NIGERIAN_STATES } from "@/lib/constants";

const emptyForm = {
  agencyName: "",
  address: "",
  state: "",
  lga: "",
  country: "Nigeria",
  currency: "NGN",
  timezone: "Africa/Lagos",
  dateFormat: "DD/MM/YYYY",
  financialYearStart: "01-01",
};

export function AgencyProfilePage() {
  const { user, agencyId, agencyRole, reloadAgency } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isOwner = agencyRole === "agency_owner" || agencyRole === "platform_admin";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.agencyName || !form.address || !form.state || !form.lga) {
      setError("Please fill in all required fields.");
      return;
    }
    if (!user) {
      setError("Your session has expired. Please sign in again.");
      return;
    }

    setLoading(true);
    try {
      await createAgencyForUser(user, {
        agencyName: form.agencyName,
        email: user.email ?? "",
        phone: "",
        state: form.state,
        lga: form.lga,
        address: form.address,
        currency: form.currency,
        timezone: form.timezone,
        dateFormat: form.dateFormat,
        financialYearStart: form.financialYearStart,
      });

      await reloadAgency();
      toast.success("Agency created successfully!");
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agency. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Agency already exists — show its details instead of the create form.
  if (agencyId) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Agency Profile</h2>
          <p className="mt-1 text-sm text-slate-500">
            Your agency is active and linked to your account.
          </p>
        </div>

        <Card className="p-6">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Agency ID</dt>
              <dd className="mt-1 font-mono text-sm text-slate-900">{agencyId}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your role</dt>
              <dd className="mt-1 text-sm text-slate-900">{agencyRole ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account email</dt>
              <dd className="mt-1 text-sm text-slate-900">{user?.email ?? "—"}</dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-wrap gap-3">
            {isOwner && (
              <Link to="/invite-staff">
                <Button size="sm">Invite staff</Button>
              </Link>
            )}
            <Button size="sm" variant="outline" onClick={() => navigate("/dashboard")}>
              Back to dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Create your agency</h2>
        <p className="mt-1 text-sm text-slate-500">
          Your account is ready. Set up the agency it will administer to start managing properties.
        </p>
      </div>

      {error && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </div>
      )}

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Agency name"
            required
            value={form.agencyName}
            onChange={(e) => setForm({ ...form, agencyName: e.target.value })}
            placeholder="e.g. Acme Properties Ltd"
          />

          <Input
            label="Agency address"
            required
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="e.g. 12 Marina Road, Lagos"
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="State"
              required
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
              options={[
                { value: "", label: "Select your state" },
                ...NIGERIAN_STATES.map((s) => ({ value: s, label: s })),
              ]}
            />
            <Input
              label="LGA"
              required
              value={form.lga}
              onChange={(e) => setForm({ ...form, lga: e.target.value })}
              placeholder="e.g. Ikeja"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Currency"
              required
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              placeholder="NGN"
            />
            <Input
              label="Timezone"
              required
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              placeholder="Africa/Lagos"
            />
          </div>

          <Input
            label="Financial year start (MM-DD)"
            required
            value={form.financialYearStart}
            onChange={(e) => setForm({ ...form, financialYearStart: e.target.value })}
            placeholder="01-01"
          />

          <Button type="submit" loading={loading} className="w-full" size="lg">
            Create agency
          </Button>
        </form>
      </Card>
    </div>
  );
}
