# Civic Agent Cost and Carbon Budget Governor — User Guide (#1185)

## Overview

The Civic Agent Cost and Carbon Budget Governor helps you track and control the
cost, tokens, latency and estimated carbon impact of AI agent workflows in
Civic Help Setu.

Agent workflows can become expensive when retries and multi-model chains are
unbounded. The governor enforces budgets and stop conditions, routes to cheaper
deterministic fallbacks when budgets are exhausted, and surfaces transparent
estimates so you can make informed choices.

All cost, energy and carbon figures are **estimates** derived from token counts
and published model pricing. They are **not a bill** and do not include
provider taxes, surcharges or discounts.

## Accessing the governor

Open the workspace at `/cost-carbon-governor`. No citizen records, credentials,
raw documents or sensitive prompts are stored or displayed — only aggregated
cost, token, latency and carbon metadata.

## Starting a governed run

1. Enter a **workflow id** (lowercase slug, e.g. `civic-assistant-query-flow`).
2. Enter a **model id** (e.g. `gpt-4o-mini`).
3. Optionally enter a **prompt**. The prompt is hashed before storage; the
   actual text is never kept.
4. Optionally select a **policy id** to apply a specific budget policy. The
   default budget policy applies if none is given.
5. If this is a **high-impact action**, confirm the explicit human approval
   checkbox. High-impact actions require explicit human approval and are never
   executed autonomously (no autonomous filings, denials or official
   verifications).
6. Select **Start governed run**.

A run is created with zeroed totals and a `running` status.

## Recording a model call

1. With an active (running) run, enter a **model id** and **prompt**.
2. Select **Record governed call**.

The governor estimates cost, tokens, energy and carbon before the call, then
records actual usage after the call. If a cumulative budget or stop condition is
reached, the run is stopped and you are offered a deterministic fallback or a
clear block message.

## Viewing run status

Each run shows:
- Run id and status (`pending`, `running`, `completed`, `stopped`, `fallback`, `blocked`, `failed`)
- Estimated cost (USD), tokens (in/out), and carbon (gCO2e)
- A table of recorded calls with model, source, tokens, cost and carbon

When a run stops due to a budget or stop condition, the reason is shown.

## Viewing workflow aggregates

Enter a **workflow id** and select **Load aggregate** to see totals across all
runs for that workflow: run count, total calls, total cost and total carbon.

## Budget policies

Policies define per-workflow cost, token, latency and carbon ceilings. The
default budget policy is applied unless you specify a different policy id.
Policies can be created or updated through the operator API at
`/api/civic-agent-cost-carbon/policies`.

## Important reminders

- Cost, energy and carbon figures are **estimates only**, not a bill.
- AI outputs are untrusted suggestions carrying provenance; they never
  autonomously file applications, deny benefits or claim official verification.
- Explicit human approval is required for high-impact actions.
- The governor provides a non-AI deterministic fallback for essential workflows
  when budgets are exhausted.
- No citizen records, credentials, raw documents or sensitive prompts are
  stored or displayed.
