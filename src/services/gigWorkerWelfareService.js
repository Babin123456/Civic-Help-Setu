/**
 * @file gigWorkerWelfareService.js
 * @description Provides a source-grounded information workspace for gig and platform workers.
 * Distinguishes statutory government social security schemes from private platform-provided perks.
 * Does not imply registration or benefit approval occurs within Civic Help Setu.
 */

import { GIG_WELFARE_PROGRAMMES, GIG_TERMINOLOGY_GLOSSARY } from '../data/gigWorkerWelfareData.js';

export class GigWorkerWelfareService {
  constructor(programmes = GIG_WELFARE_PROGRAMMES, glossary = GIG_TERMINOLOGY_GLOSSARY) {
    this.programmes = programmes;
    this.glossary = glossary;
  }

  /**
   * Retrieves programmes separated by scope (central vs state).
   */
  getProgrammesByState(stateCode) {
    const matched = this.programmes.filter(p => p.state === 'ALL_INDIA' || (stateCode && p.state === stateCode));
    const central = matched.filter(p => p.scope === 'CENTRAL_FRAMEWORK');
    const state = matched.filter(p => p.scope === 'STATE_STATUTORY');

    const stateHasOfficialBoard = state.length > 0;

    return {
      queryState: stateCode || 'ALL',
      stateHasOfficialBoard,
      unavailabilityWarning: !stateHasOfficialBoard
        ? `No officially notified state-specific gig welfare board is currently active for ${stateCode}. Displaying central social security frameworks only.`
        : null,
      centralSchemes: central,
      stateSchemes: state,
      statutoryDisclaimer: 'Civic Help Setu provides neutral informational guidance only. Official registration, welfare card issuance, and claims disbursal occur solely on authorized government portals.'
    };
  }

  /**
   * Distinguishes government statutory schemes from private platform perks (e.g. Swiggy/Zomato/Uber company insurance).
   */
  distinguishGovernmentVsPlatformBenefits() {
    return {
      governmentWelfare: {
        legalBasis: 'Statutory Act or Government Gazetted Notification (e.g., Code on Social Security 2020, Rajasthan Act 2023)',
        portability: 'Benefits remain active even when switching between different platform aggregators.',
        funding: 'Financed through statutory aggregator cess or state social security budget.',
        disputeRedressal: 'State Labour Commissioner, Welfare Board appellate officers, or Lok Adalat.'
      },
      privatePlatformPerks: {
        legalBasis: 'Commercial group insurance policy contracted privately between aggregator and insurance broker.',
        portability: 'Coverage terminates immediately upon account deactivation or cessation of active gig shifts.',
        funding: 'Paid or subsidised voluntarily by the platform company as operational expense.',
        disputeRedressal: 'Aggregator in-app support or private insurance company claims desk.'
      }
    };
  }

  /**
   * Generates a step-by-step application preparation checklist.
   */
  generatePreparationChecklist(programmeId) {
    const prog = this.programmes.find(p => p.id === programmeId);
    if (!prog) {
      throw new Error(`Programme not found with id ${programmeId}`);
    }

    return {
      title: `Registration Preparation: ${prog.title}`,
      administeringAuthority: prog.administeringAuthority,
      portal: prog.registrationPortal,
      requiredDocuments: prog.requiredDocuments.map((doc, idx) => ({
        step: idx + 1,
        documentName: doc,
        verified: false,
        tip: 'Ensure that the mobile number registered on your delivery/cab driver app matches your Aadhaar-linked phone.'
      })),
      benefitsSummary: prog.benefits,
      officialSourceUrl: prog.guidelineSourceUrl,
      lastVerifiedDate: prog.lastVerifiedDate,
      warning: 'Never pay unofficial intermediaries or cyber-cafe agents for e-Shram or state gig registrations.'
    };
  }

  /**
   * Returns plain-language glossary of social security and gig-work terms.
   */
  getGlossary() {
    return this.glossary;
  }
}

export const defaultGigWorkerWelfareService = new GigWorkerWelfareService();
