import { occupancyFromStatuses, type UnitRecord, type UnitStatus } from "./firestore";

/** Structural category of a property, as opposed to its lettable unit type. */
export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  residential_house: "Residential House",
  apartment_flat: "Apartment / Flat",
  commercial_building: "Commercial Building",
  office_shop: "Office / Shop",
  warehouse: "Warehouse",
  industrial: "Industrial",
  short_let: "Short Let",
  vacant: "Vacant",
  mixed_use: "Mixed Use",
  land: "Land",
};

export const OCCUPANCY_LABELS: Record<string, string> = {
  occupied: "Occupied",
  vacant: "Vacant",
  partially_occupied: "Partially Occupied",
  under_maintenance: "Under Maintenance",
  inactive: "Inactive",
};

export const OCCUPANCY_BADGE_VARIANT: Record<
  string,
  "success" | "warning" | "danger" | "info" | "default"
> = {
  occupied: "success",
  vacant: "info",
  partially_occupied: "warning",
  under_maintenance: "warning",
  inactive: "default",
};

export const UNIT_STATUS_LABELS: Record<string, string> = {
  available: "Available",
  occupied: "Occupied",
  reserved: "Reserved",
  under_maintenance: "Under Maintenance",
  inactive: "Inactive",
};

export const UNIT_STATUS_BADGE_VARIANT: Record<string, "success" | "warning" | "info" | "default"> =
  {
    available: "success",
    reserved: "info",
    occupied: "default",
    under_maintenance: "warning",
    inactive: "default",
  };

/** Loose property shape for list/detail views that don't need timestamps. */
export interface PropertyRecord {
  id: string;
  name: string;
  reference?: string;
  type?: string;
  unitType?: string;
  address?: string;
  state?: string;
  lga?: string;
  unitCount?: number;
  occupancyStatus?: string;
  askingRent?: number;
  ownerIds?: string[];
  status?: string;
}

export interface UnitDraft {
  key: string;
  /** Set when the unit already exists in Firestore (edit mode). */
  id?: string;
  label: string;
  type: string;
  annualRent: string;
  status: UnitStatus;
}

export interface PropertyFormValues {
  name: string;
  reference: string;
  type: string;
  unitType: string;
  address: string;
  state: string;
  lga: string;
  unitCount: string;
  occupancyStatus: string;
  askingRent: string;
  description: string;
  landlordId: string;
  units: UnitDraft[];
}

export const EMPTY_PROPERTY_FORM: PropertyFormValues = {
  name: "",
  reference: "",
  type: "residential_house",
  unitType: "",
  address: "",
  state: "",
  lga: "",
  unitCount: "1",
  occupancyStatus: "vacant",
  askingRent: "",
  description: "",
  landlordId: "",
  units: [],
};

/** Roll the individual unit statuses up into a property-level occupancy status. */
export function deriveOccupancy(units: UnitDraft[]): string {
  return occupancyFromStatuses(units.map((u) => u.status));
}

export function unitToDraft(unit: UnitRecord): UnitDraft {
  return {
    key: unit.id,
    id: unit.id,
    label: unit.label ?? "",
    type: unit.type ?? "",
    annualRent: unit.annualRent != null ? String(unit.annualRent) : "",
    status: (unit.status as UnitStatus) ?? "available",
  };
}
