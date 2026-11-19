# Property-Tax Assessment Breakdown & Correction Visualizer

## Problem Statement & Scope
Property owners frequently face unexplained sudden escalations in annual municipal property tax bills without clarity on whether the hike results from revised Unit Area Values (UAV), reassessed built-up plinth area, loss of depreciation benefits, or erroneous reclassification from self-occupied residential to tenanted commercial.

This tool visualizes the exact mathematical composition of the tax assessment, performs Year-over-Year (YoY) differential analysis, and generates a structured evidence checklist for filing municipal objections.

---

## Assessment Mathematical Framework
In most Indian Urban Local Bodies (e.g., BBMP SAS, MCD Unit Area System, BMC Capital Value System):

$$\text{Annual Value} = \text{Built-up Area (sq ft)} \times \text{Base Unit Rate} \times \text{Usage Multiplier} \times (1 - \text{Depreciation}) \times 10\text{ months}$$

$$\text{Base Tax} = 20\% \times \text{Annual Value}$$

$$\text{Total Payable} = \text{Base Tax} + \text{SWM Cess (15\%)} + \text{Library Cess (6\%)} + \text{Beggar Cess (3\%)} - \text{Early Rebate (5\%)}$$

---

## Municipal Statutory Appellate Hierarchy
- **First Level Review**: Application before Assistant Revenue Officer (ARO) within 30 days of bill receipt.
- **Second Level Grievance**: Appeal before Joint Commissioner (Revenue) under Section 144.
- **Judicial Tribunal**: Appeal before Chief Judge of the Court of Small Causes / Municipal Taxation Appeals Tribunal.

---

## Root-Cause Differential Analysis
The tool compares current versus preceding assessment records across key parameters:
1. **Built-up Area Delta**: Checks if physical extensions or satellite measurement resurveys expanded declared area.
2. **Occupancy Multiplier**: Detects if residential self-occupied status (1.0x factor) was incorrectly flipped to tenanted residential (2.0x factor) or commercial (3.5x–4.0x factor).
3. **Depreciation Verification**: Ensures building aging allowances (up to 30% cap) are accurately maintained.

---

## Municipal Objection & Correction Pathway
- Generates a customized evidence preparation list (architect measurement certificates, electricity meter bills in owner name, occupancy affidavits).
- **Statutory Limitation**: Objections under Section 108 / Section 143 of Municipal Acts must be lodged within **30 days** of receiving the provisional assessment notice.
- **Zero Automated Filing Guarantee**: The tool assists preparation and verification; it never files legal tax objections without explicit citizen execution.
