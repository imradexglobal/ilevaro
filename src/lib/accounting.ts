import "firebase/compat/firestore";
import { db } from "./firebase";
import { stripUndefined } from "./sanitize";

export type Money = number;

export function formatNGN(kobo: Money): string {
  const naira = kobo / 100;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(naira);
}

export function parseNGN(amount: string): Money {
  const clean = amount.replace(/[₦,\s]/g, "").trim();
  const value = parseFloat(clean);
  if (isNaN(value)) return 0;
  return Math.round(value * 100);
}

export type LedgerEntryType =
  | "rent_charge"
  | "payment"
  | "expense"
  | "deposit_refund"
  | "commission"
  | "remittance";

export interface LedgerEntry {
  id: string;
  type: LedgerEntryType;
  agencyId: string;
  propertyId?: string;
  tenantId?: string;
  amount: Money;
  description: string;
  reference?: string;
  date: Date;
  createdAt: Date;
}

export async function addLedgerEntry(
  entry: Omit<LedgerEntry, "id" | "createdAt">
): Promise<string> {
  const now = new Date();
  const docRef = await db
    .collection("agencies")
    .doc(entry.agencyId)
    .collection("ledger")
    .add({
      ...stripUndefined(entry),
      amount: entry.amount,
      date: entry.date,
      createdAt: now,
    });
  return docRef.id;
}

export async function getLedgerEntries(agencyId: string): Promise<LedgerEntry[]> {
  const snap = await db
    .collection("agencies")
    .doc(agencyId)
    .collection("ledger")
    .get();
  return snap.docs
    .sort((a, b) => {
      const aTime = a.data().createdAt?.toDate?.()?.getTime() ?? 0;
      const bTime = b.data().createdAt?.toDate?.()?.getTime() ?? 0;
      return bTime - aTime;
    })
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        type: data.type,
        agencyId: data.agencyId,
        propertyId: data.propertyId,
        tenantId: data.tenantId,
        amount: data.amount,
        description: data.description,
        reference: data.reference,
        date: data.date?.toDate?.() || new Date(data.createdAt),
        createdAt: data.createdAt?.toDate?.() || new Date(),
      } as LedgerEntry;
    });
}

export async function getLedgerEntriesByType(
  agencyId: string,
  type: LedgerEntryType
): Promise<LedgerEntry[]> {
  const snap = await db
    .collection("agencies")
    .doc(agencyId)
    .collection("ledger")
    .where("type", "==", type)
    .get();
  return snap.docs
    .sort((a, b) => {
      const aTime = a.data().createdAt?.toDate?.()?.getTime() ?? 0;
      const bTime = b.data().createdAt?.toDate?.()?.getTime() ?? 0;
      return bTime - aTime;
    })
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        type: data.type,
        agencyId: data.agencyId,
        propertyId: data.propertyId,
        tenantId: data.tenantId,
        amount: data.amount,
        description: data.description,
        reference: data.reference,
        date: data.date?.toDate?.() || new Date(data.createdAt),
        createdAt: data.createdAt?.toDate?.() || new Date(),
      } as LedgerEntry;
    });
}

export function calculateTotal(entries: LedgerEntry[]): Money {
  return entries.reduce((sum, entry) => sum + entry.amount, 0);
}

export function calculateNet(entries: LedgerEntry[]): Money {
  const inflows = entries
    .filter((e) => e.type === "rent_charge" || e.type === "payment")
    .reduce((sum, e) => sum + e.amount, 0);
  const outflows = entries
    .filter(
      (e) =>
        e.type === "expense" ||
        e.type === "deposit_refund" ||
        e.type === "commission" ||
        e.type === "remittance"
    )
    .reduce((sum, e) => sum + e.amount, 0);
  return inflows - outflows;
}

export function generateIncomeStatement(entries: LedgerEntry[]) {
  const totalInflows = calculateTotal(
    entries.filter((e) => e.type === "rent_charge" || e.type === "payment")
  );
  const totalOutflows = calculateTotal(
    entries.filter(
      (e) =>
        e.type === "expense" ||
        e.type === "deposit_refund" ||
        e.type === "commission" ||
        e.type === "remittance"
    )
  );
  const net = totalInflows - totalOutflows;

  return {
    totalInflows: formatNGN(totalInflows),
    totalOutflows: formatNGN(totalOutflows),
    netProfit: formatNGN(net),
    totalInflowsKobo: totalInflows,
    totalOutflowsKobo: totalOutflows,
    netKobo: net,
  };
}

export function generateBalanceSheet(entries: LedgerEntry[]) {
  const totalAssets = calculateTotal(
    entries.filter((e) => e.type === "deposit_refund")
  );
  const totalLiabilities = calculateTotal(
    entries.filter((e) => e.type === "commission" || e.type === "remittance")
  );
  const equity = calculateTotal(
    entries.filter((e) => e.type === "rent_charge" || e.type === "payment")
  );

  return {
    totalAssets: formatNGN(totalAssets),
    totalLiabilities: formatNGN(totalLiabilities),
    equity: formatNGN(equity),
    totalAssetsKobo: totalAssets,
    totalLiabilitiesKobo: totalLiabilities,
    equityKobo: equity,
  };
}

export function getReconciliationSummary(entries: LedgerEntry[]) {
  const totalInflows = calculateTotal(
    entries.filter((e) => e.type === "rent_charge" || e.type === "payment")
  );
  const totalOutflows = calculateTotal(
    entries.filter(
      (e) =>
        e.type === "expense" ||
        e.type === "deposit_refund" ||
        e.type === "commission" ||
        e.type === "remittance"
    )
  );
  const net = totalInflows - totalOutflows;

  const byType: Record<LedgerEntryType, number> = {
    rent_charge: 0,
    payment: 0,
    expense: 0,
    deposit_refund: 0,
    commission: 0,
    remittance: 0,
  };

  entries.forEach((entry) => {
    if (byType[entry.type] !== undefined) {
      byType[entry.type] += 1;
    }
  });

  return {
    totalInflows: formatNGN(totalInflows),
    totalOutflows: formatNGN(totalOutflows),
    net: formatNGN(net),
    entryCount: entries.length,
    byType,
    totalInflowsKobo: totalInflows,
    totalOutflowsKobo: totalOutflows,
    netKobo: net,
  };
}