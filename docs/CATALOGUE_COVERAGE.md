# Catalogue coverage and missing-data dashboard

Admin > **Catalogue Coverage** shows which service records are missing which information, grouped by field and severity, so maintainers can decide what to fix first. It is catalogue quality reporting. It is not the import pipeline (`serviceImportService.js`, which validates files before they are added) and not the freshness indicator (`dataFreshnessTrustService.js`, which is about how old a review is).

The rules and numbers live in `src/services/catalogueCoverage.js`; the panel (`src/components/admin/CatalogueCoveragePanel.jsx`) only shows them.

## What is counted

The report reads each record as it is stored. **It never fills a gap with a default**: a record without `jurisdiction` is counted as missing the jurisdiction even though the public pages show "India" for it (the filters use the displayed value, and the list says "(default)" next to it). It never changes a record and only reads fields of the [service data contract](SERVICE_DATA_CONTRACT.md), so no citizen data can appear in it; the CSV export is built from the same fields.

`jurisdiction` can be plain text (`"Kerala"`) or the structured form `{ level, states, districts, localBody }` from the applicability metadata. Either counts as present; a blank value, an unknown `level` or any other type counts as missing. Filters and the list show it as a readable name such as "India (national)", "Kerala" or "Kochi, Kerala".

A field is **missing** when it is absent, `null`, blank or the wrong type, a list is empty, or (for the two fields below) the value is unusable:

- `officialSources`: at least one source needs a name **and** an `https` link, otherwise it is reported as "no source has a name and an https link".
- `lastVerified`: must be a real `YYYY-MM-DD` date, otherwise "not a real YYYY-MM-DD date".

## The rules

| Field | Label | Level | Severity | Blocks publication |
| --- | --- | --- | --- | --- |
| `shortDescription` | Short description | required | high | yes |
| `department` | Department | required | high | yes |
| `officialSources` | Official source | required | high | yes |
| `steps` | Application steps | required | high | yes |
| `documents` | Required documents | required | medium | yes |
| `eligibility` | Eligibility criteria | required | medium | yes |
| `fees` | Fees | required | medium | yes |
| `processingTime` | Processing time | required | medium | yes |
| `lastVerified` | Last-reviewed date | required | medium | yes |
| `jurisdiction` | Jurisdiction | optional | medium | no |
| `contacts` | Contacts | optional | low | no |
| `warnings` | Warnings / things to know | optional | low | no |
| `eligibilityRuleKey` | Eligibility rule key | optional | low | no |

- **Required** and **optional** fields are scored separately ("Required fields complete", "Optional fields complete").
- **Optional omissions never block publication** unless a maintainer ticks that field under "Treat these optional fields as publication blockers" (or passes it in `extraBlockers`).
- **Severity** is how much the gap matters to a citizen: high gaps leave the guide unusable or unverifiable, medium ones leave out something people need before applying, low ones are extras.

To add or change a rule, edit `COVERAGE_RULES` and this table in the same pull request (a test fails if they disagree).

## Filters, and how the numbers reconcile

- **Category, jurisdiction and publication state** choose which records are measured. Drafts and archived records are separate from public ones (a record with no state counts as published, and is marked "(default state)"). The summary cards and the field table are computed for exactly that group.
- **Missing field and severity** narrow the **list** to records that have such a gap.

So the numbers always match the list: with no gap filter, "Records to fix" equals "Records with gaps"; with a missing-field filter it equals that field's "Missing" count. Tests check this for every field.

## Using it

- **Edit record** opens the record in the admin editor; **View public page** opens the public page (public records only).
- **Refresh** reads the catalogue again. After you save a record in the editor the report updates by itself.
- **Download summary (CSV)** exports the totals, the field table and one line per record with gaps. Cells that start with `=`, `+`, `-` or `@` are prefixed so a spreadsheet does not run them as formulas.

## Tests

`src/services/catalogueCoverage.test.js` (rules, empty catalogue, partial records, malformed input, filter combinations and reconciliation, export) and `src/components/admin/CatalogueCoveragePanel.test.jsx` (what the panel shows).
