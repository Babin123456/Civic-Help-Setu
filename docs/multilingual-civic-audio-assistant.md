# Multilingual Civic Audio-to-Action Assistant with Human-Verified Transcripts

This document details the audio transcription pipeline, supported Indian regional languages, acoustic confidence monitoring, human verification gates, and statutory guidance separation for Civic Help Setu.

## Problem Statement
A substantial portion of citizens across India prefer verbal communication in regional languages (Hindi, Bengali, Tamil, Telugu, Marathi, Kannada, English) when reporting municipal deficiencies, tracking certificate applications, or describing public grievances.

Speech recognition models often produce acoustic errors on dialect variation, background noise, or code-switching. If these uncorrected transcripts are routed directly to downstream RAG engines or grievance generation, inaccurate allegations, corrupted dates, or false claims may be fabricated.

## Human-in-the-Loop Architecture

```
     [ Citizen Spoken Voice Note ] (Regional Language / Dialect)
                    │
                    ▼
     +-----------------------------------------------------------+
     |         Acoustic Speech-to-Text & Language Check          |
     |  - Language & dialect support verification                |
     |  - Acoustic confidence scoring                            |
     |  - Zero Audio Retention (Immediate audio file purge)      |
     +------------------------------+----------------------------+
                                    │
                                    ▼
     +-----------------------------------------------------------+
     |   State: TRANSCRIBED_PENDING_REVIEW                       |
     |   - Visual warning if confidence is below threshold       |
     |   - Text-only alternative always available                |
     +------------------------------+----------------------------+
                                    │
                                    ▼
     +-----------------------------------------------------------+
     |            Human-in-the-Loop Verification Gate            |
     |  - Citizen reviews and manually corrects transcript       |
     |  - Explicit confirmation converts state to:               |
     |    USER_CONFIRMED                                         |
     +------------------------------+----------------------------+
                                    │
                                    ▼
     +-----------------------------------------------------------+
     |             Action Generation & Fact Separation           |
     |  - User-stated facts strictly anchored in confirmed text  |
     |  - Retrieved statutory rules rendered visibly distinct    |
     |  - Downstream action blocked if state != USER_CONFIRMED   |
     +-----------------------------------------------------------+
```

## Privacy & Safety Controls
1. **Immediate Audio Deletion**: Audio files are held transiently in memory or temporary buffers and purged immediately after transcription. No voice recordings are archived or used for background model training.
2. **Strict Confirmation Gating**: Any attempt to convert an unreviewed or unconfirmed audio transcript into a formal grievance draft triggers an immediate safety exception.
3. **Fact vs. Rule Separation**: The output explicitly distinguishes what the citizen stated from what statutory administrative rules prescribe.
