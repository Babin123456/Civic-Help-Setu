# Civic Fee Composition Explorer with Scenario Sliders

## Purpose & Scope
Government service web pages often present a single flat fee, obscuring underlying components such as base application fees, variable meter connection sizes, road restoration rates, statutory cesses, optional express scrutiny, and statutory concessions.

This explorer breaks down the full composition using deterministic arithmetic tied directly to published gazettes and municipal rate schedules.

---

## Charge Taxonomies
- **Fixed (`FIXED`)**: Mandatory base scrutiny or application processing fees.
- **Variable (`VARIABLE`)**: Costs driven by input sliders (e.g. pipe diameter, linear meters of road cutting, built-up floor area).
- **Statutory Cess (`CESS`)**: Mandatory environmental, sanitation, or infrastructure development surcharges mandated by state legislature.
- **Optional (`OPTIONAL`)**: Expedited 48-hour inspections or ancillary services chosen at citizen discretion.
- **Concession (`CONCESSION`)**: Statutorily protected rebates (e.g., 50% waiver for BPL/Antyodaya households or women entrepreneurs).

---

## Strict Deterministic Computation
- All arithmetic operations are executed in deterministic code.
- **Zero Generative AI Hallucination**: AI is limited strictly to summarizing legal definitions and explaining municipal terms. Under no circumstance does an LLM generate or approximate fee amounts.
- Every line item references an explicit statutory notification or PWD schedule of rates.

---

## Payment Gateway & Surcharge Transparency
- **UPI & RuPay Debit Cards**: Zero merchant transaction charges under Ministry of Finance guidelines.
- **Net Banking & Credit Cards**: Clearly identifies whether a ₹10 flat bank charge or a 1.2% payment gateway convenience fee is levied by the treasury portal.

---

## Scenario Simulation & Comparison
Citizens can slide parameters (e.g., comparing a 0.5-inch domestic line vs. a 1.0-inch line, or 2 meters vs. 5 meters of road cutting) to evaluate financial implications prior to submitting physical applications.
