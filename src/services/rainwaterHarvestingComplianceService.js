/**
 * @file rainwaterHarvestingComplianceService.js
 * @description Evaluates property rainwater harvesting (RWH) compliance requirements,
 * explains technical design components in plain language, and generates seasonal maintenance checklists.
 * Clarifies generic guidance when local municipal rules are unavailable.
 */

import { MUNICIPAL_RWH_BYELAWS } from '../data/rainwaterHarvestingRulesData.js';

export class RainwaterHarvestingComplianceService {
  constructor(byelaws = MUNICIPAL_RWH_BYELAWS) {
    this.byelaws = byelaws;
  }

  /**
   * Assesses statutory RWH mandate based on city/jurisdiction, plot area, and building age.
   */
  evaluateComplianceRequirement(jurisdictionId, plotAreaSqFt, isNewConstruction = true) {
    const rule = this.byelaws.find(b => b.jurisdictionId === jurisdictionId);

    if (!rule) {
      return {
        isLocalRuleFound: false,
        city: 'Unknown / Unindexed Municipality',
        mandated: null,
        message: 'No verified municipal bye-law indexed for this jurisdiction. Showing generic national Model Building Bye-Laws (MBBL) recommendation: RWH is recommended for all plots over 1,000 sq ft.',
        components: [
          { name: 'Rooftop Catchment', function: 'Capture terrace runoff.' },
          { name: 'First Flush', function: 'Discard initial dirty runoff.' },
          { name: 'Filter & Recharge Pit', function: 'Infiltrate cleaned water into shallow aquifer.' }
        ]
      };
    }

    const threshold = isNewConstruction
      ? rule.mandatoryThresholds.newBuildingsPlotAreaSqFt
      : rule.mandatoryThresholds.existingBuildingsPlotAreaSqFt;

    const isMandatory = plotAreaSqFt >= threshold;

    return {
      isLocalRuleFound: true,
      city: rule.city,
      jurisdictionId: rule.jurisdictionId,
      governingAuthority: rule.governingAuthority,
      statutoryNotification: rule.statutoryNotification,
      plotAreaSqFt,
      thresholdSqFt: threshold,
      isMandatory,
      penaltiesForNonCompliance: isMandatory ? rule.penaltiesForNonCompliance : 'Exempt from statutory surcharge due to smaller plot footprint.',
      keyComponents: rule.keyComponents,
      inspectionAgency: rule.inspectionAgency,
      officialPortalUrl: rule.officialPortalUrl,
      lastVerifiedDate: rule.lastVerifiedDate,
      disclaimer: 'This assessment is educational and does not substitute for structural inspection by an empanelled civil engineer or municipal town planning officer.'
    };
  }

  /**
   * Generates a pre-monsoon and post-monsoon maintenance checklist.
   */
  generateMaintenanceChecklist() {
    return {
      title: 'Rainwater Harvesting Seasonal Maintenance Checklist',
      preMonsoonSteps: [
        { task: 'Clean Roof Catchment', details: 'Sweep terrace free of leaves, bird droppings, and loose dust.' },
        { task: 'Inspect Gutters & Downpipes', details: 'Ensure no cracks, blockages, or stagnant debris in PVC downpipes.' },
        { task: 'Replace Filter Medium', details: 'Wash or replace sand, charcoal, and gravel in filtration chamber.' },
        { task: 'Flush First-Flush Diverter', details: 'Open the drain cap of the first flush pipe to purge accumulated silt.' }
      ],
      postMonsoonSteps: [
        { task: 'Drain Sediment from Sump', details: 'Pump out bottom sediment and scrub interior walls.' },
        { task: 'Cap Wells to Prevent Mosquitoes', details: 'Fit fine stainless-steel mesh on vent pipes and inspection covers.' }
      ],
      notice: 'Regular maintenance ensures water purity and prevents groundwater contamination.'
    };
  }
}

export const defaultRwhComplianceService = new RainwaterHarvestingComplianceService();
