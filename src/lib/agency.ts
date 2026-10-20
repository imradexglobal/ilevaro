import { createAgencyDoc, createAgencyMembership } from "./firestore";
import { generateReference } from "./format";

export interface NewAgencyInput {
  agencyName: string;
  email: string;
  phone: string;
  state: string;
  lga?: string;
  address?: string;
  role?: string;
  currency?: string;
  timezone?: string;
  dateFormat?: string;
  financialYearStart?: string;
}

export interface AgencyCreator {
  uid: string;
  email?: string | null;
  displayName?: string | null;
}

/**
 * Creates a new agency for a user and links them as its owner.
 *
 * The write order is dictated by firestore.rules:
 *   1. agencies/{id}/meta/{id}  — create rule only checks data.ownerId == auth.uid
 *   2. agency_members/{uid}/profile/data — create rule only checks auth.uid == userId
 *   3. any other agencies/{id}/...       — requires step 2 to exist first
 */
export async function createAgencyForUser(
  user: AgencyCreator,
  input: NewAgencyInput
): Promise<string> {
  const agencyId = generateReference("AGY");
  const role = input.role ?? "agency_owner";

  await createAgencyDoc(agencyId, "meta", agencyId, {
    name: input.agencyName,
    email: input.email,
    phone: input.phone,
    address: input.address ?? "",
    state: input.state,
    lga: input.lga ?? "",
    country: "Nigeria",
    currency: input.currency ?? "NGN",
    timezone: input.timezone ?? "Africa/Lagos",
    dateFormat: input.dateFormat ?? "DD/MM/YYYY",
    financialYearStart: input.financialYearStart ?? "01-01",
    status: "trial",
    ownerId: user.uid,
  });

  await createAgencyMembership(user.uid, {
    agencyId,
    email: input.email,
    displayName: user.displayName ?? "",
    role,
    status: "active",
    phone: input.phone,
  });

  await createAgencyDoc(agencyId, "users", user.uid, {
    agencyId,
    email: input.email,
    displayName: user.displayName ?? "",
    role,
    status: "active",
    phone: input.phone,
  });

  return agencyId;
}
