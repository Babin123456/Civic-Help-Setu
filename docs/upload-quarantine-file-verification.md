# Document Upload Quarantine and File-Type Verification

## Problem Statement
When citizens submit supporting evidence for civic schemes, grievances, or service requests (e.g., identity cards, utility bills, municipal complaints), attackers may attempt to upload malicious executables, polyglot payloads, or scripts disguised with harmless extensions like `.pdf` or `.png`. Relying solely on client-provided `Content-Type` headers or file extensions exposes users and administrative staff to cross-site scripting (XSS), server-side vulnerabilities, or client-side execution.

---

## Defense-in-Depth Verification Pipeline

This architecture enforces strict upload containment:

1. **Path Traversal Sanitization**:
   - File names containing directory traversal sequences (`../`, `..\`) or control characters are sanitized to clean, alphanumeric identifiers.
2. **Strict Disallowed Extension Blacklist**:
   - Explicitly rejects scripts, executables, shell binaries, and compressed archives (`.exe`, `.sh`, `.bat`, `.zip`, `.js`, `.php`, `.svg`, etc.).
3. **Magic Bytes Content Signature Verification**:
   - Files are inspected at the byte level. Claimed MIME types are validated against known cryptographic file signatures:
     - PDF: `%PDF` (`0x25 0x50 0x44 0x46`)
     - PNG: `\x89PNG\r\n\x1a\n` (`0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A`)
     - JPEG: `\xFF\xD8\xFF`
     - WebP: `RIFF` header (`0x52 0x49 0x46 0x46`)
4. **Quarantine Containment State**:
   - Staged files remain unverified and completely inaccessible for download until all cryptographic and structural checks succeed.
5. **Safe Content-Disposition Header**:
   - Verified attachments force download via `Content-Disposition: attachment; filename="..."`, preventing the browser from executing inline HTML or scripting payloads.

---

## Implementation & Rollout

- Service module: `src/services/uploadQuarantineService.js`
- Test suite: `src/services/uploadQuarantineService.test.js`
- Configurable upload size ceilings (defaults to 10MB per document).
- Ready for integration with Cloud Storage / S3 presigned upload post-processing hooks.

### Detailed Threat Modeling & Mitigations

| Attack Vector | Attempted Mechanism | Quarantine Pipeline Mitigation |
| :--- | :--- | :--- |
| Polyglot File Upload | Executable header wrapped in GIF or PDF | Magic bytes validation inspects prefix signatures, rejecting hybrid payloads |
| Directory Traversal | `../../windows/system32/cmd.exe` | Base name extraction and traversal character stripping to alphanumeric safe tokens |
| Executable Masquerading | `malware.pdf.exe` or `exploit.sh` | Blacklist detection scans suffixes against `.exe`, `.bat`, `.sh`, `.php`, `.zip`, etc. |
| Memory / Resource Exhaustion | 500MB zip bomb or massive image | Strict byte-size ceiling check (10MB) immediately aborts oversized buffers |
| Stored XSS Execution | SVG or HTML with embedded `<script>` | Vector formats disallowed; clean files served strictly with `Content-Disposition: attachment` |

---

## Operational Verification Runbook

1. **Synthetic Header Testing**:
   Ensure automated CI runners execute mock file streaming across diverse valid and invalid MIME formats.
2. **Quarantine Audit Inquiries**:
   Allow compliance operators to inspect rejection statistics while strictly avoiding access to hazardous binaries.
3. **Storage Tier Integration**:
   Staged payloads are quarantined in private, non-public cloud buckets with access restricted by IAM credentials.
4. **Automated Signature Refresh**:
   Maintain and periodically update cryptographic magic numbers as newer standardized document standards (e.g. PDF 2.0, AVIF) are onboarded into civic portals.
5. **Client Notification Guidelines**:
   Provide citizen users with clear, actionable rejection messages when an attachment fails signature verification, explaining exactly which supported formats (PDF, JPEG, PNG, WebP) are accepted.
6. **Zero Inline Rendering Rule**:
   Under no circumstances shall untrusted user-uploaded content be rendered directly in `<iframe>` or `<img>` elements without passing quarantine verification and having strict sandboxing attributes enabled.



