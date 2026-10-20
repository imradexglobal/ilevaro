import "firebase/compat/firestore";
import { db } from "./firebase";

export type NotificationType =
  | "rent_due"
  | "payment_received"
  | "deposit_expiring"
  | "commission_earned"
  | "remittance_sent"
  | "system_alert";

export type NotificationSeverity = "info" | "warning" | "urgent";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  severity: NotificationSeverity;
  agencyId: string;
  propertyId?: string;
  tenantId?: string;
  actionUrl?: string;
  read: boolean;
  createdAt: Date;
}

export async function createNotification(
  agencyId: string,
  notification: Omit<Notification, "id" | "read" | "createdAt">
): Promise<string> {
  const now = new Date();
  const docRef = await db
    .collection("agencies")
    .doc(agencyId)
    .collection("notifications")
    .add({
      ...notification,
      agencyId,
      severity: notification.severity,
      read: false,
      createdAt: now,
    });
  return docRef.id;
}

export function subscribeToNotifications(
  agencyId: string,
  onNotification: (notification: Notification) => void,
  onError?: (error: Error) => void
): () => void {
  return db
    .collection("agencies")
    .doc(agencyId)
    .collection("notifications")
    .where("read", "==", false)
    .onSnapshot(
      (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            const notification: Notification = {
              id: change.doc.id,
              type: data.type,
              title: data.title,
              message: data.message,
              severity: data.severity,
              agencyId: data.agencyId,
              propertyId: data.propertyId,
              tenantId: data.tenantId,
              actionUrl: data.actionUrl,
              read: data.read,
              createdAt: data.createdAt?.toDate?.() || new Date(),
            };
            onNotification(notification);
          }
        });
      },
      onError
    );
}

export async function markNotificationRead(
  agencyId: string,
  notificationId: string
): Promise<void> {
  await db
    .collection("agencies")
    .doc(agencyId)
    .collection("notifications")
    .doc(notificationId)
    .update({ read: true });
}

export async function markAllNotificationsRead(agencyId: string): Promise<void> {
  const snap = await db
    .collection("agencies")
    .doc(agencyId)
    .collection("notifications")
    .where("read", "==", false)
    .get();

  const batch = db.batch();
  snap.docs.forEach((doc) => {
    batch.update(doc.ref, { read: true });
  });
  await batch.commit();
}

export async function checkRentDue(agencyId: string): Promise<void> {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const rentSnap = await db
    .collection("agencies")
    .doc(agencyId)
    .collection("rent_charges")
    .get();

  for (const chargeDoc of rentSnap.docs) {
    const chargeData = chargeDoc.data();
    const dueDate = chargeData.dueDate?.toDate?.() || chargeData.dueDate;
    if (!dueDate) continue;

    const chargeMonth = new Date(dueDate).getMonth();
    const chargeYear = new Date(dueDate).getFullYear();

    if (chargeMonth !== currentMonth || chargeYear !== currentYear) continue;

    const paySnap = await db
      .collection("agencies")
      .doc(agencyId)
      .collection("payments")
      .get();

    const reference = chargeData.reference || chargeDoc.id;
    const alreadyPaid = paySnap.docs.some((p) => p.data().reference === reference);
    if (alreadyPaid) continue;

    const notifSnap = await db
      .collection("agencies")
      .doc(agencyId)
      .collection("notifications")
      .where("type", "==", "rent_due")
      .get();

    const alreadyExists = notifSnap.docs.some((d) => {
      const data = d.data();
      return data.propertyId === chargeDoc.id;
    });
    if (alreadyExists) continue;

    await createNotification(agencyId, {
      type: "rent_due",
      title: "Rent Due",
      message: `Rent is due for ${chargeData.propertyName || "property"}`,
      severity: "warning",
      agencyId,
    });
  }
}

export async function getUnreadCount(agencyId: string): Promise<number> {
  const snap = await db
    .collection("agencies")
    .doc(agencyId)
    .collection("notifications")
    .where("read", "==", false)
    .get();
  return snap.size;
}

export async function getAllNotifications(
  agencyId: string,
  maxCount = 50
): Promise<Notification[]> {
  const snap = await db
    .collection("agencies")
    .doc(agencyId)
    .collection("notifications")
    .orderBy("createdAt", "desc")
    .limit(maxCount)
    .get();

  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      type: data.type,
      title: data.title,
      message: data.message,
      severity: data.severity,
      agencyId: data.agencyId,
      propertyId: data.propertyId,
      tenantId: data.tenantId,
      actionUrl: data.actionUrl,
      read: data.read,
      createdAt: data.createdAt?.toDate?.() || new Date(),
    } as Notification;
  });
}