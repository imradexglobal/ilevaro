import { db } from "./firebase";

type SearchCollection =
  | "properties"
  | "tenants"
  | "rent_charges"
  | "payments"
  | "expenses";

interface SearchResult {
  properties: (Record<string, unknown> & { id: string })[];
  tenants: (Record<string, unknown> & { id: string })[];
  rentCharges: (Record<string, unknown> & { id: string })[];
  payments: (Record<string, unknown> & { id: string })[];
  expenses: (Record<string, unknown> & { id: string })[];
  score: number;
}

export async function globalSearch(
  agencyId: string,
  query: string
): Promise<SearchResult> {
  const searchLower = query.toLowerCase();
  const results: SearchResult = {
    properties: [],
    tenants: [],
    rentCharges: [],
    payments: [],
    expenses: [],
    score: 0,
  };

  const addResult = async (
    target: SearchResult["properties"],
    getter: (data: Record<string, unknown>) => boolean,
    colName: SearchCollection
  ) => {
    const snap = await db
      .collection("agencies")
      .doc(agencyId)
      .collection(colName)
      .get();
    snap.docs.forEach((doc) => {
      const data = doc.data();
      if (getter(data as Record<string, unknown>)) {
        target.push({ id: doc.id, ...data });
        results.score += 1;
      }
    });
  };

  await addResult(
    results.properties,
    (data): boolean =>
      Boolean(
        (data.name && String(data.name).toLowerCase().includes(searchLower)) ||
        (data.reference && String(data.reference).toLowerCase().includes(searchLower)) ||
        (data.address && String(data.address).toLowerCase().includes(searchLower)) ||
        (data.state && String(data.state).toLowerCase().includes(searchLower))
      ),
    "properties"
  );

  await addResult(
    results.tenants,
    (data): boolean =>
      Boolean(
        (data.firstName && String(data.firstName).toLowerCase().includes(searchLower)) ||
        (data.lastName && String(data.lastName).toLowerCase().includes(searchLower)) ||
        (data.phone && String(data.phone).toLowerCase().includes(searchLower))
      ),
    "tenants"
  );

  await addResult(
    results.rentCharges,
    (data): boolean =>
      Boolean(
        (data.reference && String(data.reference).toLowerCase().includes(searchLower)) ||
        (data.status && String(data.status).toLowerCase().includes(searchLower))
      ),
    "rent_charges"
  );

  await addResult(
    results.payments,
    (data): boolean =>
      Boolean(
        (data.reference && String(data.reference).toLowerCase().includes(searchLower)) ||
        (data.transactionRef && String(data.transactionRef).toLowerCase().includes(searchLower))
      ),
    "payments"
  );

  await addResult(
    results.expenses,
    (data): boolean =>
      Boolean(
        (data.description && String(data.description).toLowerCase().includes(searchLower)) ||
        (data.category && String(data.category).toLowerCase().includes(searchLower))
      ),
    "expenses"
  );

  return results;
}

export function formatSearchResults(results: SearchResult) {
  return {
    total:
      results.properties.length +
      results.tenants.length +
      results.rentCharges.length +
      results.payments.length +
      results.expenses.length,
    properties: results.properties,
    tenants: results.tenants,
    rentCharges: results.rentCharges,
    payments: results.payments,
    expenses: results.expenses,
    searchScore: results.score,
  };
}