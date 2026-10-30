import "firebase/compat/firestore";
import { db } from "./firebase";

export interface PlatformSettings {
  defaultTrialDays: number;
  maxAgencies: number;
  updatedAt?: Date;
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  defaultTrialDays: 14,
  maxAgencies: 1000,
};

const SETTINGS_DOC = () => db.collection("platform_settings").doc("global");

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const snap = await SETTINGS_DOC().get();
  if (!snap.exists) return { ...DEFAULT_PLATFORM_SETTINGS };
  const data = snap.data() ?? {};
  return {
    defaultTrialDays:
      typeof data.defaultTrialDays === "number"
        ? data.defaultTrialDays
        : DEFAULT_PLATFORM_SETTINGS.defaultTrialDays,
    maxAgencies:
      typeof data.maxAgencies === "number"
        ? data.maxAgencies
        : DEFAULT_PLATFORM_SETTINGS.maxAgencies,
    updatedAt: data.updatedAt?.toDate?.(),
  };
}

export async function savePlatformSettings(
  settings: Pick<PlatformSettings, "defaultTrialDays" | "maxAgencies">
): Promise<void> {
  await SETTINGS_DOC().set(
    {
      defaultTrialDays: settings.defaultTrialDays,
      maxAgencies: settings.maxAgencies,
      updatedAt: new Date(),
    },
    { merge: true }
  );
}
