/**
 * @file propertyTaxDisputeGuideService.js
 * @description Provides a city/local-body-aware guide to property tax terminology, rebates, exemptions,
 * and procedural checklists for disputing inaccurate municipal assessments.
 * Explicitly avoids calculating authoritative tax liability from incomplete property data.
 */

import {
  MUNICIPAL_PROPERTY_TAX_RULES,
  PROPERTY_TAX_GLOSSARY
} from '../data/propertyTaxRulesData.js';

export class PropertyTaxDisputeGuideService {
  constructor(rules = MUNICIPAL_PROPERTY_TAX_RULES, glossary = PROPERTY_TAX_GLOSSARY) {
    this.rules = rules;
    this.glossary = glossary;
  }

  /**
   * Retrieves municipal tax rules, rebates, and dispute procedures for a specific local body.
   */
  getMunicipalTaxRules(jurisdictionId) {
    const matched = this.rules.find(r => r.jurisdictionId === jurisdictionId);

    if (!matched) {
      return {
        isVerifiedLocalBodyFound: false,
        jurisdictionId,
        message: 'No verified property tax rules indexed for this urban local body. Displaying standard national property tax principles.',
        commonRebates: ['Early-bird 5% rebate before April/June deadline in most municipal corporations.'],
        disclaimer: 'Always verify on your official municipal corporation website before remitting tax.'
      };
    }

    return {
      isVerifiedLocalBodyFound: true,
      jurisdictionId: matched.jurisdictionId,
      municipality: matched.municipality,
      assessmentSystem: matched.assessmentSystem,
      portalUrl: matched.portalUrl,
      rebates: matched.rebates,
      exemptions: matched.exemptions,
      disputeChannel: matched.disputeChannel,
      receiptVerificationTip: matched.paymentReceiptVerification,
      statutoryNotice: 'Civic Help Setu does NOT calculate binding tax liabilities; consult your official municipal property tax bill.'
    };
  }

  /**
   * Generates a step-by-step checklist for disputing an erroneous assessment notice.
   */
  generateAssessmentDisputeChecklist(jurisdictionId) {
    const rules = this.getMunicipalTaxRules(jurisdictionId);

    return {
      title: `Property Tax Assessment Dispute Checklist - ${rules.municipality || 'Municipal Corporation'}`,
      disputeFilingWindow: 'Must be filed within 30 calendar days from the date of service of the Special Assessment Notice / Demand Notice.',
      prerequisiteDocuments: [
        'Copy of the Impugned Special Notice or Revised Demand Notice showing altered tax slab',
        'Previous 3 years property tax paid receipts and SAS acknowledgment copies',
        'Approved Building Sanction Plan or Architectural Measurement Certificate (if dispute relates to built-up area)',
        'Occupancy Certificate or Electricity Bill showing exact usage classification (Residential vs Commercial)',
        'Sale Deed or Khata / Title document proving ownership'
      ],
      escalationSteps: [
        `1. Submit formal written objection letter to the Assistant Revenue Officer (ARO) / Assessor.`,
        `2. Demand an on-site joint measurement inspection if discrepancy relates to plinth or carpet area.`,
        `3. Obtain a stamped and dated receipt acknowledgement copy of your objection letter.`,
        `4. If rejected without speaking order, file an appeal before the Municipal Taxation Tribunal or Joint Commissioner within statutory limitation.`
      ],
      receiptRetentionGuidance: 'Retain downloaded digitally signed payment receipts indefinitely. In banking transactions, preserve the bank transaction reference (UTR) alongside the municipal G-8 counterfoil.'
    };
  }

  getGlossary() {
    return this.glossary;
  }
}

export const defaultPropertyTaxService = new PropertyTaxDisputeGuideService();
