# Civic Agent Workflow Policy-as-Code Engine — User Guide (#1187)

## Overview

The Civic Agent Workflow Policy-as-Code Engine lets you define and enforce
machine-readable rules that govern which agent actions, tools, sources and
state transitions are permitted in Civic Help Setu.

Every proposed agent action is evaluated against active policies *before* it
executes. The engine is **deny-by-default**: any action not explicitly
permitted by an active policy is refused.

Decisions are access-control outputs only. They are **not legal advice**,
**do not deny benefits**, and **do not constitute official verification**.
No actions are executed autonomously — high-impact actions require explicit
human approval.

## Accessing the engine

Open the workspace at `/policy-engine`. No citizen records, credentials, raw
documents or sensitive prompts are stored or displayed.

## Evaluating an action

1. Enter a **policy id** (lowercase slug, e.g. `default-civic-agent-policy-v1`).
   The default policy applies if none is given.
2. Select a **resource type** (tool, agent, source, state_transition, workflow).
3. Enter a **resource id** (e.g. `lookupServiceDetails`).
4. Enter an **action** (e.g. `read`, `save`, `submit`).
5. Enter a **role** (e.g. `citizen`, `admin`).
6. Optionally enter **context** as JSON (e.g. `{}`).
7. Toggle the relevant flags:
   - **Citizen confirmed** — the citizen has confirmed the action.
   - **Human approved** — explicit human approval for a high-impact action.
   - **Source verified** — the source has been verified.
8. Enter a **daily call count** (default 0).
9. Select **Evaluate action**.

The engine returns:
- **Permitted** — yes or no.
- **Decision** — allow, deny, or require_approval.
- **Reason** — why the decision was made.
- **Code** — the stable result code.
- **Policy** — the policy id and version used.
- **Matched rule** — the rule that determined the outcome (if any).
- **Explanation** — a human-readable explanation.

## Inspecting a policy

Enter a **policy id** and select **Inspect policy** to view:
- Policy name, version, description and status.
- Whether deny-by-default is enabled.
- Whether emergency lock is active.
- The policy's rules (each with resource type/id, effect, priority, roles).

## Viewing policy versions

Each policy update creates a new version. Select **Inspect policy** to view the
version history, including when each version was applied.

## Viewing evaluation audit

Select **Load evaluation audit events** to view the aggregated audit trail of
past evaluations (action, permitted/denied, resource, timestamp). Audit records
contain no sensitive data.

## Policy simulation (testing)

The engine includes simulation to validate policy behaviour with synthetic
data:

- **Bypass attempts** — checks whether actions that should be denied are
  accidentally permitted.
- **Conflicting policies** — verifies higher-priority rules win when allow and
  deny rules overlap.
- **Emergency revocation** — verifies actions are suspended after a policy is
  emergency-locked.
- **Deny-by-default** — verifies unknown resources and missing policies are
  denied.

These are synthetic tests only and produce no real decisions.

## Important reminders

- Decisions are access-control outputs, not legal advice or benefit denial.
- The engine never autonomously files applications, denies benefits or claims
  official verification.
- Explicit human approval is required for high-impact actions.
- No citizen records, credentials, raw documents or sensitive prompts are
  stored or displayed.
