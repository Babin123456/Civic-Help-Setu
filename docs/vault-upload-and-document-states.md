# Vault Upload and Document-List Visual States (#588)

## Overview
Issue #588 focuses on improving the visual hierarchy, document list states, upload constraints communication, and data minimization feedback on the citizen Vault page (`src/pages/Vault.jsx`).

## Improvements Made
1. **Privacy Architecture and File Constraints Banner**:
   - Introduced a prominent banner at the top of the active vault dashboard.
   - Transparently clarifies supported file types (PDF, JPG, PNG) and file size ceiling (maximum 5 MB per item).
   - Explains that file contents are not sent to any server; only client-side metadata and masked identifiers are retained.
   - Highlights session inactivity auto-lock (5-minute idle safety for public kiosks).

2. **Overhauled Empty State**:
   - Distinct, welcoming empty state when zero documents have been cataloged.
   - Distinguishes between:
     - Global empty vault (inviting first document addition).
     - Empty category tab (guiding user on what belongs there).
     - Zero search query matches (providing a 1-click "Clear Filters" action).
   - Clear icon graphics and accessible heading structure (`aria-labelledby="vault-empty-title"`).

3. **Visual Document Cards & Safety Indicators**:
   - Clear badge tags for expiration statuses (`Expired`, `Expiring Soon`).
   - Self-declared verification status and date formatting.
   - Secure inspection and watermark tools accessible from card headers.

## Testing & Quality Assurance
- Automated tests in `src/pages/Vault.test.jsx` verifying privacy banners, constraints, and empty state rendering.
- Passed all vault component unit tests (`DocumentModal`, `WatermarkAttestationModal`, `DocumentPreflightChecker`).
- ESLint security check passing with zero errors.
