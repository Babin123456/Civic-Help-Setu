# Civic Form Completion Agent with Field-Level Evidence Binding

## Problem Statement
Completing complex government application forms (e.g., voter registration Form 6, caste certificate applications, or pension forms) is prone to errors. Generic AI autofill often hallucinates details or submits unverified citizen attributes.

## Core Principles
1. **Field-Level Evidence Binding**: Every filled field is strictly bound to an excerpt from verified citizen documents (e.g., Aadhaar, utility bills, matriculation marks card).
2. **Confidence Thresholds**: Fields below confidence thresholds remain blank and are marked `UNRESOLVED_MANUAL_INPUT_REQUIRED`.
3. **No Auto-Submit Guarantee**: `canAutoSubmit` is permanently `false`. Citizens must review and verify all proposals before saving or manual submission.
4. **Transparent Audit**: Displays source document ID, exact snippet, and matching rule for each field.
