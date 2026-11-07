# Consistent Page Headers and Content-Width Patterns (#590)

## Overview
Issue #590 addresses visual inconsistencies across primary pages by introducing a unified, accessible, and responsive header pattern (`src/components/common/StandardPageHeader.jsx`) and standardized container maximum widths.

## Architectural Changes
1. **Reusable `StandardPageHeader` Component**:
   - Encapsulates:
     - Standardized heading hierarchy (`<h1>` with fluid clamp typography `clamp(2rem, 4.5vw, 3.25rem)`).
     - Semantic eyebrow category labels with icon glyphs and optional status badges (`Verified Official`, `Central & State`).
     - Subtitle lead with bounded max-width (defaults to 700-780px) to guarantee comfortable reading measure across wide screens.
     - Optional action slot (`children`) for search toolbars, count pills, or utility modals.
   - Fully customizable alignment (`center` or `left`) and color tokens adhering to system light and dark themes.

2. **Integration into Primary Pages**:
   - Integrated `StandardPageHeader` into `src/pages/Services.jsx`, replacing bespoke markup while retaining all interactive RTI builder and Grievance router buttons.
   - Provides consistent layout tokens across desktop, tablet, and mobile breakpoints.

## Testing & Verification
- Unit test suite `StandardPageHeader.test.jsx` testing titles, subtitles, badges, and action slots.
- Component and page tests passing.
- Zero ESLint security warnings.
