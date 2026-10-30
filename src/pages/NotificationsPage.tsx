import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Card, StatCard } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, Spinner } from "@/components/ui/States";
import {
  checkRentDue,
  getAllNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
  type Notification,
} from "@/lib/notifications";
import { formatDateTime } from "@/lib/format";

const severityVariant: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  info: "info",
  warning: "warning",
  urgent: "danger",
};

const typeLabels: Record<string, string> = {
  rent_due: "Rent Due",
  payment_received: "Payment Received",
  deposit_expiring: "Deposit Expiring",
  commission_earned: "Commission Earned",
  remittance_sent: "Remittance Sent",
  system_alert: "System Alert",
};

export function NotificationsPage() {
  const { user, agencyId } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!agencyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await getAllNotifications(agencyId, 100);
      setNotifications(list);
    } catch (err) {
      toast.error("Failed to load notifications");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [agencyId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!agencyId) return;
    const unsubscribe = subscribeToNotifications(
      agencyId,
      (notification) => {
        setNotifications((prev) => {
          if (prev.some((n) => n.id === notification.id)) return prev;
          return [notification, ...prev];
        });
      },
      (error) => console.error("Notification stream error:", error)
    );
    return unsubscribe;
  }, [agencyId]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const filtered = notifications.filter((n) => {
    if (showUnreadOnly && n.read) return false;
    if (severityFilter && n.severity !== severityFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      n.title.toLowerCase().includes(q) ||
      n.message.toLowerCase().includes(q) ||
      (typeLabels[n.type] ?? n.type).toLowerCase().includes(q)
    );
  });

  const handleMarkRead = async (notification: Notification) => {
    if (!agencyId || notification.read) return;
    try {
      await markNotificationRead(agencyId, notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      );
    } catch (err) {
      toast.error("Failed to update notification");
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    if (!agencyId) return;
    setBusy(true);
    try {
      await markAllNotificationsRead(agencyId);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast.success("All notifications marked as read");
    } catch (err) {
      toast.error("Failed to mark all as read");
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const handleCheckRentDue = async () => {
    if (!agencyId) return;
    setBusy(true);
    try {
      await checkRentDue(agencyId);
      toast.success("Rent-due check complete");
      await load();
    } catch (err) {
      toast.error("Rent-due check failed");
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-xl font-bold text-slate-900">Sign in to view notifications</h2>
        <p className="mt-2 text-slate-500">Please sign in to access notifications.</p>
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
          message="Create your agency to receive notifications."
          action={<Button onClick={() => navigate("/agency-profile")}>Create agency</Button>}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Notifications</h2>
          <p className="mt-1 text-sm text-slate-500">
            Rent-due alerts, payment events and system messages.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" loading={busy} onClick={handleCheckRentDue}>
            Run Rent-Due Check
          </Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
          >
            Mark All Read
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total" value={String(notifications.length)} />
        <StatCard label="Unread" value={String(unreadCount)} />
        <StatCard
          label="Urgent Unread"
          value={String(
            notifications.filter((n) => !n.read && n.severity === "urgent").length
          )}
        />
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder="Search notifications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full"
          />
          <Select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="sm:w-44"
            options={[
              { value: "", label: "All severities" },
              { value: "info", label: "Info" },
              { value: "warning", label: "Warning" },
              { value: "urgent", label: "Urgent" },
            ]}
          />
          <Button
            variant={showUnreadOnly ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowUnreadOnly((v) => !v)}
          >
            {showUnreadOnly ? "Showing: Unread" : "Showing: All"}
          </Button>
        </div>
      </Card>

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title={notifications.length === 0 ? "No notifications" : "No matches"}
            message={
              notifications.length === 0
                ? "You're all caught up. Alerts will appear here."
                : "Try a different search or filter."
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((n) => (
            <Card key={n.id} className={n.read ? "p-4" : "p-4 border-l-4 border-l-brand-500"}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{n.title}</h3>
                    <Badge variant={severityVariant[n.severity] ?? "default"}>
                      {n.severity}
                    </Badge>
                    <Badge variant="default">{typeLabels[n.type] ?? n.type}</Badge>
                    {!n.read && <Badge variant="success">New</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{n.message}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatDateTime(n.createdAt)}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {n.actionUrl && (
                    <Button size="sm" variant="outline" onClick={() => navigate(n.actionUrl!)}>
                      Open
                    </Button>
                  )}
                  {!n.read && (
                    <Button size="sm" variant="ghost" onClick={() => handleMarkRead(n)}>
                      Mark Read
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
