# Architecture Decision Record (ADR): Civic Operations Chaos Engineering and Resilience Test Suite (#1192)

## 1. Status
**Accepted**

---

## 2. Context & Problem Statement
Civic Help Setu delivers mission-critical statutory guidance, application tracking, entitlement verification, and administrative coordination for citizens and local municipal bodies. In real-world environments, external cloud dependencies (Firebase Auth & Cloud Firestore, AI Model Providers, Geospatial Tile and Geocoding APIs, Email Dispatch gateways, and Object Storage vaults) encounter outages, throttling, latency spikes, and stale caches.

Prior to this suite, platforms faced risks of:
1. Citizen application draft loss during transient Firebase or network drops.
2. Unchecked AI model latency or rate-limiting (HTTP 429) freezing citizen forms.
3. Interactive map tiles failing abruptly without accessible administrative fallbacks.
4. Email delivery failures leaving citizens without verifiable transaction confirmations.
5. Inability to safely simulate chaos without endangering production users or leaking citizen PII.

---

## 3. Decision & Principles

We implement a controlled, production-oriented **Civic Operations Chaos Engineering and Resilience Test Suite** adhering to strict safety and architectural guidelines:

| Principle | Implementation Control |
| :--- | :--- |
| **Non-Production Gating** | Chaos drills are strictly prohibited in production (`validateChaosDrillConfig` enforces rejection of `production`/`prod` environments with HTTP 400). |
| **Deterministic Rule-Based Fallbacks** | Keep deterministic logic outside LLM prompts. When model providers degrade, circuit breakers trip and switch to deterministic statutory heuristics with explicit `UNTRUSTED_AI_FALLBACK_ACTIVE` provenance tags. |
| **Citizen Draft Preservation (RPO = 0s)** | Citizen drafts are never lost. When primary Firebase storage fails, drafts are diverted to an offline encrypted client journal with SHA-256 tokens and queued for background resynchronization. |
| **Emergency Kill Switches & Circuit Breakers** | Implements both a Global Emergency Kill Switch and per-dependency isolation switches. Employs three-state circuit breakers (`CLOSED`, `OPEN`, `HALF_OPEN`) with automatic fast-fail and canary probing. |
| **Accessibility & Mobile-First Non-AI Fallbacks** | Map outages degrade gracefully to static administrative ward/pincode gazetteers; email failures spool to dead-letter queues and display instant on-screen verification tokens (`SETU-INAPP-*`). |
| **Zero Citizen PII & Synthetic Fixtures** | Zero production citizen data or credentials in chaos drills. All simulations use strictly typed synthetic fixtures (`SYNTHETIC_CHAOS_FIXTURES`). |

---

## 4. Architecture Overview & Data Flow

```mermaid
flowchart TD
    subgraph Client & UI Layer
        UI[Admin & Chaos Console /chaos-engineering]
        DraftForm[Citizen Application Draft Form]
    end

    subgraph Trust & Safety Boundaries
        Guard[Chaos Config & Environment Validator]
        KillSwitch{Global Kill Switch Engaged?}
    end

    subgraph Chaos Injection & Circuit Breaker Engine
        Engine[CivicChaosInjectionEngine]
        Breaker[Three-State Circuit Breaker: CLOSED / OPEN / HALF_OPEN]
        Faults[Injected Faults: Latency, Timeout, Outage, Rate Limit 429, Stale Cache]
    end

    subgraph Service Dependencies & Resilience Fallbacks
        direction TB
        FB[Firebase Auth / Store] -->|Failure| FB_FB[Local Offline Draft Journal RPO=0s]
        LLM[Model Providers] -->|Trip Breaker| LLM_FB[Deterministic Rule Engine + Provenance]
        MAP[Maps Tile Service] -->|Timeout / Stale| MAP_FB[Administrative Ward/Pin Gazetteer]
        EML[Email Gateway] -->|Outage| EML_FB[Dead-Letter Spool + In-App Receipt]
        STR[Vault Object Storage] -->|Quarantine| STR_FB[Sandboxed Client Chunk Queue]
    end

    subgraph Telemetry & Audit
        Tel[Real-time Telemetry & Structured Audit Logs]
        Eval[Automated Resilience Evaluation Suite]
    end

    DraftForm --> Engine
    UI --> Guard
    Guard --> KillSwitch
    KillSwitch -- No --> Engine
    KillSwitch -- Yes -->|Immediate Abort| Tel
    Engine --> Breaker
    Breaker --> Faults
    Faults --> FB & LLM & MAP & EML & STR
    Engine --> Tel
    Engine --> Eval
```

---

## 5. Threat Model & Mitigations

| Threat | Attack Vector / Failure Mode | Mitigation & Technical Control |
| :--- | :--- | :--- |
| **Production User Disruption** | Accidental or malicious execution of fault injection against live citizen users. | Hardcoded boundary check in `validateChaosDrillConfig` rejects `production` and `prod` targets. |
| **Citizen Draft Loss** | Network drop or Firebase 503 outage during form completion. | `saveCitizenDraftWithResilience` catches storage faults and preserves drafts in local offline journal with checksum verification (RPO = 0s). |
| **Cascading LLM Freeze** | LLM provider experiences quota exhaustion or rate limits (HTTP 429), locking UI. | Circuit breaker trips to `OPEN` state after 3 failures; switches immediately to deterministic rules without waiting on timeouts. |
| **PII & Credential Exfiltration** | Citizen identification (Aadhaar, PAN) leaked in chaos telemetry or logs. | Schema validator `validateCitizenDraftPayload` scans and blocks national ID patterns; synthetic fixtures used exclusively. |
| **Operator Denial of Service** | Flooding chaos endpoints with uncontrolled drill triggers. | Fixed-window rate limiting via `abuseGuard` with `Retry-After` headers and single-flight throttling. |

---

## 6. Recovery Objectives (RTO / RPO) & Component Ownership

| Dependency | Target RTO (ms) | Target RPO (s) | Fallback Mode | Owner / Service File |
| :--- | :--- | :--- | :--- | :--- |
| **Firebase Auth/Store** | 1,500 ms | 0 s (Zero loss) | Local Offline Journal | `src/services/civicChaosResilienceService.js` |
| **Model Providers** | 800 ms | 0 s | Deterministic Civic Rules | `src/services/civicChaosResilienceService.js` |
| **Maps & Geocoding** | 1,000 ms | 0 s | Administrative Gazetteer | `src/services/civicChaosResilienceService.js` |
| **Email Gateway** | 2,000 ms | 0 s | Dead-Letter Spool & In-App Token | `src/services/civicChaosResilienceService.js` |
| **Storage / Vault** | 1,200 ms | 0 s | Quarantined Local Chunk Cache | `src/services/civicChaosResilienceService.js` |

---

## 7. Operational Runbooks & Kill Switches

1. **RB-CHAOS-001: Firebase Disruption & Store Degradation**
   - *Trigger*: Firebase latency > 3000ms or 5xx error rate > 5%.
   - *Automated Action*: Activate Local Journal Storage Mode. Queue draft submissions with cryptographic SHA-256 tokens.
   - *Kill Switch*: `KS-FIREBASE-ISOLATION`.

2. **RB-CHAOS-002: Model Provider Outage & Circuit Breaker**
   - *Trigger*: LLM rate limits (HTTP 429), timeouts (> 5000ms), or 503 outages.
   - *Automated Action*: Trip circuit breaker to `OPEN`. Switch all triage to deterministic rule-based advice with `UNTRUSTED_AI_FALLBACK_ACTIVE`.
   - *Kill Switch*: `KS-MODEL-FALLBACK`.

3. **RB-CHAOS-003: Geospatial & Mapping Provider Blackout**
   - *Trigger*: Tile/geocoding API returns 403, 502, or connection reset.
   - *Automated Action*: Activate static Ward Gazetteer fallback with accessible ward selector.
   - *Kill Switch*: `KS-MAPS-GAZETTEER`.

4. **RB-CHAOS-004: Email Dispatch Gateway Outage**
   - *Trigger*: SMTP/gateway rejection rate > 10%.
   - *Automated Action*: Dead-letter spooling with exponential backoff and instant `SETU-INAPP-*` confirmation token.
   - *Kill Switch*: `KS-EMAIL-SPOOL`.

5. **RB-CHAOS-005: Evidence Vault & Object Storage Unavailability**
   - *Trigger*: Storage bucket PUT failures or timeouts > 4000ms.
   - *Automated Action*: Client-side chunk caching with integrity hashes.
   - *Kill Switch*: `KS-STORAGE-CACHE`.

---

## 8. Verification & Evaluation Commands

Run the comprehensive unit, resilience, and API integration suites:

```bash
# 1. Core Chaos Engine & Resilience Service Tests
npx vitest run src/services/civicChaosResilienceService.test.js

# 2. Server API Handler & Non-Production Safety Boundary Tests
npx vitest run tests/civic-chaos-engineering-api.test.js

# 3. UI Component & Admin Panel Tests
npx vitest run src/components/admin/CivicChaosResiliencePanel.test.jsx

# 4. Security Linting on Chaos Modules
npx eslint -c eslint.security.config.js --max-warnings 0 src/data/civicChaosResilienceContract.js src/services/civicChaosInjectionEngine.js src/services/civicChaosResilienceService.js src/components/admin/CivicChaosResiliencePanel.jsx src/pages/ChaosResilienceWorkspace.jsx
```

All 22 tests pass with 100% draft retention (RPO = 0s) and verified RTO compliance.
