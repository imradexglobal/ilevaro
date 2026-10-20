# TESTING_STRATEGY.md — ILEVARO

---

## Test Pyramid

```
          ┌────────────────┐
          │   E2E (Phase 15)│   Playwright / Cypress — critical user journeys
          ├────────────────┤
          │  Integration    │   Firestore emulator + service layer + rules
          │  (Phase 2+)     │
          ├────────────────┤
          │  Unit & Component│  Vitest + React Testing Library (from Phase 1)
          └────────────────┘
```

---

## Tooling (Phase 1)

| Tool | Purpose |
|---|---|
| **Vitest** | Test runner (unit + component) |
| **React Testing Library** | Component rendering and interaction |
| **jsdom** | Browser-like environment for component tests |
| **@testing-library/jest-dom** | DOM matchers (`toBeInTheDocument`, `toBeDisabled`, etc.) |

Commands:
```bash
npm test          # run once
npm run test:watch  # watch mode
```

---

## Test Categories by Phase

### Phase 1 (current) — Foundation
- [x] Currency formatting (zero, large, negative, no float artifacts)
- [x] Reference generation (format, uniqueness over 1000 iterations)
- [x] Button (render, disabled while loading, click handler)
- [x] Input (label association, error display, aria-invalid)
- [x] Badge (render)
- [x] EmptyState / ErrorState (render)
- [x] Toast (context, message display, throws outside provider)

### Phase 2 — Data Layer
- CRUD service functions
- **Tenant isolation integration tests** (Firestore emulator):
  - User in Agency A cannot read/write Agency B documents
  - Query with wrong agencyId returns empty/denied
- Input validation at rules level
- Timestamps and serverTimestamp behaviour
- Soft-delete / archive queries exclude archived by default

### Phase 3 — Auth & Permissions
- Registration → agency doc creation
- Login/logout state transitions
- Role-based route guard (redirects unauthenticated and wrong-role users)
- Password reset flow
- Invitation flow (invite → accept → profile created)

### Phase 7 — Rent Engine (highest test priority)
- Due-date calculation for monthly/quarterly/half-yearly/annual/custom
- Grace period boundary (exactly at due date + grace)
- Leap-year date handling (29 Feb commencement)
- Year-end / month-end boundaries (31 Jan → 28/29 Feb)
- Idempotent charge generation (running generator twice = no duplicates)
- Status transitions (upcoming → due → overdue → partially_paid → paid)
- Overdue NOT triggered before due date + grace, even with outstanding balance
- Escalation applied at correct interval, never retroactively

### Phase 8 — Payments (highest test priority)
- Full payment closes charge
- Partial payment: outstanding = amountDue − amountPaid
- Multi-charge allocation in single transaction
- Advance payment → credit balance
- Duplicate transaction reference rejected
- Double-allocation prevention (same paymentId+rentChargeId)
- Reversal restores outstanding to pre-payment value
- Concurrent allocation (two clients allocating same payment) — one fails

### Phase 9 — Financial Modules
- Deposit tracking: received, deducted, refunded — never counted as rent income
- Commission calculation matches configured rate/basis
- Owner payable = rent collected for owner − commissions − approved owner expenses − remittances
- Owner statement reconciliation

### Phase 10 — Accounting
- Every journal: sum(debits) === sum(credits)
- Posted entries cannot be updated/deleted from client
- Reversal creates offsetting entry, does not mutate original
- Trial balance totals match general ledger
- No double-counting: rent payment recorded once across payment, allocation, and journal views

### Phase 12 — Reports
- Dashboard totals reconcile with individual record queries
- CSV export column counts match headers
- Date-filtered report boundaries (inclusive start, exclusive end)

### Phase 15 — Security & E2E
- **Cross-agency attack simulation**: manipulate URL, body, filter, export parameters
- **Privilege escalation**: tenant tries to write to landlord collection; field_agent tries to verify payment
- Full critical journeys (22 workflows from Master Instructions §11)
- Accessibility (axe-core)
- Performance under 10k-record queries

---

## Conventions

1. Test file location: colocated — `module.test.ts` next to `module.ts`
2. Name tests by behaviour, not implementation: `it("marks charge overdue after grace period")`
3. **Never disable a failing test to get green** — fix the code or document the blocker
4. Financial tests must use explicit expected values, not recomputed formulas (avoid testing code with itself)
5. Integration tests requiring Firebase emulator are marked and skipped with explanation if emulator not available

---

## Firebase Emulator (Phase 2+)

```bash
npm install -D firebase-tools
firebase emulators:start --only firestore,auth
```

Test config override:
```ts
// In test setup when emulator is running
connectFirestoreEmulator(db, "127.0.0.1", 8080);
connectAuthEmulator(auth, "http://127.0.0.1:9099");
```

This is required to test Security Rules without affecting real data.
