# Civic Service Outage and Alternative-Access Directory

## Overview
When critical public service portals (such as land records, transport services, ration distribution, or municipal payment gateways) experience technical downtime, citizens are often left unaware of the root cause, expected recovery timeframe, or official alternative channels.

The `civicServiceOutageDirectoryService` (`src/services/civicServiceOutageDirectoryService.js`) provides a community and administrative status directory that separates verified official advisories from citizen-reported accessibility issues and surfaces verified alternative access points.

## Key Capabilities

### 1. Separation of Incident Tiers
- **`VERIFIED_OFFICIAL`**: Published by verified administrative editors and backed by official government bulletins (e.g. NIC advisories, State portal maintenance schedules).
- **`COMMUNITY_REPORTED`**: Unverified reports submitted by citizens experiencing downtime. Distinctly labeled with a moderation pending badge.

### 2. Verified Alternative Official Channels
When a primary digital portal is unavailable, the directory presents editorially verified alternative routes:
- **Physical Counters**: Dedicated municipal facilitation counters, Sub-Registrar cash desks, or RTO helpdesks.
- **Common Service Centres (CSC / e-Sevai)**: Authorized government kiosk networks with direct backend queue access.
- **Official Telephone Helplines**: Toll-free government call centers.
- **URL Whitelist Validation**: `isValidOfficialUrl()` verifies that all alternative digital links strictly belong to recognized `.gov.in`, `.nic.in`, `.gov`, or official state domains, preventing malicious redirects.

### 3. Automated Stale Incident Expiration
- Incidents automatically expire into `STALE_EXPIRED` after a configurable time-to-live (TTL, default: 48 hours) to prevent outdated downtime notices from persisting in search indexes.

### 4. Ethical Safeguards (No Probing)
- Civic-Help-Setu strictly aggregates administrative advisories and moderated community reports.
- **Strict Guardrail**: The platform prohibits automated pinging, port scanning, or unauthorized probing against government IT infrastructure.

## Verification & Testing
- Unit tests in `src/services/civicServiceOutageDirectoryService.test.js` verify:
  - Official URL validation and rejection of untrusted third-party domains.
  - Official verified incident publishing with alternative channels.
  - Rejection of unverified alternative URLs.
  - Visible separation of community-reported issues from official bulletins.
  - Editorial moderation workflow (promoting community reports to verified tier).
  - Automatic expiration of stale incidents past TTL.
