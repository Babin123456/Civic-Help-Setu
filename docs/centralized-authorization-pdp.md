# Centralized Authorization Policy Decision Point with Cached Decisions

## Purpose
Decouples authorization rules from individual route handlers into an external Policy Decision Point (PDP) featuring explicit deny precedence, scoped role claims, and short-lived decision caching.

## Key Features
- **Deny-by-Default Precedence**: Any matching explicit deny or cross-tenant boundary breach supersedes permit claims.
- **Cross-Jurisdiction Isolation**: Blocks tenant privilege escalation when actor jurisdictions do not align with resource targets.
- **Invalidation on Policy Mutation**: Clears cached decisions automatically upon policy version registration.
