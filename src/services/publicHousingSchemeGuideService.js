/**
 * @file publicHousingSchemeGuideService.js
 * @description Source-linked guide for public housing assistance schemes (PMAY-G and PMAY-U 2.0).
 * Explains lifecycle stages, beneficiary verification lookups, status vocabulary, and anti-fraud warnings.
 */

import {
  HOUSING_SCHEMES_DIRECTORY,
  HOUSING_STATUS_VOCABULARY
} from '../data/publicHousingSchemeData.js';

export class PublicHousingSchemeGuideService {
  constructor(schemes = HOUSING_SCHEMES_DIRECTORY, vocabulary = HOUSING_STATUS_VOCABULARY) {
    this.schemes = schemes;
    this.vocabulary = vocabulary;
  }

  /**
   * Retrieves housing scheme guidance filtered by rural or urban setting.
   */
  getSchemeByDomain(domain = 'RURAL') {
    const d = domain.toUpperCase();
    return this.schemes.find(s => s.domain === d) || this.schemes[0];
  }

  /**
   * Explains each lifecycle step in plain language with required documentation.
   */
  getLifecycleOverview(domain = 'RURAL') {
    const scheme = this.getSchemeByDomain(domain);

    return {
      schemeId: scheme.id,
      title: scheme.title,
      domain: scheme.domain,
      administeringMinistry: scheme.administeringMinistry,
      stages: scheme.lifecycleStages,
      verificationPortal: scheme.verificationPortal,
      antiFraudAdvisory: scheme.antiFraudAdvisory,
      requiredDocumentChecklist: [
        'Aadhaar Card (consent for DBT seeding)',
        'Active bank passbook showing IFSC code and bank branch',
        'Land possession certificate / Pattadar passbook (for BLC / PMAY-G)',
        'MGNREGA Job Card (for rural mason wage convergence)',
        'Self-declaration of not owning any pucca house in India'
      ],
      strictWarning: 'Never disclose Aadhaar OTP or bank PIN to anyone claiming to expedite housing sanction orders.'
    };
  }

  /**
   * Returns housing status vocabulary to help citizens interpret online application statuses.
   */
  getStatusVocabulary() {
    return this.vocabulary;
  }
}

export const defaultHousingGuideService = new PublicHousingSchemeGuideService();
