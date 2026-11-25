# Gig and Platform Worker Welfare Registration Guide

## Problem Statement
App-based gig workers (food delivery partners, ride-hailing drivers, quick-commerce pickers, and freelance technicians) are often confused about where and how to access emerging statutory social security benefits, state welfare boards, and how government schemes differ from company-provided commercial insurance.

## Key Architecture
1. **Separation of Schemes (`gigWorkerWelfareData.js`)**:
   - Central Framework: Code on Social Security 2020 & e-Shram UAN registrations.
   - State-Level Statutory Boards: Rajasthan Platform Based Gig Workers Act 2023, Karnataka Gig Worker Accident Insurance.
2. **Explicit Demarcation of Government vs. Private Platform Perks (`gigWorkerWelfareService.js`)**:
   - Clarifies that government statutory schemes remain portable across platforms, whereas private app perks terminate upon deactivation.
3. **Unavailability Transparency**:
   - Explicitly alerts users when a state currently lacks a notified state-specific welfare board, redirecting them to central e-Shram safeguards rather than inventing procedures.
4. **Non-Impersonation Guarantee**:
   - Explicit disclaimers confirm that Civic Help Setu is strictly an informational tool and does not process official registrations or claim sanctions.
