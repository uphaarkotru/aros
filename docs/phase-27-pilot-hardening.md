# Phase 27: Design-Partner Pilot Hardening

## Problems addressed

Phase 27 removes import-time database access, the filesystem-backed global application mode, cross-tenant demo risk, production exposure of development tools, and gaps in repeatable CI verification.

## Architectural decisions

- PostgreSQL remains the runtime system of record. Identity repository and command-pool creation is lazy, single-flight, and reused per process. Missing configuration fails at request time without exposing a connection string; production never falls back to fixtures or files.
- `organizations.environment` is the only demo authority. `DEMO` enables tenant-scoped administrator simulation; `SANDBOX` and `PRODUCTION` are production-safe.
- Organization environment changes remain a platform-administration operation. Leaving `DEMO` clears only that organization's simulated sessions in the same transaction. The change and its before/after environment are written to the security audit log.
- A centralized `/dev` layout returns 404 in production. Demo mutation APIs require authentication, demo tenant scope, administrative authority, and production flags that default off. Coinbase reset remains limited to `org-cognivit-demo`.
- CI uses a disposable PostgreSQL 16 service, applies migrations `001` through `017` in order, seeds it, rejects skipped integration tests, and builds with `DATABASE_URL` unset.

## Security implications

An organization administrator can no longer change a process-wide mode. Simulation decisions use the authenticated session's organization, so a demo tenant cannot enable simulation or credential hints elsewhere. Login pages do not publish seeded credentials. Database startup errors reach requests as closed failures, and no local file can become a production identity authority.

## Test coverage

Unit coverage verifies import without `DATABASE_URL`, closed runtime failure, configured initialization, concurrent single-flight initialization, and tenant-specific environment isolation. Existing authorization and application suites continue to run. PostgreSQL integration coverage exercises migrations, tenant constraints, identity persistence, concurrency, cadence, leadership, and leading indicators against a real disposable database.

## Remaining known gaps

- External identity federation and secret rotation remain deployment responsibilities.
- Operational health/readiness endpoints and multi-process pool telemetry are not added here.
- Demo source data remains seeded rather than ingested from live systems.

## Phase 28 boundary

Phase 28 should begin with the Context Gateway contract and governed live ingestion. Salesforce, Glean, Gong, email, calendar, and other connectors are explicitly outside Phase 27, as are new role experiences, scoring changes, and autonomous actions.
