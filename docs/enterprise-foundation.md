# Enterprise foundation

The runtime adapter is a transactional JSON store for deterministic development. PostgreSQL production deployments apply migrations `001` and `002`; tenant predicates must be included in every resource query. Legacy `User.organizationId`, `role`, `managerUserId`, and team fields remain compatibility projections until downstream fixtures are normalized.

Hierarchy reads load the tenant's active reporting edges once, build adjacency maps, and traverse iteratively. This avoids recursive repository calls and N+1 behavior. PostgreSQL implementations should use the indexed `organization_relationships` adjacency table with a recursive CTE; the write service rejects self, direct, and indirect cycles before persistence.

Authorization composes platform authority, membership administrative authority, all active organization role assignments, explicit membership overrides, reporting scope, and explicit revenue-team assignments. Administrative roles never imply revenue permissions. Reporting relationships never imply participation in an account or opportunity.
