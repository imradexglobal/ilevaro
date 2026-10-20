# SECURITY_MODEL.md — ILEVARO

---

## 1. Security Architecture

Without Cloud Functions, **Firestore Security Rules are the sole server-side enforcement layer.**
Every read and write from the client passes through them. There is no API middleware fallback.

```
Client Request
    │
    ▼
┌─────────────────────┐
│ Firebase Auth        │  ← identity: is this user authenticated?
│ (session token)      │
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ Firestore Rules      │  ← authorization: agency match? role sufficient?
│ (evaluation)         │     input validation: required fields present?
└─────────┬───────────┘     rate limiting: (limited, via abuse protection)
          ▼
┌─────────────────────┐
│ Firestore Database   │  ← data stored per-agency in sub-collections
└─────────────────────┘
```

---

## 2. Authentication

| Concern | Implementation |
|---|---|
| Provider | Firebase Authentication (email/password) |
| Session | Firebase SDK manages token refresh automatically |
| Password reset | Firebase `sendPasswordResetEmail` — emailed by Google |
| Sign-out | `signOut(auth)` clears local session |
| MFA | Deferred to Phase 3 (Firebase phone auth as optional 2nd factor) |
| Brute-force | Firebase built-in throttling + client-side error messaging |

**Rules:**
- Never store passwords anywhere in the app
- Never log auth tokens
- `.env` contains only public Firebase web config (API keys for Firebase web SDK are not secrets — they identify the project; security is in Rules + Auth)

---

## 3. Tenant Isolation (Multi-Agency)

### Structural isolation
```
agencies/{agencyId}/{collection}/{docId}
```
A user of Agency A has no reference to Agency B's `agencyId`. Even if they guess it,
security rules deny access because their `agency_members` profile has a different `agencyId`.

### Rule-level isolation (in `firestore.rules`)

```
allow read, write: if isSignedIn() &&
  get(/databases/$(database)/documents/agency_members/$(request.auth.uid)/profile/data)
    .data.agencyId == agencyId;   // agencyId comes from the URL path
```

Every sub-collection under `agencies/{agencyId}/…` uses this check.

### Verification plan (Phase 2 & 15)
- [ ] User A (Agency A) cannot `getDoc` Agency B's property by ID
- [ ] User A cannot `getDocs` from Agency B's collection path
- [ ] User A cannot `setDoc` / `updateDoc` / `deleteDoc` in Agency B's path
- [ ] Manipulating `agencyId` in request payload doesn't override path-based rules
- [ ] Query filters with foreign `agencyId` are rejected (rules evaluate query shape)

---

## 4. Role-Based Access Control

Roles stored in `agency_members/{uid}/profile.role`.

### Role hierarchy (write access)

| Role | Agency Meta | Properties | Tenancies | Payments | Expenses | Bank Details | Users |
|---|---|---|---|---|---|---|---|
| platform_admin | ✓ (all) | ✓ (all) | ✓ | ✓ | ✓ | ✓ | ✓ |
| agency_owner | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| agency_admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| property_manager | ✗ | ✓ (assigned) | ✓ (assigned) | record only | request | ✗ | ✗ |
| accountant | ✗ | read | read | ✓ | ✓ | ✓ | ✗ |
| field_agent | ✗ | read (assigned) | read (assigned) | ✗ | ✗ | ✗ | ✗ |
| auditor | ✗ | read | read | read | read | ✗ | ✗ |
| landlord | ✗ | read (own) | read (own) | read (own) | read (own) | ✗ | ✗ |
| tenant | ✗ | ✗ | read (own) | read (own) | ✗ | ✗ | ✗ |

**Enforcement layers:**
1. **Firestore Rules** — primary (blocks unauthorised reads/writes)
2. **Frontend route guards** — UX only (hides pages; NOT security)
3. **Frontend component gating** — UX only (hides buttons)

Layer 1 alone is authoritative. Layers 2–3 improve UX but must never be relied upon.

---

## 5. Input Validation

Without server middleware, validation happens at:

| Layer | Scope | Tool |
|---|---|---|
| Client form | UX feedback, immediate validation | TypeScript + form validation |
| Firestore Rules | Required fields, types, ranges on critical documents | `request.resource.data.keys()`, type checks |
| Service layer | Business rules, computed fields | TypeScript service functions |
| Database | Uniqueness where possible | Document ID conventions (see below) |

### Rules-level validation examples (to be added in Phase 2)
```javascript
// Property create: required fields and types
allow create: if isAgencyMember() &&
  request.resource.data.name is string &&
  request.resource.data.name.size() > 0 &&
  request.resource.data.type in ['residential_house', ...] &&
  request.resource.data.reference is string &&
  request.resource.data.unitCount is int &&
  request.resource.data.unitCount >= 0;
```

### Unique identifiers
Reference strings (`PRP-…`, `TEN-…`, `PAY-…`) are generated client-side with timestamp + random suffix.
True uniqueness enforced by using the reference as part of the document ID where feasible,
or by a lookup query before write (Phase 2 pattern: `where("reference","==",x)` before create).

---

## 6. Money Handling Security

| Risk | Mitigation |
|---|---|
| Floating-point drift | Centralised service functions; round at defined boundaries; integer kobo for journals |
| Client-side tampering of `outstanding` | `outstanding` recomputed in service layer on every write from `amountDue − amountPaid − waivedAmount` |
| Double-allocation of payment | Compound doc ID `paymentId_rentChargeId` — second write overwrites → prevented by existence check |
| Overwriting a confirmed payment | `status: "verified"` documents: rules deny update except to add `reversalOf` reference |
| Concurrent allocation | Firestore transaction (`runTransaction`) for allocation + charge update together (Phase 8) |

---

## 7. XSS / Injection

| Risk | Mitigation |
|---|---|
| XSS | React auto-escapes all JSX output; no `dangerouslySetInnerHTML` without sanitisation |
| Firestore injection | No string-concatenated queries; always parameterised `where()` clauses |
| URL manipulation | All route params validated against expected format before Firestore call |
| CSS injection | Tailwind class interpolation from user input: avoided (only static class maps) |

---

## 8. Secrets Management

| Item | Location | Safe? |
|---|---|---|
| Firebase web API key | `.env` (gitignored) → `import.meta.env` | ✅ Not a secret (identifies project; Rules enforce access) |
| Firebase service account | Never in frontend | ✅ Not used |
| Firestore admin SDK | Never in frontend | ✅ Not used (no backend server) |
| Payment provider keys | Server-side only (future) | ✅ N/A yet |
| `.env.example` | Committed with placeholder values | ✅ |

---

## 9. Audit & Activity Logging

Every significant action writes to `agencies/{agencyId}/activity_events/`:

```json
{
  "actorId": "uid",
  "actorName": "Jane Doe",
  "action": "payment.verified",
  "entityType": "payment",
  "entityId": "PAY-XXXX",
  "before": { "status": "pending" },
  "after": { "status": "verified" },
  "timestamp": "<Timestamp>"
}
```

Activity events are **append-only** (no update/delete from client).
Not to include sensitive values (bank account numbers, ID numbers).

---

## 10. Files and Documents (Phase 13 constraint)

The user specified: **Firestore + Auth only (no Storage, no Functions)**.

| Need | Options to evaluate in Phase 13 |
|---|---|
| Property photos | Base64 in Firestore (small images only, size limits apply) |
| Lease PDFs | Consider re-evaluating the Storage constraint, or third-party storage with signed URLs |
| ID documents | Same — encrypted client-side before write, or revisit constraint |

**Do not silently bypass the constraint.** Raise it explicitly before Phase 13.

---

## 11. Rate Limiting

Firebase provides built-in protections:
- Auth: email link and sign-in attempt throttling by Google
- Firestore: per-project quotas (billable, not security-grade)

**Client-side rate limiting** (Phase 3): throttle sensitive client actions (e.g., search-as-you-type) with debounce.

---

## 12. Security Checklist (per Phase)

Before marking any phase complete:

- [ ] New Firestore collections have rules restricting access to correct `agencyId`
- [ ] New roles/permissions enforced in Rules, not just UI
- [ ] No sensitive data exposed in client logs or error messages
- [ ] Financial fields recomputed in service layer, never trusted from form input
- [ ] New routes have auth guards; new pages gate by role where needed
- [ ] `npm run lint` passes
- [ ] No secrets committed (check `git diff` for `.env` values)
