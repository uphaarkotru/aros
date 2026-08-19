# AROS Revenue Operating System Experience V2 audit

## Current state

| Area | Status | Evidence / gap |
| --- | --- | --- |
| PostgreSQL tenant persistence | COMPLETE | Identity, revenue, cadence, leading-indicator, and leadership repositories are tenant-scoped. |
| Authentication and role authorization | COMPLETE | `requireIdentity`, permissions, scope checks, and role simulation exist. |
| Revenue Digital Twin and audit events | PARTIAL | Cadence and intervention mutations write events; not every UI action has a shared lifecycle label. |
| AE Today | PARTIAL | Rich AI feed, decisions, cadences, indicators, and accounts; escalation to the manager queue was previously missing. |
| RSM Today | PARTIAL | Intervention, commitment, approval, and coaching views exist; manager triage and delegation are not unified. |
| VP/CRO Today | PARTIAL | Leadership briefing and forecast views exist; operating-review cadence handoffs are not yet first-class. |
| Application shell | PARTIAL | `TodayShell` exists, but several navigation entries are visual-only and role context was fragmented. |
| Role switcher | PARTIAL | Demo-only simulation works; signed-in identity, viewed identity, tenant, and scope were not presented together. |
| Cadence model | PARTIAL | Templates and persistence support manager 1:1, 2x2, forecast, and executive motions; VP/CRO operating templates required seed coverage. |
| Shared operating lifecycle | NEEDS REFACTOR | Signal, insight, decision, action, ownership, outcome, and institutional memory were represented by separate feature-specific types. |

## V2 architecture direction

V2 adds a shared operating vocabulary in `src/domain/revenue-operating-model.ts` and reusable presentation primitives in `src/components/revenue-operating.tsx`. Existing repositories remain the system of record; these additions do not create a parallel decision or persistence system.

The AE-to-RSM escalation endpoint creates a tenant-scoped `manager_interventions` item and records an audit event. RSM, VP, and CRO workflows should continue to use the existing cadence, decision, commitment, escalation, and Digital Twin tables as their durable handoff objects.

## Remaining work

- Convert visual-only shell items into backed routes as their screens are delivered.
- Add first-class preparation views for AE–RSM, RSM–VP, and VP–CRO operating reviews.
- Add lifecycle timeline rendering to account and cadence detail pages.
- Add integration coverage for AE escalation, operating-review creation, and cross-role outcome propagation.
