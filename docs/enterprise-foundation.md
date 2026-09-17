# Enterprise foundation

PostgreSQL is the runtime system of record for identity, sessions, security audit history, and tenant revenue state. Production has no JSON, filesystem, fixture, or in-memory identity fallback. Runtime identity initialization is lazy, single-flight, and fails closed if configuration or connectivity is unavailable; module import and `next build` do not require `DATABASE_URL`. Deployments apply migrations `001` through `017` in filename order and record them in `schema_migrations`. Tenant predicates must be included in every resource query. Legacy `User.organizationId`, `role`, `managerUserId`, and team fields remain compatibility projections until downstream fixtures are normalized.

`organizations.environment` is the sole demo/production behavior switch. `DEMO` permits authenticated organization-admin simulation inside that same tenant. `SANDBOX` and `PRODUCTION` disable simulation. Platform administration alone changes environment, changes are audited, and a transition out of `DEMO` clears simulated-view state for that organization only.

Hierarchy reads load the tenant's active reporting edges once, build adjacency maps, and traverse iteratively. This avoids recursive repository calls and N+1 behavior. PostgreSQL implementations should use the indexed `organization_relationships` adjacency table with a recursive CTE; the write service rejects self, direct, and indirect cycles before persistence.

Authorization composes platform authority, membership administrative authority, all active organization role assignments, explicit membership overrides, reporting scope, and explicit revenue-team assignments. Administrative roles never imply revenue permissions. Reporting relationships never imply participation in an account or opportunity.
