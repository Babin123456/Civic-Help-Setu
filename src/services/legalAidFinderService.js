/**
 * @file legalAidFinderService.js
 * @description Provides a neutral, source-grounded navigator for legal aid eligibility under Section 12
 * of the Legal Services Authorities Act, 1987, alongside a verified DLSA / SLSA contact finder.
 * Does not provide legal counsel or predict case outcomes.
 */

import { STATUTORY_LEGAL_AID_CRITERIA_SEC_12, DLSA_DIRECTORY } from '../data/legalAidDirectoryData.js';

export class LegalAidFinderService {
  constructor(criteria = STATUTORY_LEGAL_AID_CRITERIA_SEC_12, directory = DLSA_DIRECTORY) {
    this.criteria = criteria;
    this.directory = directory;
    this.contactReports = [];
  }

  /**
   * Evaluates Section 12 statutory eligibility without forming legal opinions.
   */
  evaluateEligibility(applicant = {}) {
    const matchedCategories = [];
    let isIncomeExempt = false;

    // Check income-exempt categories
    if (applicant.isWoman || applicant.isChild) {
      matchedCategories.push(this.criteria.find(c => c.categoryCode === 'WOMEN_AND_CHILDREN'));
      isIncomeExempt = true;
    }
    if (applicant.isSC || applicant.isST) {
      matchedCategories.push(this.criteria.find(c => c.categoryCode === 'SC_ST'));
      isIncomeExempt = true;
    }
    if (applicant.hasDisability) {
      matchedCategories.push(this.criteria.find(c => c.categoryCode === 'PERSONS_WITH_DISABILITIES'));
      isIncomeExempt = true;
    }
    if (applicant.inCustodyOrDetention) {
      matchedCategories.push(this.criteria.find(c => c.categoryCode === 'UNDER_TRIAL_PRISONERS_IN_CUSTODY'));
      isIncomeExempt = true;
    }
    if (applicant.isIndustrialWorkman) {
      matchedCategories.push(this.criteria.find(c => c.categoryCode === 'INDUSTRIAL_WORKERS'));
      isIncomeExempt = true;
    }
    if (applicant.isDisasterOrTraffickingVictim) {
      matchedCategories.push(this.criteria.find(c => c.categoryCode === 'VICTIMS_OF_DISASTER_OR_TRAFFICKING'));
      isIncomeExempt = true;
    }

    // Evaluate general income criterion if not already exempt
    if (!isIncomeExempt) {
      const lowIncomeRule = this.criteria.find(c => c.categoryCode === 'LOW_INCOME_CITIZENS');
      if (applicant.annualIncomeINR !== undefined && applicant.annualIncomeINR !== null) {
        if (applicant.annualIncomeINR <= lowIncomeRule.incomeCeilingsINR.defaultGeneralINR) {
          matchedCategories.push({
            ...lowIncomeRule,
            appliedIncomeINR: applicant.annualIncomeINR,
            ceilingAppliedINR: lowIncomeRule.incomeCeilingsINR.defaultGeneralINR
          });
        }
      }
    }

    const isLikelyEligible = matchedCategories.length > 0;

    return {
      isLikelyEligible,
      matchedStatutoryCategories: matchedCategories.filter(Boolean),
      isIncomeExempt,
      disclaimer: 'This assessment is purely educational based on statutory criteria. The Member Secretary of the DLSA makes the final determination on appointing an empaneled legal aid counsel.'
    };
  }

  /**
   * Finds DLSA details based on state code and district name.
   */
  findAuthority(stateCode, districtName) {
    return this.directory.filter(dlsa => {
      if (stateCode && dlsa.state !== stateCode) return false;
      if (districtName && !dlsa.district.toLowerCase().includes(districtName.toLowerCase())) return false;
      return true;
    });
  }

  /**
   * Generates a neutral appointment preparation checklist for citizens visiting DLSA offices.
   */
  generateAppointmentChecklist(dlsaId) {
    const dlsa = this.directory.find(d => d.id === dlsaId) || this.directory[0];

    return {
      authorityName: dlsa.authorityName,
      address: dlsa.officeAddress,
      helpline: dlsa.tollFreeHelpline,
      email: dlsa.email,
      documentChecklist: [
        {
          step: 1,
          name: 'Identity and Residence Proof',
          details: 'Aadhaar Card, Voter ID, or Ration Card (original and 2 photocopies).'
        },
        {
          step: 2,
          name: 'Category Qualification Document',
          details: 'Caste certificate, disability certificate, or salary/income affidavit (if claiming under income ceiling).'
        },
        {
          step: 3,
          name: 'Case / Dispute Papers',
          details: 'Summons, court notice, police FIR copy, lease agreement, or previous court orders.'
        },
        {
          step: 4,
          name: 'Chronology Note',
          details: 'Brief 1-page chronological summary of the dispute in plain language.'
        }
      ],
      emergencyGuidance: 'In situations involving imminent domestic violence or child safety, immediately dial 112 (Police) or 181 (Women Helpline) before scheduling an in-person DLSA appointment.',
      reportIncorrectContactAction: `Report incorrect address/phone for ${dlsa.id} to civic-legal-audit@setu.org`
    };
  }

  /**
   * Accepts crowdsourced reports of outdated phone numbers or changed office locations.
   */
  reportIncorrectContact(dlsaId, issueDescription) {
    if (!dlsaId || !issueDescription) {
      throw new Error('dlsaId and issueDescription are required');
    }

    const report = {
      id: `dlsa_err_${Date.now()}`,
      dlsaId,
      issueDescription,
      reportedAt: new Date().toISOString(),
      status: 'VERIFICATION_PENDING'
    };

    this.contactReports.push(report);
    return report;
  }
}

export const defaultLegalAidFinder = new LegalAidFinderService();
