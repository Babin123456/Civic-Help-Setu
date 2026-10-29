# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Admin catalogue coverage and missing-data dashboard: required and optional fields scored separately, filters, links to the affected records and a CSV summary (issue #264). See `docs/CATALOGUE_COVERAGE.md`.
- Admin eligibility-rule test bench (issue #259): run fictional applicant cases through the live scheme and service eligibility rules, see which requirement changed a result, and spot rules that have no regression case. See `docs/ELIGIBILITY_TEST_BENCH.md`.
- Deterministic synthetic service fixtures for tests, demos and development: named scenarios (complete, partial, draft, archived, region-specific, conditional and invalid records) generated from a seed, with no real data and no writes to production storage (issue #273). See `docs/TEST_FIXTURES.md`.
- Firestore and Cloud Storage security rules, deny by default, with a documented access policy and emulator tests for anonymous, citizen and admin access (issue #220). See `docs/FIREBASE_RULES.md`; run `npm run rules:test`.
- Security headers and a report-only Content Security Policy (issue #219), generated from `scripts/securityHeaders.js` into `vercel.json`. See `docs/SECURITY_HEADERS.md`.
- Initial setup of CivicBridge MVP.
- React/Vite project structure.
- Routing and basic page skeletons.
- AI Assistant mock integration.
- Service directory mock data.
