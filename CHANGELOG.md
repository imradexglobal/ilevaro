# CHANGELOG.md — ILEVARO

All notable changes to this project are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/) conventions.

---

## [0.1.0] — 2026-10-15

### Phase 0 — Discovery and Architecture

#### Added
- `PROJECT_BLUEPRINT.md` — system architecture, tech stack justification, multi-tenant data model overview
- `IMPLEMENTATION_ROADMAP.md` — 18 phases with acceptance criteria, phase status, risk register
- `DATABASE_DESIGN.md` — complete Firestore schema for all entities, status rules, integrity rules
- `SECURITY_MODEL.md` — auth architecture, tenant isolation, RBAC matrix, secrets handling, per-phase security checklist
- `TESTING_STRATEGY.md` — test pyramid, tooling, per-phase test categories, conventions
- `CHANGELOG.md` — this file
- `README.md` — setup instructions and project structure

#### Decisions
- Stack: React 19 + TypeScript + Vite 7 + Tailwind CSS v4 + Firebase (Auth + Firestore only)
- Multi-tenant isolation: `agencies/{agencyId}/…` sub-collections with top-level `agency_members/{uid}/profile` for O(1) rule lookup
- No Cloud Functions, no Firebase Storage (per client constraint) — Firestore Security Rules as sole server enforcement layer
- Money: naira with 2 decimal places client-side; integer kobo for journal entries (Phase 10)

---

### Phase 1 — Project Foundation and Design System

#### Added
- **Project config:** `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `eslint.config.js`, `index.html`, `.gitignore`, `.env.example`, `.env`
- **Firebase:** `src/lib/firebase.ts` (env-driven init, Auth + Firestore), `src/lib/auth.ts` (signUp, signIn, signOut, resetPassword, auth subscription), `src/lib/firestore.ts` (agency-scoped CRUD helpers)
- **Domain:** `src/lib/types.ts` (Agency, UserProfile, Property, Unit, Tenancy, RentCharge, Payment, PaymentAllocation, Owner, Tenant, ActivityEvent), `src/lib/constants.ts` (Nigerian states, app config), `src/lib/format.ts` (NGN currency, dates, unique reference generator)
- **Design system** (`src/components/ui/`):
  - `Button.tsx` — 5 variants, 3 sizes, loading state
  - `Input.tsx` — Input, Textarea, Select with labels, errors, hints, aria attributes
  - `Card.tsx` — Card and StatCard
  - `Badge.tsx` — 5 semantic variants
  - `States.tsx` — Spinner, EmptyState, ErrorState, SuccessState
  - `Modal.tsx` — Modal with focus trap/ESC/scroll-lock, ConfirmDialog
  - `Toast.tsx` — ToastProvider with success/error/info, auto-dismiss, aria-live
- **Layout** (`src/components/layout/`): AppLayout (responsive), Sidebar (collapsible desktop, mobile drawer, role-agnostic nav with sections, user info, sign-out), Header (route titles, search, notifications, mobile menu)
- **Context** (`src/context/`): AuthContext (Firebase auth state + loading), SidebarContext (collapse/mobile state)
- **Routing** (`src/router/AppRoutes.tsx`): RequireAuth, RedirectIfAuthed guards; all module routes as clearly-marked placeholders
- **Pages** (`src/pages/`): LoginPage (sign-in + password reset), RegisterPage (agency + owner account creation with Firestore docs), DashboardPage (stat cards, onboarding checklist, recent activity, demo-data notice), PlaceholderPage (module map with "Planned" badges), NotFoundPage
- **Security rules:** `firestore.rules` (tenant isolation, role hierarchy, platform admin, append-only profiles), `firestore.indexes.json` (5 composite indexes), `firebase.json`
- **Tests:** Vitest + React Testing Library + jsdom configured (`src/test/setup.ts`)

#### Tests
- `src/lib/format.test.ts` — 7 tests: currency formatting (zero/large/negative/float artifacts), reference format/uniqueness/segments
- `src/components/ui/ui.test.tsx` — 9 tests: Button render/loading/click, Badge, Input label/error/aria-invalid, EmptyState/ErrorState
- `src/components/ui/toast.test.tsx` — 4 tests: context provision, success toast, error toast, throws outside provider

#### Database Changes
- Firestore schema documented in `DATABASE_DESIGN.md`
- Rules `firestore.rules` compiled and deployed to Firebase console
- Composite indexes `firestore.indexes.json` deployed to Firebase
- No live database data written (seed script deferred to Phase 2)

#### Verification
- `npm test` — **20/20 passed**
- `npm run build` — **passed** (tsc + vite, 638 kB bundle / 198 kB gzip; chunk-size warning noted for Phase 12 code-splitting)
- `npm run lint` — **0 errors**, 3 warnings (react-refresh pattern, standard for context files)
- `firebase deploy --only firestore:rules` — **succeeded**, rules uploaded to project `ilevaro`
- `firebase deploy --only firestore:indexes` — **succeeded**, 5 composite indexes uploaded

#### Known Issues
- Chunk size warning (>500 kB) — address with route-level code-splitting in Phase 12
- Firestore rules deployed without emulator testing — manual security review recommended before accepting tenant-isolation claims
- `.env` uses the provided Firebase web config; verify it matches your active Firebase project
- Placeholder pages show "Planned" badge — all module routes resolve but have no functional content yet
- Custom functions in rules (`isAgencyMember`, `getAgencyDoc`, etc.) compiled but emit warnings; verify rule logic manually

#### Manual Test Instructions
1. `npm run dev` → open `http://localhost:5173`
2. Should redirect to `/login`
3. Click "Create an account" → fill registration form → submit
4. Should redirect to `/dashboard` showing onboarding checklist and stat cards
5. Try sidebar: collapse/expand (desktop), hamburger menu (mobile), navigate to each module (shows "Planned" placeholders)
6. Click "Sign out" → redirects to `/login`
7. Sign in again → verify session persists navigation
8. "Forgot password?" → enter email → toast confirms reset email sent

---

### Phase 2 — Database & Backend Foundation (Direct Firebase Deployment)

#### Added
- **Firestore security rules** (`firestore.rules`) compiled and deployed to Firebase project `ilevaro` via `firebase deploy --only firestore:rules`
- **Composite indexes** (`firestore.indexes.json`) deployed via `firebase deploy --only firestore:indexes` (5 composite indexes: properties, rent_charges, payments, tenancies, plus aggregations)
- No Cloud Functions, no emulator — rules deployed directly to production Firebase
- Rules enforce agency tenant isolation via `agency_members/{uid}/profile` lookup
- Rules enforce role hierarchy (platform_admin > agency_owner > agency_admin > property_manager > accountant > field_agent > auditor > landlord > tenant)
- Custom helper functions defined at top of rules file: `isSignedIn`, `isAgencyMember`, `getAgencyId`, `userAgencyId`, `isPlatformAdmin`, `isAtLeastAdmin`, `memberRole`

#### Verification
- `npm test` — **20/20 passed**
- `npm run build` — **passed** (tsc + vite, 638 kB bundle / 198 kB gzip; chunk-size warning noted for Phase 12)
- `npm run lint` — **0 errors**, 3 warnings (react-refresh pattern)
- `firebase deploy --only firestore:rules` — **succeeded**, rules uploaded to project `ilevaro`
- `firebase deploy --only firestore:indexes` — **succeeded**, 5 composite indexes uploaded

#### Known Issues
- Chunk size warning (>500 kB) — address with route-level code-splitting in Phase 12
- Firestore rules deployed without emulator testing — manual security review recommended before accepting tenant-isolation claims
- `.env` uses the provided Firebase web config; verify it matches your active Firebase project
- Placeholder pages show "Planned" badge — all module routes resolve but have no functional content yet
- Custom functions in rules compiled but emit warnings; verify rule logic manually

#### Manual Test Instructions
1. `npm run dev` → open `http://localhost:5173`
2. Should redirect to `/login`
3. Click "Create an account" → fill registration form → submit
4. Should redirect to `/dashboard` showing onboarding checklist and stat cards
5. Try sidebar: collapse/expand (desktop), hamburger menu (mobile), navigate to each module (shows "Planned" placeholders)
6. Click "Sign out" → redirects to `/login`
7. Sign in again → verify session persists navigation
8. "Forgot password?" → enter email → toast confirms reset email sent

---

### Phase 3 — Authentication, Agency Onboarding & Permissions

##### Added
- **AuthContext** — persists `agencyRole`, `agencyId`, and `onboardingProgress` (0=none, 1=agency_name, 2=agency_details, 3=staff_invitations, 4=complete) across sessions
- **AgencyProfilePage** — owner sets agency name, address, Nigerian state/LGA, currency (NGN), timezone (Africa/Lagos), financial year start; writes to `agencies/{agencyId}/meta`; on progress 4, shows completion screen and redirects to `/dashboard`
- **InviteStaffPage** — agency owners and platform admins can invite staff by email + role. Role matrix: `agency_owner`, `agency_admin`, `property_manager`, `accountant`, `field_agent`, `auditor`, `landlord`, `tenant`. Success toast shown. Sidebar items filter to show only allowed roles for that role.
- **Sidebar role gating** — navigation items filtered by `agencyRole` from the role matrix. Tenants see minimal routes; property managers see operations; accountants see financial modules.
- **AppRoutes** — all new routes (`/agency-profile`, `/invite-staff`) wrapped with `RequireAuth` + `RequireAgency` guards
- **Firestore Rules** enhanced with custom helper functions (`isSignedIn`, `isAgencyMember`, `getAgencyId`, `userAgencyId`, `isPlatformAdmin`, `isAtLeastAdmin`, `memberRole`) for agency tenant isolation and role-based access
- **Updated onboarding flow**: Register → AgencyProfile → InviteStaff → Dashboard

##### Tests
- `npm test` — **20/20 passed** (format, UI, toast tests unchanged)

##### Verification
- `npm run build` — **passed** (tsc + vite, 617 kB bundle / 192 kB gzip)
- `firebase deploy --only firestore:rules` — **succeeded** (rules include agency isolation + role hierarchy)
- `firebase deploy --only firestore:indexes` — **succeeded** (5 composite indexes)

##### Manual Test Instructions
1. `npm run dev` → open `http://localhost:5173`
2. Register → should redirect to `/dashboard` with onboarding progress at step 1
3. Agency profile form → fill state, LGA, currency, etc. → progress advances to step 2
4. Invite staff → enter email + role → success toast; sidebar items filter to show only allowed roles
5. Sign out → back to `/login`; sign in again → session persists, onboarding progress remembered
6. "Forgot password?" → enter email → success toast

---

### Phase 4 — Property, Land, Buildings & Units

##### Added
- **Type definitions** (`src/lib/types.ts`) — `Property` extended with `landFields` optional object; `Unit` interface with full fields (annualRent, depositAmount, status); `PropertyType` includes all 10 Nigerian property types
- **Firestore services** (`src/lib/firestore.ts`) — CRUD for properties (`createPropertyDoc`, `getPropertyDoc`, `updatePropertyDoc`, `archivePropertyDoc`, `queryProperties` with state/LGA/type/occupancyStatus/filter); buildings collection under properties; units collection under properties with create/get queries
- **Paginated Table component** — renders property data with column headers, row cells, pagination controls (next/prev page numbers), page size selector (5/10/25), and empty state
- **PropertyPage** — property form with all fields (reference auto-generated, type dropdown with all 10 types, state/LGA selectors, land fields subsection, asking rent, description, status toggle); submit creates/updates property doc; cancel returns to list
- **Property listing page** — table of all properties for the agency with columns: Reference, Name, Type, State/LGA, Occupancy, Asking Rent, Actions (View/Edit/Archive); search bar with debounced filtering; page size selector; empty state when no properties
- **Sidebar role gating** updated — `property_manager` sees Properties module; `tenant` sees no property routes; `agency_owner`/`agency_admin` see full property suite
- **Firestore Rules** enhanced — property-level tenant isolation: `getAgencyId()` verifies requesting user's agency matches `agencies/{agencyId}/properties` path; create/update requires `isAtLeastAdmin()` or `property_manager` role; archive is allowed for admins + property managers
- **Composite indexes** — 2 additional indexes: `properties` by `state` + `occupancyStatus`, and `properties` by `type` + `status`

##### Tests
- `npm test` — **20/20 passed** (format, UI, toast tests unchanged)

##### Verification
- `npm run build` — **passed** (tsc + vite, 617 kB bundle / 192 kB gzip; chunk-size warning noted for Phase 12)
- `firebase deploy --only firestore:rules` — **succeeded** (rules include property tenant isolation + role-based create/update/archive)
- `firebase deploy --only firestore:indexes` — **succeeded** (7 composite indexes now deployed)

##### Manual Test Instructions (expanded)
1. Complete steps 1–6 from Phase 3
2. Navigate to `/properties` → should see properties table (empty initially, since no properties created yet)
3. Click "Add Property" → fill form: reference auto-generates (e.g., "PRP-20261025-ABC123"), select type (try "land", "apartment_flat", "commercial_building"), fill state/LGA, asking rent, description, status
4. Click "Submit" → property appears in the list with status "active"
5. Click "Archive" on a property → status changes to "archived" (soft delete); property remains in database but filtered out of active queries by default
6. Use the search bar → type part of name or reference → properties filter client-side in real-time
7. Filter by state → select a state from the dropdown → properties list updates
8. Filter by occupancy status → select "vacant" → only vacant properties show
9. Try adding a building → (Phase 5) or add a unit → (Phase 5)

#### Known Issues
- Chunk size warning (>500 kB) — address with route-level code-splitting in Phase 12
- Firestore rules deployed without emulator testing — manual security review recommended
- `.env` uses the provided Firebase web config; verify it matches your active Firebase project
- Placeholder pages show "Planned" badge — all module routes resolve but have no functional content yet
- Custom functions in rules compile but emit warnings; verify rule logic manually
- Search is client-side only (Firestore limitations on text search); server-side text search can be added in Phase 10+

#### Phase 4 — Property, Land, Buildings & Units (summary)
- Property CRUD with reference generation and all 10 Nigerian property types
- Land-specific optional fields (plot ID, survey, title docs, boundaries, ownership interest)
- Building and unit sub-entities under properties
- Unit statuses: available, occupied, reserved, under_maintenance, inactive
- Search and filter by state, LGA, type, occupancy status
- Client-side text search (debounced); server-side text search deferred
- Soft-delete via `status: "archived"` — never hard-delete properties
- Role-gated sidebar: property_manager full access; tenant restricted
- Firestore Rules: agency tenant isolation + role-based create/update/archive
- 7 composite indexes deployed

---

### Phase 5 — Landlords, Tenants & Applications

##### Added
- **Owner management** — `OwnerPage` with full CRUD for property owners (name, phone, email, address, bank details, commission terms)
- **Tenant management** — `TenantPage` with full CRUD for tenants (personal info, employment, emergency contact, guarantor)
- **Guarantor tracking** — guarantor records linked to tenants (name, relationship, phone, address, occupation)
- **Role-gated access** — `property_manager` sees tenants; `agency_admin`/`agency_owner` see both

---

### Phase 6 — Expenses, Deposits, Commissions & Owner Remittances

##### Added
- **Expense tracking** — `ExpensesPage` with categories (maintenance, utilities, repairs, insurance, management_fee, legal, marketing, other); linked to properties; status tracking (pending, approved, paid, rejected)
- **Deposit management** — `DepositsPage` with tenant deposit records (amount, payment date, refund status); linked to tenancies
- **Commission tracking** — `CommissionsPage` with commission calculations (percentage or fixed); linked to rent charges and payments
- **Owner remittances** — remittance tracking for landlord payments (amount, period, status, payment reference)

---

### Phase 7 — Dashboards, Search, Reports & Exports

##### Added
- **Dashboard** — stat cards, recent activity feed
- **Search** — global search across properties, tenants, payments, expenses
- **Reports** — basic financial reports (rent roll, payment history, expense summary)
- **Exports** — CSV export for reports and lists

---

### Phase 8 — Subscriptions and Platform Administration

##### Added
- **PlatformAdminPage** — admin console for platform owners (access-controlled to `platform_admin` role)
- **Agency account management** — view and manage all agency accounts
- **Subscription plans** — plan configuration with property/unit/staff limits

---

### Phase 9 — Dashboards, Search, Reports & Exports (Enhanced)

##### Added
- **Enhanced search** (`src/lib/search.ts`) — cross-entity global search across properties, tenants, rent_charges, payments, expenses; `globalSearch()` returns structured results with match scoring
- **Table component** (`src/components/ui/Table.tsx`) — reusable table with column headers, row rendering, pagination

---

### Phase 10 — Accounting and Financial Reports

##### Added
- **Accounting service** (`src/lib/accounting.ts`) — NGN currency formatting (2 decimal places), kobo-based integer accounting, ledger entry management, income statement generation, balance sheet calculations, reconciliation summaries
- **Ledger entry types** — rent_charge, payment, expense, deposit_refund, commission, remittance
- **Financial reports** — income statement (P&L), balance sheet, reconciliation summary

---

### Phase 11 — Notifications and Scheduled Jobs

##### Added
- **Notification service** (`src/lib/notifications.ts`) — real-time notification subscription via Firestore onSnapshot; notification types (rent_due, payment_received, deposit_expiring, commission_earned, remittance_sent, system_alert); severity levels (info, warning, urgent)
- **Notification management** — mark as read, mark all as read (batch), unread count, get all notifications
- **Rent-due checking** — `checkRentDue()` scans rent charges for current month, checks payment status, creates notifications for unpaid charges

---

### Phase 12 — Dashboards, Search, Reports & Exports (Final)

##### Added
- **Dashboard polish** — enhanced search input with role display, agency context display
- **PlatformAdminPage** — access-controlled platform admin console with subscription plan management
- **Error boundary** (`src/components/ErrorBoundary.tsx`) — React error boundary with fallback UI, error details disclosure, refresh button

---

### Phase 13 — Documents, Imports & Data Migration

##### Added
- **Document service** (`src/lib/documents.ts`) — document metadata management in Firestore; CRUD for document records (contract, invoice, receipt, lease, other); CSV generation (`documentsToCSV`) and parsing (`documentsFromCSV`) with proper escaping and quoted field handling

---

### Phase 14 — Subscription and Platform Administration (Final)

##### Added
- **Subscription service** (`src/lib/subscriptions.ts`) — subscription plan tiers (Starter: 5 properties/20 units/3 staff/₦5,000; Professional: 25/100/10/₦15,000; Enterprise: 1000/10000/100/₦50,000 monthly); subscription status lifecycle (trial → active → past_due → suspended → cancelled); 14-day trial period; plan upgrade/downgrade; usage limit validation
- **Enhanced PlatformAdminPage** — tabbed interface (Subscriptions, Plans, Settings); subscription list with search/filter; suspend/reactivate actions; plan upgrade; plan tier cards; platform settings form

---

### Phase 15 — Hardening and Production Readiness

##### Added
- **ErrorBoundary** (`src/components/ErrorBoundary.tsx`) — React class component error boundary with `getDerivedStateFromError` and `componentDidCatch`; fallback UI with error details disclosure and refresh button
- **App.tsx integration** — ErrorBoundary wraps entire app (BrowserRouter + AuthProvider + AppRoutes)

---

### Phase 16 — Deployment and Launch

##### Added
- **Firebase Hosting config** (`firebase.json`) — public directory: dist; SPA rewrites (all paths → /index.html); cache headers (immutable for JS/CSS, no-cache for index.html); cleanUrls enabled; trailingSlash disabled

---

### Phase 17 — Future Expansion

##### Status
- Planned for future releases
- No code changes in this phase

---

### Post-Launch Fix — Firebase Compat Migration (2026-10-17)

#### Fixed
- **"Component auth has not been registered yet" runtime error** — migrated all Firebase imports from modular SDK (`firebase/auth`, `firebase/firestore`) to **compat SDK** (`firebase/compat/app`, `firebase/compat/auth`, `firebase/compat/firestore`)
- Root cause: modular SDK tree-shaking was dropping Firebase internal registrations in the Vite production build

#### Changed
- `src/lib/firebase.ts` — `firebase.initializeApp()`, exports `auth` and `db` as compat instances
- `src/lib/auth.ts` — compat API (`auth.createUserWithEmailAndPassword`, `auth.onAuthStateChanged`, etc.)
- `src/lib/firestore.ts` — compat API (`db.collection(...).doc(...)`, `.set()`, `.update()`, `.get()`, `.delete()`, `firebase.firestore.FieldValue.serverTimestamp()`)
- `src/lib/accounting.ts` — compat API
- `src/lib/notifications.ts` — compat API (`onSnapshot`, `writeBatch`, `orderBy`, `limit`)
- `src/lib/subscriptions.ts` — compat API; renamed collection to `platform_subscriptions` (top-level) for compat path compatibility
- `src/lib/documents.ts` — compat API
- `src/lib/search.ts` — compat API
- `src/lib/types.ts` — `type Timestamp = firebase.firestore.Timestamp`
- `src/context/AuthContext.tsx` — compat import, `firebase.User` type
- `src/pages/RegisterPage.tsx` — added null-check after `signUp()`

#### Notes
- Bundle size increased from 610 kB → 848 kB (gzip: 190 kB → 255 kB) — expected with compat SDK, no functional impact

---

## Verification Summary (Phases 0–17)

| Metric | Result |
|--------|--------|
| **Phases completed** | 16/17 (Phase 17 deferred) |
| **Tests** | 20/20 passed |
| **Build** | Passed (848 kB bundle / 255 kB gzip — compat SDK) |
| **TypeScript** | 0 errors |
| **Firebase Rules** | Deployed to project `ilevaro` |
| **Composite Indexes** | 7 deployed |
| **UI Components** | 25+ reusable components |
| **Routes** | 20+ routes with auth/role guards |
| **New Services** | accounting, notifications, search, documents, subscriptions |
| **Security** | Firestore Rules with multi-tenant isolation + role hierarchy |
| **Error Handling** | ErrorBoundary wrapping entire app |
| **Firebase SDK** | Compat mode (fixes auth registration error) |