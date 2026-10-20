# IMPLEMENTATION_ROADMAP.md — ILEVARO

Phase gates: **each phase requires explicit approval before the next begins.**

---

## Phase Status

| Phase | Name | Status |
|---|---|---|
| 0 | Discovery & Architecture | ✅ Complete |
| 1 | Project Foundation & Design System | ✅ Complete |
| 2 | Database & Backend Foundation | ⬜ Not started |
| 3 | Authentication, Onboarding & Permissions | ⬜ Not started |
| 4 | Property, Land, Buildings & Units | ⬜ Not started |
| 5 | Landlords, Tenants & Applications | ⬜ Not started |
| 6 | Tenancy & Lease Management | ⬜ Not started |
| 7 | Rent Schedule & Due-Date Engine | ⬜ Not started |
| 8 | Payments, Receipts & Reconciliation | ⬜ Not started |
| 9 | Expenses, Deposits, Commissions & Remittances | ⬜ Not started |
| 10 | Accounting & Financial Reports | ⬜ Not started |
| 11 | Notifications & Scheduled Jobs | ⬜ Not started |
| 12 | Dashboards, Search, Reports & Exports | ⬜ Not started |
| 13 | Documents, Imports & Data Migration | ⬜ Not started |
| 14 | Subscription & Platform Administration | ⬜ Not started |
| 15 | Hardening & Production Readiness | ⬜ Not started |
| 16 | Deployment & Launch | ⬜ Not started |
| 17 | Future Expansion | ⬜ Deferred |

---

## Phase Acceptance Criteria

### Phase 0 — Discovery & Architecture ✅
- [x] Project directory inspected (was empty)
- [x] Technology stack decided and justified
- [x] `PROJECT_BLUEPRINT.md` created
- [x] `IMPLEMENTATION_ROADMAP.md` created
- [x] `DATABASE_DESIGN.md` created
- [x] `SECURITY_MODEL.md` created
- [x] `TESTING_STRATEGY.md` created
- [x] `CHANGELOG.md` created

### Phase 1 — Project Foundation & Design System ✅
- [x] Vite + React + TypeScript project configured
- [x] Tailwind CSS v4 configured with brand theme
- [x] Firebase Auth + Firestore client initialized (env-driven config)
- [x] React Router with authenticated route guards
- [x] Design system: Button, Input, Textarea, Select, Card, StatCard, Badge, Modal, ConfirmDialog, Toast, Spinner, EmptyState, ErrorState, SuccessState
- [x] Responsive app shell: collapsible sidebar (desktop), drawer (mobile), sticky header
- [x] Login page with password reset
- [x] Registration page (agency + owner account creation)
- [x] Dashboard page with stat cards and onboarding checklist
- [x] Placeholder pages for all planned modules (clearly marked "Planned")
- [x] Firestore security rules drafted
- [x] Firestore composite indexes drafted
- [x] ESLint configured
- [x] Vitest + React Testing Library configured
- [x] Unit tests for formatting, reference generation
- [x] Component tests for Button, Input, Badge, States, Toast
- [x] Build passes (`npm run build`)
- [x] Tests pass (`npm test`)
- [ ] `.env` file created from `.env.example` (developer action required)

### Phase 2 — Database & Backend Foundation
**Goal:** Solid Firestore data layer with enforced tenant isolation.

- [ ] Document all Firestore collection paths and document schemas
- [ ] Deploy and test Firestore security rules (tenant isolation verified)
- [ ] CRUD service layer for core entities (agency, user, property, unit, owner, tenant)
- [ ] Server-side (rules-level) input validation for critical fields
- [ ] Development seed script for test data
- [ ] Integration tests: agency A cannot read/write agency B data
- [ ] Concurrency handling: optimistic updates, idempotent writes

### Phase 3 — Authentication, Agency Onboarding & Permissions
**Goal:** Complete auth flow with working multi-tenant isolation.

- [ ] Registration → agency creation → profile completion flow
- [ ] Login / logout / password reset (verify against Firebase)
- [ ] Agency profile setup (name, logo, address, state, currency, timezone)
- [ ] Staff invitation flow (invite by email, assign role)
- [ ] Role-based UI gating (sidebar visibility, page access)
- [ ] Role-based Firestore Rules enforcement
- [ ] Onboarding checklist tracks completion state
- [ ] Test: user cannot access routes they lack permissions for
- [ ] Test: agency member cannot read another agency's data

### Phase 4 — Property, Land, Buildings & Units
- [ ] Property CRUD with reference generation
- [ ] Property types, Nigerian states/LGAs, GPS coordinates
- [ ] Land-specific fields (plot ID, survey, title docs)
- [ ] Building and unit sub-entities with relationships
- [ ] Unit statuses (available, occupied, reserved, maintenance)
- [ ] Property photo placeholders (actual upload deferred to Phase 13)
- [ ] Search, filters, pagination
- [ ] Duplicate detection on property reference and name
- [ ] Archive/restore, soft-delete rules
- [ ] Record history (created/modified audit trail)

### Phase 5 — Landlords, Tenants & Applications
- [ ] Owner/landlord CRUD with bank details (restricted)
- [ ] Multiple owners per property, multiple properties per owner
- [ ] Tenant CRUD with minimal necessary data
- [ ] Prospective tenant application workflow
- [ ] Guarantor records
- [ ] Document attachment placeholders
- [ ] Restrict bank/payout fields to accountant+ roles

### Phase 6 — Tenancy & Lease Management
- [ ] Tenancy creation: tenant ↔ unit ↔ terms
- [ ] Lease fields: dates, rent, frequency, due day, grace period, deposit, fees
- [ ] Lease lifecycle: proposed → active → renewed/expired/terminated
- [ ] Renewal preserves original tenancy record
- [ ] Rent changes require effective date (audit trail)
- [ ] Move-in / move-out inspection records
- [ ] Notices and communication log

### Phase 7 — Rent Schedule & Due-Date Engine
- [ ] Rent charge generation from active tenancies
- [ ] Billing frequencies: monthly, quarterly, half-yearly, annual, custom
- [ ] Due-date calculation with grace periods
- [ ] Idempotent generation (no duplicate charges — verified by tests)
- [ ] Status calculation: upcoming, due, partially paid, paid, overdue, waived, cancelled
- [ ] Overdue only after due date + grace period passes with outstanding balance
- [ ] Dashboard widgets: due today, due 7/30 days, overdue, partial
- [ ] Lease expiration alerts
- [ ] Configurable reminder windows
- [ ] Tests: date boundaries, leap years, interval math, timezone handling

### Phase 8 — Payments, Receipts & Reconciliation
- [ ] Payment recording (method, reference, date, amount)
- [ ] Full and partial allocation to rent charges
- [ ] Multi-charge allocation in one transaction
- [ ] Advance/unallocated payments with credit balance
- [ ] Duplicate transaction detection
- [ ] Payment verification workflow (pending → verified)
- [ ] Reversal creates adjustment — original preserved
- [ ] Receipt generation with receipt numbers
- [ ] Atomic allocation (no double-allocation under concurrency)
- [ ] Tests: partial payment math, reversal, duplicate prevention

### Phase 9 — Expenses, Deposits, Commissions & Remittances
- [ ] Expense records with categories, vendors, approval status
- [ ] Maintenance request workflow
- [ ] Security deposit tracking (separate from rent)
- [ ] Deposit deductions and refunds with approval
- [ ] Commission calculation per configurable agreement
- [ ] Owner payable balance computation
- [ ] Owner remittance records and statements
- [ ] Owner statement reconciliation test

### Phase 10 — Accounting & Financial Reports
- [ ] Chart of accounts
- [ ] Double-entry journal entries (debits = credits, enforced)
- [ ] Posted entries immutable (no silent edits/deletes)
- [ ] Accounts receivable, cash/bank, owner payable, deposit liability
- [ ] Trial balance, general ledger, income statement, balance sheet
- [ ] Documented accounting treatment for: advance rent, deposits, owner funds, commissions, refunds, unpaid rent
- [ ] All journal posting rules tested

### Phase 11 — Notifications & Scheduled Jobs
- [ ] In-app notification centre
- [ ] Notification templates and preferences
- [ ] Delivery tracking and retry (via chosen channel)
- [ ] Deduplication: repeated job runs do not double-send
- [ ] Reminder schedules configurable per agency
- [ ] Background job approach documented (Firestore client triggers vs. external scheduler)

### Phase 12 — Dashboards, Search, Reports & Exports
- [ ] Role-specific dashboards (agency, manager, landlord, tenant)
- [ ] Global search across authorised entities
- [ ] Advanced filters, sorting, pagination
- [ ] CSV export; PDF/Excel as feasible
- [ ] Financial summaries reconcile with source records (tested)

### Phase 13 — Documents, Imports & Data Migration
- [ ] Document upload (evaluate Firebase Storage vs. alternatives given constraint)
- [ ] File type/size validation
- [ ] Access-controlled download
- [ ] CSV/Excel import with column mapping
- [ ] Preview before import, row-level errors
- [ ] Failed import leaves no partial records
- [ ] Export permissions enforced

### Phase 14 — Subscription & Platform Administration
- [ ] Platform admin console (separate routes, platform_admin role)
- [ ] Agency account management (suspend, reactivate, close)
- [ ] Subscription plans and trial periods
- [ ] Usage limits
- [ ] Platform-wide configuration

### Phase 15 — Hardening & Production Readiness
- [ ] Full E2E test suite for critical workflows
- [ ] Security review: IDOR, privilege escalation, XSS, injection
- [ ] Cross-agency access tested via URL/body/filter manipulation
- [ ] Performance profiling
- [ ] Accessibility audit
- [ ] Backup and restore test
- [ ] Dependency vulnerability scan
- [ ] Production deployment guide

### Phase 16 — Deployment & Launch
- [ ] Production Firebase project configured
- [ ] Firestore rules deployed and verified
- [ ] Environment variables set
- [ ] Custom domain + HTTPS
- [ ] Production smoke tests pass
- [ ] Rollback plan documented

### Phase 17 — Future Expansion
- PWA, mobile apps, offline support, portals, e-signatures, payment gateways, bank reconciliation, maps, AI features, i18n.

---

## Known Risks

| Risk | Severity | Mitigation |
|---|---|---|
| No Cloud Functions means all writes are client-initiated | High | Comprehensive Firestore Rules; security review every phase |
| Firestore security rules are the only server enforcement layer | High | Rules tested with emulator in Phase 2+ |
| Financial calculations run in browser — must be deterministic | High | Centralised service layer; integer-cent arithmetic; test coverage |
| No scheduled jobs without Functions or external cron | Medium | Documented in Phase 11; may require re-evaluating the "no Functions" constraint |
| Firebase costs can grow with read-heavy dashboards | Medium | Aggregated document fields; composite indexes; limit queries |
| No server-side file storage (constraint) | Medium | Phase 13 must evaluate alternatives (e.g. client-side encrypted storage, or revisit Storage constraint) |
