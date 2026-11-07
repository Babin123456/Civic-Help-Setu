# Shared Navigation & Branding Standardization Notes

## Issue Summary (#563)
Standardizes visible branding across shared navigation elements, footer, home page hero, and open source page to consistently display **Civic Help Setu** instead of obsolete **CivicBridge** placeholder labels.

## Key Changes
1. **Navbar (`src/components/Navbar.jsx`)**:
   - Updated default brand text fallback from `'CivicBridge'` to `'Civic Help Setu'`.
2. **Footer (`src/components/Footer.jsx`)**:
   - Updated default brand text fallback and legal disclaimer to explicitly state `'Civic Help Setu'`.
3. **Home Page (`src/pages/Home.jsx`)**:
   - Replaced hero subtitle and "How it works" section headings with `'Civic Help Setu'`.
4. **Open Source Page (`src/pages/OpenSource.jsx`)**:
   - Replaced headline with `'Why Civic Help Setu is Open Source'`.
5. **English Locales (`src/locales/en.json`)**:
   - Updated `nav.brand`, `hero.subtitle`, and `footer.disclaimer` to reference `'Civic Help Setu'`.
6. **Regression Tests**:
   - Added unit test suite in `src/components/common/BrandingConsistency.test.jsx` verifying that all shared navigation and footer components render "Civic Help Setu" and do not leak obsolete names.
