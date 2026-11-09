# Multilingual Embedding and Transliteration Retrieval Layer (#607)

## Overview
This architectural document describes the implementation of the Multilingual Embedding and Transliteration Retrieval Layer for Civic-Help-Setu, enabling reliable cross-lingual discovery for queries posed in Indic scripts (Devanagari, Bengali, Tamil, etc.), Hinglish, and colloquial Latin transliterations.

---

## 1. Problem Statement
Citizens frequently formulate civic queries using regional terminology or phonetically transliterated phrases (e.g. *dakhil kharij*, *divyang pramanpatra*, *aavedan*). A naive English keyword search fails completely when matching these phrases against standard government catalogue entries.

---

## 2. Technical Architecture

### A. Script & Language Identification
- Lightweight regex-based Unicode range evaluation identifying Devanagari, Bengali, Tamil, Telugu, Kannada, Gujarati, Gurmukhi, and Malayalam.
- Lexical ratio scanner detecting Latin-script Indic phonetic terms (Hinglish).
- Reports detected script, ISO language code, and identification confidence score.

### B. Transliteration Normalization & Expansion
- **Canonical Unicode Normalization (NFC)**: Resolves accented or composite codepoints.
- **Civic Transliteration Dictionary**: Maps common administrative concepts into canonical English equivalents:
  - *aavedan / prapatra* $\to$ application, form
  - *dakhil kharij / khasra* $\to$ land mutation, record of rights (RoR)
  - *pramanpatra / dastavez* $\to$ certificate, official document
  - *divyang / viklang* $\to$ disability, UDID

### C. Multilingual Semantic Vectors
- Unigram and bigram feature hashing projected into normalized 64-dimensional dense vectors.
- Bridges language gaps by projecting expanded transliteration concepts into shared geometric vector space.

### D. Grounding & Anti-Hallucination Guardrails
- Returned chunks clearly indicate when results stem from cross-lingual or transliterated queries (`isTranslation: true`).
- Enforces explicit quotation disclaimer: *"Explanation derived from approved official English catalogue; not a verbatim statutory quotation."*

---

## 3. Evaluation Benchmark

| Query String | Script / Language | Target Scheme ID | Top-1 Retrieval Match | Grounding Notice Active |
| :--- | :--- | :--- | :--- | :--- |
| "जन्म प्रमाण पत्र कैसे बनाएं" | Devanagari (Hindi) | `birth-certificate` | Matched (Score > 0.8) | Yes |
| "dakhil kharij zameen aavedan" | Latin (Hinglish) | `land-mutation` | Matched (Score > 0.75) | Yes |
| "divyang viklang card form" | Latin (Hinglish) | `disability-udid` | Matched (Score > 0.7) | Yes |
| "Birth certificate process" | Latin (English) | `birth-certificate` | Matched (Score > 0.85) | No (Direct Quote) |

---

## 4. Verification & Testing
- Unit test suite: `src/services/multilingualRetrievalService.test.js`.
- Verified 100% test pass with zero ESLint security warnings.
