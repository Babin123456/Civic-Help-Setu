# Civic Service Counter Demand Forecasting & Queue Staffing (#764)

## Overview & Problem Statement
Civic Help Setu provides an end-to-end operational capacity planning module for estimating daily and hourly civic service counter demand and assisting facilitation centre managers with queue staffing.

The module ingests **aggregated** appointments, walk-ins, service categories, holiday calendars, and office counter capacities to compute probabilistic demand forecasts and queue staffing requirements using **Erlang-C ($M/M/c$) queueing theory**.

> **Zero-Guarantee Principle**: This workspace is an administrative planning tool. Citizens see probabilistic traffic patterns only and are **never** presented with false wait-time guarantees.

---

## 1. Mathematical Models & Forecasting Algorithms

### A. Seasonal Time-Series Demand Baseline
Hourly demand is decomposed using day-of-week seasonality, diurnal hourly ratios, and holiday impact multipliers:

$$\text{Demand}(t) = \text{BaseLevel} \times \text{DoW}(d) \times \text{HourFactor}(h) \times \text{HolidayMultiplier}(t) \times \text{PostHolidaySurge}(t)$$

- **Day-of-Week Seasonality ($\text{DoW}$)**: Captures civic rush cycles (e.g. Monday +35% surge, Saturday -55% light load).
- **Diurnal Factor ($\text{HourFactor}$)**: 8 operating hours (09:00 to 17:00), capturing typical 10:00-12:00 morning and 15:00-16:00 afternoon peaks.
- **Holiday Multiplier**: Gazetted holidays set multiplier to $0.0$ (closed).
- **Post-Holiday Backlog Recovery**: Days immediately following closures reflect a $+35\%$ to $+55\%$ backlog surge.

### B. Prediction Intervals
Residual variance ($s_e$) over the historical observation window yields confidence ribbons:
- **80% Prediction Interval**: $\text{Demand} \pm 1.28 \times s_e$
- **95% Prediction Interval**: $\text{Demand} \pm 1.96 \times s_e$

### C. Erlang-C ($M/M/c$) Queue Staffing Optimization
Given hourly arrivals $\lambda$ and service rate $\mu = \frac{60}{\text{avgServiceDurationMinutes}}$ per counter:

1. **Offered Load (Traffic Intensity)**:
   $$A = \frac{\lambda}{\mu}$$
2. **Erlang-C Probability of Waiting $P(\text{Wait} > 0)$**:
   $$C(c, A) = \frac{\frac{A^c}{c!} \frac{c}{c - A}}{\sum_{k=0}^{c-1} \frac{A^k}{k!} + \frac{A^c}{c!} \frac{c}{c - A}} \quad (\text{for } c > A)$$
3. **Staffing Optimization Objective**:
   Find the minimum integer $c$ such that:
   - System utilization $\rho = \frac{A}{c} \le 0.85$ (preventing unbounded queue growth)
   - Probability of wait exceeding statutory target $T$ is $\le 20\%$:
     $$P(W > T) = C(c, A) \cdot e^{-(c\mu - \lambda) T} \le 0.20$$
4. **Buffer Staff Allocation**:
   $$c_{\text{buffer}} = \min(c_{\text{max}}, \lceil c \times (1 + \text{bufferStaffRatio}) \rceil)$$

---

## 2. Normalized Data Architecture

| Entity | Collection / Key | Key Attributes |
|---|---|---|
| `OfficeCapacity` | `office_capacity` | `officeId`, `jurisdiction`, `totalPhysicalCounters`, `defaultOpenCounters`, `operatingHours`, `bufferStaffRatio` |
| `ServiceCategory` | `service_categories` | `categoryId`, `name`, `defaultServiceDurationMinutes`, `targetMaxWaitMinutes`, `seasonalityWeight` |
| `HolidayCalendar` | `holiday_calendar` | `holidayId`, `date`, `jurisdiction`, `type`, `impactMultiplier`, `postHolidaySurgeMultiplier` |
| `OfficeDemandAggregate` | `civicbridge_counter_aggregates_v1` | `aggregateId`, `officeId`, `date`, `timeSlot`, `totalFootfall`, `appointmentCount`, `walkInCount`, `isSuppressed` |
| `CapacityPlan` | `civicbridge_capacity_plans_v1` | `planId`, `officeId`, `planDate`, `status`, `hourlyStaffing`, `overrideReason`, `hasVarianceOverride`, `approvedBy` |
| `CapacityAuditLog` | `civicbridge_capacity_audit_logs_v1` | `auditId`, `planId`, `action`, `actor`, `details`, `timestamp` |

---

## 3. Finite State Machine (Capacity Plan Lifecycle)

```
       +------------+
       |   DRAFT    |<----------------+
       +-----+------+                 |
             | submitForReview()      | revisePlan()
             v                        |
       +------------+                 |
       | SUBMITTED  +-----------------+
       +-----+------+  rejectPlan()
             |
             | approvePlan() [Manager/Admin]
             v
       +------------+
       |  APPROVED  |
       +-----+------+
             | archivePlan()
             v
       +------------+
       |  ARCHIVED  |
       +------------+
```

### Mandatory Human Override Rule
If human staffing departs by **$\ge 20\%$** from the Erlang-C recommendation, the system enforces entering a mandatory operational justification (minimum 8 characters) before the draft can be saved or submitted, which is permanently logged in the audit trail.

---

## 4. Privacy, Security & Zero-PII Guarantees

1. **Zero-PII Schema Validation**: Strictly prohibits storing citizen names, telephone numbers, Aadhaar/PAN, or individual application tokens.
2. **Small-Group Suppression ($k$-anonymity)**: Any hourly bin with total footfall $< 5$ is masked (`isSuppressed = true`, counts set to `0`) to prevent de-anonymization of unique visitors.
3. **AbuseGuard Rate Limiting**: Serverless submissions in `api/counter-demand-reports.js` enforce IP rate limits (12/min) and single-flight in-flight deduplication.

---

## 5. Verification & Testing

Run targeted test suites locally:
```bash
# Contract & schema validation tests
npx vitest run src/data/counterDemandContract.test.js

# Erlang-C, forecasting, backtesting, and state machine tests
npx vitest run src/services/counterDemandForecastingService.test.js

# Workspace UI, accessibility, and state resilience tests
npx vitest run src/pages/CounterDemandForecastingWorkspace.test.jsx

# Serverless API endpoint tests
npx vitest run tests/counter-demand-reports.test.js

# Admin moderation queue tests
npx vitest run src/components/admin/CounterDemandReviewQueue.test.jsx

# Service directory banner integration tests
npx vitest run src/pages/ServiceDetails.test.jsx
```

