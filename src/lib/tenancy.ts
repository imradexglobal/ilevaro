import type { TenancyStatus } from "./types";

export const FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "half_yearly", label: "Half-Yearly" },
  { value: "annual", label: "Annual" },
  { value: "custom", label: "Custom" },
];

export const TENANCY_STATUS_OPTIONS = [
  { value: "proposed", label: "Proposed" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "terminated", label: "Terminated" },
  { value: "renewed", label: "Renewed" },
];

export const TENANCY_STATUS_VARIANT: Record<
  string,
  "default" | "success" | "warning" | "danger" | "info"
> = {
  proposed: "info",
  active: "success",
  expired: "warning",
  terminated: "danger",
  renewed: "default",
};

export type DateLike = { toDate: () => Date } | Date | null | undefined;

export function toDate(value: DateLike): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  return null;
}

export function sortableTime(value: DateLike): number {
  return toDate(value)?.getTime() ?? 0;
}

export function toDateInput(value: DateLike): string {
  const d = toDate(value);
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export function durationLabel(start: DateLike, end: DateLike): string {
  const s = toDate(start);
  if (!s) return "-";
  const e = toDate(end) ?? new Date();
  const months = Math.max(
    0,
    Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
  );
  if (months < 1) return "< 1 month";
  if (months < 12) return `${months} month${months === 1 ? "" : "s"}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem ? `${years}y ${rem}m` : `${years}y`;
}

/** Loose tenancy shape used by the list/history views. */
export interface TenancyRecord {
  id: string;
  propertyId: string;
  unitId?: string;
  unitLabel?: string;
  tenantId: string;
  status: TenancyStatus;
  startDate?: DateLike;
  endDate?: DateLike;
  rentAmount?: number;
  rentFrequency?: string;
  billingFrequency?: string;
  dueDay?: number;
  gracePeriodDays?: number;
  securityDeposit?: number;
  agencyFee?: number;
  otherCharges?: number;
  exitReason?: string;
  notes?: string;
}

export interface TenancyForm {
  propertyId: string;
  unitId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  rentAmount: string;
  rentFrequency: string;
  billingFrequency: string;
  dueDay: string;
  gracePeriodDays: string;
  securityDeposit: string;
  agencyFee: string;
  otherCharges: string;
  status: TenancyStatus;
  exitReason: string;
  notes: string;
}

export const EMPTY_TENANCY_FORM: TenancyForm = {
  propertyId: "",
  unitId: "",
  tenantId: "",
  startDate: "",
  endDate: "",
  rentAmount: "",
  rentFrequency: "annual",
  billingFrequency: "annual",
  dueDay: "1",
  gracePeriodDays: "7",
  securityDeposit: "",
  agencyFee: "",
  otherCharges: "",
  status: "proposed",
  exitReason: "",
  notes: "",
};

/** Build the editable form state from a stored tenancy record. */
export function tenancyToForm(tenancy: TenancyRecord): TenancyForm {
  return {
    propertyId: tenancy.propertyId ?? "",
    unitId: tenancy.unitId ?? "",
    tenantId: tenancy.tenantId ?? "",
    startDate: toDateInput(tenancy.startDate),
    endDate: toDateInput(tenancy.endDate),
    rentAmount: tenancy.rentAmount != null ? String(tenancy.rentAmount) : "",
    rentFrequency: tenancy.rentFrequency ?? "annual",
    billingFrequency: tenancy.billingFrequency ?? "annual",
    dueDay: tenancy.dueDay != null ? String(tenancy.dueDay) : "1",
    gracePeriodDays: tenancy.gracePeriodDays != null ? String(tenancy.gracePeriodDays) : "7",
    securityDeposit: tenancy.securityDeposit != null ? String(tenancy.securityDeposit) : "",
    agencyFee: tenancy.agencyFee != null ? String(tenancy.agencyFee) : "",
    otherCharges: tenancy.otherCharges != null ? String(tenancy.otherCharges) : "",
    status: tenancy.status ?? "proposed",
    exitReason: tenancy.exitReason ?? "",
    notes: tenancy.notes ?? "",
  };
}
