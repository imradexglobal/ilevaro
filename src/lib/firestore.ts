import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import { db } from "./firebase";
import { stripUndefined } from "./sanitize";
import { DEFAULT_DUE_SOON_DAYS, DEFAULT_PROPERTY_TYPES } from "./constants";
import type { Money } from "./accounting";
import type { OccupancyStatus, PaymentMethod, TenantCreditType } from "./types";

export type { Money } from "./accounting";
export type { Property, Expense, Deposit, Commission } from "./types";

type Timestamp = firebase.firestore.Timestamp;

export function agencyCollection(agencyId: string, name: string) {
  return db.collection("agencies").doc(agencyId).collection(name);
}

export function agencyDoc(agencyId: string, name: string, id: string) {
  return db.collection("agencies").doc(agencyId).collection(name).doc(id);
}

export async function createAgencyDoc(
  agencyId: string,
  collectionName: string,
  id: string,
  data: Record<string, unknown>
) {
  const ref = agencyDoc(agencyId, collectionName, id);
  await ref.set({
    ...stripUndefined(data),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  return ref;
}

export async function getAgencyDoc(
  agencyId: string,
  collectionName: string,
  id: string
): Promise<(Record<string, unknown> & { id: string }) | null> {
  const snap = await agencyDoc(agencyId, collectionName, id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data()! } as Record<string, unknown> & { id: string };
}

export async function updateAgencyDoc(
  agencyId: string,
  collectionName: string,
  id: string,
  data: Record<string, unknown>
) {
  await agencyDoc(agencyId, collectionName, id).update({
    ...stripUndefined(data),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

export async function deleteAgencyDoc(
  agencyId: string,
  collectionName: string,
  id: string
) {
  await agencyDoc(agencyId, collectionName, id).delete();
}

export async function queryAgencyCollection(
  agencyId: string,
  collectionName: string,
  ...constraints: ((q: firebase.firestore.Query) => firebase.firestore.Query)[]
): Promise<(Record<string, unknown> & { id: string })[]> {
  let q: firebase.firestore.Query = agencyCollection(agencyId, collectionName);
  for (const constraint of constraints) {
    q = constraint(q);
  }
  const snap = await q.get();
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as (Record<string, unknown> & { id: string })[];
}

// Agency membership (top-level so security rules can do an O(1) lookup).
// Path is agency_members/{userId}/profile/data — "data" is a fixed doc id
// and is what every rule in firestore.rules reads.

export function agencyMemberProfileDoc(userId: string) {
  return db
    .collection("agency_members")
    .doc(userId)
    .collection("profile")
    .doc("data");
}

export async function createAgencyMembership(
  userId: string,
  data: Record<string, unknown>
) {
  const ref = agencyMemberProfileDoc(userId);
  await ref.set({
    ...stripUndefined(data),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  return ref;
}

export async function getAgencyMembership(
  userId: string
): Promise<(Record<string, unknown> & { id: string }) | null> {
  const snap = await agencyMemberProfileDoc(userId).get();
  if (!snap.exists) return null;
  return {
    id: snap.id,
    ...snap.data()!,
  } as Record<string, unknown> & { id: string };
}

// Property services

export function propertyCollection(agencyId: string) {
  return db.collection("agencies").doc(agencyId).collection("properties");
}

export function propertyDoc(agencyId: string, id: string) {
  return db.collection("agencies").doc(agencyId).collection("properties").doc(id);
}

export async function createPropertyDoc(
  agencyId: string,
  id: string,
  data: Record<string, unknown>
) {
  const ref = propertyDoc(agencyId, id);
  await ref.set({
    ...stripUndefined(data),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  return ref;
}

export async function getPropertyDoc(
  agencyId: string,
  id: string
): Promise<(Record<string, unknown> & { id: string }) | null> {
  const snap = await propertyDoc(agencyId, id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data()! } as Record<string, unknown> & { id: string };
}

export async function updatePropertyDoc(
  agencyId: string,
  id: string,
  data: Record<string, unknown>
) {
  await propertyDoc(agencyId, id).update({
    ...stripUndefined(data),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

export async function archivePropertyDoc(
  agencyId: string,
  id: string
) {
  await propertyDoc(agencyId, id).update({
    status: "archived",
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

export async function queryProperties(
  agencyId: string,
  filters?: {
    state?: string;
    lga?: string;
    type?: string;
    occupancyStatus?: string;
    status?: string;
    search?: string;
  }
) {
  let q: firebase.firestore.Query = propertyCollection(agencyId);

  if (filters) {
    if (filters.state) q = q.where("state", "==", filters.state);
    if (filters.lga) q = q.where("lga", "==", filters.lga);
    if (filters.type) q = q.where("type", "==", filters.type);
    if (filters.occupancyStatus) q = q.where("occupancyStatus", "==", filters.occupancyStatus);
    if (filters.status) q = q.where("status", "==", filters.status);

    if (filters.search) {
      const snap = await q.get();
      const results = snap.docs.filter((d) => {
        const data = d.data() as Record<string, unknown>;
        return (
          (data.name && String(data.name).toLowerCase().includes(filters.search!.toLowerCase())) ||
          (data.reference && String(data.reference).toLowerCase().includes(filters.search!.toLowerCase())) ||
          (data.description && String(data.description).toLowerCase().includes(filters.search!.toLowerCase()))
        );
      });
      return results.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown> & { id: string }));
    }
  }

  const snap = await q.get();
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as (Record<string, unknown> & { id: string })[];
}

// Building services

export function buildingCollection(agencyId: string, propertyId: string) {
  return db.collection("agencies").doc(agencyId).collection("properties").doc(propertyId).collection("buildings");
}

export function buildingDoc(agencyId: string, propertyId: string, id: string) {
  return db.collection("agencies").doc(agencyId).collection("properties").doc(propertyId).collection("buildings").doc(id);
}

export async function createBuildingDoc(
  agencyId: string,
  propertyId: string,
  id: string,
  data: Record<string, unknown>
) {
  const ref = buildingDoc(agencyId, propertyId, id);
  await ref.set({
    ...stripUndefined(data),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  return ref;
}

export async function getBuildingDoc(
  agencyId: string,
  propertyId: string,
  id: string
): Promise<(Record<string, unknown> & { id: string }) | null> {
  const snap = await buildingDoc(agencyId, propertyId, id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data()! } as Record<string, unknown> & { id: string };
}

// Unit services
// Units live under a property: agencies/{agencyId}/properties/{propertyId}/units.

export type UnitStatus = "available" | "occupied" | "reserved" | "under_maintenance" | "inactive";

export function unitCollection(agencyId: string, propertyId: string) {
  return db.collection("agencies").doc(agencyId).collection("properties").doc(propertyId).collection("units");
}

export function unitDoc(agencyId: string, propertyId: string, id: string) {
  return unitCollection(agencyId, propertyId).doc(id);
}

export async function createUnitDoc(
  agencyId: string,
  propertyId: string,
  id: string,
  data: Record<string, unknown>
) {
  const ref = unitDoc(agencyId, propertyId, id);
  await ref.set({
    ...stripUndefined(data),
    agencyId,
    propertyId,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  return ref;
}

export async function updateUnitDoc(
  agencyId: string,
  propertyId: string,
  id: string,
  data: Record<string, unknown>
) {
  await unitDoc(agencyId, propertyId, id).update({
    ...stripUndefined(data),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

export async function deleteUnitDoc(agencyId: string, propertyId: string, id: string) {
  await unitDoc(agencyId, propertyId, id).delete();
}

export type UnitRecord = {
  id: string;
  agencyId?: string;
  propertyId?: string;
  label?: string;
  type?: string;
  annualRent?: number;
  status?: UnitStatus;
  description?: string;
};

export async function queryUnits(agencyId: string, propertyId: string): Promise<UnitRecord[]> {
  const snap = await unitCollection(agencyId, propertyId).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as UnitRecord[];
}

/** Move a unit between availability states, e.g. when a tenancy starts or ends. */
export async function setUnitStatus(
  agencyId: string,
  propertyId: string,
  unitId: string,
  status: UnitStatus
): Promise<void> {
  if (!propertyId || !unitId) return;
  try {
    await updateUnitDoc(agencyId, propertyId, unitId, { status });
  } catch (err) {
    // A missing unit or a role without unit write access must not fail the
    // tenancy operation the caller is performing.
    console.error("Failed to update unit status", err);
  }
}

/** Roll individual unit statuses up into one property-level occupancy status. */
export function occupancyFromStatuses(statuses: string[]): OccupancyStatus {
  if (statuses.length === 0) return "vacant";
  const occupied = statuses.filter((s) => s === "occupied").length;
  if (occupied === statuses.length) return "occupied";
  if (occupied > 0) return "partially_occupied";
  const maintenance = statuses.filter((s) => s === "under_maintenance").length;
  if (maintenance === statuses.length) return "under_maintenance";
  if (statuses.some((s) => s === "available" || s === "reserved")) return "vacant";
  return "inactive";
}

/**
 * Recompute a property's occupancy status and persist it when it changed.
 *
 * Properties with units take their occupancy from those units; a property
 * without units falls back to its tenancies (occupied while any tenancy is
 * active, vacant otherwise). Properties that have never been let keep whatever
 * occupancy a user set manually. Safe to call after any tenancy or unit change —
 * it only writes when the value actually differs.
 */
export async function syncPropertyOccupancy(
  agencyId: string,
  propertyId: string
): Promise<void> {
  if (!agencyId || !propertyId) return;
  try {
    const units = await queryUnits(agencyId, propertyId);
    let next: OccupancyStatus;
    if (units.length > 0) {
      next = occupancyFromStatuses(units.map((u) => u.status ?? "available"));
    } else {
      const tenancySnap = await agencyCollection(agencyId, "tenancies")
        .where("propertyId", "==", propertyId)
        .get();
      if (tenancySnap.empty) return; // never let — keep the manual value
      next = tenancySnap.docs.some((d) => d.data().status === "active") ? "occupied" : "vacant";
    }
    const propertySnap = await agencyDoc(agencyId, "properties", propertyId).get();
    if (!propertySnap.exists) return;
    if (propertySnap.data()?.occupancyStatus === next) return;
    await updatePropertyDoc(agencyId, propertyId, { occupancyStatus: next });
  } catch (err) {
    console.error("Failed to sync property occupancy", err);
  }
}

// ---- Agency settings (stored on the agency meta document) ----
// Property/unit types and the "due soon" window are agency-wide preferences.

export interface AgencySettings {
  propertyTypes: string[];
  dueSoonDays: number;
}

export async function getAgencySettings(agencyId: string): Promise<AgencySettings> {
  const doc = await getAgencyDoc(agencyId, "meta", agencyId);
  const rawTypes = doc?.propertyTypes;
  const propertyTypes = Array.isArray(rawTypes)
    ? rawTypes.filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    : [];
  const dueSoonDays =
    typeof doc?.dueSoonDays === "number" && doc.dueSoonDays > 0
      ? doc.dueSoonDays
      : DEFAULT_DUE_SOON_DAYS;
  return {
    propertyTypes: propertyTypes.length > 0 ? propertyTypes : [...DEFAULT_PROPERTY_TYPES],
    dueSoonDays,
  };
}

export async function updateAgencySettings(
  agencyId: string,
  data: { propertyTypes?: string[]; dueSoonDays?: number }
): Promise<void> {
  await db
    .collection("agencies")
    .doc(agencyId)
    .collection("meta")
    .doc(agencyId)
    .set(
      {
        ...stripUndefined(data),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

// Owner services

export function ownerCollection(agencyId: string) {
  return db.collection("agencies").doc(agencyId).collection("owners");
}

export function ownerDoc(agencyId: string, id: string) {
  return db.collection("agencies").doc(agencyId).collection("owners").doc(id);
}

export async function createOwnerDoc(
  agencyId: string,
  id: string,
  data: Record<string, unknown>
) {
  const ref = ownerDoc(agencyId, id);
  await ref.set({
    ...stripUndefined(data),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  return ref;
}

export async function getOwnerDoc(
  agencyId: string,
  id: string
): Promise<(Record<string, unknown> & { id: string }) | null> {
  const snap = await ownerDoc(agencyId, id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data()! } as Record<string, unknown> & { id: string };
}

export async function updateOwnerDoc(
  agencyId: string,
  id: string,
  data: Record<string, unknown>
) {
  await ownerDoc(agencyId, id).update({
    ...stripUndefined(data),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

// Tenant services

export function tenantCollection(agencyId: string) {
  return db.collection("agencies").doc(agencyId).collection("tenants");
}

export function tenantDoc(agencyId: string, id: string) {
  return db.collection("agencies").doc(agencyId).collection("tenants").doc(id);
}

export async function createTenantDoc(
  agencyId: string,
  id: string,
  data: Record<string, unknown>
) {
  const ref = tenantDoc(agencyId, id);
  await ref.set({
    ...stripUndefined(data),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  return ref;
}

export async function getTenantDoc(
  agencyId: string,
  id: string
): Promise<(Record<string, unknown> & { id: string }) | null> {
  const snap = await tenantDoc(agencyId, id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data()! } as Record<string, unknown> & { id: string };
}

// Guarantor services

export function guarantorCollection(agencyId: string) {
  return db.collection("agencies").doc(agencyId).collection("guarantors");
}

export function guarantorDoc(agencyId: string, id: string) {
  return db.collection("agencies").doc(agencyId).collection("guarantors").doc(id);
}

export async function createGuarantorDoc(
  agencyId: string,
  id: string,
  data: Record<string, unknown>
) {
  const ref = guarantorDoc(agencyId, id);
  await ref.set({
    ...stripUndefined(data),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  return ref;
}

export async function getGuarantorDoc(
  agencyId: string,
  id: string
): Promise<(Record<string, unknown> & { id: string }) | null> {
  const snap = await guarantorDoc(agencyId, id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data()! } as Record<string, unknown> & { id: string };
}

// Expense services

export function expenseCollection(agencyId: string) {
  return db.collection("agencies").doc(agencyId).collection("expenses");
}

export function expenseDoc(agencyId: string, id: string) {
  return db.collection("agencies").doc(agencyId).collection("expenses").doc(id);
}

export async function createExpenseDoc(
  agencyId: string,
  id: string,
  data: Record<string, unknown>
) {
  const ref = expenseDoc(agencyId, id);
  await ref.set({
    ...stripUndefined(data),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  return ref;
}

export async function getExpenseDoc(
  agencyId: string,
  id: string
): Promise<(Record<string, unknown> & { id: string }) | null> {
  const snap = await expenseDoc(agencyId, id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data()! } as Record<string, unknown> & { id: string };
}

export async function updateExpenseDoc(
  agencyId: string,
  id: string,
  data: Record<string, unknown>
) {
  await expenseDoc(agencyId, id).update({
    ...stripUndefined(data),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

// Deposit services

export function depositCollection(agencyId: string) {
  return db.collection("agencies").doc(agencyId).collection("deposits");
}

export function depositDoc(agencyId: string, id: string) {
  return db.collection("agencies").doc(agencyId).collection("deposits").doc(id);
}

export async function createDepositDoc(
  agencyId: string,
  id: string,
  data: Record<string, unknown>
) {
  const ref = depositDoc(agencyId, id);
  await ref.set({
    ...stripUndefined(data),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  return ref;
}

export async function getDepositDoc(
  agencyId: string,
  id: string
): Promise<(Record<string, unknown> & { id: string }) | null> {
  const snap = await depositDoc(agencyId, id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data()! } as Record<string, unknown> & { id: string };
}

export async function updateDepositDoc(
  agencyId: string,
  id: string,
  data: Record<string, unknown>
) {
  await depositDoc(agencyId, id).update({
    ...stripUndefined(data),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

// Commission services

export function commissionCollection(agencyId: string) {
  return db.collection("agencies").doc(agencyId).collection("commissions");
}

export function commissionDoc(agencyId: string, id: string) {
  return db.collection("agencies").doc(agencyId).collection("commissions").doc(id);
}

export async function createCommissionDoc(
  agencyId: string,
  id: string,
  data: Record<string, unknown>
) {
  const ref = commissionDoc(agencyId, id);
  await ref.set({
    ...stripUndefined(data),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  return ref;
}

export async function getCommissionDoc(
  agencyId: string,
  id: string
): Promise<(Record<string, unknown> & { id: string }) | null> {
  const snap = await commissionDoc(agencyId, id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data()! } as Record<string, unknown> & { id: string };
}

export async function updateCommissionDoc(
  agencyId: string,
  id: string,
  data: Record<string, unknown>
) {
  await commissionDoc(agencyId, id).update({
    ...stripUndefined(data),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

// Remittance services

export function remittanceCollection(agencyId: string) {
  return db.collection("agencies").doc(agencyId).collection("remittances");
}

export function remittanceDoc(agencyId: string, id: string) {
  return db.collection("agencies").doc(agencyId).collection("remittances").doc(id);
}

export async function createRemittanceDoc(
  agencyId: string,
  id: string,
  data: Record<string, unknown>
) {
  const ref = remittanceDoc(agencyId, id);
  await ref.set({
    ...stripUndefined(data),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  return ref;
}

export async function getRemittanceDoc(
  agencyId: string,
  id: string
): Promise<(Record<string, unknown> & { id: string }) | null> {
  const snap = await remittanceDoc(agencyId, id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data()! } as Record<string, unknown> & { id: string };
}

// ---- Rent Engine Service ----
// Critical business logic for rent charge generation, payment allocation,
// and status determination. All financial operations go through this layer
// to ensure deterministic calculations and prevent double-allocation.

export type RentChargeStatus =
  | "upcoming"
  | "due"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "waived"
  | "cancelled";

export interface RentCharge {
  id: string;
  agencyId: string;
  tenancyId: string;
  reference: string;
  periodStart: Timestamp;
  periodEnd: Timestamp;
  dueDate: Timestamp;
  amountDue: number;
  amountPaid: number;
  outstanding: number;
  status: RentChargeStatus;
  waivedAmount?: number;
  waiverReason?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Generate rent charges from all active tenancies for an agency
// Returns the list of created charge IDs
export async function generateRentCharges(agencyId: string): Promise<string[]> {
  const tenanciesRef = db.collection("agencies").doc(agencyId).collection("tenancies");
  const tenancySnap = await tenanciesRef.get();

  const createdIds: string[] = [];

  for (const tenancyDoc of tenancySnap.docs) {
    const tenancyData = tenancyDoc.data();

    // Skip if tenancy is not active
    if (tenancyData.status !== "active" && tenancyData.status !== "proposed") {
      continue;
    }

    // Check if a charge already exists for this tenancy
    const existingChargesRef = db.collection("agencies").doc(agencyId).collection("rent_charges");
    const existingSnap = await existingChargesRef.where("tenancyId", "==", tenancyDoc.id).get();

    if (!existingSnap.empty) {
      // Charge already exists for this tenancy
      continue;
    }

    // Calculate rent charge details. The total due for a period is the rent
    // plus any recurring other charges agreed with the tenant.
    const rentAmount = tenancyData.rentAmount || 0;
    const otherCharges = tenancyData.otherCharges || 0;
    const totalDue = rentAmount + otherCharges;
    const dueDay = tenancyData.dueDay || 1;

    // Calculate period start and end based on frequency
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;

    // Monthly: current calendar month
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Calculate due date (dueDay of the month)
    const dueDate = new Date(periodEnd);
    dueDate.setDate(dueDay);

    const outstanding = totalDue;

    const reference = `REN-${agencyId.substring(0, 3).toUpperCase()}-${String(createdIds.length + 1).padStart(3, "0")}`;

    const chargeDocRef = db.collection("agencies").doc(agencyId).collection("rent_charges").doc();

    await chargeDocRef.set({
      agencyId,
      tenancyId: tenancyDoc.id,
      reference,
      periodStart: firebase.firestore.Timestamp.fromDate(periodStart),
      periodEnd: firebase.firestore.Timestamp.fromDate(periodEnd),
      dueDate: firebase.firestore.Timestamp.fromDate(dueDate),
      amountDue: totalDue,
      amountPaid: 0,
      outstanding,
      status: "upcoming",
      waivedAmount: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    createdIds.push(chargeDocRef.id);

    // Any credit the tenant already holds (e.g. from an earlier overpayment) is
    // applied straight away so the new charge opens with the correct balance.
    const tenantId = tenancyData.tenantId as string | undefined;
    if (tenantId) {
      await applyTenantCreditToCharge(agencyId, tenantId, chargeDocRef.id);
    }
  }

  return createdIds;
}

// Calculate charge status based on due date and payments
export function calculateChargeStatus(
  dueDate: Date,
  amountDue: number,
  amountPaid: number,
  gracePeriodDays: number = 7
): RentChargeStatus {
  // Nothing owed, or fully settled.
  if (amountDue <= 0 || amountPaid >= amountDue) return "paid";

  // Whole days from the due date: positive once past it, negative while ahead.
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysFromDue = Math.ceil((Date.now() - dueDate.getTime()) / msPerDay);

  // Past due and beyond the grace window with money still owed.
  if (daysFromDue > gracePeriodDays) return "overdue";

  // Some money paid but not the full amount.
  if (amountPaid > 0) return "partially_paid";

  // Inside the grace window on either side of the due date.
  if (daysFromDue >= -gracePeriodDays) return "due";

  return "upcoming";
}

// Allocate a payment to one or more rent charges
// Prevents double-allocation by checking existence of PaymentAllocation doc
// Uses Firestore transaction for concurrent allocation safety
export async function allocatePayment(
  agencyId: string,
  paymentId: string,
  tenancyId: string,
  rentChargeIds: string[],
  amounts: number[]
): Promise<{
  success: boolean;
  allocated: Array<{ chargeId: string; amount: number; remaining: number }>;
  error?: string;
}> {
  const allocations: Array<{ chargeId: string; amount: number; remaining: number }> = [];
  let totalAllocated = 0;

  // Use Firestore transaction for concurrent allocation safety
  await db.runTransaction(async (t) => {
    for (let i = 0; i < rentChargeIds.length; i++) {
      const chargeId = rentChargeIds[i];
      const amountToAllocate = amounts[i] || 0;

      const chargeRef = db.collection("agencies").doc(agencyId).collection("rent_charges").doc(chargeId);

      if (amountToAllocate <= 0) {
        const chargeSnap = await t.get(chargeRef);
        if (chargeSnap.exists) {
          const chargeData = chargeSnap.data() as RentCharge;
          allocations.push({ chargeId, amount: 0, remaining: chargeData.outstanding });
        } else {
          allocations.push({ chargeId, amount: 0, remaining: 0 });
        }
        continue;
      }

      const chargeSnap = await t.get(chargeRef);
      if (!chargeSnap.exists) {
        allocations.push({ chargeId, amount: 0, remaining: 0 });
        continue;
      }

      // One allocation record per payment+charge pair. Using the charge id (not
      // the tenancy id) keeps a separate record for every charge a payment is
      // spread across, which is what makes reversal possible later.
      const allocRef = db
        .collection("agencies")
        .doc(agencyId)
        .collection("payment_allocations")
        .doc(`${paymentId}_${chargeId}`);
      const allocSnap = await t.get(allocRef);
      if (allocSnap.exists) {
        throw new Error("This payment has already been allocated to one of the selected charges");
      }

      const chargeData = chargeSnap.data() as RentCharge;
      const remainingOutstanding = chargeData.outstanding;

      // Allocate the lesser of the payment amount or remaining outstanding
      const allocationAmount = Math.min(amountToAllocate, remainingOutstanding);

      if (allocationAmount <= 0) {
        allocations.push({ chargeId, amount: 0, remaining: remainingOutstanding });
        continue;
      }

      const newOutstanding = remainingOutstanding - allocationAmount;
      const newAmountPaid = (chargeData.amountPaid || 0) + allocationAmount;
      const newStatus = newOutstanding <= 0 ? "paid" : calculateChargeStatus(
        chargeData.dueDate.toDate(),
        chargeData.amountDue,
        newAmountPaid
      );

      // Update the charge within the transaction
      t.update(chargeRef, {
        amountPaid: newAmountPaid,
        outstanding: newOutstanding,
        status: newStatus,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      // Record the payment allocation to prevent double-allocation
      t.set(allocRef, {
        paymentId,
        rentChargeId: chargeId,
        agencyId,
        tenancyId,
        amountAllocated: allocationAmount,
        allocatedAt: new Date(),
      });

      allocations.push({
        chargeId,
        amount: allocationAmount,
        remaining: newOutstanding,
      });

      totalAllocated += allocationAmount;

      // If fully paid, stop allocating to remaining charges
      if (newOutstanding <= 0 && i < rentChargeIds.length - 1) {
        for (let j = i + 1; j < rentChargeIds.length; j++) {
          const cRef = db.collection("agencies").doc(agencyId).collection("rent_charges").doc(rentChargeIds[j]);
          const cSnap = await t.get(cRef);
          allocations.push({ chargeId: rentChargeIds[j], amount: 0, remaining: cSnap.exists ? (cSnap.data() as RentCharge).outstanding : 0 });
        }
        break;
      }
    }
  });

  return {
    success: totalAllocated > 0,
    allocated: allocations,
    error: totalAllocated === 0 ? "No charges found or fully paid already" : undefined,
  };
}

// ---- Payment allocations & cascade deletion ----

export interface PaymentAllocationRecord {
  id: string;
  paymentId: string;
  rentChargeId: string;
  tenancyId: string;
  amountAllocated: number;
}

async function queryAllocations(
  agencyId: string,
  field: "paymentId" | "rentChargeId",
  value: string
): Promise<PaymentAllocationRecord[]> {
  const snap = await db
    .collection("agencies")
    .doc(agencyId)
    .collection("payment_allocations")
    .where(field, "==", value)
    .get();
  return snap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<PaymentAllocationRecord, "id">),
  }));
}

export function getPaymentAllocations(agencyId: string, paymentId: string) {
  return queryAllocations(agencyId, "paymentId", paymentId);
}

export function getRentChargeAllocations(agencyId: string, rentChargeId: string) {
  return queryAllocations(agencyId, "rentChargeId", rentChargeId);
}

/**
 * Undo one allocation: hand the amount back to the rent charge and drop the
 * allocation record. Used when a payment is deleted or its amount is changed.
 */
async function releaseAllocation(
  agencyId: string,
  allocation: PaymentAllocationRecord
): Promise<void> {
  const chargeRef = db
    .collection("agencies")
    .doc(agencyId)
    .collection("rent_charges")
    .doc(allocation.rentChargeId);

  const snap = await chargeRef.get();
  if (snap.exists) {
    const charge = snap.data() as RentCharge;
    const newAmountPaid = Math.max(0, (charge.amountPaid || 0) - allocation.amountAllocated);
    const newOutstanding = Math.min(
      charge.amountDue,
      (charge.outstanding || 0) + allocation.amountAllocated
    );
    await chargeRef.update({
      amountPaid: newAmountPaid,
      outstanding: newOutstanding,
      status: calculateChargeStatus(charge.dueDate.toDate(), charge.amountDue, newAmountPaid),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  await db
    .collection("agencies")
    .doc(agencyId)
    .collection("payment_allocations")
    .doc(allocation.id)
    .delete();
}

/**
 * Release every allocation belonging to a payment. Call this before changing a
 * payment's amount so the charges it paid are returned to their prior balances.
 */
export async function releasePaymentAllocations(
  agencyId: string,
  paymentId: string
): Promise<number> {
  const allocations = await getPaymentAllocations(agencyId, paymentId);
  for (const allocation of allocations) {
    await releaseAllocation(agencyId, allocation);
  }
  return allocations.length;
}

/**
 * Delete a payment receipt. Every rent charge the payment was allocated to is
 * restored to its pre-payment balance, its allocation records are removed, any
 * overpayment credit it created is withdrawn, and the matching ledger entry is
 * dropped, so nothing is left dangling.
 */
export async function deletePayment(
  agencyId: string,
  paymentId: string
): Promise<{ releasedCharges: number; releasedCredit: number }> {
  const paymentRef = db.collection("agencies").doc(agencyId).collection("payments").doc(paymentId);
  const paymentSnap = await paymentRef.get();
  const reference = paymentSnap.exists
    ? (paymentSnap.data() as { reference?: string }).reference
    : undefined;

  const releasedCharges = await releasePaymentAllocations(agencyId, paymentId);
  const releasedCredit = await reversePaymentCredit(agencyId, paymentId);

  if (reference) {
    const ledgerSnap = await db
      .collection("agencies")
      .doc(agencyId)
      .collection("ledger")
      .where("reference", "==", reference)
      .get();
    await Promise.all(ledgerSnap.docs.map((doc) => doc.ref.delete()));
  }

  await paymentRef.delete();
  return { releasedCharges, releasedCredit };
}

/**
 * Delete a rent charge along with any payment allocations pointing at it. The
 * payments themselves stay — only the allocation links are removed.
 */
export async function deleteRentCharge(agencyId: string, rentChargeId: string): Promise<void> {
  const allocations = await getRentChargeAllocations(agencyId, rentChargeId);
  await Promise.all(
    allocations.map((allocation) =>
      db
        .collection("agencies")
        .doc(agencyId)
        .collection("payment_allocations")
        .doc(allocation.id)
        .delete()
    )
  );
  await deleteAgencyDoc(agencyId, "rent_charges", rentChargeId);
}

// ---- Tenant credit balance ----

export interface TenantCreditRecord {
  id: string;
  tenantId: string;
  amount: number;
  type: TenantCreditType;
  paymentId?: string;
  rentChargeId?: string;
  notes?: string;
}

export function tenantCreditCollection(agencyId: string) {
  return db.collection("agencies").doc(agencyId).collection("tenant_credits");
}

/** Unallocated money a tenant currently holds on their account. */
export async function getTenantCreditBalance(
  agencyId: string,
  tenantId: string
): Promise<number> {
  const snap = await db
    .collection("agencies")
    .doc(agencyId)
    .collection("tenants")
    .doc(tenantId)
    .get();
  if (!snap.exists) return 0;
  return (snap.data() as { creditBalance?: number }).creditBalance ?? 0;
}

/**
 * Add money to a tenant's credit balance and record the movement on the credit
 * ledger. Called when a payment is larger than the tenant's outstanding
 * charges, so the excess is never silently lost.
 */
export async function addTenantCredit(
  agencyId: string,
  tenantId: string,
  amount: number,
  options: { paymentId?: string; notes?: string } = {}
): Promise<number> {
  if (amount <= 0) return 0;
  const base = db.collection("agencies").doc(agencyId);
  const tenantRef = base.collection("tenants").doc(tenantId);
  const creditRef = tenantCreditCollection(agencyId).doc();

  let newBalance = 0;
  await db.runTransaction(async (t) => {
    const tenantSnap = await t.get(tenantRef);
    const current = tenantSnap.exists
      ? (tenantSnap.data() as { creditBalance?: number }).creditBalance ?? 0
      : 0;
    newBalance = current + amount;
    t.set(
      tenantRef,
      {
        creditBalance: newBalance,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    t.set(
      creditRef,
      stripUndefined({
        agencyId,
        tenantId,
        amount,
        type: "overpayment" as TenantCreditType,
        paymentId: options.paymentId,
        notes: options.notes,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
    );
  });
  return newBalance;
}

/**
 * Draw a tenant's available credit down against one rent charge. Applies the
 * lesser of the credit balance and the charge's outstanding amount, updates the
 * charge and records the movement. Returns the amount applied.
 *
 * IDs are read first and written after, as Firestore transactions require.
 */
export async function applyTenantCreditToCharge(
  agencyId: string,
  tenantId: string,
  rentChargeId: string
): Promise<number> {
  const base = db.collection("agencies").doc(agencyId);
  const tenantRef = base.collection("tenants").doc(tenantId);
  const chargeRef = base.collection("rent_charges").doc(rentChargeId);
  const creditRef = tenantCreditCollection(agencyId).doc();

  let applied = 0;
  await db.runTransaction(async (t) => {
    const tenantSnap = await t.get(tenantRef);
    const chargeSnap = await t.get(chargeRef);
    if (!chargeSnap.exists) return;

    const credit = tenantSnap.exists
      ? (tenantSnap.data() as { creditBalance?: number }).creditBalance ?? 0
      : 0;
    const charge = chargeSnap.data() as RentCharge;
    const outstanding = charge.outstanding ?? 0;
    applied = Math.min(credit, outstanding);
    if (applied <= 0) return;

    const newOutstanding = outstanding - applied;
    const newAmountPaid = (charge.amountPaid || 0) + applied;
    const newStatus: RentChargeStatus =
      newOutstanding <= 0
        ? "paid"
        : calculateChargeStatus(charge.dueDate.toDate(), charge.amountDue, newAmountPaid);

    t.update(chargeRef, {
      amountPaid: newAmountPaid,
      outstanding: newOutstanding,
      status: newStatus,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    t.set(
      tenantRef,
      {
        creditBalance: credit - applied,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    t.set(
      creditRef,
      stripUndefined({
        agencyId,
        tenantId,
        amount: -applied,
        type: "applied" as TenantCreditType,
        rentChargeId,
        notes: "Auto-applied to rent charge",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
    );
  });
  return applied;
}

/** Credit movements created by a payment (its overpayment), if any. */
export async function getPaymentCredits(
  agencyId: string,
  paymentId: string
): Promise<TenantCreditRecord[]> {
  const snap = await tenantCreditCollection(agencyId).where("paymentId", "==", paymentId).get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<TenantCreditRecord, "id">) }))
    .filter((credit) => credit.amount > 0);
}

/**
 * Undo the overpayment credit created by a payment. Reduces the tenant's
 * balance by what is still available (never below zero) and removes the ledger
 * rows so the credit is not left behind after a reversal or deletion.
 */
export async function reversePaymentCredit(
  agencyId: string,
  paymentId: string
): Promise<number> {
  const credits = await getPaymentCredits(agencyId, paymentId);
  if (credits.length === 0) return 0;

  const base = db.collection("agencies").doc(agencyId);
  let removed = 0;
  for (const credit of credits) {
    const tenantRef = base.collection("tenants").doc(credit.tenantId);
    const tenantSnap = await tenantRef.get();
    if (tenantSnap.exists) {
      const current = (tenantSnap.data() as { creditBalance?: number }).creditBalance ?? 0;
      const reduction = Math.min(current, credit.amount);
      if (reduction > 0) {
        await tenantRef.set(
          {
            creditBalance: current - reduction,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        removed += reduction;
      }
    }
    await tenantCreditCollection(agencyId).doc(credit.id).delete();
  }
  return removed;
}


export interface TenancyDependents {
  rentCharges: number;
  deposits: number;
  commissions: number;
  payments: number;
}

/** What a tenancy would take with it, used to warn before a cascade delete. */
export async function getTenancyDependents(
  agencyId: string,
  tenancyId: string
): Promise<TenancyDependents> {
  const base = db.collection("agencies").doc(agencyId);
  const [charges, deposits, commissions, payments] = await Promise.all([
    base.collection("rent_charges").where("tenancyId", "==", tenancyId).get(),
    base.collection("deposits").where("tenancyId", "==", tenancyId).get(),
    base.collection("commissions").where("tenancyId", "==", tenancyId).get(),
    base.collection("payments").where("tenancyId", "==", tenancyId).get(),
  ]);
  return {
    rentCharges: charges.size,
    deposits: deposits.size,
    commissions: commissions.size,
    payments: payments.size,
  };
}

/**
 * Delete a tenancy together with everything hanging off it, so no rent charge,
 * deposit or commission is left pointing at a tenancy that no longer exists.
 * Payment receipts are kept (they are money received) but are unlinked.
 */
export async function deleteTenancyCascade(
  agencyId: string,
  tenancyId: string
): Promise<TenancyDependents> {
  const dependents = await getTenancyDependents(agencyId, tenancyId);
  const base = db.collection("agencies").doc(agencyId);

  const [charges, deposits, commissions, payments] = await Promise.all([
    base.collection("rent_charges").where("tenancyId", "==", tenancyId).get(),
    base.collection("deposits").where("tenancyId", "==", tenancyId).get(),
    base.collection("commissions").where("tenancyId", "==", tenancyId).get(),
    base.collection("payments").where("tenancyId", "==", tenancyId).get(),
  ]);

  // Allocations reference charge ids, so they must go as the charges go.
  for (const chargeDoc of charges.docs) {
    const allocations = await getRentChargeAllocations(agencyId, chargeDoc.id);
    await Promise.all(
      allocations.map((allocation) => base.collection("payment_allocations").doc(allocation.id).delete())
    );
  }

  await Promise.all([
    ...charges.docs.map((doc) => doc.ref.delete()),
    ...deposits.docs.map((doc) => doc.ref.delete()),
    ...commissions.docs.map((doc) => doc.ref.delete()),
    ...payments.docs.map((doc) =>
      doc.ref.update({ tenancyId: firebase.firestore.FieldValue.delete() })
    ),
  ]);

  await base.collection("tenancies").doc(tenancyId).delete();
  return dependents;
}

// Record a payment receipt
export async function recordPayment({
  agencyId,
  tenantId,
  reference,
  amount,
  method,
  transactionRef,
  notes,
}: {
  agencyId: string;
  tenantId: string;
  reference: string;
  amount: number;
  method: PaymentMethod;
  transactionRef?: string;
  notes?: string;
}): Promise<string> {
  const receiptRef = db.collection("agencies").doc(agencyId).collection("payments").doc();

  await receiptRef.set(
    stripUndefined({
      agencyId,
      tenantId,
      reference,
      amount,
      paymentDate: firebase.firestore.FieldValue.serverTimestamp(),
      method,
      transactionRef,
      status: "pending" as PaymentStatus,
      notes,
      recordedBy: "", // Would be set from auth context
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    })
  );

  // Also create a ledger entry for double-entry accounting
  try {
    await db.collection("agencies").doc(agencyId).collection("ledger").add({
      id: crypto.randomUUID(),
      type: "payment" as LedgerEntryType,
      agencyId,
      tenantId,
      amount,
      reference,
      date: new Date(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    // Ledger entry failure should not block the payment receipt
    console.error("Failed to create ledger entry:", err);
  }

  return receiptRef.id;
}

// Payment status type
export type PaymentStatus = "pending" | "verified" | "reversed" | "failed";

// ---- Accounting Journal Types ----

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

// Journal entry posting status
export type JournalStatus = "posted" | "pending" | "reversed";

// Journal entry for double-entry accounting
export interface JournalEntry {
  id: string;
  debitAccount: string;
  creditAccount: string;
  amount: Money;
  description: string;
  reference?: string;
  entityType: "rent_charge" | "payment" | "expense" | "deposit" | "commission";
  entityId: string;
  agencyId: string;
  status: JournalStatus;
  postedAt: Date;
  postedBy?: string;
  createdAt: Date;
  reversedAt?: Date;
  reversalOf?: string; // ID of the original entry being reversed
}

// Post a new journal entry (debits must equal credits)
export async function postJournalEntry({
  agencyId,
  debitAccount,
  creditAccount,
  amount,
  description,
  reference,
  entityType,
  entityId,
  postedBy,
}: {
  agencyId: string;
  debitAccount: string;
  creditAccount: string;
  amount: Money;
  description: string;
  reference?: string;
  entityType: LedgerEntryType;
  entityId: string;
  postedBy: string;
}): Promise<string> {
  // Validate that debit and credit accounts are different
  if (debitAccount === creditAccount) {
    throw new Error("Debit and credit accounts must be different");
  }

  // Validate amount is positive
  if (amount <= 0) {
    throw new Error("Journal entry amount must be positive");
  }

  const journalRef = db.collection("agencies").doc(agencyId).collection("journal_entries").doc();

  await journalRef.set(
    stripUndefined({
      debitAccount,
      creditAccount,
      amount,
      description,
      reference,
      entityType,
      entityId,
      status: "posted" as JournalStatus,
      postedAt: new Date(),
      postedBy,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    })
  );

  return journalRef.id;
}

// Reverse a journal entry (creates offsetting entry, does not mutate original)
export async function reverseJournalEntry(
  agencyId: string,
  originalEntryId: string,
  reversalDescription: string
): Promise<{
  success: boolean;
  originalEntry: JournalEntry;
  reversalEntryId: string;
  error?: string;
}> {
  const journalRef = db.collection("agencies").doc(agencyId).collection("journal_entries").doc(originalEntryId);
  const originalSnap = await journalRef.get();

  if (!originalSnap.exists) {
    return { success: false, originalEntry: {} as JournalEntry, reversalEntryId: "", error: "Original journal entry not found" };
  }

  const originalEntry = originalSnap.data() as JournalEntry;

  // Cannot reverse a reversed entry
  if (originalEntry.reversalOf) {
    return { success: false, originalEntry, reversalEntryId: "", error: "This entry has already been reversed" };
  }

  // Create the reversal entry (offsetting entry)
  const reversalRef = db.collection("agencies").doc(agencyId).collection("journal_entries").doc();

  await reversalRef.set(
    stripUndefined({
      debitAccount: originalEntry.creditAccount,
      creditAccount: originalEntry.debitAccount,
      amount: originalEntry.amount,
      description: reversalDescription,
      reference: originalEntry.reference,
      entityType: originalEntry.entityType,
      entityId: originalEntry.entityId,
      agencyId: originalEntry.agencyId,
      status: "posted" as JournalStatus,
      postedAt: new Date(),
      postedBy: "", // System reversal
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      reversalOf: originalEntry.id,
    })
  );

  // Mark the original entry as reversed
  await journalRef.update({
    reversedAt: new Date(),
    status: "reversed" as JournalStatus,
  });

  return {
    success: true,
    originalEntry,
    reversalEntryId: reversalRef.id,
    error: undefined,
  };
}

// Converts a Firestore Timestamp (or Date) into a Date
function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  const maybe = value as { toDate?: () => Date } | null | undefined;
  return maybe && typeof maybe.toDate === "function" ? maybe.toDate() : new Date();
}

// Get journal entries for an agency with optional filtering
export async function getJournalEntries(agencyId: string, options?: {
  type?: LedgerEntryType;
  startDate?: Date;
  endDate?: Date;
}): Promise<JournalEntry[]> {
  let q: firebase.firestore.Query = db.collection("agencies").doc(agencyId).collection("journal_entries");

  if (options?.type) {
    q = q.where("entityType", "==", options.type);
  }

  if (options?.startDate) {
    q = q.where("createdAt", ">=", firebase.firestore.Timestamp.fromDate(options.startDate));
  }

  if (options?.endDate) {
    q = q.where("createdAt", "<=", firebase.firestore.Timestamp.fromDate(options.endDate));
  }

  const snap = await q.get();
  return snap.docs
    .sort((a, b) => b.data().createdAt?.toDate()?.getTime() ?? 0 - a.data().createdAt?.toDate()?.getTime() ?? 0)
    .map((doc) => {
      const data = doc.data() as JournalEntry;
      return {
        id: doc.id,
        debitAccount: data.debitAccount,
        creditAccount: data.creditAccount,
        amount: data.amount,
        description: data.description,
        reference: data.reference,
        entityType: data.entityType,
        entityId: data.entityId,
        agencyId: data.agencyId,
        status: data.status,
        postedAt: toDate(data.postedAt),
        postedBy: data.postedBy,
        createdAt: toDate(data.createdAt),
        reversedAt: data.reversalOf ? new Date() : undefined,
        reversalOf: data.reversalOf,
      };
    });
}