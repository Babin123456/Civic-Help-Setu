# AI-Assisted Civic Service Journey Map with Interactive Authority Swimlanes

## Purpose & Scope
This service models complex, multi-authority civic service journeys (such as water connections, trade licences, and building sanctions) as interactive, versioned visual swimlanes. It visually demystifies hand-offs between citizens, facilitation kiosks, local urban bodies, and central government verification portals.

---

## Authority Swimlanes
1. **Citizen Action (`CITIZEN_ACTION`)**: Steps requiring direct citizen involvement (online application form, payment of fees, uploading property deeds).
2. **Service Centre (`SERVICE_CENTRE`)**: Frontline facilitation points (CSC kiosks, citizen service desks, municipal intake counters).
3. **Local Authority (`LOCAL_AUTHORITY`)**: Urban Local Body / Panchayat departments (Junior Engineer site inspections, Executive Engineer sanctions).
4. **External Portal (`EXTERNAL_PORTAL`)**: Cross-departmental systems (Right of Way road digging portal, Traffic Police clearance, Revenue Bhoomi portal).

---

## Node Types & Visual States
- **Action Node (`ACTION`)**: Standard operational step with prerequisites, SLAs, and official document requirements.
- **Decision Diamond (`DECISION_DIAMOND`)**: Branching point evaluating statutory compliance (e.g., feasibility report approval vs. pipeline extension requirement).
- **Parallel Branch (`PARALLEL_BRANCH`)**: Tasks executed concurrently across independent authorities.
- **Terminal Outcome (`TERMINAL_OUTCOME`)**: Formal delivery of civic entitlement (meter installation, certificate grant, or dismissal).

---

## Accessible Linear Fallback
In compliance with WCAG 2.1 accessibility criteria, every visual swimlane diagram maintains an equivalent linear stepper sequence that screen readers and mobile viewport users can traverse sequentially without loss of context.

---

## Bounded AI & Information Verification
- AI assistance is constrained to providing concise, plain-language summaries of verified steps.
- The AI is statutorily prohibited from inventing deadlines, fees, or requirements. If verified evidence is absent for a node, the UI explicitly labels it as **"Information not verified"**.
- Private progress snapshots allow citizens to bookmark understood stages without affecting real-world administrative application statuses.
