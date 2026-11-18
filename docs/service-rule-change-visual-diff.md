# Citizen-Facing Service Rule Change Visual Diff with Saved-Checklist Impact

## Purpose & Scope
When municipal or state departments update service rules — revising fees, adding mandatory documents (e.g. fire clearance), or abolishing outdated requirements (e.g. physical notarized affidavits) — citizens who previously saved a checklist are often caught unaware.

This service computes a semantic version diff between two published rule sets, automatically evaluates the impact on active citizen plans, and displays clear visual status badges.

---

## Semantic Diff Categorization
- **Added (`ADDED`)**: Newly introduced statutory conditions (e.g., Mandatory Rainwater Harvesting or Energy Efficiency certificate).
- **Modified (`MODIFIED`)**: Changed parameter values (e.g., base application fee increased from ₹250 to ₹350, or turnaround time shortened from 30 days to 14 days under a Citizen Charter amendment).
- **Removed (`REMOVED`)**: Abolished procedures (e.g., elimination of physical gazetteer officer attestations under digital governance reforms).
- **Unchanged (`UNCHANGED`)**: Stable rules persisting across versions.

---

## Prospective Application & Non-Retroactivity Rule
- Revisions in procedural fees or documentation standards apply strictly **prospectively**.
- Applications already submitted and acknowledged under an earlier version are grandfathered under the doctrine of legitimate expectation unless primary legislation provides retrospective force.
- Version rollbacks are implemented by publishing an incremental version rather than mutating historical logs.

---

## Saved-Checklist Impact Badges
When a citizen opens their private saved service plan, affected items are annotated:
- `[RULE_REMOVED]`: Explains that the requirement has been rescinded by executive order; saves unnecessary procurement effort.
- `[REQUIREMENT_MODIFIED]`: Cites the exact old value versus the new value with the official gazette reference.
- `[NO_CHANGE]`: Indicates the item remains valid as originally planned.

---

## Audited Notification & Acknowledgment
- Notifications are triggered only for **reviewed and published** official revisions. Unreviewed internal drafts never send alerts.
- Citizens can acknowledge and dismiss alerts with one click, preserving a persistent historical record of version transitions.
