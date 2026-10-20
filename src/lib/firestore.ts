import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import { db } from "./firebase";

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
    ...data,
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
    ...data,
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
    ...data,
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
    ...data,
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
    ...data,
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
    ...data,
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
    ...data,
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
    ...data,
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
    ...data,
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
    ...data,
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
    ...data,
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
    ...data,
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
    ...data,
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
    ...data,
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
    ...data,
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
    ...data,
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
    ...data,
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