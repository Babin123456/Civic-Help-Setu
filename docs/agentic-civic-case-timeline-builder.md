# Agentic Civic Case Timeline Builder from Citizen Records

## Overview
Citizens navigating protracted civic disputes (such as disputed property assessments, stalled pension cases, or unfulfilled road work complaints) frequently possess loose collections of physical notices, speed-post acknowledgments, and RTI responses.

The **Agentic Civic Case Timeline Builder** turns these fragmented records into a coherent, verifiable, chronological timeline of civic engagement.

## Capabilities
1. **Multi-Format Date Normalization**: Identifies ISO (`YYYY-MM-DD`), localized Indian formats (`DD/MM/YYYY`), and text date strings.
2. **Deterministic Event Classification**: Classifies events into legal milestones (`APPLICATION_SUBMISSION`, `RTI_OR_LEGAL_HEARING`, `AUTHORITY_OBJECTION`, `APPROVAL_OR_DISPATCH`).
3. **Evidence Citations**: Ties every event directly back to source documents and line-level snippets.
4. **Gap Analysis**: Automatically detects spans (>90 days) of official dormancy or unrecorded periods.
5. **Formal Dossier Export**: Compiles structured Markdown dossiers for ombudsman hearings or consumer forum complaints.
