# Abuse Control Plane — Evaluation Report (#1174)

## 1. Evaluation criteria

| Criterion | Target | Measured by |
|-----------|--------|-------------|
| Legitimate low-bandwidth users unaffected | 0% increase in errors for users under quota | Unit tests + synthetic load |
| Abusive scraper blocked | 429 with Retry-After after limit exceeded | Unit tests |
| NAT shared address not false-positive blocked | Per-user limit applies; address limit skipped when NAT-shared | Unit tests |
| Privacy: no raw address stored | Only HMAC-SHA256 hashes in store | Code review + tests |
| Appeal creates + resolves | pending → approved/rejected with human review | Integration tests |
| Invalid input rejected | 400 with stable error codes | Schema validation tests |
| Concurrent requests handled | Single-flight not needed; each request counted independently | Concurrency tests |

## 2. Reproducible commands

```bash
# Install dependencies
npm install --no-audit --no-fund

# Lint all code
npm run lint

# Run control plane tests
npx vitest run api/_lib/abuseControlPlane.test.js tests/abuse-control-plane.test.js src/components/abuse-control-plane/AbuseDashboard.test.jsx

# Run all tests (note: pre-existing failures in unrelated files)
npx vitest run
```

## 3. Test coverage summary

| Test file | Tests | Passing |
|-----------|-------|---------|
| `api/_lib/abuseControlPlane.test.js` | 25 | 25 |
| `tests/abuse-control-plane.test.js` | 18 | 18 |
| `src/components/abuse-control-plane/AbuseDashboard.test.jsx` | 4 | 4 |

### Test categories covered

- **Unit:** window counter, signal detector, privacy identifier, default config.
- **Per-route quotas:** limit enforcement, per-address counting, default fallback.
- **NAT protection:** per-user limit independent of shared address, NAT-shared detection.
- **Blocklist/allowlist:** hard block, bypass limits.
- **Error signals:** error_burst recorded for 4xx responses, not for 2xx.
- **Appeals:** create, read, update, missing appeal.
- **Adaptive throttling:** signal-driven limit reduction.
- **Integration (HTTP):** schema endpoint, 405, operator auth, quotas, signals,
  appeals (create/read/update), blocklist, allowlist, bearer token extraction.

## 4. Negative / permission / retry / concurrency cases

- **Negative:** invalid quota config → 400 `validation_failed`; invalid appeal
  input → 400; missing bucket → 400; invalid appeal ID → 400.
- **Permission:** operator endpoints without Clerk session → 403; appeal
  creation without session → 401; invalid session → 401.
- **Retry:** 429 includes `Retry-After` header and `retryAfterSeconds` body
  field (minimum 1 second).
- **Concurrency:** each request is counted independently; concurrent requests
  from the same address each consume a quota slot.

## 5. Dependencies, licences, and cost

- **Runtime dependencies:** none beyond existing (`firebase-admin`, `@clerk/backend`, `node:crypto`).
- **Dev dependencies:** vitest, eslint (existing).
- **Licences:** MIT (project LICENSE).
- **Cost:** Firestore reads/writes for signal and appeal records; bounded by
  retention (24h) and page limits (max 100 appeals per page).
- **Performance:** per-instance in-memory counters; no cross-instance
  coordination unless Firestore store is used.

## 6. Safety

- Synthetic fixtures only (`tests/fixtures/abuseSyntheticFixtures.js`): hashed
  identifiers, made-up routes, fabricated signals. No citizen records,
  credentials, raw documents, or sensitive prompts.
- Logs and analytics: no PII, no raw addresses, no credentials.
- AI: not used in this control plane; all rules are deterministic.
