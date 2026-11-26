# Architecture Decision Record: Multi-Agent Office Visit Preparation and Follow-Up Coach

## Date: 2026-11-24
## Author: Civic Help Setu Engineering
## Status: Proposed
## Issue: #1166

## 1. Context
The Civic Help Setu platform already provides appointment readiness, visit packing checklists, and physical visit dossier services (`officeAppointmentReadinessService`, `physicalVisitDossierService`, `appointmentVisitPackService`, `makeChecklistService`). However, there is no consolidated "coach" experience that:
- Prepares citizens for complex multi-step in-person service journeys
- Captures post-visit outcomes
- Tracks unresolved steps across multiple service interactions
- Provides question prompts and printable checklists
- Integrates with existing services without implying automatic appointment booking

## 2. Decision: Vertical slice implementation of a Multi-Agent Coach

### 2.1 Architecture Style
- **Modular agent-based design**: Three distinct agents within a single coach service:
  - **Planning Agent**: Generates personalized preparation plans based on service, office, and citizen context
  - **Checklist Agent**: Creates and manages printable, ink-friendly checklists with provenance tracking
  - **Follow-Up Agent**: Records visit outcomes, tracks unresolved steps, and triggers appropriate follow-up actions

### 2.2 Data Flow
```
Citizen Service Request
        |
        v
[Planning Agent] --> Determines office type, service requirements, generates checklist config
        |
        v
[Checklist Agent] --> Renders structured checklist, validates items, produces printable HTML/text
        |
        v
[Citizen Interaction] --> User reviews checklist, marks items, adds notes, records visit outcome
        |
        v
[Follow-Up Agent] --> Updates visit status, tracks unresolved steps, stores outcome provenance
        |
        v
[Shared Source Set] <---> [Catalogue Services] (official sources, document requirements, office data)
```

### 2.3 Key Design Principles
1. **Deterministic rules outside LLM prompts**: All requirement classification, ambiguity detection, and mandatory status determination uses regex-based rules (as established in `makeChecklistService.js`) rather than LLM-based inference.
2. **AI outputs as untrusted suggestions**: Any LLM-generated content carries explicit provenance metadata and is always accompanied by deterministic validation.
3. **Explicit human approval for high-impact actions**: Recording visit outcomes, modifying checklists, or marking items as resolved require explicit user confirmation.
4. **Non-AI fallback for essential workflows**: All checklist generation, classification, and formatting has deterministic fallback paths.
5. **Shared approved source set**: All official sources, document requirements, and office data flow through the existing catalogue services (`serviceCatalog`, `civicServiceCoverageAtlasService`).
6. **Never imply appointment booking or office confirmation without integration**: The coach explicitly disclaims any integration with official scheduling systems.

### 2.4 Component Ownership
| Component | Owner | Responsibilities |
|-----------|-------|------------------|
| `multiAgentOfficeCoachService.js` | Planning Agent | Plan generation, requirement classification, source resolution |
| `checklist-generation-service.js` | Checklist Agent | Checklist creation, printable format generation, item classification |
| `visit-outcome-service.js` | Follow-Up Agent | Outcome recording, unresolved step tracking, status management |
| `office-visit-coach-ui/` | Frontend Team | UI components, accessible interactions, mobile-first design |
| `src/services/catalogueServices*` | Existing Team | Source data integrity, schema validation, |

### 2.5 Failure Handling
- **Stale office data**: If office data hasn't been verified within the configured TTL (default 30 days), the coach flags the data as "stale" and suggests re-verification rather than using potentially outdated information.
- **AI failure**: Any LLM-dependent path cleanly falls back to deterministic rule-based classification (as in `makeChecklistService.js`).
- **Storage errors**: LocalStorage failures gracefully degrade to in-memory only mode; the citizen can still use the coach; data is persisted when storage becomes available.
- **Concurrent access**: Conflict detection via revision numbers (as in `checklistStorage.js`) prevents silent overwrites across tabs.
- **Permission errors**: Owner-based access control (as in `appointmentStore`) ensures citizens can only access their own visit plans.

### 2.6 Threat Model
| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| Data staleciation | Medium | High (citizen travels to closed office) | TTL-based verification flagging, periodic source re-fetch |
| Unauthorized outcome recording | Low | Medium | Owner-based access control, explicit approval requirement |
| Printable checklist injection | Low | Medium | HTML sanitization (`escapeHtml` pattern from `appointmentVisitPackService`), CSS constraints |
| Source data tampering | Low | High | Input validation at trust boundaries, versioned schema contracts |
| Cross-tab conflict | Medium | Medium | Revision-based concurrency control |
| Sensitive data leakage in logs | Low | High | No citizen records, credentials, or raw documents in logs; sanitization via `sanitizeUserNotes` pattern |
| AI hallucination in prompts | Medium | High | Provenance metadata on all AI outputs; deterministic validation gate |

### 2.7 Versioned Schemas & Contracts
All external input validated at trust boundaries using JSON Schema (draft 2020-12):

- `VisitPlanSchema` - Version 1.0.0: Defines the core visit plan structure
- `ChecklistItemSchema` - Version 1.0.0: Defines checklist item type, condition, and provenance
- `VisitOutcomeSchema` - Version 1.0.0: Defines valid visit outcomes and outcome notes
- `OfficeContextSchema` - Version 1.0.0: Defines office and service context data

All schemas enforce:
- Required fields with proper types
- Enumerated values for status/outcome fields
- Version stamps for migration support
- Synthetic fixture compliance (no real citizen PII)

### 2.8 Evaluation Criteria (Measurable)
- **Checklist generation latency**: < 500ms for deterministic path, < 2s for AI-assisted path
- **Stale data detection**: > 95% of office data flagged when verification TTL > 30 days expired
- **Printable output compliance**: A4 ink-friendly, < 200KB HTML output, all sections mobile-wrappable
- **Test coverage**: ≥ 80% line coverage for deterministic code paths, ≥ 70% for AI-assisted paths
- **Concurrency safety**: Zero data loss in 1000 concurrent toggle simulations
- **Accessibility**: WCAG AA compliance for all UI components

### 2.9 Rollback & Migration
- **Schema versioning**: All data includes `schemaVersion` field; v1.0.0 is the initial version
- **Migration path**: v1.0.0 → v1.1.0 adds optional `notes` field; handled via backward-compatible reader
- **Rollback**: Downgrade removes `notes` field; existing data unaffected for core fields
- **Feature flag**: Coach feature guarded by `FEATURE_OFFICE_VISIT_COACH` env var

### 2.10 Dependencies
- **Direct**: `react`, `react-dom`, `vitest` (test), `eslint` (lint)
- **Transitive (existing)**: `firebase-admin`, `@clerk/backend`, `@clerk/react`, `lucide-react`, `qrcode-generator`
- **No new runtime dependencies**: All functionality reuses existing service modules

### 2.11 Licensing
- Follows the MIT license of the Civic Help Setu project (see LICENSE file)
- Synthetic fixtures use public domain data; no copyright-restricted documents included

---
*This ADR is living document and will be updated as the implementation evolves.*