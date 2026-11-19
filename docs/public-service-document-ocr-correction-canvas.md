# Public-Service Document OCR Correction Canvas with Field Confidence Overlays

## Overview
When citizens digitize or upload physical documents (such as salary slips, electricity bills, or tax receipts) to prepare civic checklists, raw OCR pipelines frequently extract imperfect values. A plain list of extracted text lacks provenance: citizens cannot easily discern where a number came from on the physical page, whether a digit was misclassified (e.g. `O` vs `0`), or how confident the extraction engine was.

The **Public-Service Document OCR Correction Canvas Service** (`src/services/documentOcrCorrectionCanvasService.js`) provides an interactive, privacy-first document canvas with field confidence overlays. It maps extracted fields to spatial bounding boxes, flags low-confidence detections with visual inspection tiers, empowers citizens to correct or confirm values with human oversight, and guarantees immediate irrevocable deletion of all scans and derived metadata upon citizen request.

---

## Architectural Principles & Workflow

```
   [ Citizen Consent & Scanned Document Ingestion ]
                         |
                         v
       +------------------------------------+
       | Field Detection & Bounding Box Map |
       |   - Spatial Coordinates (x, y, w, h)|
       |   - Confidence Scoring (0.0 to 1.0)|
       +-----------------+------------------+
                         |
                         v
       +------------------------------------+
       | Confidence Classification Tiers    |
       |   - HIGH (>= 0.85): Green          |
       |   - MEDIUM (0.60 - 0.84): Amber    |
       |   - LOW (< 0.60): Red              |
       +-----------------+------------------+
                         |
        +----------------+----------------+
        |                                 |
        v                                 v
+-------------------+           +-------------------+
| Visual Canvas     |           | Accessible Table  |
| (Rotation, Zoom,  |           | (WCAG Non-Visual  |
|  Bounding Boxes)  |           |  Tabular Parity)  |
+-------------------+           +-------------------+
                         |
                         v
       +------------------------------------+
       | Human Correction & Confirmation    |
       |   - USER_CORRECTED / CONFIRMED     |
       |   - USER_REMOVED (false detections)|
       |   - No Auto-Submission to Portals  |
       +-----------------+------------------+
                         |
                         v
       +------------------------------------+
       | Privacy & Data Retention Lifecycle |
       |   - Irrevocable Purge on Demand    |
       |   - PII Scrubbing for Audit Export |
       +------------------------------------+
```

---

## Core Capabilities

### 1. Consent-Gated Ingestion & Bounding Box Mapping
- Processing is strictly gated on explicit citizen consent (`explicitConsentGiven: true`).
- Maps every detected civic attribute (`applicantName`, `monthlySalary`, `meterNumber`) to spatial coordinates (`x`, `y`, `width`, `height`).
- Normalizes confidence into three intuitive tiers (`CONFIDENCE_TIER`):
  - **`HIGH_CONFIDENCE`** (>= 0.85): Clear recognition, minimal scrutiny needed.
  - **`MEDIUM_REVIEW_RECOMMENDED`** (0.60 - 0.84): Advisory review recommended.
  - **`LOW_CORRECTION_REQUIRED`** (< 0.60): Marked with red highlights, requiring citizen verification before confirmation.

### 2. Interactive Canvas Management
- **Stepped Rotation**: Supports 90-degree step rotations (`0`, `90`, `180`, `270`) to handle sideways or upside-down mobile scans.
- **Bounded Zoom**: Constrains zoom between `0.5x` and `3.0x` for high-resolution inspection.
- **Multi-Page Navigation**: Bounded page navigation across multi-page PDF documents.
- **Low-Confidence Filter**: Rapidly isolates fields flagged for scrutiny.

### 3. Human-in-the-Loop Verification
- Extracted values start with status `PROPOSED_BY_OCR`.
- Citizens can:
  - `correctExtractedField`: Override misrecognized characters with confirmed values (`USER_CORRECTED`).
  - `confirmExtractedField`: Validate correct proposals (`USER_CONFIRMED`).
  - `removeExtractedField`: Discard spurious text artifacts (`USER_REMOVED`).
- **Strict Guardrail**: Unconfirmed OCR text is strictly prohibited from being auto-submitted to official government portals.

### 4. Non-Visual Accessible Alternative
- `getAccessibleOcrFieldsTable(session)` produces a linearized WCAG-compliant table.
- Screen-reader users can inspect field labels, coordinates, confidence percentages, and confirmed values without visual canvas interactions.

### 5. Irrevocable Purge & Export Sanitization
- `deleteDocumentAndExtractions(documentId, ownerId)` irrevocably purges the raw document and all derived extraction coordinates from memory.
- `sanitizeOcrSessionForExport(session)` redacts confidential values (Aadhaar, income numbers, PAN) to `[REDACTED_CONFIDENTIAL_INPUT]` for safe audit export.

---

## Statutory Notice & Scope

> [!IMPORTANT]
> **Statutory Notice**: OCR extraction and bounding box overlays are advisory preparation aids to accelerate checklist verification. Confidence ratings are visual inspection tools, not official authenticity or entitlement verdicts. Extracted data will not be submitted to statutory portals without citizen confirmation.

---

## Verification & Metrics
- **Unit Test Suite**: `src/services/documentOcrCorrectionCanvasService.test.js`
- **Results**: 17/17 tests passing.
- **Linting & Security**: 0 errors, 0 warnings across ESLint and `eslint.security.config.js`.
