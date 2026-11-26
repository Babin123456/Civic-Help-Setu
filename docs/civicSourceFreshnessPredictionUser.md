# Civic Information Freshness Prediction and Review Prioritization Model — User Guide (#1189)

## Overview

The Civic Information Freshness Prediction and Review Prioritization Engine
helps maintainers track and control the freshness of civic service pages and
official sources.

Agent workflows and service pages can become outdated when source documents
change, links break, or verification lapses. The engine helps you track which
services need review most urgently by computing a deterministic priority score
based on source change history, link health, and last verification.

All figures are model outputs for triage only. They are **not a truth score**,
**do not constitute official verification**, and **never trigger an autonomous
edit** of civic guidance.

## Accessing the engine

Open the workspace at `/freshness-prediction`. No citizen records, credentials,
raw documents or sensitive prompts are stored or displayed — only aggregated
cost, token, latency and carbon metadata.

## Computing a prediction

1. Enter a **service id** (lowercase slug, e.g. `ration-card-service`).
2. Enter a **service name** (optional, e.g. `Ration Card Service`).
3. Enter **last verified** date (YYYY-MM-DD format, or leave blank if never verified).
4. Select **primary link health** (reachable, redirected, not working, unable to verify, not a web link).
5. Enter **source age in days** (optional, or leave blank if unknown).
6. Toggle **source superseded / withdrawn** if the source has been replaced or revoked.
7. Enter **change events count** (how many times the source has changed).
8. Enter **verification count** (how many times the source has been verified).
9. Select **Compute prediction**.

The engine returns:
- **Priority score** (0–100) — higher means more urgent review needed.
- **Priority band** (low, medium, high, critical).
- **Confidence** (0–100%) — how confident the engine is in the score.
- **Reasons** — why the score was computed this way.
- **Computed at** — when the prediction was computed.

## Inspecting a prediction

Enter a **service id** and select **Get prediction** to view a previously
computed prediction, including its score, band, confidence, reasons, and review
status.

## Listing all predictions

Select **Load predictions** to view all computed predictions, sorted by
priority score (highest first). This helps you triage which services need
review most urgently.

## Reviewing a prediction

After computing a prediction, select **Record review decision** to record your
human decision. You'll be prompted to enter a review decision (pending,
computed, stale, reviewed, superseded, or withdrawn). The prediction will be
marked as reviewed with your name and a timestamp.

## Viewing review audit

Select **Load audit events** to view the history of review decisions, including
who reviewed what and when.

## Viewing drift events

Select **View drift events** to see when a prediction's score changed
significantly (more than 5%). Drift events help you track how priority scores
evolve over time.

## Feature weights

The **Feature weights** section shows the deterministic weights used to compute
the priority score. Higher weights mean the factor contributes more to the
priority score. These weights are configurable by operators.

## Important reminders

- Priority scores are **deterministic triage hints**, not truth scores.
- The engine never autonomously edits guidance, files applications, or denies
  benefits.
- Explicit human review is required for high-priority actions.
- No citizen records, credentials, raw documents or sensitive prompts are
  stored or displayed.
