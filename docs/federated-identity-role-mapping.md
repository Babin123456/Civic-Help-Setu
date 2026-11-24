# Federated Identity and Role Mapping Layer for Partner Portals

## Overview
Civic Help Setu connects with external state and national e-governance systems (such as MeriPehchaan NSSO, DigiLocker, and state e-District portals).

This service implements an **OpenID Connect (OIDC) / SAML federated identity verification and role mapping engine**.

## Key Architecture
1. **Issuer Trust Registry**: Only explicitly allowlisted identity providers (e.g. `https://meripehchaan.gov.in`) can mint authenticated sessions.
2. **Audience & Expiration Validation**: Restricts tokens to approved audiences and blocks replay or expired sessions.
3. **Explicit Role Mapping**: Maps external assertions (e.g., `GOV_OFFICER_REVENUE`) to internal roles (`ward_officer`, `verifier`, `citizen`) with least-privilege defaults.
4. **Revocation Registry**: Immediate revocation propagation across active institutional sessions.
