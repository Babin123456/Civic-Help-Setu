# Security Policy

Civic Help Setu helps citizens find and track public services. People may type names, phone numbers, document numbers and free-text complaints into it, so a security bug here can hurt real people. This page explains how to report one without putting anyone at risk, and how the maintainers handle reports.

The maintainers of this project are volunteers. **We do not promise any response or fix times.** We will answer when we can and keep you updated as we learn more.

## Supported versions

There are no tagged releases or versioned builds yet. Only the latest code on the `main` branch is supported, and fixes are made there. If you find a problem in an old fork or an old commit, please check whether it still exists on current `main` before reporting.

## Is it a security issue?

Report it **privately** (see below) if it could expose or change someone's data, or let someone do something they should not be allowed to do. For example:

- cross-site scripting (a script running because of text someone typed or pasted)
- reading or changing another person's records, or getting admin access without being an admin
- sign-in or session problems, or redirects after sign-in that can send people to another site
- links or QR codes that can send people to a look-alike site
- personal data (names, phone numbers, document numbers, location) leaving the device when it should not, or showing up in logs
- API keys, tokens or passwords committed to the repo or shipped in the built JavaScript
- a dependency vulnerability that you can show is actually reachable in this app

Open a **normal public issue** instead for anything that is not an exploitable weakness:

- a wrong fee, office address, document list or other civic information: use the "Incorrect Information" issue template
- a broken page, layout or translation: use the "Bug report" template
- a new feature or an idea: use the "Feature request" template
- general hardening ideas with no working attack (for example "we should add a security header"): a public issue is fine. Several of these are already tracked, search the issues for `[security]` first

If you are not sure which one it is, treat it as security and report it privately. We would rather sort it out than have it posted in public by accident.

## How to report a vulnerability

Please do not open a public issue, pull request or discussion with details of a vulnerability, and do not post it anywhere else public.

### Use GitHub private vulnerability reporting

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability** (direct link: <https://github.com/GoldRay19/Civic-Help-Setu/security/advisories/new>).
3. Fill in the form. Only you and the maintainers can see it.

This channel only works when the maintainers have switched on private vulnerability reporting for the repository (Settings, then Code security, then Private vulnerability reporting). If you do not see the **Report a vulnerability** button, it is not switched on yet.

### If the button is not there

Please do not put details in a public issue. As a stopgap:

1. Open a public issue with the title `[security] I would like to report an issue privately` and **no details at all**. No steps, no screenshots, no affected page.
2. A maintainer will reply there and arrange a private way to send the details.

There is no security email address for this project at the moment, so please do not guess one.

### What to include

- what the problem is and which page, component or file it is in
- the steps to reproduce it, with fake data only (see below)
- what an attacker could do with it, and who would be affected
- the commit or date of `main` you tested, and your browser
- how you think it could be fixed, if you have an idea (optional)
- whether you want to be credited when it is published, and under what name (optional)

### Do not include real citizen data

Please never put real personal data in a report, a screenshot, a recording or a file you attach. That means no real names, phone numbers, email addresses, Aadhaar, PAN, voter ID, licence or other document numbers, addresses, grievance texts or application reference numbers that belong to a real person.

Use made-up values, for example a name like `Test Citizen`, a phone number that is obviously fake, and a document number like `1111 2222 3333`. Crop or blur screenshots. If your proof of concept printed or stored real data by accident, remove it from the report and tell us in words what kind of data it was.

## Safe reproduction

Please test in a way that cannot harm real users.

- Run the app **on your own machine** (`npm install`, then `npm run dev`) and test there. Do not test against a live deployment that real citizens are using.
- Use your own test accounts. If you need sign-in, use your own Clerk development keys or the local demo mode. Do not use anyone else's account.
- The app keeps citizen records in the browser's `localStorage`. Use a fresh browser profile so your test data and your own real data do not mix.
- Stop as soon as you have shown the problem. Do not go on to read, copy, change or delete other people's data.
- If you come across real personal data while testing, do not save or share it. Close it, and tell us only the type of data and where you found it.
- No denial-of-service tests, no spamming of forms or reports, no phishing or social engineering of real people, no physical attacks.
- Please do not publish the problem before it is fixed or before we have agreed a date with you.

## How we triage reports

For each private report a maintainer does the following, in this order.

1. **Acknowledge.** Reply to the reporter and confirm it is being looked at. No promise about how long the rest takes.
2. **Check it.** Reproduce it locally with fake data. Ask the reporter for more detail if needed. If it cannot be reproduced, say so and explain.
3. **Sort it out.** Decide if it is a security issue or something else (a normal bug, wrong civic info, a feature request). If it is not security, tell the reporter and move it to a public issue with their agreement. Mark duplicates.
4. **Rate the severity** using the table below.
5. **Assign an owner** who is responsible for the fix, and write down who it is in the advisory.
6. **Plan the fix** in private (see the checklist). Public pull requests and issues must not describe the vulnerability until the fix is out.

### Severity guide

This is a guide for ordering work, not a score that has to be exact. When in doubt, pick the higher level.

| Severity | What it looks like here | Examples |
|---|---|---|
| Critical | Real citizen data exposed at scale, or full control of the app or accounts | A committed secret that gives access to user data or the Clerk account, a way to read other people's data, a way for anyone to become admin on a live deployment |
| High | One user can hurt another, or a serious step toward Critical | Stored or reflected XSS, a redirect that sends people to another site after sign-in, personal data sent to an unintended third party |
| Medium | Needs special conditions or limited impact | XSS that needs the victim to paste hostile text, a look-alike link that passes as an official one, personal data written to logs |
| Low | Small impact, hard to exploit, or hardening | Missing security header with no working attack, verbose error messages, a weakness only the user can use against themselves |

## Maintainer checklist

Use this for every confirmed vulnerability. Copy it into the private advisory and tick it off.

**Fix**
- [ ] Reproduced the issue and written down the cause
- [ ] Owner assigned and severity set
- [ ] Fix prepared in private (for example in the advisory's temporary private fork), not in a public branch or PR
- [ ] Checked the rest of the code for the same mistake
- [ ] If a secret was exposed, revoked or rotated it first, before anything else
- [ ] Reporter asked to confirm the fix, if they are willing

**Test**
- [ ] Added a regression test that fails before the fix and passes after it (where the code can be tested)
- [ ] `npm run build` and `npm test` pass, and `npm run lint` shows no new errors
- [ ] Tried the original steps again in the browser with fake data
- [ ] Looked at related paths (other pages or services that handle the same kind of data)

**Release**
- [ ] Fix merged to `main`
- [ ] Deployed, and checked on the live site that the fix is there
- [ ] Added a `CHANGELOG.md` entry that says what was fixed without explaining how to exploit it
- [ ] Told anyone running their own copy or fork to update, if relevant

**Disclosure**
- [ ] Published the GitHub security advisory (request a CVE if it applies), with credit to the reporter if they want it
- [ ] Agreed the publish date with the reporter
- [ ] Linked the fix commit or pull request in the advisory
- [ ] Closed the private report and wrote down what was learned: what let it happen, and what would catch it next time (a test, a lint rule, a doc change)

## If real citizen data may have been exposed

Treat this as an incident, not only a bug.

1. **Contain.** Roll back or take down the affected deployment, and revoke or rotate any exposed keys.
2. **Keep evidence.** Save logs and the report. Do not copy the exposed data anywhere else.
3. **Work out the scope.** Which data, whose, and for how long.
4. **Tell the right people.** Contact the owner of the deployment and the people affected. Ask whoever is responsible for the deployment whether any law or rule requires a report to an authority, because that depends on how and where it is run.
5. **Review afterwards.** Write down what happened and add the fix or check that would have prevented it.

## Credit

If you report a vulnerability responsibly and want to be named, we will credit you in the advisory. If you prefer not to be named, we will not name you.

## Dependency vulnerability audit

Dependency checks use **npm** (the project's package manager). The command is `npm audit`, which reads `package-lock.json` and reports known advisories from the npm registry.

### What runs

CI runs `npm audit` through `scripts/security/audit-report.mjs` (see `.github/workflows/security.yml`). Locally:

```bash
# what blocks on PRs: production dependencies only, fails on high or critical
node scripts/security/audit-report.mjs --omit-dev --level high

# everything including dev tooling, report only (warning, not blocking)
node scripts/security/audit-report.mjs --level high --warn-only

# plain npm output
npm audit
```

`npm audit` needs no `npm install`; it reads `package-lock.json` directly.

### Production vs. development dependencies

Findings are split by scope:

- **Production dependencies** (`dependencies` in `package.json`) ship to users. A high or critical finding here blocks the check and must be fixed before a release.
- **Development dependencies** (`devDependencies`) only affect tooling (Vite, ESLint, Vitest). They are reported but do not block, because they are not shipped to users. Fix them promptly, but they do not expose runtime users to the vulnerability.

To tell which scope a finding belongs to, check whether the package appears in `dependencies` or `devDependencies` in `package.json`, or follow the `via` chain in the audit output back to a direct dependency.

### Triage path for high / critical findings

1. **Do not run automatic breaking upgrades.** Never blindly run `npm install <pkg>@latest` or accept every `npm audit fix` suggestion. Major version bumps can introduce breaking changes; review them first.
2. **Review the advisory.** Open the advisory URL listed in the output (or `https://github.com/advisories/<GHSA-id>`) to understand impact, affected versions and the patched version.
3. **Check the fix path.** Run `npm audit fix` and inspect the `package-lock.json` diff. Accept minor/patch upgrades automatically; review major version bumps in their own PR and run `npm test` and `npm run build` afterwards.
4. **Apply the smallest safe fix.** Prefer the patched version within the same major line (`^x.y.z`) unless the advisory requires a major jump.
5. **Verify.** Re-run `npm audit`, `npm run lint`, `npm run build` and `npm test` to confirm nothing broke.
6. **Document.** Record the decision (upgrade / pin / accepted risk) in the pull request so maintainers can review it. If no fix is published yet, open an issue with the advisory link to track it and mention it in the PR. There is no ignore list on purpose, so an accepted risk stays visible.

If a finding does not apply to how this project uses the package, say why in the PR; maintainers decide whether to proceed.

### Audit output does not reveal credentials

`npm audit` emits only package metadata — names, versions, severity, advisory references and dependency paths. It does **not** emit registry URLs with embedded credentials, auth tokens, `.npmrc` contents, environment variables, or any other secrets. Before sharing audit output in an issue or PR, confirm you did not paste a `.npmrc` token or any auth value alongside it.

## Questions about this policy

For anything that is not a vulnerability, open a normal issue. If you think this policy is unclear or missing something, a pull request that improves this file is welcome.
