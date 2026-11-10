# Fairness and Error-Monitoring Framework for Civic Recommendation Models

This document outlines the equity auditing pipeline, error-monitoring framework, demographic parity verification, and automated rollback gates for civic recommendation systems in Civic Help Setu.

## Ethical Foundation
Civic information platforms must deliver equitable service discovery regardless of a citizen's geographic location (tier-1 urban vs rural tribal belt), language, or bandwidth constraints.

Algorithms recommending public schemes must **never**:
1. Harvest or incorporate prohibited attributes (caste, religion, disability status, health records) as ranking features.
2. Systematically under-index services for non-metro or rural jurisdictions.
3. Obscure low-confidence predictions behind false assertions of relevance.

## Metric Definitions

- **Recall@k**: Fraction of relevant civic services appearing in the top-$k$ recommendations.
- **Normalized Discounted Cumulative Gain (nDCG@k)**: Measures ranking quality, penalizing relevant services ranked further down.
- **Disparity Ratio (Four-Fifths Rule)**:
  $$\text{Disparity Ratio} = \frac{\min_{\text{cohort}}(\text{Recall@k})}{\max_{\text{cohort}}(\text{Recall@k})}$$
  A ratio below $0.80$ indicates unacceptable disparity and halts deployment.
- **Brier Calibration Score**: Measures squared divergence between recommendation confidence score and true factual relevance.

## CI/CD Safety Gate & Automatic Rollback

```
   [ Candidate Recommendation Model Release ]
                       │
                       ▼
   +---------------------------------------+
   |   Consented & Synthetic Test Suite    |
   |   (Excludes all protected attributes) |
   +-------------------+-------------------+
                       │
                       ▼
   +---------------------------------------+
   |    Disparity & Calibration Audit      |
   |    - Regional recall gap              |
   |    - Abstention rate check            |
   +-------------------+-------------------+
                       │
         +-------------+-------------+
         |                           |
 [ Disparity < 0.80          [ All Thresholds Met ]
   or Recall < 0.65 ]                │
         │                           ▼
         ▼                 +--------------------+
   +--------------------+  | Proceed Deployment |
   | Block Release &    |  +--------------------+
   | Trigger Rollback   |
   +--------------------+
```
