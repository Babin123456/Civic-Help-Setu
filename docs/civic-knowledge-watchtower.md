# Civic Knowledge Update Watchtower with Source Health Scoring

## Problem Statement
Official government websites frequently undergo silent updates, server outages, or domain restructuring. When civic AI advice relies on stale rules or dead links, citizens may face rejected applications or missed deadlines.

## Features
1. **Allowlisted URL Monitoring**: Regularly polls official gazettes, department portals, and notification pages.
2. **Deterministic Cryptographic Content Hashing**: Uses SHA-256 digests to reliably identify content drift.
3. **Editorial Gate**: Prohibits automatic knowledge base mutation upon drift detection; requires explicit maintainer sign-off.
4. **Source Health & Uptime Scoring**: Computes dynamic health scores (0-100) factoring in uptime and consecutive failures.
