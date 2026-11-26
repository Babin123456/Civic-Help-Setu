# Rainwater Harvesting Rules and Building Compliance Guide

## Context & Objectives
Rapid urbanisation and groundwater depletion have led Indian municipal corporations to mandate Rainwater Harvesting (RWH) in building bye-laws. Homeowners and Resident Welfare Associations (RWAs) often do not know whether RWH is compulsory for their specific plot size, what penalties apply for non-installation, or how to maintain filtration sumps.

## Key Capabilities
1. **City-Specific Municipal Bye-Law Mapping (`rainwaterHarvestingRulesData.js`)**:
   - Covers Bengaluru (BWSSB 1200/2400 sq ft rule & tariff surcharge penalties).
   - Covers Delhi (DJB/MCD UBBL 2016 100/500 sq m mandate).
   - Covers Chennai (CMWSSB mandatory for all buildings).
2. **Threshold Evaluation & Fallback (`rainwaterHarvestingComplianceService.js`)**:
   - Evaluates whether installation is mandatory based on plot size and construction vintage.
   - Falls back gracefully to national Model Building Bye-Laws when local rules are unindexed.
3. **Plain-Language Technical Explanations**:
   - Deconstructs components: Catchment, First Flush Diverter, Sand-Gravel Filtration, Sump/Recharge Well.
4. **Seasonal Maintenance Checklist**:
   - Pre-monsoon gutter desilting and post-monsoon mosquito prevention mesh checks.
