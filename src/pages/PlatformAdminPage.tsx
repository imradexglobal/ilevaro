import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import {
  getSubscriptions,
  updateSubscriptionStatus,
  upgradePlan,
  PLAN_TIERS,
  type AgencySubscription,
  type SubscriptionStatus,
  type PlanTier,
} from "@/lib/subscriptions";
import {
  DEFAULT_PLATFORM_SETTINGS,
  getPlatformSettings,
  savePlatformSettings,
} from "@/lib/platform";
import { formatCurrency, formatDate } from "@/lib/format";

export function PlatformAdminPage() {
  const { agencyRole } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [subscriptions, setSubscriptions] = useState<AgencySubscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState<"subscriptions" | "plans" | "settings">("subscriptions");
  const [settings, setSettings] = useState(DEFAULT_PLATFORM_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (agencyRole !== "platform_admin") return;
    setLoading(true);
    Promise.all([getSubscriptions(), getPlatformSettings()])
      .then(([subs, platformSettings]) => {
        setSubscriptions(subs);
        setSettings(platformSettings);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [agencyRole]);

  if (agencyRole !== "platform_admin") {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-bold text-slate-900">Access Denied</h2>
        <p className="mt-2 text-sm text-slate-500">
          Only platform administrators can access the admin console.
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

  const filteredSubscriptions = subscriptions.filter((sub) =>
    sub.agencyId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sub.tier.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sub.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStatusChange = async (subId: string, newStatus: SubscriptionStatus) => {
    try {
      await updateSubscriptionStatus(subId, newStatus);
      setSubscriptions((prev) =>
        prev.map((s) => (s.id === subId ? { ...s, status: newStatus } : s))
      );
      toast.success(`Subscription status updated to ${newStatus}`);
    } catch {
      toast.error("Failed to update subscription status");
    }
  };

  const handleUpgrade = async (subId: string, newTier: PlanTier) => {
    try {
      await upgradePlan(subId, newTier);
      setSubscriptions((prev) =>
        prev.map((s) => (s.id === subId ? { ...s, tier: newTier } : s))
      );
      toast.success(`Plan upgraded to ${PLAN_TIERS[newTier].name}`);
    } catch {
      toast.error("Failed to upgrade plan");
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await savePlatformSettings({
        defaultTrialDays: Number(settings.defaultTrialDays) || 0,
        maxAgencies: Number(settings.maxAgencies) || 0,
      });
      toast.success("Platform settings saved");
    } catch {
      toast.error("Failed to save platform settings");
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Platform Admin Console</h2>
      <p className="text-slate-500 mb-6">
        Manage agency accounts, subscription plans, and platform settings.
      </p>

      <div className="flex gap-2 mb-6">
        <Button
          variant={selectedTab === "subscriptions" ? "primary" : "outline"}
          size="sm"
          onClick={() => setSelectedTab("subscriptions")}
        >
          Subscriptions
        </Button>
        <Button
          variant={selectedTab === "plans" ? "primary" : "outline"}
          size="sm"
          onClick={() => setSelectedTab("plans")}
        >
          Plans
        </Button>
        <Button
          variant={selectedTab === "settings" ? "primary" : "outline"}
          size="sm"
          onClick={() => setSelectedTab("settings")}
        >
          Settings
        </Button>
      </div>

      {selectedTab === "subscriptions" && (
        <div>
          <Input
            placeholder="Search by agency, tier, or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full mb-4"
          />

          {loading ? (
            <p className="text-slate-500">Loading subscriptions...</p>
          ) : (
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left py-3 px-4 border-b font-medium text-slate-500">Agency ID</th>
                    <th className="text-left py-3 px-4 border-b font-medium text-slate-500">Plan</th>
                    <th className="text-left py-3 px-4 border-b font-medium text-slate-500">Status</th>
                    <th className="text-left py-3 px-4 border-b font-medium text-slate-500">Trial Ends</th>
                    <th className="text-left py-3 px-4 border-b font-medium text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubscriptions.map((sub) => (
                    <tr key={sub.id}>
                      <td className="py-3 px-4 border-b text-slate-700">{sub.agencyId}</td>
                      <td className="py-3 px-4 border-b text-slate-700">{PLAN_TIERS[sub.tier].name}</td>
                      <td className="py-3 px-4 border-b">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            sub.status === "active" ? "bg-green-100 text-green-800" :
                            sub.status === "trial" ? "bg-blue-100 text-blue-800" :
                            sub.status === "suspended" ? "bg-yellow-100 text-yellow-800" :
                            "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {sub.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 border-b text-slate-700">
                        {sub.trialEndsAt ? formatDate(sub.trialEndsAt) : "N/A"}
                      </td>
                      <td className="py-3 px-4 border-b">
                        <div className="flex gap-2">
                          {sub.status === "active" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleStatusChange(sub.id, "suspended")}
                            >
                              Suspend
                            </Button>
                          )}
                          {sub.status === "suspended" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleStatusChange(sub.id, "active")}
                            >
                              Reactivate
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpgrade(sub.id, "professional")}
                          >
                            Upgrade
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {selectedTab === "plans" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Object.values(PLAN_TIERS).map((plan) => (
            <Card key={plan.tier} className="p-4">
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="text-2xl font-bold mt-2">
                {formatCurrency(plan.priceMonthly / 100)}
                <span className="text-sm font-normal text-slate-500">/mo</span>
              </p>
              <p className="text-sm text-slate-500 mt-2">
                {plan.maxProperties} properties
              </p>
              <p className="text-sm text-slate-500">
                {plan.maxUnits} units
              </p>
              <p className="text-sm text-slate-500">
                {plan.maxStaff} staff members
              </p>
            </Card>
          ))}
        </div>
      )}

      {selectedTab === "settings" && (
        <div>
          <h3 className="font-semibold mb-2">Platform Settings</h3>
          <p className="text-sm text-slate-500 mb-4">
            Configure platform-wide settings and usage limits.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Default Trial Length (days)</label>
              <Input
                type="number"
                value={settings.defaultTrialDays}
                onChange={(e) =>
                  setSettings({ ...settings, defaultTrialDays: Number(e.target.value) })
                }
                className="mt-1 w-48"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Max Agencies</label>
              <Input
                type="number"
                value={settings.maxAgencies}
                onChange={(e) => setSettings({ ...settings, maxAgencies: Number(e.target.value) })}
                className="mt-1 w-48"
              />
            </div>
            <Button
              loading={savingSettings}
              onClick={handleSaveSettings}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Save Settings
            </Button>
          </div>
        </div>
      )}

      <Button
        onClick={() => navigate("/dashboard")}
        className="mt-6 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Back to Dashboard
      </Button>
    </div>
  );
}