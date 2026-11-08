# Profile Page Form Grouping & Feedback Architecture

## Overview
This document specifies the form grouping, field validation, and accessible feedback architecture implemented for the **Citizen Profile & Preferences page** (`src/pages/Profile.jsx`), resolving Issue `#586`.

---

## 1. Grouped Form Sections & Visual Hierarchy

Profile data is organized into semantic cards with explicit section titles:
1. **Personal Information**:
   - First and Last Name (Clerk core fields with mandatory first name validation).
   - Email Address with read-only badge and inline "Change Email" action for Clerk users.
   - Phone Number with regex formatting feedback (`+91 98765 43210`).
2. **Jurisdiction & Demographics**:
   - City / District and State / Union Territory inputs for local jurisdiction mapping.
   - Occupation / Sector used to match welfare scheme subsidies and professional certificates.
3. **Private Notes & Bio**:
   - Encrypted notes area visible only to the authenticated citizen.
4. **Security & Notification Preferences**:
   - Email lifecycle preferences and statutory alerts management.
5. **Citizen Data Portability**:
   - Machine-readable JSON/CSV export of all stored application references and checklists.

---

## 2. Accessible Feedback & Form Validation
- **Inline Field Errors**: Rendered directly beneath the offending input using `role="alert"` and `aria-describedby` links.
- **Dynamic Save & Error States**:
  - `Saving changes…` state with spinning indicator.
  - `Changes saved successfully` confirmation banner with `role="status"` and `aria-live="polite"`.
  - Global error banner for API failures.
- **Privacy Preservation**: Strict isolation of sensitive identity parameters; no tokens, private notes, or internal Clerk identifiers leaked to public views.
