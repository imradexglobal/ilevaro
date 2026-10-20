# ILEVARO

**Every Property. Every Payment. Under Control.**

Multi-tenant property and real estate management platform for Nigerian agencies.

## Tech Stack

- React 19 + TypeScript (strict) + Vite 7
- Tailwind CSS v4
- Firebase Authentication + Cloud Firestore (no Cloud Functions, no Storage)
- React Router v7
- Vitest + React Testing Library

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
copy .env.example .env    # then fill in your Firebase web config values

# 3. Start dev server
npm run dev

# 4. Run tests
npm test

# 5. Build
npm run build
```

## Firestore Rules

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

Requires `firebase-tools` (`npm install -g firebase-tools`) and `firebase login`.

## Project Structure

```
src/
  components/
    layout/      # AppLayout, Sidebar, Header
    ui/          # Design system: Button, Input, Card, Badge, Modal, Toast, States
  context/       # AuthContext, SidebarContext
  lib/           # Firebase init, auth, Firestore CRUD, types, format, constants
  pages/         # Route-level pages
  router/        # AppRoutes with auth guards
  test/          # Test setup
firestore.rules  # Security rules (tenant isolation + role enforcement)
firestore.indexes.json
```

## Documentation

- [PROJECT_BLUEPRINT.md](PROJECT_BLUEPRINT.md) — architecture and stack
- [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) — phases and acceptance criteria
- [DATABASE_DESIGN.md](DATABASE_DESIGN.md) — Firestore data model
- [SECURITY_MODEL.md](SECURITY_MODEL.md) — auth, isolation, roles, risks
- [TESTING_STRATEGY.md](TESTING_STRATEGY.md) — test approach
- [CHANGELOG.md](CHANGELOG.md) — change history
