# Secure Redacted Document Sharing Room with Expiring Access

> **Issue**: [#1426](https://github.com/GoldRay19/Civic-Help-Setu/issues/1426)
> **Branch**: `feat/redacted-sharing-room-1426`

---

## 1. Architecture Overview

| Component | Role |
|-----------|------|
| `api/_lib/redactedSharingRoomStore.js` | Bounded in-memory store (max 500 rooms, 2,000 audit logs), per-file permissions (`view`/`download`/`denied`), expiry, immediate revocation, replay nonce tracking, owner isolation |
| `api/_lib/handlers/redacted-sharing-room.js` | Serverless REST API (`/api/redacted-sharing-room`) with Clerk JWT auth, 30 req/min rate limit, `X-Robots-Tag: noindex, nofollow, noarchive`, `Cache-Control: no-store`, and zero-PII screening |
| `src/services/redactedSharingRoomService.js` | Client-side offline-first persistence, automatic Aadhaar/PAN/phone redaction prior to sharing, non-indexable URL builder, provenance labels |
| `src/pages/RedactedSharingRoomWorkspace.jsx` | Accessible workspace with loading, empty, error, offline states, per-file permission controls, expiry presets, one-click revocation, and access log viewer |

---

## 2. Security, Privacy & Authorization Controls

- **Per-File Permissions**: Each document in a room is independently configured as `view`, `download`, or `denied`. View-only files return `403 DOWNLOAD_NOT_PERMITTED` on download attempts.
- **Expiry & Revocation**: Rooms expire automatically per TTL (`15m`–`7d`) and can be revoked immediately by the owner (`410 ROOM_EXPIRED` / `410 ROOM_REVOKED`).
- **Replay Protection**: Optional one-time access `nonce` values are tracked per room; replaying a consumed nonce returns `409 ERR_REPLAY_DETECTED`.
- **Cross-User Isolation**: Designated `recipientId` restricts access to the owner and designated recipient (`403 CROSS_USER_DENIED`). Only the owner can revoke rooms or read access logs.
- **Non-Indexable URLs**: All API responses include `X-Robots-Tag: noindex, nofollow, noarchive` and `Cache-Control: no-store, max-age=0`.
- **Zero PII**: Unredacted Aadhaar, PAN, and personal phone numbers are rejected (`400`) by `screenForPII()` and stripped client-side by `redactSensitiveText()`.

---

## 3. Data Provenance

Shared items display distinct provenance badges (`Citizen Entered`, `Official Record`, `AI Suggestion (Verify)`).

---

## 4. Configuration, Monitoring & Rollback

- **Configuration**: Uses `CLERK_SECRET_KEY` for JWT verification; no new env vars required.
- **Monitoring**: Track `403` (`CROSS_USER_DENIED`, `DOWNLOAD_NOT_PERMITTED`), `409` (`ERR_REPLAY_DETECTED`), `410` (`ROOM_REVOKED`, `ROOM_EXPIRED`), and `429` rate-limit events.
- **Rollback**: Remove `"redacted-sharing-room"` from `api/[...path].js` and `/redacted-sharing-room` / `/sharing-room` from `src/App.jsx`.
