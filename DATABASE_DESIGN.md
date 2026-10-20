# DATABASE_DESIGN.md — ILEVARO (Firestore)

NoSQL document store. All agency-scoped data lives under `agencies/{agencyId}/{collection}/{docId}`.

---

## Money Representation

All monetary values are stored as **numbers representing naira with up to 2 decimal places**
(e.g. `1250000.50`). Firestore's `number` type is IEEE-754 double — safe for values under 2^53,
which comfortably covers naira amounts. **Arithmetic must be centralised in TypeScript services**
with rounding at defined boundaries, never scattered across components.

For accounting (Phase 10), journal amounts will additionally be stored as **integer kobo**
(`amountKobo`) to guarantee exact balance checks.

---

## Top-Level Collections

### `agencies/{agencyId}`

| Path | Purpose |
|---|---|
| `agencies/{agencyId}/meta/{agencyId}` | Agency profile and settings document |

**Agency meta document:**
```json
{
  "name": "Acme Properties",
  "ownerId": "firebaseAuthUid",
  "email": "info@acme.ng",
  "phone": "08012345678",
  "address": "12 Marina Rd, Lagos",
  "state": "Lagos",
  "lga": "Ikeja",
  "country": "Nigeria",
  "currency": "NGN",
  "timezone": "Africa/Lagos",
  "dateFormat": "DD/MM/YYYY",
  "financialYearStart": "01-01",
  "status": "trial | active | suspended | closed",
  "planId": "free",
  "trialEndsAt": "<Timestamp>",
  "createdAt": "<Timestamp>",
  "updatedAt": "<Timestamp>"
}
```

### `agency_members/{userId}/profile/{userId}`

Top-level for O(1) security-rule lookup.

```json
{
  "agencyId": "AGY-XXXX",
  "email": "user@agency.ng",
  "displayName": "Jane Doe",
  "role": "agency_owner | agency_admin | property_manager | accountant | field_agent | auditor | landlord | tenant | platform_admin",
  "status": "active | invited | deactivated | suspended",
  "phone": "08012345678",
  "assignedPropertyIds": ["..."],
  "branchIds": ["..."],
  "createdAt": "<Timestamp>",
  "updatedAt": "<Timestamp>"
}
```

---

## Agency Sub-Collections

All documents below include `agencyId` (redundant but enables rules to verify path ↔ data match)
and `createdAt` / `updatedAt` timestamps.

### `properties/`
```json
{
  "reference": "PRP-XXXX",
  "name": "Marina Court",
  "type": "apartment_flat | residential_house | commercial_building | office_shop | warehouse | industrial | short_let | vacant | mixed_use | land",
  "address": "12 Marina Rd",
  "state": "Lagos",
  "lga": "Lagos Mainland",
  "latitude": 6.4541,
  "longitude": 3.3947,
  "landSize": 500,
  "landUnit": "sqm",
  "buildingSize": 1200,
  "buildingUnit": "sqm",
  "unitCount": 12,
  "ownerIds": ["owner1", "owner2"],
  "occupancyStatus": "occupied | vacant | partially_occupied | under_maintenance | inactive",
  "askingRent": 2500000,
  "description": "...",
  "status": "active | archived | deleted",
  "createdBy": "uid"
}
```

**Land-specific optional fields:** `plotIdentifier`, `surveyNumber`, `titleDocumentRef`, `boundaryDescription`, `ownershipInterest`.

### `buildings/`
```json
{
  "propertyId": "…",
  "name": "Block A",
  "floors": 4,
  "unitCount": 16,
  "description": "…"
}
```

### `units/`
```json
{
  "propertyId": "…",
  "buildingId": "…",
  "label": "A3",
  "type": "flat | shop | office | room",
  "floor": 3,
  "annualRent": 1200000,
  "depositAmount": 200000,
  "status": "available | occupied | reserved | under_maintenance | inactive",
  "description": "…"
}
```

### `owners/` (landlords)
```json
{
  "fullName": "Chief Okafor",
  "businessName": "Okafor Ventures Ltd",
  "email": "ok@example.com",
  "phone": "08012345678",
  "address": "…",
  "idType": "NIN | international_passport | drivers_license | voters_card",
  "idNumber": "…",
  "bankName": "GTBank",
  "bankAccountNumber": "0123456789",
  "bankAccountName": "C Okafor",
  "status": "active | archived",
  "notes": "…"
}
```
> Bank fields restricted to `accountant`, `agency_owner`, `agency_admin` roles via Firestore Rules.

### `tenants/`
```json
{
  "firstName": "Chidi",
  "lastName": "Okafor",
  "email": "chidi@example.com",
  "phone": "08098765432",
  "address": "…",
  "emergencyContactName": "…",
  "emergencyContactPhone": "…",
  "idType": "…",
  "idNumber": "…",
  "status": "prospect | active | former | blacklisted",
  "notes": "…"
}
```

### `tenancies/`
```json
{
  "propertyId": "…",
  "unitId": "…",
  "tenantId": "…",
  "landlordId": "…",
  "status": "proposed | active | expired | terminated | renewed",
  "startDate": "<Timestamp>",
  "endDate": "<Timestamp>",
  "rentAmount": 1200000,
  "rentFrequency": "monthly | quarterly | half_yearly | annual | custom",
  "billingFrequency": "monthly | quarterly | half_yearly | annual | custom",
  "rentCommencementDate": "<Timestamp>",
  "dueDay": 1,
  "gracePeriodDays": 7,
  "securityDeposit": 200000,
  "agencyFee": 120000,
  "otherCharges": 0,
  "escalationRate": 10,
  "escalationIntervalMonths": 12,
  "parentTenancyId": "…",      // set on renewal; original preserved
  "notes": "…"
}
```

### `rent_charges/`
```json
{
  "tenancyId": "…",
  "reference": "RC-XXXX",
  "periodStart": "<Timestamp>",
  "periodEnd": "<Timestamp>",
  "dueDate": "<Timestamp>",
  "amountDue": 1200000,
  "amountPaid": 500000,
  "outstanding": 700000,
  "status": "upcoming | due | partially_paid | paid | overdue | waived | cancelled",
  "waivedAmount": 0,
  "waiverReason": "…"
}
```

**Status rules (mutually exclusive):**
1. `cancelled` — charge voided before due date (manual)
2. `waived` — outstanding reduced to zero by approved waiver
3. `paid` — `outstanding <= 0`
4. `partially_paid` — `amountPaid > 0 && outstanding > 0 && not yet overdue`
5. `overdue` — `outstanding > 0 && now > dueDate + gracePeriod`
6. `due` — `outstanding > 0 && now >= dueDate && now <= dueDate + gracePeriod`
7. `upcoming` — `outstanding > 0 && now < dueDate`

**Derived, not stored inconsistently:** `outstanding = amountDue − amountPaid − waivedAmount`.
Stored for query performance but always recalculated on write.

### `payments/`
```json
{
  "tenancyId": "…",           // optional — advance/unallocated payment may omit
  "tenantId": "…",
  "reference": "PAY-XXXX",
  "receiptNumber": "RCP-0001",
  "amount": 500000,
  "paymentDate": "<Timestamp>",
  "method": "bank_transfer | cash | cheque | card | ussd | other",
  "transactionRef": "TRF-12345",
  "receivingAccount": "GTBank - 0123456789",
  "status": "pending | verified | reversed | failed",
  "verifiedBy": "uid",
  "verifiedAt": "<Timestamp>",
  "notes": "…",
  "recordedBy": "uid"
}
```

### `payment_allocations/`
```json
{
  "paymentId": "…",
  "rentChargeId": "…",
  "amount": 500000
}
```
**Unique compound key** (client-side guard): `paymentId + rentChargeId` — prevents double allocation.

### `deposits/`
```json
{
  "tenancyId": "…",
  "tenantId": "…",
  "amountReceived": 200000,
  "receivedDate": "<Timestamp>",
  "amountHeld": 200000,
  "deductions": [ { "amount": 5000, "reason": "…", "approvedBy": "uid", "date": "<Timestamp>" } ],
  "amountRefunded": 0,
  "status": "held | partially_refunded | refunded"
}
```

### `expenses/`
```json
{
  "propertyId": "…",
  "ownerId": "…",
  "category": "repairs | plumbing | electrical | cleaning | security | waste | service_charge | insurance | inspection | other",
  "amount": 45000,
  "expenseDate": "<Timestamp>",
  "vendorId": "…",
  "paymentMethod": "…",
  "fundedBy": "owner | agency | tenant",
  "approvalStatus": "pending | approved | rejected",
  "approvedBy": "uid",
  "receiptDocId": "…",
  "notes": "…"
}
```

### `vendors/`
```json
{
  "name": "…",
  "contactPerson": "…",
  "phone": "…",
  "email": "…",
  "serviceCategories": ["plumbing"],
  "status": "active | archived"
}
```

### `maintenance_requests/`
```json
{
  "propertyId": "…",
  "unitId": "…",
  "tenantId": "…",
  "title": "…",
  "description": "…",
  "priority": "low | medium | high | urgent",
  "status": "open | assigned | in_progress | completed | cancelled",
  "assignedTo": "uid",
  "dueDate": "<Timestamp>",
  "completedAt": "<Timestamp>",
  "cost": 0,
  "expenseId": "…"
}
```

### `commissions/`
```json
{
  "tenancyId": "…",
  "type": "management_fee | letting_commission | renewal_fee | other",
  "basis": "percentage | fixed",
  "rate": 10,
  "fixedAmount": 0,
  "calculatedAmount": 120000,
  "period": "…",
  "status": "calculated | approved | paid"
}
```

### `remittances/`
```json
{
  "ownerId": "…",
  "amount": 1500000,
  "paymentDate": "<Timestamp>",
  "method": "bank_transfer",
  "reference": "REM-XXXX",
  "period": "2026-09",
  "notes": "…",
  "recordedBy": "uid"
}
```

### `documents/`
```json
{
  "entityType": "property | tenancy | tenant | owner | payment | expense | agency",
  "entityId": "…",
  "fileName": "lease-agreement.pdf",
  "fileType": "application/pdf",
  "fileSize": 102400,
  "category": "lease | title | survey | receipt | invoice | identification | inspection | other",
  "storagePath": "…",        // resolved in Phase 13
  "uploadedBy": "uid",
  "version": 1
}
```

### `notifications/`
```json
{
  "userId": "…",
  "type": "rent_due | rent_overdue | payment_received | lease_expiring | maintenance_update | …",
  "title": "…",
  "body": "…",
  "read": false,
  "entityType": "rent_charge | tenancy | …",
  "entityId": "…",
  "scheduledFor": "<Timestamp>",
  "sentAt": "<Timestamp>",
  "dedupeKey": "rent_due:chargeId:userId"   // prevents duplicates
}
```

### `activity_events/`
```json
{
  "actorId": "uid",
  "actorName": "Jane Doe",
  "action": "property.created | payment.verified | tenancy.renewed | …",
  "entityType": "property",
  "entityId": "…",
  "before": { },
  "after": { },
  "timestamp": "<Timestamp>"
}
```

---

## Composite Indexes (drafted in `firestore.indexes.json`)

| Collection | Fields |
|---|---|
| properties | agencyId + status + createdAt DESC |
| rent_charges | agencyId + tenancyId + dueDate |
| rent_charges | agencyId + status + dueDate |
| payments | agencyId + paymentDate DESC |
| tenancies | agencyId + status + endDate |

---

## Integrity Rules Summary

1. Every agency-scoped document stores `agencyId` — rules verify it matches the requesting user
2. Monetary values: no floats in logic; round at boundaries; integer kobo for journals (Phase 10)
3. `outstanding` always recomputed on write, never incremented blindly
4. Payment allocations guarded by unique `paymentId+rentChargeId` compound key
5. Lease renewals create new tenancy docs — originals never mutated for historical financial data
6. Soft delete via `status: "archived" | "deleted"` — never hard-delete financial records
7. All mutations write `updatedAt`; creates write `createdAt`
