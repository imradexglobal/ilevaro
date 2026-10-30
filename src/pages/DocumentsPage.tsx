import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  createDocumentRecord,
  deleteDocumentRecord,
  documentsFromCSV,
  documentsToCSV,
  getDocumentRecords,
  type DocumentRecord,
} from "@/lib/documents";
import { formatDate } from "@/lib/format";

const DOC_TYPES: { value: DocumentRecord["type"]; label: string }[] = [
  { value: "contract", label: "Contract" },
  { value: "lease", label: "Lease" },
  { value: "invoice", label: "Invoice" },
  { value: "receipt", label: "Receipt" },
  { value: "other", label: "Other" },
];

const MANAGE_ROLES = ["agency_owner", "agency_admin", "property_manager", "platform_admin"];

function downloadTextFile(fileName: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function DocumentsPage() {
  const { user, agencyId } = useAuth();
  const { agencyRole } = useAgency();
  const navigate = useNavigate();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const [records, setRecords] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DocumentRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    type: DocumentRecord["type"];
    description: string;
    file: File | null;
  }>({ name: "", type: "contract", description: "", file: null });

  const canManage = MANAGE_ROLES.includes(agencyRole ?? "");

  const load = useCallback(async () => {
    if (!agencyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await getDocumentRecords(agencyId);
      setRecords(list.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()));
    } catch (err) {
      toast.error("Failed to load documents");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [agencyId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyId || !user) return;
    if (!form.name.trim() || !form.file) {
      toast.error("Provide a name and choose a file");
      return;
    }
    setSaving(true);
    try {
      await createDocumentRecord(agencyId, {
        agencyId,
        name: form.name.trim(),
        type: form.type,
        description: form.description.trim() || undefined,
        fileName: form.file.name,
        fileSize: form.file.size,
        mimeType: form.file.type || undefined,
        uploadedBy: user.displayName || user.email || user.uid,
      });
      toast.success("Document record added");
      setFormOpen(false);
      setForm({ name: "", type: "contract", description: "", file: null });
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
    } catch (err) {
      toast.error("Failed to add document");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!agencyId || !deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDocumentRecord(agencyId, deleteTarget.id);
      toast.success("Document record removed");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error("Failed to remove document");
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = () => {
    if (records.length === 0) {
      toast.info("Nothing to export");
      return;
    }
    downloadTextFile("documents-register.csv", documentsToCSV(records), "text/csv;charset=utf-8");
    toast.success("Register exported");
  };

  const handleImportFile = async (file: File) => {
    if (!agencyId || !user) return;
    const text = await file.text();
    const parsed = documentsFromCSV(text);
    if (parsed.length === 0) {
      toast.error("No valid rows found. Expected columns: name, type, fileName");
      return;
    }
    setSaving(true);
    try {
      for (const row of parsed) {
        await createDocumentRecord(agencyId, {
          ...row,
          agencyId,
          uploadedBy: user.displayName || user.email || user.uid,
        });
      }
      toast.success(`Imported ${parsed.length} document record(s)`);
      await load();
    } catch (err) {
      toast.error("Import failed");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-xl font-bold text-slate-900">Sign in to manage documents</h2>
        <p className="mt-2 text-slate-500">Please sign in to access documents.</p>
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
          message="Create your agency before adding documents."
          action={<Button onClick={() => navigate("/agency-profile")}>Create agency</Button>}
        />
      </Card>
    );
  }

  const filtered = records.filter((r) => {
    if (typeFilter && r.type !== typeFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) ||
      r.fileName.toLowerCase().includes(q) ||
      (r.description ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Documents</h2>
          <p className="mt-1 text-sm text-slate-500">
            Register of agreements, leases, invoices and receipts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExport} disabled={saving}>
            Export CSV
          </Button>
          {canManage && (
            <>
              <Button
                variant="outline"
                onClick={() => importInputRef.current?.click()}
                disabled={saving}
              >
                Import CSV
              </Button>
              <Button variant="primary" onClick={() => setFormOpen(true)}>
                + Add Document
              </Button>
            </>
          )}
        </div>
      </div>

      <input
        ref={importInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleImportFile(f);
          e.target.value = "";
        }}
      />

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            placeholder="Search by name, file name or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full"
          />
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="sm:w-48"
            options={[{ value: "", label: "All types" }, ...DOC_TYPES]}
          />
        </div>
      </Card>

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title={records.length === 0 ? "No documents yet" : "No matches"}
            message={
              records.length === 0
                ? "Add your first document record to build the register."
                : "Try a different search or filter."
            }
            action={canManage ? <Button onClick={() => setFormOpen(true)}>+ Add Document</Button> : undefined}
          />
        </Card>
      ) : (
        <Card className="p-0">
          <Table>
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Name</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Type</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">File</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Uploaded</th>
                <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">By</th>
                {canManage && (
                  <th className="text-right text-xs font-medium text-slate-500 px-6 py-3">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b hover:bg-slate-50">
                  <td className="text-xs px-6 py-3">
                    <p className="font-medium text-slate-700">{r.name}</p>
                    {r.description && <p className="text-slate-400">{r.description}</p>}
                  </td>
                  <td className="text-xs px-6 py-3">
                    <Badge variant="info">{r.type}</Badge>
                  </td>
                  <td className="text-xs px-6 py-3 text-slate-700">
                    <p>{r.fileName}</p>
                    {typeof r.fileSize === "number" && (
                      <p className="text-slate-400">{Math.max(1, Math.round(r.fileSize / 1024))} KB</p>
                    )}
                  </td>
                  <td className="text-xs px-6 py-3 text-slate-700">{formatDate(r.uploadedAt)}</td>
                  <td className="text-xs px-6 py-3 text-slate-700">{r.uploadedBy || "-"}</td>
                  {canManage && (
                    <td className="text-right px-6 py-3">
                      <Button size="sm" variant="danger" onClick={() => setDeleteTarget(r)}>
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

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Add Document"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} onClick={handleAdd}>
              Add Document
            </Button>
          </>
        }
      >
        <form onSubmit={handleAdd} className="space-y-4">
          <Input
            label="Document Name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Tenancy Agreement - Unit 4B"
          />
          <Select
            label="Type"
            value={form.type}
            onChange={(e) =>
              setForm({ ...form, type: e.target.value as DocumentRecord["type"] })
            }
            options={DOC_TYPES}
          />
          <Textarea
            label="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="e.g. Signed 12-month lease for the marina apartment"
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">File</label>
            <input
              ref={fileInputRef}
              type="file"
              required
              onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })}
              className="block w-full text-sm text-slate-700"
            />
            <p className="text-xs text-slate-500">
              The file name, size and type are stored in the register. Ensure the source file is
              kept in your secure storage.
            </p>
          </div>
          <button type="submit" className="hidden" aria-hidden="true" />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete document record"
        message={`Remove "${deleteTarget?.name ?? "this document"}" from the register?`}
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
