# Service data contract (schema version 1)

The canonical shape of a service record, for components and future integrations.
Implemented in `src/data/serviceContract.js`, tested in `src/data/serviceContract.test.js`.

## Internal contract, not a public API

This is an **internal, read-only data contract**. The app has no backend that serves
service data, and nothing here is a deployed or public network API. Do not describe it
as one. The contract is enforced by importing `validateServiceRecord` /
`validateCatalogue` in code or tests. If a real HTTP API is added later it should
reuse this schema and bump the version if the shape changes.

## Fields

Required unless marked optional.

| Field | Type | Rule |
| --- | --- | --- |
| `id` | string | lowercase slug, unique in the catalogue |
| `name` | string | non-empty |
| `shortDescription` | string | non-empty |
| `category` | string | one of `SERVICE_CATEGORIES` |
| `department` | string | non-empty |
| `type` | string | delivery mode, e.g. `Online`, `Online / Offline` |
| `difficulty` | string | `Easy`, `Medium` or `Hard` |
| `feeType` | string | `free` or `paid` |
| `speedDays` | integer | 0 or more |
| `eligibility` | string[] | non-empty strings (the array may be empty) |
| `documents` | string[] | non-empty strings (the array may be empty) |
| `steps` | `{title, description}[]` | at least one |
| `fees` | string | human readable fee text |
| `processingTime` | string | human readable time text |
| `officialSources` | `{name, url}[]` | at least one; `url` must be https |
| `lastVerified` | string | real date, `YYYY-MM-DD` |
| `warnings` | string[] | optional, fallback `[]` |
| `popularityScore` | number | optional, 0 to 100 |
| `eligibilityRuleKey` | string | optional, key into `eligibilityRules.js` |
| `jurisdiction` | `{level, states, districts, localBody}` | optional, no fallback: a record without it is "unknown", never nationwide. Checked with the app's own `validateJurisdiction` (a `state` level needs a state, a `national` one lists none, and so on). A legacy plain string such as `India` is rejected |
| `publicationState` | string | optional: `draft`, `published`, `archived`; fallback `published` |
| `contacts` | `{label, phone?, email?, url?}[]` | optional, fallback `[]`; each needs a label and at least one way to reach it |

The current catalogue carries the structured `jurisdiction` on its built-in guides but not `publicationState` or
`contacts`; they are optional so existing records stay valid. Use
`applyServiceDefaults(record)` to read them safely.

## No personal data

Service records are public reference data. Fields such as `userId`, `email`, `phone`,
`aadhaarNumber`, `documentUrl` or `profile` are rejected (see `FORBIDDEN_FIELDS`).
Department contact details go in `contacts`, never a citizen's.

## Validation and errors

- `validateServiceRecord(record)` returns `[{ field, reason }]`; empty means valid.
- `validateCatalogue({ schemaVersion, services })` returns `{ valid, errors }` with
  `{ serviceId, field, reason }` per error and flags duplicate ids.
- `formatContractError(error)` gives a one-line message such as
  `birth-certificate: difficulty must be one of: Easy, Medium, Hard`.

An unsupported or missing `schemaVersion` fails before records are checked:
`schemaVersion unsupported schema version 2; supported versions: 1`.

## Examples

Valid (minimum):

```js
{
  id: 'voter-id', name: 'Voter ID', shortDescription: 'Electoral photo identity card.',
  category: 'Identity', department: 'Election Commission', type: 'Online',
  difficulty: 'Easy', feeType: 'free', speedDays: 30,
  eligibility: ['Indian citizen aged 18 or above'], documents: ['Proof of age'],
  steps: [{ title: 'Apply', description: 'Submit the form online.' }],
  fees: 'Free', processingTime: '30 days',
  officialSources: [{ name: 'ECI', url: 'https://eci.gov.in' }],
  lastVerified: '2024-01-15',
}
```

Invalid, with the error each produces:

| Change | Error |
| --- | --- |
| `difficulty: 'Impossible'` | `difficulty must be one of: Easy, Medium, Hard` |
| `lastVerified: '2024-02-30'` | `lastVerified must be a real date in YYYY-MM-DD format` |
| `officialSources[0].url: 'http://x'` | `officialSources[0].url must be an https URL` |
| `email` field added | `email personal or sensitive data is not allowed in a service record` |

## Versioning

`SERVICE_SCHEMA_VERSION` is currently `1`. Adding an optional field is backward
compatible and stays at 1 with this document updated. Renaming, removing or changing
the meaning of a field, or making an optional field required, needs a new version:
add it to `SUPPORTED_SCHEMA_VERSIONS`, keep validation for older versions as long as
they are supported, and note it in `CHANGELOG.md`.
