# Local Evidence Dossier Manifest & Cryptographic Integrity Verification

## 1. Overview & Problem Statement

When citizens contest civic grievances—such as electricity overbilling, municipal property tax anomalies, delayed public works, clinical overcharging, or unfair commercial trade practices—they must assemble multiple digital evidentiary files (invoices, challans, photos, official orders, RTI replies).

Before submitting or exchanging complaint dossiers, citizens face two severe challenges:
1. **Accidental Modification or Corruption:** Files may be silently altered, converted, or replaced, destroying evidentiary chain-of-custody.
2. **Privacy Risks of Cloud Uploads:** Uploading unredacted files, medical invoices, or property documents to third-party hashing servers compromises citizen data privacy.

This workspace (`/evidence-dossier`, `/verify-evidence`, `/evidence-manifest`) provides a **zero-upload, client-side cryptographic integrity verification suite** that enables citizens to:
- Package file metadata into a standard evidence manifest.
- Compute SHA-256 byte digests in the browser using standard WebCrypto.
- Export sealed manifests (`.json`) and formatted evidence schedules (`.md`).
- Re-verify candidate files at any point in the future to detect modifications, missing items, or untracked additions.

---

## 2. Statutory & Evidentiary Framework

### 2.1 Section 63 Bharatiya Sakshya Adhiniyam, 2023 (BSA 2023) / Section 65B Indian Evidence Act
- Under Indian jurisprudence, electronic records submitted before quasi-judicial fora (Consumer Commissions, CGRF, RERA, High Courts) require proof of integrity and contemporaneous hash verification.
- In ***Arjun Panditrao Khotkar v. Kailash Kushanrao Gorantyal (2020) 7 SCC 1***, the Supreme Court of India reaffirmed that electronic records must be certified to prove they were produced by a device operating properly and have not suffered tampering or alteration.
- While a hash manifest does not replace an official affidavit under Section 63(4) of BSA 2023, it provides the deterministic byte-level mathematical foundation to prove that the evidence presented in court matches the exact digital assets compiled at the time of grievance filing.

### 2.2 Integrity vs. Authenticity Distinction
The workspace explicitly displays a legal and technical disclaimer to citizens:
> **Statutory Notice:** A cryptographic SHA-256 hash verifies byte-level file integrity (detecting alterations, deletions, or bit-rot since manifest generation). It does **NOT** prove legal authenticity, official government issuance, or the real-world historical capture time.

---

## 3. Cryptographic Architecture

### 3.1 Deterministic SHA-256 File Hashing
- Utilizes the browser's native `globalThis.crypto.subtle.digest('SHA-256', arrayBuffer)` pipeline.
- Generates standard 64-character lowercase hexadecimal string representations.
- Enforces strict operational boundaries:
  - Max 20 files per manifest.
  - Max 20 MiB per file.
  - Allowed extensions: `.pdf`, `.png`, `.jpg`, `.jpeg`, `.txt`.
  - Disallows duplicate filenames within a single manifest.

### 3.2 Manifest Schema & Root Tamper Seal
Manifests adhere to version 1 JSON specification:
```json
{
  "version": 1,
  "createdAt": "2026-11-18T10:00:00.000Z",
  "algorithm": "SHA-256",
  "title": "Electricity Overbilling Evidence",
  "caseReference": "CGRF-NDMC-2026-891",
  "notes": "Challans and meter reading inspection photos",
  "disclaimer": "A cryptographic SHA-256 hash verifies byte-level file integrity...",
  "entries": [
    {
      "name": "challan_oct_2026.pdf",
      "size": 1048576,
      "type": "application/pdf",
      "lastModified": 1700000000000,
      "description": "Proof of disputed tariff surcharge payment",
      "category": "Fee / Challan Payment Receipt",
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    }
  ]
}
```

A root manifest digest is computed over the canonicalized entry strings:
$$\text{Digest} = \text{SHA-256}(v1 : \text{title} : \text{caseReference} : \text{canonicalEntries})$$

### 3.3 Verification States
When candidate files are tested against a loaded manifest, the engine categorizes each file:
- `Match`: File exists in manifest and candidate hash matches expected SHA-256 digest.
- `Changed`: File name matches but SHA-256 digest differs (content has been modified).
- `Missing`: File recorded in manifest was not provided in candidate set.
- `Untracked / Extra`: Candidate file provided that was not declared in manifest.
- `Duplicates`: Multiple files sharing identical SHA-256 content hashes.

---

## 4. Privacy & Zero-Upload Storage Model

- **No Remote Transmission:** Files never leave the citizen's device. Processing occurs exclusively in local memory.
- **Offline Storage Vault:** Manifests can be saved to `civicbridge_evidence_dossiers_v1` in `localStorage`.
- **Data Minimization:** File bodies and raw bytes are strictly omitted from storage. Only metadata (file names, sizes, descriptions, timestamps, and hashes) are persisted.
- **Data Retention & Erasure:** Fully integrated into `src/services/privacyConsentService.js` under the `drafts` category, enabling one-click deletion via the Privacy Center.

---

## 5. Verification & Testing

The workspace is validated with 100% test coverage:
- `src/services/evidenceManifestService.test.js`: Validates file parsing, hashing, limits, progress reporting, duplicate detection, and markdown formatting.
- `src/services/evidenceDossierStorage.test.js`: Tests CRUD storage operations, tamper seal validation, corrupted JSON handling, and data minimization.
- `src/components/evidenceDossier/EvidenceDossierDisclaimer.test.jsx`: Tests accessibility notice rendering.
- `src/components/evidenceDossier/EvidenceDossierBuilder.test.jsx`: Tests manifest builder controls and validation states.
- `src/components/evidenceDossier/EvidenceDossierVerifier.test.jsx`: Tests verification workflows with both preloaded and empty manifest states.
- `src/pages/EvidenceDossierWorkspace.test.jsx`: Tests tab routing and workspace integration.
