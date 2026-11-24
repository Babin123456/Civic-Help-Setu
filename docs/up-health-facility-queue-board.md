# UP Public Health Facility Queue and Service Availability Observation Board

## Overview
Under the **National Health Mission (NHM)** and the Department of Medical Health and Family Welfare, Government of Uttar Pradesh (`uphealth.up.gov.in`), thousands of citizens visit Primary Health Centres (PHCs), Community Health Centres (CHCs), and District Hospitals daily.

A major bottleneck for rural patients, pregnant women, and senior citizens is extreme queue congestion at non-clinical counters (OPD registration, pharmacy dispensary, and diagnostic sample counters) or unannounced counter closures.

This service establishes an intra-day crowd observation board focusing on counter service flow, waiting time estimates, and medicine stock availability.

---

## Service Standards & Wait-Time Benchmarks

| Counter Type | Prescribed Maximum Queue Wait | Administrative Standard |
|---|---|---|
| **OPD Registration / Parchi Counter** | **20 Minutes** | ABHA Scan-and-Share QR digital queue + manual token desk. |
| **Pharmacy / Free Medicine Counter** | **25 Minutes** | Free generic drug dispensing under UP Medical Supplies Corporation Ltd (UPMSCL). |
| **Diagnostic Pathology Lab** | **30 Minutes** | Free blood/urine collection for CBC, blood sugar, lipid profile, malaria/dengue. |
| **X-Ray & Radiology** | **45 Minutes** | Emergency priority + token queue for OPD patients. |

---

## Architectural Principles

1. **4-Hour Intra-Day Freshness Decay**:
   - Hospital OPD crowds peak between 08:30 AM and 11:30 AM and taper off by early afternoon.
   - Any patient queue observation older than **4 hours** automatically expires to ensure accurate, real-time advice for citizens traveling from distant villages.

2. **Consensus Aggregation (3+ Verified Observations)**:
   - A single report of medicine stock-out or long queues does not trigger automated public alerts. At least 3 independent patient logs within the 4-hour window are required to confirm consensus.

3. **Strict Patient Clinical Privacy**:
   - **Zero Health Records**: No patient medical history, clinical diagnoses, doctor prescriptions, or illness details are ever recorded.
   - The system tracks only physical counter operations, wait times, and commodity availability.

---

## Escalation Matrix & Emergency Health Contacts
- **Facility Level**: Medical Officer In-Charge (MOIC) / Chief Medical Superintendent (CMS).
- **District Level**: Chief Medical Officer (CMO / Mukhya Chikitsa Adhikari).
- **Emergency Ambulance Services**:
  - Dial **108**: 24x7 Free Emergency Ambulance (Trauma & Critical illness).
  - Dial **102**: 24x7 Free National Ambulance Service for Pregnant Women & Sick Newborns (JSSK).
  - Dial **1076**: UP CM Jan Sunwai Grievance Helpline.
