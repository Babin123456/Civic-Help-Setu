# Public transport concessions directory

## Data provenance

The operator index in `src/data/transitConcessions.js` is navigation metadata, not a concession policy source. Each operator entry links to its official website. Policy fields (eligibility, application, renewal, fees, validity, route exclusions, lost/blocked pass process, source publication date, effective date, and verification timestamp) remain unavailable until an administrator has reviewed a dated official rule. Do not infer missing requirements from another operator or from community submissions.

Keep verbatim official instructions, editorial explanations, and generated summaries in separate fields. A verified policy record must include the responsible authority, state/city jurisdiction, operator and mode, official source URL, source publication date, effective date when stated, and verification timestamp. An unknown effective date must remain unknown.

## Refresh and fallback behaviour

Operator references do not establish concession rules. When there is no dated official rule, the interface labels the rule set unverified and explicitly reports unavailable fields. A verified record becomes stale after 180 days; the interface hides its requirements until the official source is rechecked. Refresh means an administrator checks the official authority source and updates the record and verification timestamp; it is not an automatic scrape.

Corrections are submitted without account details or personal identifiers, validated on the server, stored for administrator review, and do not become public policy automatically. Approved corrections are evidence for a subsequent reviewed data update.

## Saved user information

Renewal dates, checklist progress, and notes are stored only in browser local storage. They are never sent to the directory or included in analytics or shared links. Users can edit or delete a checklist for an operator. Users should not put identity/pass numbers, phone numbers, or other personal data in notes.
