# Saved Services Empty State and Collection Navigation (#587)

## Overview
Issue #587 focuses on improving the citizen experience when viewing saved services, both when no services have been bookmarked across the account, and when viewing a specific empty collection folder.

## Key Changes
1. **SavedEmptyState Overhaul**:
   - Replaced plain text dashed card with a structured educational hub.
   - Highlights 3 core citizen capabilities:
     - **Custom Collections**: Grouping guides by life milestone (property purchase, childbirth, vehicle transfer).
     - **Renewal Reminders**: Statutory reminders before licences expire.
     - **Private Notes**: Keeping application token numbers and notes safe locally.
   - High-contrast call to action pointing to the main services directory.

2. **CollectionEmptyState Refinement**:
   - Clarified distinction between having no bookmarked services at all vs. having an empty folder.
   - Explains how guides are assigned to folders via the "Notes & Collection" menu.
   - Provided quick actions to jump back to "All saved guides" or discover services in the directory.

3. **Collection Navigation & Accessibility**:
   - Preserved accessible keyboard focus management and screen-reader announcements.
   - Clear semantic status and headings (`aria-labelledby="saved-empty-title"` and `aria-labelledby="collection-empty-title"`).
   - High-contrast badges and clear icon glyphs.

## Verification
- Unit test suites in `SavedEmptyState.test.jsx` and `CollectionEmptyState.test.jsx`.
- Verified in light and dark theme contrast.
- Zero security vulnerabilities.
