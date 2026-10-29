# Eligibility rule test bench

Before a maintainer changes an eligibility criterion, the test bench runs fictional applicant cases through the
**live** rules and shows which cases now give a different answer, and which requirement is behind it. It is the
Admin tab **Eligibility Test Bench**.

It never evaluates a rule itself. It calls the same code the citizen flows use, so a case cannot drift from the app.

## What can be tested

| Kind | Evaluator | Used by | Statuses |
|---|---|---|---|
| `scheme` | `evaluateAllSchemes()` then `applyCriteria()` | Universal eligibility wizard | eligible, conditional, ineligible, unknown |
| `service` | `ELIGIBILITY_RULES[id].evaluate(answers)` | Service eligibility wizard | eligible, conditional, ineligible |

Schemes: `pm-kisan`, `ration-card`, `scholarship-post-matric`, `driving-license`, `udyam-registration`, `passport`.
Services: `birth-certificate`, `driving-license`, `aadhaar-card`, `pan-card`.

## A case

```js
{
  id: 'farmer-with-land',            // lower-case slug, unique
  name: 'Farmer with land',          // at most 80 characters
  subject: { kind: 'scheme', id: 'pm-kisan' },
  input: { age: 40, annualIncome: 200000, employment: 'farmer', ownsAgriculturalLand: true },
  expected: 'eligible',
  expectedCriteria: { landholding: 'satisfied' },   // optional, scheme cases only
  note: 'optional, at most 300 characters',
  synthetic: true                    // required
}
```

- A blank number (`''`) or a missing field means **not answered**, which is different from zero.
- `expectedCriteria` pins single requirements (`satisfied`, `missing`, `unknown`, `confirm`). Other criteria are not checked.
- **Cases are fictional.** A case with a personal field (name, Aadhaar number, mobile, date of birth, ...) is refused, and
  `input` accepts only the wizard's own fields.

## Reading a result

| Result | Meaning |
|---|---|
| Passes | The rule gives the expected status (and pinned criteria). |
| Different result | The status or a pinned criterion changed. The panel lists the requirements that are not satisfied and up to five single-answer changes that would restore the expected status. |
| Could not run | The case is invalid or the evaluator threw. This never stops the other cases. |

A rule with no case is **valid**, just reported as "Not regression-tested" in the coverage list.

## Cases

- **Shipped cases** live in `src/data/eligibilityTestCases.js`. A test (`eligibilityTestBench.test.js`) runs all of them against the
  current rules, so a rule change that alters one fails CI. If the change is intended, update the expected value in the same pull request.
- **Your cases** are saved in the browser under `civicbridge_eligibility_test_cases_v1` (at most 50 per rule). They are admin data,
  kept when a citizen clears their data (see `DATA_RETENTION.md`). Shipped cases cannot be edited or deleted in the panel.

## Adding a shipped case

1. Add it to `SHIPPED_CASES` with the `scheme()` or `service()` helper.
2. Run `npx vitest run src/services/eligibilityTestBench.test.js`.
3. Only fictional answers. No real names, numbers or dates of birth.
