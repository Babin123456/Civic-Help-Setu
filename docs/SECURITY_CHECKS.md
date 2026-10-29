# Security checks in CI

The workflow `.github/workflows/security.yml` runs on every pull request to `main`, on every push to `main`, once a week (Monday 03:30 UTC) and on demand (Actions tab, "Run workflow"). The weekly run is there because new advisories appear without any code change. It has three jobs. Each one can be run on your own machine with the commands below.

| Job | Tool | Fails the check when |
|---|---|---|
| Secret scan | gitleaks 8.30.1 | a commit in the PR (or the push) contains something that looks like a credential |
| Dependency audit | `npm audit` through `scripts/security/audit-report.mjs` | a production dependency has a high or critical advisory. Dev-only findings are reported as a warning |
| Unsafe DOM/HTML patterns | ESLint, `eslint.security.config.js` | code uses `dangerouslySetInnerHTML`, assigns `innerHTML`/`outerHTML`, calls `insertAdjacentHTML`, `createContextualFragment` or `document.write`, or uses `eval`, `new Function`, string `setTimeout`, `javascript:` URLs |

The workflow only has `contents: read`. Third-party actions are pinned to a full commit SHA, and gitleaks is downloaded from its release page and checked against a SHA-256 before it runs.

## 1. Secrets

What runs: `gitleaks git --redact --verbose --config .gitleaks.toml --log-opts=<range>`. For a pull request the range is base..head, for a push it is before..after, for the weekly run and manual runs it is the whole history.

Secret values are not printed. `--redact` masks the matched value in the console output, so the log shows the file, line, rule and commit but not the secret. Please do not paste the value into the PR or an issue either.

**If it fails because of a real secret:**
1. Treat it as leaked, even if the PR is not merged. Git history and the PR's commits keep it.
2. Revoke or rotate it at the provider first (Clerk dashboard, OpenAI dashboard, and so on).
3. Remove it from the code and read it from an environment variable instead. Frontend variables starting with `VITE_` are bundled into the public JavaScript, so a real private key must never go in one. Anything secret belongs on a server.
4. Rewrite your branch so the secret is not in any of its commits (for example `git rebase -i`, or recreate the branch from `main` and re-apply your change), then force-push the branch. Just adding a "remove the key" commit on top does not pass, because the earlier commit is still in the range that is scanned.
5. If the secret already reached `main`, tell the maintainers privately (see `SECURITY.md`) so the history can be handled. Do not open a public issue with the value in it.

**Run it locally** (install from https://github.com/gitleaks/gitleaks/releases, or `brew install gitleaks`):

```bash
# commits on your branch that are not on main
gitleaks git . --config .gitleaks.toml --redact --no-banner --verbose --log-opts="origin/main..HEAD"

# files you have not committed yet
gitleaks dir . --config .gitleaks.toml --redact --no-banner --verbose
```

Exit code 1 means a finding, 0 means clean. Before you commit, a quick `gitleaks dir` is the easy way to be sure.

**False positives** (a test fixture, a placeholder, an example in docs):
- First ask whether it can be changed so it does not look like a key (`your_key_here` style placeholders are fine).
- Otherwise add a narrow entry to the `[allowlist]` block in `.gitleaks.toml`, either one `paths` entry or one `regexes` entry, with a comment saying why it is safe. Do not allowlist a whole directory.
- A single known finding can instead go in a `.gitleaksignore` file at the repo root, one fingerprint per line. The fingerprint is printed with the finding (`Fingerprint: commit:file:rule:line`). Add a comment line above it saying why.
- Allowlist changes are reviewed like any other change, so say in the PR what the value is and why it is not a secret.

The config also adds a rule for Clerk secret keys (`sk_live_...` / `sk_test_...`). The publishable key (`pk_...`) is public by design and is not flagged.

## 2. Dependencies

What runs: `node scripts/security/audit-report.mjs`, a small wrapper over `npm audit --json`. For each finding it prints the severity, the package, whether it is a direct or transitive dependency, the advisory title and link, and a fix hint (`npm audit fix`, or the version to upgrade to and whether that is a major bump).

Two steps run:
- **Production dependencies** (`--omit-dev --level high`): fails the check on high or critical.
- **All dependencies including dev tooling** (`--level high --warn-only`): prints the same report and leaves a warning annotation, but does not fail. Tooling like Vite and ESLint is not shipped to users, and failing every unrelated PR because of a dev-server advisory would just teach people to ignore the check. It is still visible in the job log and the run summary, and the weekly run keeps surfacing it.

When this check was added, `npm audit` showed 4 high findings (`vite`, `zod`, `brace-expansion`, `source-map-js`), all in dev-only dependencies and all with a fix available through `npm audit fix`. Production dependencies had none, so the blocking step passes on `main`.

**Run it locally:**

```bash
node scripts/security/audit-report.mjs --omit-dev --level high   # what blocks
node scripts/security/audit-report.mjs --level high --warn-only  # everything, report only
npm audit                                                       # plain npm output
```

**If it fails:** run `npm audit fix` and commit the `package-lock.json` change. If the hint says a major upgrade is needed, upgrade that package in its own PR and run `npm test` and `npm run build`. If there is no fix yet, open an issue with the advisory link so it is tracked, and mention it in the PR. If the advisory does not apply to how this project uses the package, say why in the PR; the maintainers decide whether to proceed. There is no ignore list on purpose, so an accepted risk stays visible.

If the step fails with "npm audit did not return JSON", the registry was unreachable; re-run the job.

## 3. Unsafe DOM/HTML patterns

What runs: `npm run lint:security`, which is `eslint -c eslint.security.config.js --max-warnings 0 src`.

This is a separate config from the normal `eslint.config.js` and turns on only the rules below, so it stays quiet about the unrelated findings in `npm run lint` (unused variables, hook rules) and a failure always means an unsafe pattern. Test files are skipped.

| Pattern | Rule |
|---|---|
| `dangerouslySetInnerHTML` | `no-restricted-syntax` |
| `el.innerHTML = ...`, `el.outerHTML = ...` (also `+=`) | `no-restricted-syntax` |
| `insertAdjacentHTML`, `createContextualFragment` | `no-restricted-syntax` |
| `document.write`, `document.writeln`, `win.document.write` | `no-restricted-syntax` |
| `eval()` | `no-eval` |
| `new Function(...)` | `no-new-func` |
| `setTimeout("code")`, `setInterval("code")` | `no-implied-eval` |
| `javascript:` URL strings | `no-script-url` |

Existing findings: three print-window helpers already use `document.write` on `main` (`FormTemplatePreview.jsx`, `RtiPreviewLetter.jsx`, `AppellateEscalationModal.jsx`). They are listed in `DOCUMENT_WRITE_LEGACY` at the top of `eslint.security.config.js`, so only `document.write` is allowed in those three files. Everything else (including `innerHTML` in those same files, and `document.write` anywhere else) is checked, so the check fails only on new violations. Do not add to that list. Remove a file from it when it stops using `document.write`.

**Run it locally:**

```bash
npm run lint:security
```

**What it does not catch:** this is pattern matching on the syntax. It does not follow data, so it cannot tell whether a value is user input, it will not see `el["inner" + "HTML"]`, a `javascript:` URL that is built at runtime, or an unsafe `href={userValue}`. Treat it as a guard against the common mistakes, not as a full XSS scanner.

**False positives and exceptions:**
- Prefer changing the code: render text as a React child, or set `textContent`.
- If an exception is really needed (for example HTML that is already sanitized), use an inline disable on that one line **with a reason**:

  ```js
  // eslint-disable-next-line no-restricted-syntax -- content comes from sanitizeHtml(), see src/utils/sanitize.js
  el.innerHTML = clean
  ```

  A disable without a reason after `--` will be asked about in review. Do not use a file-wide `/* eslint-disable */` for these rules.
- Do not edit `eslint.security.config.js` to switch a rule off for a file without maintainer approval.

## Limits

- These are three common checks, not a full security review. They do not look at server code (there is none in this repo), HTTP headers, or runtime behaviour.
- The workflow could only be checked statically (`actionlint`) and by running each command locally. Its first real run will be on GitHub.

## When a page crashes

Page routes are wrapped in `RouteErrorBoundary` (`src/components/common/RouteErrorBoundary.jsx`, used in `App.jsx`). If a page throws while rendering, only that page is replaced by a short message with **Try again** and **Go to home**; the navigation bar, footer and accessibility toolbar stay usable, and moving to another page clears the error. If a page file cannot be downloaded (offline, or a new deployment), the button becomes **Reload page**. `RouteErrorFallback` remains the router's last-resort screen for anything outside a page.

Rules for this screen:

- It never shows the error, its message or its stack. The boundary does not even keep them in state. In development the error is written to the browser console; production logs nothing.
- Do not add a "details" section or `error.message` to it. If production diagnostics are needed later, send them to a reporting service, not to the page.
## Search and filter parameters

Values in the address bar (`/services?q=...&sort=...`, `/track?id=...`, `/nearby?service=...`, `/assistant?q=...`) can be typed or shared by anyone, so they go through `src/utils/searchParams.js` before the page uses them:

- **Search text** (`q`): control and hidden direction characters are replaced, whitespace is collapsed, and it is cut to 100 characters (500 for the assistant). The search box also has `maxLength`. It is only ever rendered as a React child, never as HTML.
- **Filters and sort** (`cat`, `dept`, `mode`, `diff`, `fee`, `speed`, `sort`): matched case-insensitively against a fixed list (categories and departments come from the catalogue). Anything else, including repeated or empty values, falls back to the default ("All" / "relevance") and the page keeps working.
- **Ids**: `service` must look like a slug (letters, digits, `.`, `-`, `_`, up to 64 characters). The tracking reference is cleaned and cut to 64 characters but not otherwise restricted, because references typed by hand have no fixed format.

When you add a new filter or sort option, add it to `FILTER_OPTIONS` or `SORT_KEYS` in that file, or the page will treat it as unknown.
## Redirect destinations after sign in

Every login, sign-up and SSO return path goes through `sanitizeRedirectPath` in `src/utils/authRedirect.js`. Do not read `redirect_url`, `sign_in_force_redirect_url` or router state and pass it to `navigate` or Clerk directly.

It accepts an in-app path (`/saved?folder=x`) or a full URL on this site's own origin. It returns `null` (callers fall back to `/`) for:

- other origins, including look-alike hosts, other ports, `http://` downgrades and URLs with credentials (`https://app.example@evil.example`)
- `//host`, `///host`, `/\host`, and the same with a tab, newline or other control character inside (browsers delete those, so `/<TAB>/evil.example` becomes `//evil.example`)
- percent-encoded leading separators (`/%2Fevil.example`, `/%5C…`, double encoding) and malformed escapes
- `javascript:`, `data:`, `vbscript:` and every other scheme, in any case or encoding
- the sign-in pages themselves (loop), and anything over 2048 characters

To trust another origin, add the full origin (`https://apply.example.org`) to `APPROVED_REDIRECT_ORIGINS` and say why in the pull request. The list is empty today.
