# AI Civic Policy Change Impact and Saved-Journey Diff Engine

This document details the architecture, immutable policy version comparison, human editor review workflow, and saved-journey diff alerts for Civic Help Setu.

## Problem Statement
When government ministries revise citizen service rules—such as raising application fees, requiring additional supporting affidavits, amending submission deadlines, or migrating from offline to digital workflows—citizens following saved checklists or undergoing multi-week procedures may follow obsolete guidelines.

Unvetted or automated AI notifications can create false alarms, misinterpret retroactive effective dates, or disturb users whose applications were already grandfathered under older statutory regimes.

## Architecture & Human-in-the-Loop Pipeline

```
  +--------------------------------+       +--------------------------------+
  | Prior Policy Version (v1)      |       | New Policy Version (v2)        |
  | Effective Date, Rules, Citation|       | Effective Date, Rules, Citation|
  +---------------+----------------+       +---------------+----------------+
                  |                                        |
                  +--------------------+-------------------+
                                       |
                                       v
                     +----------------------------------+
                     |    Deep Policy Differ Engine     |
                     |  - Fees (Added, Changed)         |
                     |  - Required Documents            |
                     |  - Processing Timelines (TAT)    |
                     +-----------------+----------------+
                                       |
                                       v
                     +----------------------------------+
                     | Proposed Impact Draft            |
                     | Status: DRAFT_PROPOSED           |
                     | (NO USER NOTIFICATION SENT)      |
                     +-----------------+----------------+
                                       |
                                       v
                     +----------------------------------+
                     | Human Editor Approval Gate       |
                     | Reviewer ID & Timestamp Required |
                     +-----------------+----------------+
                                       |
                         +-------------+-------------+
                         |                           |
                 [ If Rejected ]             [ If Approved ]
                         |                           |
                         v                           v
                  Archive Proposal           +----------------------------------+
                                             | Saved Journey Impact Evaluator   |
                                             | - Compares submission dates      |
                                             | - Preserves historical rules     |
                                             | - Uncertainty label:             |
                                             |   'AFFECTED_PENDING_REVIEW'      |
                                             +-----------------+----------------+
                                                               |
                                                               v
                                             +----------------------------------+
                                             | User UI Alert & Dismissal Option |
                                             +----------------------------------+
```

## Security & Reliability Controls
1. **Zero Premature Alerts**: Proposals remain in `DRAFT_PROPOSED` until an authorized editor explicitly confirms the accuracy of the extracted gazette order.
2. **Grandfathering Preservation**: Applications filed before the effective date retain explicit notes indicating that historical statutory guidelines govern their adjudication.
3. **Explicit User Dismissal**: Citizens can inspect individual diffs and dismiss alerts with audit notes.
