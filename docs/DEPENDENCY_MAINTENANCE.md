# Dependency maintenance

Dependabot checks the root npm manifest and GitHub Actions workflows weekly. It groups patch releases within each ecosystem. Minor and major releases remain separate so reviewers can assess behavior changes without unrelated updates in the same pull request. The repository's Dependabot security-update setting is managed separately; this configuration groups version updates only.

For each update pull request, a maintainer should:

1. Read the release notes and inspect the dependency and lockfile diff. Confirm the package comes from the expected publisher and that any new permissions or scripts are understood.
2. Run `npm ci`, `npm run lint`, `npm test`, `npm run build`, and the checks in [SECURITY_CHECKS.md](SECURITY_CHECKS.md). The pull request quality workflow should report the same lint, test, and build results before merge.
3. Review major framework or build-tool updates individually. If an update is incompatible, document the failing check on its pull request, hold or close that update, and open a focused follow-up; do not weaken the gate to merge it.
4. Require normal code review and branch protection. Do not enable auto-merge for updater pull requests or bypass required checks.

If a merged dependency causes a regression, revert that merge, verify the lockfile is restored, and rerun the full quality and security checks before deploying again. Record the affected version and the reason for the revert on the update pull request.
