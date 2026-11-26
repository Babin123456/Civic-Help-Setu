# Fair Contribution Streaks with Anti-Gaming Rules

## Motivation & Healthy Engagement
Daily contribution streak counters often cause perverse incentives in open-source ecosystems:
- Contributors feel pressured to submit trivial whitespace modifications or empty commits simply to keep a streak alive.
- Daily streaks penalize contributors who have exams, illnesses, religious holidays, or family obligations.

The Civic Help Setu Fair Contribution Streaks engine establishes a sustainable, burnout-resistant recognition metric grounded in **Weekly Active Cycles** and built-in **Grace Freezes**.

---

## Architectural Principles

| Mechanism | Design Rule | Purpose |
| :--- | :--- | :--- |
| **Weekly UTC ISO Cadence** | `YYYY-Www` (e.g. `2026-W47`) | Evaluates contributions across complete calendar weeks rather than 24h pressure |
| **Excused Grace Period** | 1 Excused Freeze per cycle | Preserves streak momentum when taking a scheduled 1-week break |
| **Substantive Quality Filter**| Rejects 0-LOC or empty commits | Eliminates gaming and trivial commit spam |
| **Automated Bot Exclusion** | Filters service accounts | Prevents non-human accounts from inflating streaks |

---

## Streak Calculation Rules

1. **Active Week**: A week during which the contributor authored a merged PR, conducted a constructive code review, triaged an issue, or updated documentation.
2. **Grace Activation**: If a contributor misses one week, their streak freezes without resetting, resuming when they return the subsequent week.
3. **Streak Reset**: Only when two or more consecutive inactive weeks elapse does the current streak counter reset to zero.

---

## Streak Progression & Grace Visualizer

```mermaid
flowchart LR
    W1[Week 1: Active PR] -->|Streak: 1| W2[Week 2: Code Review]
    W2 -->|Streak: 2| W3[Week 3: Sick Leave]
    W3 -.->|Grace Freeze Invoked| W4[Week 4: Documentation]
    W4 -->|Streak: 3 Maintained| W5[Week 5: Test Suite]
```

### Edge Cases and Anti-Gaming Safeguards

- **Timestamp Spoofing Mitigation**: Timestamps must fall within legitimate Git server commit windows; retroactively pushed commits backdated by more than 30 days are ignored for current active streaks.
- **Micro-Commit Defense**: Merged PRs containing 0 lines modified or containing only commit message noise are excluded from qualification.
- **Collaborative Health**: Emphasizes collaborative code review alongside authoring code, ensuring that reviewing peers is treated as equal civic contribution.

---

## Verification & Execution

Execute streak tracking test suite:
```bash
npx vitest run src/services/contributionStreakService.test.js
```
Automated workflows evaluate streak statistics during weekly community health reviews.

