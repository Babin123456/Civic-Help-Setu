# Interactive Service Requirement Coverage Radar (#823)

## Feature Overview

The coverage radar provides administrators with an interactive, visual representation of service record completeness across the catalogue. It extends the existing catalogue coverage reporting with:

- **Per-service radar charts** showing 5 explicit states per field: `missing`, `draft`, `verified`, `stale`, `conflicting`
- **Sortable coverage matrix** across all services with color-coded state cells
- **Deterministic quality scores** computed from field-level checks (no AI hallucinations)
- **AI suggestion queue** for missing field text (human-approved, never auto-published)
- **Category, jurisdiction, and publication state filters**
- **Tabular alternative** for every chart and matrix (accessibility requirement)

## Primary User Flow

1. Administrator opens the **Catalogue Coverage Radar** workspace
2. Selects a **category**, **state**, or **service** using filter controls
3. System evaluates required fields against the configurable schema
4. Radar chart displays per-service state distribution; matrix shows cross-service coverage
5. Admin clicks a gap segment → system highlights affected records
6. Editor opens the relevant service record for editing
7. After saving, the chart recalculates and an **audit event** is recorded
8. User can **cancel**, **return**, or **resume** without losing confirmed non-sensitive inputs

## States and Meanings

Each field in a service record receives one of five states:

| State | Color | Meaning |
|-------|-------|---------|
| `missing` | `#ef4444` (red) | Field not present, empty, or invalid |
| `draft` | `#f59e0b` (amber) | Field present but marked as draft/pending review (contains placeholder text) |
| `verified` | `#22c55e` (green) | Field present and confirmed against official source |
| `stale` | `#eab308` (yellow) | Field present but `lastVerified` > 90 days ago |
| `conflicting` | `#a855f7` (purple) | Field present but sources disagree or contain vague phrasing |

## Quality Score Calculation

The deterministic quality score is computed as:

```
score = (Σ weight_i for fields i where state_i = 'verified') / (Σ weight_i for all rules) × 100
```

- Weights are configurable per rule (default: 1.0 for required, 0.5 for optional)
- Score ranges from 0–100
- Grade bands: Excellent (≥90), Good (≥75), Fair (≥60), Poor (<60)
- Score is **always** computed from deterministic field checks; AI suggestions never auto-publish

## AI Guardrails and Suggestions

- AI may suggest candidate text for missing descriptions using existing approved source documents
- Suggestions are placed in a **review queue** (`catalogueEnrichmentReviewService.js`)
- **Never auto-published**; requires explicit administrator approval
- Each suggestion carries **source references** and the **data version** used for generation
- Low-confidence or conflicting evidence routes to review instead of guessing
- AI output is labelled as "Suggestion" until confirmed by authorized reviewer

## Configurable Rules

Completeness rules, field weights, and verification timestamps are defined in `ENHANCED_COVERAGE_RULES` in `src/services/catalogueCoverage.enhanced.js`:

- `field`: the service record field name
- `label`: human-readable display name
- `level`: `'required'` (publication blocker) or `'optional'`
- `severity`: `'high'` / `'medium'` / `'low'`
- `state`: default state assessment logic (`missing`, `draft`, `verified`, `stale`, `conflicting`)
- `weight`: numeric weight for quality score computation
- `aiSuggest`: whether AI may generate text suggestions for this field
- `impactExplanation`: why this field matters for citizens

## Filters

Three filter controls narrow the measured set:

| Filter | Values | Effect |
|--------|--------|--------|
| **Category** | e.g. All, Certificates, Identity, Business, Health | Limits records to matching category |
| **Jurisdiction** | e.g. All, India, Tamil Nadu, Maharashtra | Limits records to matching jurisdiction |
| **Publication state** | All, published, draft, archived | Limits records to matching state; drafts/archived not publicly visible |

## Interface Components

### RadarChartWithTable

- SVG-based radial chart with 5 state segments per field
- Inner circle shows overall quality score
- Table alternative renders same data semantically
- Clicking a segment fires `onSegmentClick(field, state)` → opens service editor
- Keyboard-focusable with visible focus ring
- Respects `prefers-reduced-motion` media query
- Essential state information available without hover (via table or focus)

### CoverageMatrix

- Sortable table: rows = services, columns = fields
- Color-coded cells showing state (missing/draft/verified/stale/conflicting)
- Last column = overall quality score (%)
- Filter controls above matrix (category, jurisdiction, publication state)
- Summary statistics: total records, average score, complete count
- Column headers sortable with keyboard activation (Enter/Space)
- `role="grid"`/`role="gridcell"` for assistive technology
- Summary attribute describes table purpose

### CatalogueCoverageRadarPanel (main workspace)

- Header with quality grade badge
- Filter controls (category, jurisdiction, publication state)
- View mode tabs: **Matrix**, **Radar**, **Detailed**
- Per-service radar cards (grid layout)
- AI suggestions panel (pending proposals, approve/reject buttons)
- Action bar with tips and links
- Loading, empty, and error states

## States per Field

The radar chart shows the distribution of all 5 states across all fields for a service. The matrix shows per-cell state for each service-field combination.

### State Assessment Logic

- **missing**: value is `undefined`/`null`/empty string/empty array
- **draft**: value present but contains placeholder indicators (`TODO`, `placeholder`, `TBC`, etc.)
- **verified**: field present and well-formed (non-empty string, non-empty array, valid date, valid HTTPS URL)
- **stale**: `lastVerified` > 90 days old (for the `lastVerified` field)
- **conflicting**: multiple HTTPS+HTTP sources, or vague phrasing in description

## API Endpoints (server-side)

The feature exposes the following server-side endpoints (role-based access control applies):

| Endpoint | Method | Description | Auth |
|---|---|---|---|
| `GET /api/catalogue/coverage-radar` | GET | Return enhanced coverage analysis for filtered catalogue | admin |
| `POST /api/catalogue/coverage-radar/score` | POST | Compute quality score for a single service record | admin |
| `POST /api/catalogue/enrichment-proposals` | POST | Create AI suggestion in review queue | admin |
| `POST /api/catalogue/enrichment-proposals/:id/review` | POST | Approve/reject/review AI proposal | admin |
| `GET /api/catalogue/coverage-radar/rules` | GET | Return configurable coverage rules schema | admin |
| `PUT /api/catalogue/coverage-rules` | PUT | Update coverage rules (add/remove/modify) | super-admin |

**Request/Response schemas** follow the existing patterns in `src/services/`: payloads validated on both client and server, structured error responses on failure.

**Pagination/aggregation**: For large catalogues, the endpoint supports `?page=&per_page=&category=&jurisdiction=&publicationState=` query parameters. Never loads the entire catalogue into a single bundle.

## Security, Privacy, and Accessibility

### Data Protection

- **No citizen data** appears in coverage reports (only service metadata: name, category, jurisdiction, scores)
- **Aadhaar numbers, passwords, OTPs, uploaded document contents** never appear in logs or reports
- Role-based authorization on all administrative endpoints
- Audit-sensitive changes logged with service ID, admin ID, timestamp, and outcome

### Accessibility

- **Keyboard navigation** throughout: Tab/Shift+Tab, Enter/Space activation, Escape to clear selection
- **Visible focus rings** on all interactive elements (SVG paths, table cells, buttons)
- **Semantic HTML**: `<table>`, `<th scope="col">`, `<button>`, `<select>`, `<svg aria-label>`
- **ARIA labels** on chart SVG, table summary, focusable elements
- **Reduced-motion support**: `prefers-reduced-motion` disables transitions/animations
- **Contrast ratio** ≥ 4.5:1 for state colors against background
- **Essential information** (state, field name, score) available without hover
- **Table alternative** for every chart/graph as accessibility fallback

### Error States

| State | Description | UI Treatment |
|---|---|---|
| **Loading** | Catalogue data being fetched | Spinner + "Loading coverage data..." message |
| **Empty** | No records match filters | "No services match the current filters. Try adjusting category/jurisdiction." |
| **Error** | Failed to load data | Inline error box with dismiss action, shows error message |
| **Stale data** | Data older than refresh threshold | Yellow warning banner + "Some data may be stale. Last refreshed: ..." |
| **Permission denied** | User lacks admin role | "You do not have permission to access the coverage radar workspace."

## Tests

### Unit Tests (`src/services/catalogueCoverage.enhanced.test.js`)

- `ENHANCED_COVERAGE_RULES` structure and weight validation
- `computeFieldState()` for all 5 states and edge cases
- `classifyFieldState()` vague/conflict/stale detection
- `computeQualityScore()` determinism and weight accounting
- `analyzeEnhancedCoverage()` aggregation, empty catalogue, filtering
- `suggestFieldAI()` proposal creation and queue integration

### Component Tests (`src/components/admin/RadarChart.test.jsx`)

- SVG radar chart renders correctly
- Table alternative present and semantic
- Score display, state colors, labels
- Keyboard focus, aria-labels, summary attributes
- Missing data handling, showLabels toggle

### Component Tests (`src/components/admin/CoverageMatrix.test.jsx`)

- Table renders with services and fields
- Category/jurisdiction/publication state filters
- Empty services handling, malformed records
- State cell colors, score column
- Keyboard-navigable rows (tabindex)
- Sortable column headers
- Summary statistics display

### API Integration Tests

- Authorization on administrative endpoints
- Malformed input validation (missing required fields, invalid JSON)
- Empty results handling (no records match filters)
- Pagination with large datasets
- AI proposal creation, approval, rejection flow

Run: `vitest run src/services/catalogueCoverage.enhanced.test.js src/components/admin/RadarChart.test.jsx src/components/admin/CoverageMatrix.test.jsx`

## Setup and Environment

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8080` | Base URL for API calls |
| `VITE_ENABLE_AI_SUGGESTIONS` | `true` | Feature flag for AI suggestions |
| `VITE_COVERAGE_RULES_WEIGHTS` | (JSON string) | Override default rule weights |

### Data Assumptions

- Service records follow the `serviceContract.js` schema (v1)
- Records have `id`, `name`, `category`, `shortDescription`, `department`, `officialSources`, `steps`, `fees`, `processingTime`, `lastVerified`, `jurisdiction`, `publicationState`
- `lastVerified` is stored as `YYYY-MM-DD` string or `null`
- `officialSources` is an array of `{ name, url, verified?, lastVerified? }`
- Category values match `SERVICE_CATEGORIES` from `serviceCategories.js`

### Manual Verification Steps

1. Open the Catalogue Coverage Radar workspace as an admin
2. Select a category (e.g., "Certificates") and verify records update
3. Select a service and verify the radar chart shows correct state distribution
4. Click a state segment and verify the affected records filter in the matrix
5. Add an AI suggestion via the panel and verify it enters the review queue (pending status)
6. Approve the AI suggestion and verify it can be applied to the service record
7. Toggle filters and verify numbers reconciling with the record list
8. Test on mobile: radar chart should gracefully scale, table remains readable
9. Test reduced-motion preference: no spurious animations
10. Verify CSV export includes enhanced state counts (missing/draft/verified/stale/conflicting)

### Sample Synthetic Data for Review

```json
[
  {
    "id": "srv-001",
    "name": "Test Service One",
    "category": "Certificates",
    "shortDescription": "A test service description",
    "department": "Test Department",
    "officialSources": [{ "name": "Official", "url": "https://example.gov.in" }],
    "steps": [{ "title": "Step 1", "description": "Do the thing" }],
    "fees": "Free",
    "processingTime": "7 days",
    "lastVerified": "2026-11-18",
    "jurisdiction": { "level": "national", "states": [], "districts": [], "localBody": "" },
    "publicationState": "published"
  },
  {
    "id": "srv-002",
    "name": "Test Service Two",
    "category": "Identity",
    "department": "Test Department",
    // shortDescription, officialSources, steps intentionally missing
    "fees": "Free",
    "processingTime": "7 days",
    "lastVerified": "2025-01-01",
    "jurisdiction": { "level": "national", "states": [], "districts": [], "localBody": "" },
    "publicationState": "draft"
  }
]
```

## Links to Official Authorities

- **Quality score computation**: deterministic code, no AI hallucinations
- **AI suggestions**: labelled "Suggestion" until admin approval, never auto-published
- **Coverage rules**: defined in `src/services/catalogueCoverage.enhanced.js`, editable via admin workspace
- **Data version**: each analysis run includes the catalogue version hash for reproducibility

---

*This feature implements acceptance criteria from issue #823: admins can drill from aggregate score to exact missing fields, score calculations are documented and deterministic, AI drafts require human approval, the chart has a tabular alternative, and tests cover scoring, filters, and role restrictions.*