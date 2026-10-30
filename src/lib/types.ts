import firebase from "firebase/compat/app";
import "firebase/compat/firestore";

type Timestamp = firebase.firestore.Timestamp;

export type AgencyStatus = "active" | "suspended" | "closed" | "trial";

export interface Agency {
  id: string;
  name: string;
  logo?: string;
  email: string;
  phone: string;
  address: string;
  state?: string;
  lga?: string;
  country: string;
  currency: string;
  timezone: string;
  dateFormat: string;
  financialYearStart: string;
  status: AgencyStatus;
  planId?: string;
  trialEndsAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type UserRole =
  | "platform_admin"
  | "agency_owner"
  | "agency_admin"
  | "property_manager"
  | "accountant"
  | "field_agent"
  | "auditor"
  | "landlord"
  | "tenant";

export type UserStatus = "active" | "invited" | "deactivated" | "suspended";

export interface UserProfile {
  id: string;
  agencyId: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  phone?: string;
  assignedPropertyIds?: string[];
  branchIds?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type PropertyType =
  | "residential_house"
  | "apartment_flat"
  | "commercial_building"
  | "office_shop"
  | "warehouse"
  | "industrial"
  | "short_let"
  | "vacant"
  | "mixed_use"
  | "land";

export type OccupancyStatus = "occupied" | "vacant" | "partially_occupied" | "under_maintenance" | "inactive";

export interface Property {
  id: string;
  agencyId: string;
  reference: string;
  name: string;
  type: PropertyType;
  /**
   * The lettable type of the property/units (e.g. "2 Bedroom Flat", "Duplex").
   * Configurable per agency in Settings and shown as a dropdown on creation.
   * Separate from `type`, which describes the structural category.
   */
  unitType?: string;
  address: string;
  state: string;
  lga?: string;
  latitude?: number;
  longitude?: number;
  landSize?: number;
  landUnit?: string;
  landFields?: {
    plotIdentifier?: string;
    surveyNumber?: string;
    titleDocumentRef?: string;
    boundaryDescription?: string;
    ownershipInterest?: string;
  };
  buildingSize?: number;
  buildingUnit?: string;
  unitCount: number;
  ownerIds: string[];
  occupancyStatus: OccupancyStatus;
  askingRent?: number;
  description?: string;
  status: "active" | "archived" | "deleted";
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface Unit {
  id: string;
  agencyId: string;
  propertyId: string;
  buildingId?: string;
  label: string;
  type: string;
  floor?: number;
  annualRent: number;
  depositAmount?: number;
  status: "available" | "occupied" | "reserved" | "under_maintenance" | "inactive";
  description?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type TenancyStatus = "proposed" | "active" | "expired" | "terminated" | "renewed";

export interface Tenancy {
  id: string;
  agencyId: string;
  propertyId: string;
  unitId: string;
  /** Human-readable label of the leased unit, kept so lists can render it. */
  unitLabel?: string;
  tenantId: string;
  landlordId?: string;
  status: TenancyStatus;
  startDate: Timestamp;
  endDate: Timestamp;
  rentAmount: number;
  rentFrequency: "monthly" | "quarterly" | "half_yearly" | "annual" | "custom";
  billingFrequency: "monthly" | "quarterly" | "half_yearly" | "annual" | "custom";
  rentCommencementDate: Timestamp;
  dueDay: number;
  gracePeriodDays: number;
  securityDeposit: number;
  agencyFee: number;
  otherCharges: number;
  escalationRate?: number;
  escalationIntervalMonths?: number;
  parentTenancyId?: string;
  /** Why the tenant left. Recorded when a tenancy is terminated or expires. */
  exitReason?: string;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

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

export type PaymentMethod = "bank_transfer" | "cash" | "cheque" | "card" | "ussd" | "other";
export type PaymentStatus = "pending" | "verified" | "reversed" | "failed";

export interface Payment {
  id: string;
  agencyId: string;
  tenancyId?: string;
  tenantId?: string;
  reference: string;
  receiptNumber?: string;
  amount: number;
  paymentDate: Timestamp;
  method: PaymentMethod;
  transactionRef?: string;
  receivingAccount?: string;
  status: PaymentStatus;
  verifiedBy?: string;
  verifiedAt?: Timestamp;
  notes?: string;
  recordedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PaymentAllocation {
  id: string;
  agencyId: string;
  paymentId: string;
  rentChargeId: string;
  amount: number;
  createdAt: Timestamp;
}

/**
 * A movement on a tenant's credit balance. When a payment is larger than the
 * tenant's outstanding charges the excess becomes credit ("overpayment"); the
 * credit is later drawn down automatically against new rent charges
 * ("applied"). A negative `amount` reduces the balance.
 */
export type TenantCreditType = "overpayment" | "applied" | "adjustment";

export interface TenantCredit {
  id: string;
  agencyId: string;
  tenantId: string;
  /** Positive adds credit, negative consumes it. */
  amount: number;
  type: TenantCreditType;
  paymentId?: string;
  rentChargeId?: string;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Owner {
  id: string;
  agencyId: string;
  fullName: string;
  businessName?: string;
  email?: string;
  phone: string;
  address?: string;
  idType?: string;
  idNumber?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  status: "active" | "archived";
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Guarantor {
  id: string;
  agencyId: string;
  fullName: string;
  phone: string;
  address?: string;
  idType?: string;
  idNumber?: string;
  relationshipToTenant: string;
  status: "active" | "inactive";
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Tenant {
  id: string;
  agencyId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  idType?: string;
  idNumber?: string;
  status: "prospect" | "active" | "former" | "blacklisted";
  /** Unallocated money held on the tenant's account, e.g. from an overpayment. */
  creditBalance?: number;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ActivityEvent {
  id: string;
  agencyId: string;
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  timestamp: Timestamp;
}

export interface Expense {
  id: string;
  agencyId: string;
  propertyId: string;
  ownerId?: string;
  category: "repairs" | "plumbing" | "electrical" | "cleaning" | "security" | "waste" | "service_charge" | "inspection" | "other";
  amount: number;
  expenseDate: Timestamp;
  vendorId?: string;
  paymentMethod: "bank_transfer" | "cash" | "cheque" | "card" | "ussd" | "other";
  fundedBy: "owner" | "agency" | "tenant";
  approvalStatus: "pending" | "approved" | "rejected";
  approvedBy?: string;
  receiptDocId?: string;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Deposit {
  id: string;
  agencyId: string;
  tenancyId: string;
  tenantId: string;
  amountReceived: number;
  receivedDate: Timestamp;
  amountHeld: number;
  deductions: { amount: number; reason: string; approvedBy: string; date: Timestamp }[];
  amountRefunded: number;
  status: "held" | "partially_refunded" | "refunded";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Commission {
  id: string;
  agencyId: string;
  tenancyId?: string;
  type: "management_fee" | "letting_commission" | "renewal_fee" | "other";
  basis: "percentage" | "fixed";
  rate?: number;
  fixedAmount?: number;
  calculatedAmount: number;
  period: string;
  status: "calculated" | "approved" | "paid";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Remittance {
  id: string;
  agencyId: string;
  ownerId: string;
  amount: number;
  paymentDate: Timestamp;
  method: "bank_transfer" | "check" | "other";
  reference: string;
  period: string;
  notes?: string;
  recordedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
