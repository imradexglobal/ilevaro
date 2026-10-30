import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAgency, useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Card, StatCard } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/Modal";
import { EmptyState, Spinner } from "@/components/ui/States";
import {
  generateBalanceSheet,
  generateIncomeStatement,
  getLedgerEntries,
  getReconciliationSummary,
  type LedgerEntry,
} from "@/lib/accounting";
import {
  getJournalEntries,
  postJournalEntry,
  reverseJournalEntry,
  type JournalEntry,
  type LedgerEntryType,
} from "@/lib/firestore";
import { formatCurrency, formatDate } from "@/lib/format";

const ACCOUNTING_ROLES = ["agency_owner", "agency_admin", "accountant", "platform_admin"];

const emptyJournalForm = {
  debitAccount: "",
  creditAccount: "",
  amount: "",
  description: "",
  reference: "",
  entityType: "rent_charge" as LedgerEntryType,
  entityId: "",
};

export function AccountingPage() {
  const { user, agencyId } = useAuth();
  const { agencyRole } = useAgency();
  const navigate = useNavigate();
  const toast = useToast();

  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [posting, setPosting] = useState(false);
  const [journalForm, setJournalForm] = useState(emptyJournalForm);
  const [reverseTarget, setReverseTarget] = useState<JournalEntry | null>(null);
  const [working, setWorking] = useState(false);

  const canAccess = ACCOUNTING_ROLES.includes(agencyRole ?? "");

  const load = useCallback(async () => {
    if (!agencyId) {
      setJournalEntries([]);
      setLedgerEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [entries, ledger] = await Promise.all([
        getJournalEntries(agencyId),
        getLedgerEntries(agencyId),
      ]);
      setJournalEntries(entries);
      setLedgerEntries(ledger);
    } catch (err) {
      toast.error("Failed to load accounting data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [agencyId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const incomeStatement = useMemo(
    () => (ledgerEntries.length ? generateIncomeStatement(ledgerEntries) : null),
    [ledgerEntries]
  );
  const balanceSheet = useMemo(
    () => (ledgerEntries.length ? generateBalanceSheet(ledgerEntries) : null),
    [ledgerEntries]
  );
  const reconciliation = useMemo(
    () => (ledgerEntries.length ? getReconciliationSummary(ledgerEntries) : null),
    [ledgerEntries]
  );

  const filteredEntries = journalEntries.filter((entry) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (entry.description || "").toLowerCase().includes(q) ||
      (entry.reference || "").toLowerCase().includes(q) ||
      (entry.debitAccount || "").toLowerCase().includes(q) ||
      (entry.creditAccount || "").toLowerCase().includes(q) ||
      (entry.entityId || "").toLowerCase().includes(q)
    );
  });

  const handlePostJournalEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyId || !user) return;
    const amount = Number(journalForm.amount);
    if (!journalForm.debitAccount || !journalForm.creditAccount || !amount) {
      toast.error("Debit account, credit account and amount are required");
      return;
    }
    setPosting(true);
    try {
      await postJournalEntry({
        agencyId,
        debitAccount: journalForm.debitAccount.trim(),
        creditAccount: journalForm.creditAccount.trim(),
        amount,
        description: journalForm.description.trim(),
        reference: journalForm.reference.trim() || undefined,
        entityType: journalForm.entityType,
        entityId: journalForm.entityId.trim(),
        postedBy: user.uid,
      });
      toast.success("Journal entry posted");
      setJournalForm(emptyJournalForm);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post journal entry");
      console.error(err);
    } finally {
      setPosting(false);
    }
  };

  const handleReverse = async () => {
    if (!agencyId || !reverseTarget) return;
    setWorking(true);
    try {
      const result = await reverseJournalEntry(
        agencyId,
        reverseTarget.id,
        `Reversal of ${reverseTarget.reference || reverseTarget.id}`
      );
      if (!result.success) {
        toast.error(result.error ?? "Failed to reverse entry");
      } else {
        toast.success("Journal entry reversed");
        setReverseTarget(null);
        await load();
      }
    } catch (err) {
      toast.error("Failed to reverse entry");
      console.error(err);
    } finally {
      setWorking(false);
    }
  };

  if (!user) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-xl font-bold text-slate-900">Sign in to access accounting</h2>
        <p className="mt-2 text-slate-500">Please sign in to access accounting features.</p>
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
          message="Create your agency before posting journal entries."
          action={<Button onClick={() => navigate("/agency-profile")}>Create agency</Button>}
        />
      </Card>
    );
  }

  if (!canAccess) {
    return (
      <Card className="p-8">
        <EmptyState
          title="Access denied"
          message="Only accountants, agency owners and administrators can access accounting."
          action={<Button onClick={() => navigate("/dashboard")}>Back to dashboard</Button>}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Accounting &amp; Financial Reports</h2>
        <p className="mt-1 text-sm text-slate-500">
          Double-entry journal, ledger activity and financial statements.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Income Statement Net"
          value={incomeStatement ? incomeStatement.netProfit : "No entries"}
        />
        <StatCard
          label="Balance Sheet Equity"
          value={balanceSheet ? balanceSheet.equity : "No entries"}
        />
        <StatCard
          label="Ledger Net"
          value={reconciliation ? reconciliation.net : "No entries"}
        />
        <StatCard label="Journal Entries" value={`${journalEntries.length}`} />
      </div>

      <Card title="Post Journal Entry (Double-Entry)">
        <form onSubmit={handlePostJournalEntry} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Debit Account"
              value={journalForm.debitAccount}
              onChange={(e) => setJournalForm({ ...journalForm, debitAccount: e.target.value })}
              placeholder="e.g. Cash at Bank"
              required
            />
            <Input
              label="Credit Account"
              value={journalForm.creditAccount}
              onChange={(e) => setJournalForm({ ...journalForm, creditAccount: e.target.value })}
              placeholder="e.g. Rent Income"
              required
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Amount (₦)"
              type="number"
              value={journalForm.amount}
              onChange={(e) => setJournalForm({ ...journalForm, amount: e.target.value })}
              placeholder="e.g. 250000"
              required
            />
            <Input
              label="Reference (optional)"
              value={journalForm.reference}
              onChange={(e) => setJournalForm({ ...journalForm, reference: e.target.value })}
              placeholder="e.g. RENT-MAY-2026"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Description (optional)"
              value={journalForm.description}
              onChange={(e) => setJournalForm({ ...journalForm, description: e.target.value })}
              placeholder="e.g. Rent for May 2026"
            />
            <Input
              label="Entity ID (optional)"
              value={journalForm.entityId}
              onChange={(e) => setJournalForm({ ...journalForm, entityId: e.target.value })}
              placeholder="e.g. charge or payment ID"
            />
          </div>
          <Select
            label="Entity Type"
            value={journalForm.entityType}
            onChange={(e) =>
              setJournalForm({ ...journalForm, entityType: e.target.value as LedgerEntryType })
            }
            options={[
              { value: "rent_charge", label: "Rent Charge" },
              { value: "payment", label: "Payment" },
              { value: "expense", label: "Expense" },
              { value: "deposit_refund", label: "Deposit Refund" },
              { value: "commission", label: "Commission" },
              { value: "remittance", label: "Remittance" },
            ]}
          />
          <Button type="submit" variant="primary" loading={posting}>
            Post Journal Entry
          </Button>
        </form>
      </Card>

      <Card title="Journal Entries History">
        <Input
          placeholder="Search journal entries..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4"
        />

        {loading ? (
          <Spinner />
        ) : filteredEntries.length === 0 ? (
          <EmptyState
            title={journalEntries.length === 0 ? "No journal entries yet" : "No matches"}
            message={
              journalEntries.length === 0
                ? "Post your first double-entry journal entry to begin."
                : "Try a different search term."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Date</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Description</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Debit</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Credit</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Amount</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Entity</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Status</th>
                  <th className="text-right text-xs font-medium text-slate-500 px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="border-b hover:bg-slate-50">
                    <td className="text-xs text-slate-700 px-6 py-3">
                      {formatDate(entry.postedAt)}
                    </td>
                    <td className="text-xs px-6 py-3">
                      <p className="font-medium text-slate-700">{entry.description || "-"}</p>
                      {entry.reference && <p className="text-slate-400">{entry.reference}</p>}
                    </td>
                    <td className="text-xs text-slate-700 px-6 py-3">{entry.debitAccount}</td>
                    <td className="text-xs text-slate-700 px-6 py-3">{entry.creditAccount}</td>
                    <td className="text-xs text-slate-700 px-6 py-3">
                      {formatCurrency(entry.amount || 0)}
                    </td>
                    <td className="text-xs text-slate-700 px-6 py-3">
                      {entry.entityType}
                      {entry.entityId ? `: ${entry.entityId}` : ""}
                    </td>
                    <td className="text-xs px-6 py-3">
                      <Badge
                        variant={
                          entry.status === "posted"
                            ? "success"
                            : entry.status === "reversed"
                              ? "default"
                              : "warning"
                        }
                      >
                        {entry.status}
                      </Badge>
                    </td>
                    <td className="text-right px-6 py-3">
                      {entry.status === "reversed" || entry.reversalOf ? (
                        <span className="text-xs text-slate-400">Reversed</span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setReverseTarget(entry)}
                        >
                          Reverse
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>

      <Card title="Ledger Activity by Type">
        {reconciliation ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {Object.entries(reconciliation.byType).map(([type, count]) => (
              <div key={type} className="rounded-lg border border-slate-200 px-4 py-3">
                <p className="text-xs font-medium text-slate-500 capitalize">
                  {type.replace(/_/g, " ")}
                </p>
                <p className="mt-1 text-lg font-bold text-slate-900">{count}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No ledger activity"
            message="Ledger entries are created automatically when payments, expenses and other transactions are recorded."
          />
        )}
      </Card>

      <ConfirmDialog
        open={!!reverseTarget}
        title="Reverse journal entry"
        message="Create an offsetting reversal entry for this journal entry? The original entry is retained and marked as reversed."
        confirmLabel="Reverse"
        danger
        loading={working}
        onConfirm={handleReverse}
        onCancel={() => setReverseTarget(null)}
      />
    </div>
  );
}
