/**
 * @file tradeLicenceChecklistService.js
 * @description Generates jurisdiction-specific trade licence renewal checklists, explains distinct
 * business regulatory regimes (Municipal Trade vs Shops Act vs FSSAI vs GST), and verifies payment acknowledgments.
 * Avoids claiming that a single trade licence covers all regulatory requirements.
 */

import {
  MUNICIPAL_TRADE_LICENCE_DATA,
  DISTINCT_BUSINESS_REGISTRATIONS
} from '../data/tradeLicenceRegistryData.js';

export class TradeLicenceChecklistService {
  constructor(municipalData = MUNICIPAL_TRADE_LICENCE_DATA, distinctRegs = DISTINCT_BUSINESS_REGISTRATIONS) {
    this.municipalData = municipalData;
    this.distinctRegs = distinctRegs;
  }

  /**
   * Retrieves trade licence renewal guidance for a city/local body.
   */
  getMunicipalTradeLicenceGuide(jurisdictionId) {
    const matched = this.municipalData.find(m => m.jurisdictionId === jurisdictionId);

    if (!matched) {
      return {
        isLocalRuleFound: false,
        jurisdictionId,
        message: 'No verified municipal trade licence rules indexed for this local body. Showing generic municipal trade licence renewal standards.',
        distinctRegistrations: this.distinctRegs,
        disclaimer: 'Do not rely on a single licence; check with your local municipal health department.'
      };
    }

    return {
      isLocalRuleFound: true,
      jurisdictionId: matched.jurisdictionId,
      city: matched.city,
      authority: matched.administeringAuthority,
      portalUrl: matched.portalUrl,
      renewalDeadline: matched.renewalDeadlineMonth,
      requiredDocuments: matched.standardDocuments,
      feeSlabs: matched.sampleFeeSlabs,
      lastVerifiedDate: matched.lastVerifiedDate,
      distinctRegistrations: this.distinctRegs,
      disclaimer: 'A Municipal Trade Licence does NOT substitute for FSSAI food certification, Labour Shops Act registration, or GST compliance.'
    };
  }

  /**
   * Explains how distinct business registrations differ to avoid legal non-compliance.
   */
  getDistinctRegistrationMatrix() {
    return this.distinctRegs;
  }

  /**
   * Generates an editable renewal reminder checklist with document readiness.
   */
  generateRenewalReminderChecklist(jurisdictionId, businessName = 'My Business') {
    const guide = this.getMunicipalTradeLicenceGuide(jurisdictionId);

    return {
      businessName,
      title: `Trade Licence Renewal Reminder Checklist: ${guide.city || 'Municipal Corporation'}`,
      renewalDeadline: guide.renewalDeadline || 'Before fiscal year close (March 31)',
      portalUrl: guide.portalUrl,
      documentSteps: (guide.requiredDocuments || [
        'Updated Property Tax Paid Receipt of premises',
        'Commercial Electricity Bill / BESCOM receipt',
        'Valid Lease/Rent Agreement'
      ]).map((doc, idx) => ({
        step: idx + 1,
        documentName: doc,
        verified: false
      })),
      receiptVerificationInstructions: [
        '1. Upon online payment, ensure the generated receipt carries an official QR Code and unique Transaction Ref (Challan Number).',
        '2. Verify that the trade category name and valid-upto date match the current financial year.',
        '3. Display a printed copy of the renewed Trade Licence conspicuously at the entrance of your commercial shop.'
      ],
      legalComplianceWarning: 'Operating a trade without an active municipal trade licence can lead to health officer sealing notices or fine compounding under the Municipal Corporation Act.'
    };
  }
}

export const defaultTradeLicenceService = new TradeLicenceChecklistService();
