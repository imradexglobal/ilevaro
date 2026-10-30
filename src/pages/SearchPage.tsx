import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { EmptyState, Spinner } from "@/components/ui/States";
import { queryAgencyCollection } from "@/lib/firestore";
import { formatCurrency, formatDate } from "@/lib/format";

type Doc = Record<string, unknown> & { id: string };

interface Hit {
  id: string;
  title: string;
  subtitle?: string;
  to: string;
}

interface Group {
  key: string;
  label: string;
  to: string;
  hits: Hit[];
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const maybe = value as { toDate?: () => Date };
  return typeof maybe.toDate === "function" ? maybe.toDate() : null;
}

function matches(query: string, ...fields: unknown[]): boolean {
  return fields.some((field) => str(field).toLowerCase().includes(query));
}

export function SearchPage() {
  const { user, agencyId } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const query = (searchParams.get("q") ?? "").trim();
  const [input, setInput] = useState(query);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    properties: Doc[];
    tenants: Doc[];
    owners: Doc[];
    tenancies: Doc[];
    payments: Doc[];
    documents: Doc[];
  }>({
    properties: [],
    tenants: [],
    owners: [],
    tenancies: [],
    payments: [],
    documents: [],
  });

  useEffect(() => {
    setInput(query);
  }, [query]);

  const load = useCallback(async () => {
    if (!agencyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [properties, tenants, owners, tenancies, payments, documents] = await Promise.all([
        queryAgencyCollection(agencyId, "properties"),
        queryAgencyCollection(agencyId, "tenants"),
        queryAgencyCollection(agencyId, "owners"),
        queryAgencyCollection(agencyId, "tenancies"),
        queryAgencyCollection(agencyId, "payments"),
        queryAgencyCollection(agencyId, "documents"),
      ]);
      setData({ properties, tenants, owners, tenancies, payments, documents });
    } catch (err) {
      toast.error("Failed to load search data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [agencyId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const next = input.trim();
    if (next) setSearchParams({ q: next });
    else setSearchParams({});
  };

  const groups = useMemo<Group[]>(() => {
    if (!query) return [];
    const q = query.toLowerCase();

    const propertyNames = new Map(data.properties.map((p) => [p.id, str(p.name)]));

    const properties: Hit[] = data.properties
      .filter((p) =>
        matches(q, p.name, p.reference, p.address, p.state, p.type, p.description)
      )
      .slice(0, 10)
      .map((p) => ({
        id: p.id,
        title: str(p.name) || p.id,
        subtitle: [str(p.reference), str(p.address), str(p.state)].filter(Boolean).join(" · "),
        to: "/properties",
      }));

    const tenants: Hit[] = data.tenants
      .filter((t) =>
        matches(
          q,
          `${str(t.firstName)} ${str(t.lastName)}`,
          t.firstName,
          t.lastName,
          t.email,
          t.phone,
          t.address
        )
      )
      .slice(0, 10)
      .map((t) => ({
        id: t.id,
        title: `${str(t.firstName)} ${str(t.lastName)}`.trim() || t.id,
        subtitle: [str(t.email), str(t.phone)].filter(Boolean).join(" · "),
        to: "/tenants",
      }));

    const owners: Hit[] = data.owners
      .filter((o) => matches(q, o.fullName, o.businessName, o.email, o.phone, o.address))
      .slice(0, 10)
      .map((o) => ({
        id: o.id,
        title: str(o.fullName) || str(o.businessName) || o.id,
        subtitle: [str(o.businessName), str(o.email), str(o.phone)].filter(Boolean).join(" · "),
        to: "/landlords",
      }));

    const tenancies: Hit[] = data.tenancies
      .filter((t) =>
        matches(
          q,
          t.reference,
          t.unitLabel,
          t.status,
          propertyNames.get(str(t.propertyId))
        )
      )
      .slice(0, 10)
      .map((t) => ({
        id: t.id,
        title: str(t.reference) || t.id,
        subtitle: [
          str(t.unitLabel) && `Unit ${str(t.unitLabel)}`,
          propertyNames.get(str(t.propertyId)) ?? "",
          str(t.status),
        ]
          .filter(Boolean)
          .join(" · "),
        to: "/tenancies",
      }));

    const payments: Hit[] = data.payments
      .filter((p) => matches(q, p.reference, p.transactionRef, p.receiptNumber, p.method))
      .slice(0, 10)
      .map((p) => {
        const date = toDate(p.paymentDate);
        return {
          id: p.id,
          title: str(p.reference) || p.id,
          subtitle: [
            formatCurrency(num(p.amount)),
            date ? formatDate(date) : "",
            str(p.status),
          ]
            .filter(Boolean)
            .join(" · "),
          to: "/payments",
        };
      });

    const documents: Hit[] = data.documents
      .filter((d) => matches(q, d.name, d.fileName, d.description, d.type))
      .slice(0, 10)
      .map((d) => ({
        id: d.id,
        title: str(d.name) || str(d.fileName) || d.id,
        subtitle: [str(d.type), str(d.fileName)].filter(Boolean).join(" · "),
        to: "/documents",
      }));

    return [
      { key: "properties", label: "Properties", to: "/properties", hits: properties },
      { key: "tenants", label: "Tenants", to: "/tenants", hits: tenants },
      { key: "owners", label: "Landlords", to: "/landlords", hits: owners },
      { key: "tenancies", label: "Tenancies", to: "/tenancies", hits: tenancies },
      { key: "payments", label: "Payments", to: "/payments", hits: payments },
      { key: "documents", label: "Documents", to: "/documents", hits: documents },
    ].filter((group) => group.hits.length > 0);
  }, [data, query]);

  const totalHits = groups.reduce((sum, group) => sum + group.hits.length, 0);

  if (!user) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-xl font-bold text-slate-900">Sign in to search</h2>
        <p className="mt-2 text-slate-500">Please sign in to search your agency records.</p>
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
          message="Create your agency to search its records."
          action={<Button onClick={() => navigate("/agency-profile")}>Create agency</Button>}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Search</h2>
        <p className="mt-1 text-sm text-slate-500">
          Search across properties, tenants, landlords, tenancies, payments and documents.
        </p>
      </div>

      <Card className="p-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
          <Input
            placeholder="Search properties, tenants, landlords, tenancies, payments, documents..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full"
          />
          <Button type="submit" variant="primary">
            Search
          </Button>
        </form>
      </Card>

      {loading ? (
        <Spinner />
      ) : !query ? (
        <Card className="p-8">
          <EmptyState
            title="Start typing to search"
            message="Enter a name, reference, address, phone number or file name to search your agency."
          />
        </Card>
      ) : totalHits === 0 ? (
        <Card className="p-8">
          <EmptyState
            title="No matches found"
            message={`Nothing matched "${query}". Try a different name, reference or keyword.`}
          />
        </Card>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {totalHits} result{totalHits === 1 ? "" : "s"} for{" "}
            <span className="font-medium text-slate-700">"{query}"</span>
          </p>

          {groups.map((group) => (
            <Card
              key={group.key}
              title={group.label}
              subtitle={`${group.hits.length} match${group.hits.length === 1 ? "" : "es"}`}
              actions={
                <Link to={group.to}>
                  <Button size="sm" variant="outline">
                    Open {group.label}
                  </Button>
                </Link>
              }
            >
              <ul className="divide-y divide-slate-100">
                {group.hits.map((hit) => (
                  <li key={hit.id}>
                    <Link
                      to={hit.to}
                      className="flex items-center justify-between gap-3 py-2 hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{hit.title}</p>
                        {hit.subtitle && (
                          <p className="truncate text-xs text-slate-500">{hit.subtitle}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs font-medium text-brand-600">View</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
