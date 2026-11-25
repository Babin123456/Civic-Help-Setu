/**
 * @file insuranceClaimGrievanceService.js
 * @description Provides a neutral, educational explainer for insurance claim repudiations,
 * mandatory insurer-level Grievance Redressal Officer (GRO) steps, and Insurance Ombudsman escalation routes.
 * Avoids offering binding legal interpretations of specific policy wording.
 */

import {
  IRDAI_GRIEVANCE_CHANNELS,
  INSURANCE_PRODUCT_CATEGORIES
} from '../data/irdaiGrievanceData.js';

export class InsuranceClaimGrievanceService {
  constructor(channels = IRDAI_GRIEVANCE_CHANNELS, categories = INSURANCE_PRODUCT_CATEGORIES) {
    this.channels = channels;
    this.categories = categories;
  }

  /**
   * Retrieves rejection guidance based on insurance type and specific repudiation clause.
   */
  getRejectionAnalysis(productType, rejectionReasonCode) {
    const prod = this.categories.find(c => c.productType === productType) || this.categories[0];
    const reason = prod.commonRejectionReasons.find(r => r.code === rejectionReasonCode) || prod.commonRejectionReasons[0];

    return {
      productType: prod.productType,
      productTitle: prod.title,
      rejectionCode: reason.code,
      rejectionTitle: reason.title,
      plainExplanation: reason.plainExplanation,
      statutoryCounterCheck: reason.counterCheck,
      recommendedNextSteps: [
        '1. Scrutinize the Repudiation Letter for specific clause references in your Policy Wordings.',
        '2. Obtain an Attestation / Justification Letter from your Treating Doctor / Repair Workshop.',
        '3. Submit formal representation to the Insurer Grievance Redressal Officer (GRO) and wait 15 days.',
        '4. Escalate to IRDAI Bima Bharosa portal (https://bimabharosa.irdai.gov.in).',
        '5. File complaint before the territorial Insurance Ombudsman within 1 year if unresolved.'
      ],
      privacyWarning: 'Do NOT share sensitive medical records, prescription images, or diagnostic scans through third-party platforms without redaction.',
      disclaimer: 'This explainer is purely informational based on IRDAI guidelines. Individual coverage determinations require examining your specific policy schedule.'
    };
  }

  /**
   * Evaluates readiness for Insurance Ombudsman escalation.
   */
  evaluateOmbudsmanReadiness(caseDetails = {}) {
    const blockers = [];
    const satisfiedSteps = [];

    // Step 1: Grievance to Insurer GRO
    if (!caseDetails.complainedToInsurerGro) {
      blockers.push({
        code: 'GRO_COMPLAINT_MISSING',
        rule: 'Must first lodge written grievance with Insurer Grievance Redressal Officer (GRO).'
      });
    } else {
      satisfiedSteps.push('Written complaint submitted to Insurer GRO.');
    }

    // Step 2: 15-day / 30-day waiting period
    if (caseDetails.groComplaintDate) {
      const filed = new Date(caseDetails.groComplaintDate);
      const elapsed = Math.floor((new Date() - filed) / (1000 * 60 * 60 * 24));

      if (caseDetails.groRejectedClaim) {
        satisfiedSteps.push('Insurer GRO issued written repudiation/rejection letter.');
      } else if (elapsed < 30) {
        blockers.push({
          code: 'STATUTORY_GRO_WAIT_PENDING',
          rule: `Insurer has 30 days to resolve grievance. ${30 - elapsed} days remaining before Ombudsman escalation.`
        });
      } else {
        satisfiedSteps.push(`30 days elapsed without GRO resolution (${elapsed} days).`);
      }
    }

    // Step 3: Bar against parallel court litigation
    if (caseDetails.isPendingInConsumerCourt) {
      blockers.push({
        code: 'PARALLEL_LITIGATION_BARRED',
        rule: 'Ombudsman cannot entertain matters currently pending before Consumer Disputes Redressal Commissions or Civil Courts.'
      });
    }

    const isReady = blockers.length === 0 && satisfiedSteps.length >= 2;

    return {
      isReady,
      status: isReady ? 'ELIGIBLE_FOR_INSURANCE_OMBUDSMAN' : 'PREREQUISITES_NOT_MET',
      blockers,
      satisfiedSteps,
      ombudsmanFramework: this.channels.INSURANCE_OMBUDSMAN_COUNCIL
    };
  }

  /**
   * Generates a rejection letter checklist and timeline template.
   */
  generateRejectionChecklist() {
    return {
      title: 'Insurance Claim Repudiation Document Checklist',
      items: [
        'Complete Policy Schedule and Terms & Conditions Booklet',
        'Official Claim Repudiation Letter with specific clause citations',
        'Original Hospital Discharge Summary and Itemized Final Bill',
        'Treating Doctor Certificate justifying emergency/unavoidable medical treatment',
        'All written email correspondence and grievance ticket numbers with the insurer'
      ],
      escalationSequence: [
        'Insurer Grievance Redressal Officer (GRO) -> IRDAI Bima Bharosa -> Insurance Ombudsman -> District Consumer Commission'
      ]
    };
  }
}

export const defaultInsuranceGrievanceService = new InsuranceClaimGrievanceService();
