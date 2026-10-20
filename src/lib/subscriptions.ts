import "firebase/compat/firestore";
import { db } from "./firebase";

export type SubscriptionStatus = "trial" | "active" | "past_due" | "suspended" | "cancelled";

export type PlanTier = "starter" | "professional" | "enterprise";

export interface SubscriptionPlan {
  tier: PlanTier;
  name: string;
  maxProperties: number;
  maxUnits: number;
  maxStaff: number;
  priceMonthly: number;
  priceYearly: number;
}

export const PLAN_TIERS: Record<PlanTier, SubscriptionPlan> = {
  starter: {
    tier: "starter",
    name: "Starter",
    maxProperties: 5,
    maxUnits: 20,
    maxStaff: 3,
    priceMonthly: 500000,
    priceYearly: 5000000,
  },
  professional: {
    tier: "professional",
    name: "Professional",
    maxProperties: 25,
    maxUnits: 100,
    maxStaff: 10,
    priceMonthly: 1500000,
    priceYearly: 15000000,
  },
  enterprise: {
    tier: "enterprise",
    name: "Enterprise",
    maxProperties: 1000,
    maxUnits: 10000,
    maxStaff: 100,
    priceMonthly: 5000000,
    priceYearly: 50000000,
  },
};

export interface AgencySubscription {
  id: string;
  agencyId: string;
  tier: PlanTier;
  status: SubscriptionStatus;
  trialEndsAt?: Date;
  currentPeriodEnd?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export async function createSubscription(
  agencyId: string,
  tier: PlanTier
): Promise<string> {
  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 14);

  const docRef = await db
    .collection("platform_subscriptions")
    .add({
    agencyId,
    tier,
    status: "trial",
    trialEndsAt: trialEnd,
    currentPeriodEnd: trialEnd,
    createdAt: now,
    updatedAt: now,
  });
  return docRef.id;
}

export async function getSubscriptions(): Promise<AgencySubscription[]> {
  const snap = await db.collection("platform_subscriptions").get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      agencyId: data.agencyId,
      tier: data.tier,
      status: data.status,
      trialEndsAt: data.trialEndsAt?.toDate?.(),
      currentPeriodEnd: data.currentPeriodEnd?.toDate?.(),
      createdAt: data.createdAt?.toDate?.() || new Date(),
      updatedAt: data.updatedAt?.toDate?.() || new Date(),
    } as AgencySubscription;
  });
}

export async function getSubscriptionByAgency(
  agencyId: string
): Promise<AgencySubscription | null> {
  const snap = await db
    .collection("platform_subscriptions")
    .where("agencyId", "==", agencyId)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data();
  return {
    id: d.id,
    agencyId: data.agencyId,
    tier: data.tier,
    status: data.status,
    trialEndsAt: data.trialEndsAt?.toDate?.(),
    currentPeriodEnd: data.currentPeriodEnd?.toDate?.(),
    createdAt: data.createdAt?.toDate?.() || new Date(),
    updatedAt: data.updatedAt?.toDate?.() || new Date(),
  } as AgencySubscription;
}

export async function updateSubscriptionStatus(
  subscriptionId: string,
  status: SubscriptionStatus
): Promise<void> {
  await db
    .collection("platform_subscriptions")
    .doc(subscriptionId)
    .update({ status, updatedAt: new Date() });
}

export async function upgradePlan(
  subscriptionId: string,
  newTier: PlanTier
): Promise<void> {
  await db
    .collection("platform_subscriptions")
    .doc(subscriptionId)
    .update({ tier: newTier, updatedAt: new Date() });
}

export function isWithinLimits(
  plan: SubscriptionPlan,
  currentProperties: number,
  currentUnits: number,
  currentStaff: number
): { allowed: boolean; reason?: string } {
  if (currentProperties >= plan.maxProperties) {
    return { allowed: false, reason: `Property limit reached (${plan.maxProperties})` };
  }
  if (currentUnits >= plan.maxUnits) {
    return { allowed: false, reason: `Unit limit reached (${plan.maxUnits})` };
  }
  if (currentStaff >= plan.maxStaff) {
    return { allowed: false, reason: `Staff limit reached (${plan.maxStaff})` };
  }
  return { allowed: true };
}

export function isTrialActive(sub: AgencySubscription): boolean {
  if (sub.status !== "trial") return false;
  if (!sub.trialEndsAt) return false;
  return new Date() < sub.trialEndsAt;
}

export function isSubscriptionActive(sub: AgencySubscription): boolean {
  if (sub.status === "active") return true;
  if (isTrialActive(sub)) return true;
  return false;
}