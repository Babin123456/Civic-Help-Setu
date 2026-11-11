# Civic Document Expiry, Renewal and Revalidation Calendar

## Overview
Citizens store official certificates, identity documents, and revenue clearances in the vault but frequently miss statutory validity deadlines, periodic renewal windows, or annual revalidations.

The `civicDocumentValidityCalendarService` (`src/services/civicDocumentValidityCalendarService.js`) introduces a structured validity calendar, state-specific validity rule catalogue, and opt-in reminder workspace without storing document contents in notification or analytics payloads.

## Key Capabilities

### 1. Distinction of Document Validity Types
- **`NON_EXPIRING`**: Lifetime validity records (e.g., Birth Certificates, permanent Community/Caste certificates, permanent Domicile certificates).
- **`PERIODIC_RENEWAL`**: Fixed-term documents requiring regular renewal (e.g., Indian Passport for 10 years, Pollution Under Control for 6-12 months, Driving Licences).
- **`ANNUAL_REVALIDATION`**: Financial-year dependent clearances (e.g., Income Certificates, Non-Creamy Layer OBC renewals).
- **`TEMPORARY_OR_CONDITIONAL`**: Short-term validity (e.g., provisional registrations or temporary disability assessments).

### 2. State-Dependent Validity Rules (No National Generalization)
Statutory validity tenures are preserved per jurisdiction rather than generalized:
- **Tamil Nadu Income Certificate**: Valid for 1 year (12 months) from date of issue under Revenue Administration Dept rules.
- **Maharashtra Income Certificate**: Issued for 1-year or 3-year tenures (36 months) under Maharashtra RTS manual.
- Each rule maintains an official government source citation, official URL, and last-verified date.

### 3. Consent-Driven Reminder Management
- Reminders are strictly opt-in (`remindersEnabled`).
- Citizens configure in-app alerts, email notifications, and advance notice windows (e.g. 60, 30, 7 days before expiry).
- Citizens can edit, disable, or delete reminders at any time.

### 4. Zero Document Content Exposure
- Notifications, audit logs, and calendar exports strictly exclude scanned images, PDF binaries, and sensitive identity numbers.
- `exportValidityCalendarSummary()` produces clean schedules containing only document titles, validity types, statuses, expiry dates, and official renewal links.

## Verification & Testing
- Unit tests in `src/services/civicDocumentValidityCalendarService.test.js` verify:
  - Evaluation of non-expiring lifetime documents with source citations.
  - State-specific tenure calculation without national generalization.
  - Expired and expiring-soon threshold detection.
  - User configuration, disabling, and deletion of reminders.
  - Calendar export strictly omitting file bodies and credentials.
