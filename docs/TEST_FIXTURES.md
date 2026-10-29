# Synthetic service fixtures for tests

`src/test/fixtures/serviceFixtures.js` generates **fictional** service records for automated tests, demos and local development. Use it instead of hand-writing records or relying on the real catalogue.

- **Deterministic.** The same seed, scenario name and index always give the same record, so a test can ask for a named scenario and get the same data on every run. The default seed is `DEFAULT_SEED`.
- **Fictional.** Names ("Sample Garden Permit"), departments ("Department of Sample Affairs"), phone numbers (`000-000-0000`) and links (the reserved `example.org`) are invented. Ids start with `sample-`. There is no citizen data and no credential. `isSyntheticRecord(record)` checks this and the tests run it over every scenario.
- **Never written anywhere by default.** The functions only return objects. `writeFixtureCatalogue(storage, catalogue)` needs a storage you pass in, writes to its own key (`civicbridge_TEST_fixture_services`), refuses the key the real catalogue uses, and refuses records that do not look synthetic.
- **Not part of the app.** Nothing under `src/` outside `src/test/` imports it (a test checks this).

## Using it

```js
import { getScenario, buildCatalogue, listScenarios } from '../test/fixtures/serviceFixtures.js';

const archived = getScenario('archived');                          // one record
const other = getScenario('state-specific', { seed: 7, index: 2 }); // another, still repeatable
const { schemaVersion, services } = buildCatalogue({ seed: 3, count: 20 });                // a mix of every valid scenario
const withBad = buildCatalogue({ count: 5, scenarios: ['complete', 'draft'], includeInvalid: true });
```

Each call returns new objects, so a test may change what it gets. `listScenarios()` returns each scenario's name, description, whether it is valid, and (for invalid ones) the contract error fields it must produce.

## Scenarios

Valid means the record satisfies the [service data contract](SERVICE_DATA_CONTRACT.md). An invalid scenario fails it on exactly the listed fields.

| Name | Valid? | What it is | Contract errors |
| --- | --- | --- | --- |
| `complete` | valid | Every required and optional field present. |  |
| `minimal` | valid | Only the required fields; every optional field absent. |  |
| `draft` | valid | A draft record that is not public yet. |  |
| `archived` | valid | A retired record. |  |
| `state-specific` | valid | Applies to one state only. |  |
| `district-specific` | valid | Applies to one district. |  |
| `local-body-specific` | valid | Applies to one local body. |  |
| `conditional-eligibility` | valid | Documents and criteria that depend on the applicant. |  |
| `free-and-instant` | valid | Zero fee and zero processing days (the edge of the number ranges). |  |
| `long-text` | valid | Long names, descriptions and many steps, for layout tests. |  |
| `no-documents` | valid | An empty documents list (allowed by the contract). |  |
| `no-eligibility` | valid | An empty eligibility list (allowed by the contract). |  |
| `invalid-missing-id` | invalid | No id. | `id` |
| `invalid-id-format` | invalid | An id that is not a lower-case slug. | `id` |
| `invalid-category` | invalid | A category that is not in the list. | `category` |
| `invalid-missing-department` | invalid | No department. | `department` |
| `invalid-fee-type` | invalid | A fee type that does not exist. | `feeType` |
| `invalid-negative-speed` | invalid | Negative processing days. | `speedDays` |
| `invalid-http-source` | invalid | An official source that is not https. | `officialSources[0].url` |
| `invalid-no-sources` | invalid | An empty list of official sources. | `officialSources` |
| `invalid-date` | invalid | A date that does not exist. | `lastVerified` |
| `invalid-no-steps` | invalid | No steps. | `steps` |
| `invalid-step-shape` | invalid | A step without a description. | `steps[0]` |
| `invalid-publication-state` | invalid | A publication state that does not exist. | `publicationState` |
| `invalid-jurisdiction-level` | invalid | A jurisdiction level that does not exist. | `jurisdiction` |
| `legacy-text-jurisdiction` | invalid | Jurisdiction in the retired plain-text form. | `jurisdiction` |
| `invalid-contact` | invalid | A contact with no way to reach it. | `contacts[0]` |
| `invalid-personal-data` | invalid | A record that wrongly carries personal data (fictional values). | `email`, `phone` |
| `invalid-wrong-types` | invalid | Fields with the wrong types. | `name`, `documents`, `fees` |

## Adding a scenario

1. Add one `registerScenario(name, { description, valid, expectedErrors, build })` call to `serviceFixtures.js`, next to the others of its kind.
   - `name`: lower-case words joined with `-`; invalid ones start with `invalid-`.
   - `build(rng, index)` returns a record. Start from `baseService(rng, index)` and change only what the scenario is about; take every random choice from `rng` (`rng.pick`, `rng.int`, `rng.chance`), never from `Math.random()` or the clock, or the fixture stops being repeatable.
   - Use only fictional values: `example.org` links, `000` numbers, `sample-` ids.
   - For an invalid scenario, list in `expectedErrors` the `field` of every contract error it produces (run `validateServiceRecord` on it to see them).
2. Add a row to the table above. A test fails if the table and the registered scenarios disagree.
3. Run `npx vitest run src/test/fixtures`. The tests check, for your scenario: it is deterministic, it satisfies (or fails exactly as declared) the contract, it contains no real-looking personal data, and its links are on reserved domains.

If the service contract gains a field or a rule, add or update scenarios so each new edge case has one.
