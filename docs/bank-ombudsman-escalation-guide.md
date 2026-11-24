# Bank Ombudsman Complaint Readiness and Escalation Guide

## Context & Objectives
Under the Reserve Bank - Integrated Ombudsman Scheme, 2021 (RB-IOS), bank account holders have a single-window grievance escalation mechanism covering commercial banks, RRBs, scheduled cooperative banks, and NBFCs. However, premature complaints before fulfilling mandatory bank-level waiting periods or complaints on barred commercial matters are rejected.

## Core Capabilities
1. **Mandatory 30-Day Decision Tree (`rbiOmbudsmanData.js`)**:
   - Enforces the statutory prerequisite of lodging a complaint with the bank first and waiting 30 calendar days or receiving a final rejection letter.
   - Enforces the 1-year limitation period.
2. **Harmonisation Rules & Compensation Limits (`bankOmbudsmanEscalationService.js`)**:
   - Incorporates automated penalty mandates (e.g., ₹100/day for delayed ATM reversal beyond T+5; ₹5,000/day for delayed title deed return beyond 30 days).
   - Details RBI Ombudsman compensation limits (up to ₹20 Lakhs for actual loss; up to ₹1 Lakh for mental agony).
3. **Excluded Matters Filtering**:
   - Flags disputes already pending before courts, DRT, or Consumer Commissions.
4. **Dossier & Checklist Generator**:
   - Compiles evidence packages (bank ticket ID, proof of delivery, bank statement excerpts) ready for uploading to https://cms.rbi.org.in.
