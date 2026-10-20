# PROJECT_BLUEPRINT.md — ILEVARO

**Every Property. Every Payment. Under Control.**

---

## 1. Product Summary

| Field | Value |
|---|---|
| Name | ILEVARO (provisional) |
| Category | Property and Real Estate Management SaaS |
| Initial Market | Nigeria |
| Architecture | Multi-tenant, Firebase-backed, SPA |
| Client | React 19 + TypeScript + Vite |
| Backend | Firebase Authentication + Cloud Firestore |
| Storage | Firebase (Firestore only — no Cloud Functions, no Storage bucket for Phase 0–1) |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React |

---

## 2. Technology Stack (Confirmed)

### Frontend
- **React 19** with TypeScript (strict mode)
- **Vite 7** for build tooling and dev server
- **React Router v7** for client-side routing
- **Tailwind CSS v4** with `@tailwindcss/vite` plugin
- **Lucide React** for icons
- Custom design-system components (Button, Input, Card, Badge, Modal, Toast, States)

### Backend-as-a-Service
- **Firebase Authentication** — email/password, password reset, session management
- **Cloud Firestore** — all application data, structured per-agency sub-collections
- **Firestore Security Rules** — server-side authorization and tenant isolation (this replaces a traditional API layer)

### Testing
- **Vitest** — unit and component tests
- **React Testing Library** — UI component tests
- **jsdom** — browser environment for tests
- Phase 15 will add security/integration/E2E suites

### Why Firebase (not a custom Node backend)?

**Trade-offs explained:**

| Benefit | Cost |
|---|---|
| No server to manage, deploy, or scale | Business logic runs client-side — must be reinforced by Firestore Rules |
| Built-in auth with session handling | Less flexibility than custom JWT middleware |
| Real-time data sync possible | Firestore costs scale with reads/writes |
| Rapid development for MVP phases | No Cloud Functions means no server-side cron, webhooks, or complex transactions at scale |
| Generous free tier | Vendor lock-in (mitigated by keeping domain logic in portable TypeScript) |

**Critical security note:** Without Cloud Functions, all writes go directly from the client. Firestore Security Rules are the *only* enforcement layer for data access, validation, and tenant isolation. These rules must be thorough, tested, and deployed before any production data exists.

---

## 3. System Architecture

```
┌──────────────────────────────────────────────────────┐
│                    React SPA (Vite)                   │
│  ┌────────────┐ ┌──────────────┐ ┌────────────────┐  │
│  │  Pages      │ │  Design      │ │  Business      │  │
│  │  (Routes)   │ │  System      │ │  Logic Layer   │  │
│  │             │ │  Components  │ │  (services/)   │  │
│  └──────┬─────┘ └──────────────┘ └───────┬────────┘  │
│         │                                │            │
│  ┌──────┴────────────────────────────────┴────────┐  │
│  │              Firebase Client SDK                │  │
│  │    (Auth + Firestore — read/write directly)     │  │
│  └─────────────────────┬──────────────────────────┘  │
└────────────────────────┼─────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │       Firebase Cloud        │
          │  ┌────────────┐ ┌────────┐  │
          │  │  Auth      │ │ Firestore│ │
          │  │  (users)   │ │ (data)  │ │
          │  └────────────┘ └───┬────┘  │
          │                     │       │
          │  ┌──────────────────┴─────┐ │
          │  │  Security Rules        │ │
          │  │  (authorization +      │ │
          │  │   tenant isolation)    │ │
          │  └────────────────────────┘ │
          └─────────────────────────────┘
```

### Layers (frontend)

| Layer | Location | Responsibility |
|---|---|---|
| Pages / Routes | `src/pages/`, `src/router/` | Route-level composition, page layout |
| Design System | `src/components/ui/` | Reusable, accessible UI primitives |
| Layout | `src/components/layout/` | Sidebar, header, responsive shell |
| Context | `src/context/` | Auth state, sidebar state, toasts |
| Services | `src/lib/` | Firebase init, auth operations, Firestore CRUD, formatting, constants |
| Types | `src/lib/types.ts` | Shared domain model TypeScript interfaces |

Business logic lives in `src/lib/` — never inside components.

---

## 4. Multi-Tenant Data Model (Firestore)

All agency data is namespaced under `agencies/{agencyId}/…` so tenant isolation
is enforced structurally *and* by security rules.

```
agencies/
  {agencyId}/
    meta/                 ← agency profile, settings, subscription
    properties/
    buildings/
    units/
    owners/
    tenants/
    tenancies/
    rent_charges/
    payments/
    payment_allocations/
    deposits/
    expenses/
    vendors/
    maintenance_requests/
    commissions/
    remittances/
    documents/
    notifications/
    activity_events/
    settings/

agency_members/
  {userId}/
    profile/              ← role, agencyId, status (top-level for fast auth checks)
```

**Why `agency_members` is top-level:** Security Rules must be able to look up a
user's agency and role in a single `get()` call without knowing the agency ID first.

---

## 5. Roles and Permissions (Planned)

| Role | Access Scope |
|---|---|
| `platform_admin` | Cross-agency platform management |
| `agency_owner` | Full agency access |
| `agency_admin` | Full agency access (except ownership transfer) |
| `property_manager` | Assigned properties: tenants, tenancies, maintenance |
| `accountant` | Financial modules: payments, expenses, reports |
| `field_agent` | Limited: property inspection, tenant lookup |
| `auditor` | Read-only across agency |
| `landlord` | Own properties, statements, remittances |
| `tenant` | Own tenancy, payments, receipts, documents |

Enforcement: **Firestore Rules** (primary) + **UI gating** (secondary, for UX only).

---

## 6. Nigerian Market Defaults

- Currency: **NGN (₦)** — integer-minor-unit or exact decimal, never float
- Timezone: `Africa/Lagos` (WAT, UTC+1, no DST)
- Date display: `DD/MM/YYYY` (configurable)
- Phone: `0XXXXXXXXXX` local format, `+234` international
- 36 states + FCT, with LGA fields
- Terminology: rent, tenancy, agency fee, caution deposit, landlord/owner

All configurable via agency settings — no hardcoded Nigerian rules in calculations.

---

## 7. What This Blueprint Does NOT Cover (Deferred)

- Cloud Functions / server-side cron (Phase 11 requires re-evaluation)
- Firebase Storage for files (Phase 13 — documents)
- Payment gateway integration (Phase 8/14)
- Double-entry accounting (Phase 10)
- Email/SMS sending (Phase 11)
- Mobile apps (Phase 17)
