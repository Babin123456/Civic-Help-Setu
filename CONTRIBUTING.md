# Contributing to CivicBridge

First off, thank you for considering contributing to CivicBridge! It's people like you that make this open-source civic-tech platform possible.

## How Can I Contribute?

### Reporting Bugs
If you find a bug, please create an issue using the Bug Report template.

### Suggesting Enhancements
If you have an idea for a new feature or improvement, please use the Feature Request template.

### Updating Civic Information
Public service information changes frequently. If you notice outdated or incorrect information in our mock data or service guides, please open an issue using the Incorrect Information template, or submit a Pull Request.

## Pull Request Process
1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. Ensure the test suite passes.
4. Make sure your code adheres to our code style (we use ESLint/Prettier).
5. Run the security checks (see below) before you push.
6. Update documentation if necessary.
7. Issue that pull request!

## Testing
The [pull request quality workflow](.github/workflows/pr-quality.yml) runs on every pull request to `main` and every push to `main`. It uses Node.js 22 (22.19.0 or newer, as required by the locked dependencies) and the committed npm lockfile. Run the same checks locally before opening a pull request:

```bash
npm ci
npm run lint
npm test
npm run build
```

The workflow shows install, lint, test, and build as separate steps. Lint, test, and build still run after another check fails, provided installation succeeded, so each result is visible. Any failed step makes the job fail; rerun the same command locally and include the fix in the PR. The npm cache stores downloaded packages only, with a key scoped to the runner OS, Node.js version, and lockfile hash. It does not cache `node_modules` or require deployment secrets.

For a successful run, confirm that the PR points to the intended `main` branch, `npm ci` used `package-lock.json`, lint and Vitest report no failures, the Vite production build succeeds, and the overall `Lint, tests and build` job is green. Maintainers can then mark that job as required in branch protection. The existing security checks remain separate.

Run unit and integration tests locally with Vitest:
```bash
npm test                                                      # run all tests
npm test -- --run src/services/roadSafetyBlackspotService.test.js # road-safety blackspot engine tests (#769)
npm test -- --run src/pages/RoadSafetyDashboard.test.jsx          # road-safety dashboard workspace UI tests (#769)
npm test -- --run src/components/admin/RoadHazardReviewQueue.test.jsx # road-safety hazard review queue tests (#769)
npm test -- --run tests/road-hazards.test.js                     # road-safety hazard API validation & abuse tests (#769)
npm test -- --run src/data/openContractingContract.test.js    # open-contracting schema & contract tests (#751)
npm test -- --run src/services/openContractingAnalyticsService.test.js # procurement red-flag analytics engine tests (#751)
npm test -- --run src/services/openContractingService.test.js # open-contracting service & storage tests (#751)
npm test -- --run tests/open-contracting-analytics.test.js    # open-contracting API validation & abuse tests (#751)
npm test -- --run src/pages/OpenContractingWorkspace.test.jsx # procurement analytics workspace UI tests (#751)
npm test -- --run src/services/provenanceService.test.js       # lineage DAG & cycle prevention tests (#777)
npm test -- --run src/pages/LineageExplorerWorkspace.test.jsx  # provenance explorer UI tests (#777)
npm test -- --run tests/knowledge-provenance.test.js          # provenance serverless API tests (#777)
npm test -- --run tests/knowledge-provenance-security.test.js # provenance security & PII tests (#777)
npm test -- --run src/services/citizenDraftSyncEngine.test.js # offline-first sync engine tests (#775)
npm test -- --run src/pages/CitizenDraftSyncWorkspace.test.jsx # sync workspace UI tests (#775)
npm test -- --run src/services/syntheticGeneratorEngine.test.js # synthetic dataset engine tests (#778)
npm test -- --run src/pages/SyntheticDatasetWorkspace.test.jsx # synthetic dataset workspace tests (#778)
npm test -- --run src/data/publicToiletContract.test.js              # public toilet contract & calculations (#758)
npm test -- --run src/services/publicToiletService.test.js           # public toilet service orchestration (#758)
npm test -- --run tests/public-toilets.test.js                      # public toilet API validation & receipt tests (#758)
npm test -- --run src/pages/PublicToiletDirectory.test.jsx           # public toilet workspace UI tests (#758)
npm test -- --run src/services/tenantIsolationService.test.js # tenant isolation service tests (#779)
npm test -- --run src/pages/TenantAdministrationWorkspace.test.jsx # tenant administration workspace tests (#779)
npm test -- --run tests/tenant-administration.test.js          # tenant administration API tests (#779)
npm test -- --run src/services/continuityPlannerService.test.js # continuity planner service & state machine tests (#780)
npm test -- --run src/services/dependencyGraphEngine.test.js  # graph analysis, cycle detection & SPOF tests (#780)
npm test -- --run src/pages/ContinuityPlannerWorkspace.test.jsx # incident response drill workspace & runbook tests (#780)
npm test -- --run src/services/counterDemandForecastingService.test.js # counter demand forecasting tests (#764)
npm test -- --run src/pages/CounterDemandForecastingWorkspace.test.jsx # counter demand workspace UI tests (#764)
npx vitest run src/services/treeInventoryService.test.js       # tree inventory domain/security tests (#749)
npx vitest run src/services/treeInventoryMigrations.test.js    # tree schema migration/rollback tests (#749)
npx vitest run src/pages/TreeHealthInventory.test.jsx          # tree page public-projection tests (#749)
npx vitest run src/components/trees/TreeInventoryComponents.test.jsx # tree component/accessibility tests (#749)
npx vitest run src/services/pedestrianBarrierService.test.js       # pedestrian barrier graph & service tests (#757)
npx vitest run src/services/pedestrianBarrierMigrations.test.js    # pedestrian schema migration/rollback tests (#757)
npx vitest run tests/pedestrian-barriers.test.js                   # pedestrian barrier API validation tests (#757)
npx vitest run tests/pedestrian-barriers-security.test.js          # pedestrian security, injection & replay tests (#757)
npx vitest run src/pages/AccessibleRouteBarrierWorkspace.test.jsx  # accessible barrier workspace UI tests (#757)
```

Architecture, data model, state machine, graph routing rules, and verification integrity for the accessible pedestrian route barrier map are documented in [docs/ACCESSIBLE_PEDESTRIAN_ROUTE_BARRIERS.md](docs/ACCESSIBLE_PEDESTRIAN_ROUTE_BARRIERS.md).
npx vitest run src/services/streetlightService.test.js        # streetlight clustering & repair service tests (#756)
npx vitest run src/services/streetlightAccessControl.test.js  # streetlight RBAC & privacy scoping tests (#756)
npx vitest run src/services/streetlightMigrations.test.js     # streetlight schema migration & rollback tests (#756)
npx vitest run src/pages/StreetlightOutageWorkspace.test.jsx   # streetlight workspace & accessible UI tests (#756)
npx vitest run src/data/ghgInventoryContract.test.js          # GHG inventory calculation & projection contract tests (#753)
npx vitest run src/services/ghgInventoryAccessControl.test.js # GHG role & jurisdiction scoping tests (#753)
npx vitest run src/services/ghgInventoryMigrations.test.js    # GHG inventory migration, rollback & retention tests (#753)
npx vitest run src/services/ghgInventoryService.test.js       # GHG inventory workflow & state machine tests (#753)
npx vitest run src/pages/GhgInventoryWorkspace.test.jsx       # GHG inventory workspace UI & accessibility tests (#753)
npx vitest run tests/ghg-inventory.test.js                    # GHG submission API auth, idempotency & abuse tests (#753)
```

Architecture, data model, spatial clustering algorithms, explainability ruleset, and technician workflows for streetlight outages are documented in [docs/streetlight-outage-clustering.md](docs/streetlight-outage-clustering.md).

Architecture, data model, calculation methodology, uncertainty bands, role/jurisdiction scoping, retention and rollback for the municipal greenhouse-gas inventory are documented in [docs/municipal-greenhouse-gas-inventory.md](docs/municipal-greenhouse-gas-inventory.md).
npx vitest run src/services/waterQualityService.test.js        # water quality domain & supersession tests (#754)
npx vitest run src/services/waterQualityRulesEngine.test.js    # deterministic IS 10500 compliance tests (#754)
npx vitest run src/services/waterQualityValidation.test.js     # anti-PII & schema validation tests (#754)
npx vitest run tests/water-quality-register.test.js            # serverless API abuse guard tests (#754)
npx vitest run src/pages/WaterQualityRegister.test.jsx         # water register UI & accessibility tests (#754)
npx vitest run src/services/publicProjectService.test.js       # public project domain & state transition tests (#752)
npx vitest run src/services/evidenceVerificationService.test.js # evidence integrity & CV advisory tests (#752)
npx vitest run tests/public-projects.test.js                 # public project serverless API & abuse tests (#752)
npx vitest run src/pages/PublicProjectsWorkspace.test.jsx      # public project workspace UI & a11y tests (#752)
npx vitest run src/services/routePlanning/service.test.js       # waste collection route planning service & optimization tests (#755)
npx vitest run src/services/routePlanning/migrations.test.js    # route planning schema migration & rollback tests (#755)
npx vitest run tests/route-planning-security.test.js            # route planning anti-PII, injection & tamper tests (#755)
npx vitest run src/pages/RoutePlanningWorkspace.test.jsx        # route planning workspace UI & accessibility tests (#755)
```

Architecture, data model, vehicle capacity optimization, segregation audit seals, and privacy safeguards for municipal waste collection route planning are documented in [docs/route-planning-architecture.md](docs/route-planning-architecture.md) (#755).

Architecture, data model, state machines, CV discrepancy policy, and rollback strategy for public projects are documented in [docs/geospatial-public-projects.md](docs/geospatial-public-projects.md).

Architecture, data model, roles, triage boundaries, CSV format, migrations and operational limits for the tree inventory are documented in [docs/tree-health-inventory.md](docs/tree-health-inventory.md).
Water quality standards (IS 10500:2012), data models, cryptographic seals, and audit runbooks are documented in [docs/water-quality-register.md](docs/water-quality-register.md).
Architecture, data model, k-anonymity privacy safeguards, explainable recommendations, and test suites for the Anonymized Ward-Level Civic Issue Heatmap are documented in [docs/ANONYMIZED_WARD_ISSUE_HEATMAP.md](docs/ANONYMIZED_WARD_ISSUE_HEATMAP.md) (#763).

Relief operations (#747) — need intake, verification, deterministic forecasting,
transactional stock reservations, human approval, dispatch, delivery
confirmation, audit and public projections:
```bash
npx vitest run src/services/reliefOperationsService.test.js       # workflow, RBAC, transactions, duplicates, PII
npx vitest run src/services/reliefForecastEngine.test.js          # clustering, forecast, fallback, medical boundary
npx vitest run src/services/reliefOperationsMigrations.test.js    # empty DB, legacy data, rollback, retention
npx vitest run src/pages/ReliefOperationsWorkspace.test.jsx       # page and component/accessibility tests
npx vitest run tests/relief-operations-api.test.js                # public API validation, abuse and privacy
```

Architecture, data model, state machines, role/capability matrix, forecast
boundaries, threat model, retention, rollback and the manual acceptance script
are documented in [docs/RELIEF_OPERATIONS.md](docs/RELIEF_OPERATIONS.md).

Civic Micro-Volunteer Task Board (#759) — claim, submit evidence, human
moderation, reopen, deterministic explainable suggestions, retention and audit:
```bash
npx vitest run src/data/microVolunteerContract.test.js       # states, validation, deterministic matching
npx vitest run src/services/microVolunteerService.test.js    # lifecycle, claim races, RBAC, privacy, abuse
npx vitest run src/services/microVolunteerMigrations.test.js # empty/legacy migration, indexes, retention, rollback
npx vitest run src/pages/MicroVolunteerTaskBoard.test.jsx    # page roles, states and accessibility semantics
npx vitest run tests/micro-volunteer-api.test.js             # API auth, idempotency, injection, rate limits
```

Architecture, collections, state machines, role matrix, deterministic ruleset,
retention, migrations, rollback, environment variables, operational limits and
the manual fallback are documented in
[docs/micro-volunteer-task-board.md](docs/micro-volunteer-task-board.md).

## Security checks
Every PR runs a secret scan, a dependency audit and a lint for unsafe HTML/JS patterns. Locally:
```bash
npm run lint:security
node scripts/security/audit-report.mjs --omit-dev --level high
gitleaks dir . --config .gitleaks.toml --redact --no-banner   # needs gitleaks installed
```
Never commit real keys (frontend `VITE_` variables are public). What each check does, what to do when one fails, and how to handle false positives: [docs/SECURITY_CHECKS.md](docs/SECURITY_CHECKS.md).

## Code Style
- We use standard React conventions.
- Use functional components and hooks.
- Semantic HTML is required for accessibility.
- CSS is handled via Vanilla CSS in `index.css`. Please use existing CSS variables for colors, typography, and spacing.

## Public metadata contract changes

Run `npm run contracts:check -- --base <full-base-commit-sha>` when changing civic
schemas and `npm run contracts:validate -- <public-metadata.json>` to preflight a
producer batch. The PR quality workflow checks versioned registry changes against
its verified base commit. Keep ownership, compatibility and migration audit
records alongside the schema. See [Civic data quality contracts](docs/CIVIC_DATA_QUALITY_CONTRACTS.md)
for supported entities, the existing import integration, limits and rollback.
