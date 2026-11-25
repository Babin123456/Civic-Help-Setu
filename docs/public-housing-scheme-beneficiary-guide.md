# Public Housing Scheme Application and Beneficiary Verification Guide

## Context & Objectives
Pradhan Mantri Awas Yojana (PMAY-G Rural and PMAY-U 2.0 Urban) provides subsidized pucca housing to low-income and homeless households. Due to multi-stage approval processes (Gram Sabha listing, field geotagging, plinth-level inspections, FTO releases), applicants frequently fall prey to fraudulent touts claiming they can accelerate approvals for cash.

## Core Capabilities
1. **Rural vs. Urban Segregation (`publicHousingSchemeData.js`)**:
   - PMAY-Gramin: ₹1,20,000 to ₹1,30,000 unit grant + 90 days MGNREGA wages + ₹12,000 Swachh Bharat toilet assistance.
   - PMAY-Urban 2.0: EWS/LIG/MIG verticals, Beneficiary Led Construction (BLC), and interest subsidies.
2. **Deterministic Lifecycle Stages (`publicHousingSchemeGuideService.js`)**:
   - Explicit breakdown of 5 verified phases: Listing -> Pre-construction Geotag -> Plinth inspection -> Lintel inspection -> Final Roof DBT.
3. **Status Vocabulary Explainer**:
   - Plain-language definitions for confusing official terms (FTO, Awaas+ ID, Geotagging Milestone, De-duplication).
4. **Anti-Fraud Protections**:
   - Strict warnings against paying unofficial intermediaries or disclosing OTPs.
