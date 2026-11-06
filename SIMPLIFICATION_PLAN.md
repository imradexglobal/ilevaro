# Simplification Plan

## Goal
Transform ILEVARO into a simple Property & Tenant Management System for Agents with four responsibilities: property management, tenant management, occupancy tracking, basic rent payment & outstanding balance tracking.

## Keep (essential)
- Auth, roles, agency membership (agency_members, users)
- Properties, units, landlords
- Tenants, tenancies
- Rent charges, payments, payment_allocations, tenant_credits, arrears
- Notifications, documents (metadata), search
- Settings, agency profile, invite staff

## Remove (finance/accounting modules)
- AccountingPage (/accounting) — journal entries, ledger summaries
- ExpensesPage (/expenses)
- CommissionsPage (/commissions)
- RemittancesPage (/remittances)
- DepositsPage (/deposits)
- ReportsPage (/reports) financial reports
- Accounting lib (accounting.ts, accounting-journal.test.ts)
- Finance nav section in sidebar

## Payment rule change
- Prevent overpayment: max payment = outstanding balance; block payments when balance is 0.

## UI simplification
- Sidebar sections: Overview, Portfolio, Operations (remove Finance, trim Resources).
- Dashboard: remove financial charts/summaries; show property/tenant/occupancy/payment status counts.

## Implementation order
1. Remove finance routes from AppRoutes.tsx and sidebar nav items.
2. Remove finance page imports.
3. Simplify DashboardPage (remove finance widgets).
4. Enforce overpayment prevention in RentPage payment recording.
5. Clean up unused finance libs/types.
6. Update Firestore rules (keep finance collections read-only or remove access).
7. Run lint + tests.

## Data preservation
- Do not delete existing collections; keep rules allowing read for auditors.
- Finance pages remain in repo but unrouted (or removed) — removing route is enough to hide from agents.

## Dependencies
- RentPage depends on payments, rent_charges, payment_allocations, tenant_credits, ledger — keep these.
- ArrearsPage depends on rent_charges — keep.
- DocumentsPage kept (metadata register).
