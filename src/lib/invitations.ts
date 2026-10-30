import "firebase/compat/firestore";
import firebase from "firebase/compat/app";
import { db } from "./firebase";

export type InvitationStatus = "pending" | "revoked" | "accepted";

export interface Invitation {
  id: string;
  agencyId: string;
  email: string;
  role: string;
  status: InvitationStatus;
  token: string;
  invitedBy: string;
  invitedByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export function invitationCollection(agencyId: string) {
  return db.collection("agencies").doc(agencyId).collection("invitations");
}

function toDate(value: unknown): Date {
  const maybe = value as { toDate?: () => Date } | undefined;
  if (maybe && typeof maybe.toDate === "function") return maybe.toDate();
  return new Date();
}

export async function createInvitation(
  agencyId: string,
  input: { email: string; role: string; invitedBy: string; invitedByName?: string }
): Promise<string> {
  const id = crypto.randomUUID();
  await invitationCollection(agencyId).doc(id).set({
    agencyId,
    email: input.email.trim().toLowerCase(),
    role: input.role,
    status: "pending",
    token: crypto.randomUUID(),
    invitedBy: input.invitedBy,
    invitedByName: input.invitedByName ?? "",
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  return id;
}

export async function getInvitations(agencyId: string): Promise<Invitation[]> {
  const snap = await invitationCollection(agencyId).get();
  return snap.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        agencyId: data.agencyId ?? agencyId,
        email: data.email ?? "",
        role: data.role ?? "",
        status: (data.status ?? "pending") as InvitationStatus,
        token: data.token ?? "",
        invitedBy: data.invitedBy ?? "",
        invitedByName: data.invitedByName ?? "",
        createdAt: toDate(data.createdAt),
        updatedAt: toDate(data.updatedAt),
      };
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function updateInvitationStatus(
  agencyId: string,
  invitationId: string,
  status: InvitationStatus
): Promise<void> {
  await invitationCollection(agencyId).doc(invitationId).update({
    status,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

export async function deleteInvitation(
  agencyId: string,
  invitationId: string
): Promise<void> {
  await invitationCollection(agencyId).doc(invitationId).delete();
}
