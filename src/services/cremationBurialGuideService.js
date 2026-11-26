/**
 * @file cremationBurialGuideService.js
 * @description Provides a respectful, low-bandwidth, informative guide to public cremation and burial grounds,
 * published municipal charges, required documentation, and post-cremation death registration steps.
 * Does not collect or store sensitive bereavement or citizen data.
 */

import {
  MUNICIPAL_CREMATION_FACILITIES,
  MANDATORY_BEREAVEMENT_DOCUMENTS
} from '../data/cremationBurialFacilitiesData.js';

export class CremationBurialGuideService {
  constructor(facilities = MUNICIPAL_CREMATION_FACILITIES, documents = MANDATORY_BEREAVEMENT_DOCUMENTS) {
    this.facilities = facilities;
    this.documents = documents;
  }

  /**
   * Searches for verified cremation/burial facilities by jurisdiction and query.
   */
  searchFacilities(jurisdictionId, query = '') {
    return this.facilities.filter(fac => {
      if (jurisdictionId && fac.jurisdictionId !== jurisdictionId) return false;
      if (query) {
        const q = query.toLowerCase();
        const matchesName = fac.facilityName.toLowerCase().includes(q);
        const matchesAddress = fac.address.toLowerCase().includes(q);
        if (!matchesName && !matchesAddress) return false;
      }
      return true;
    });
  }

  /**
   * Generates a compassionate, low-bandwidth guide for families during urgent bereavement.
   */
  generateBereavementAssistanceGuide(facilityId) {
    const facility = this.facilities.find(f => f.id === facilityId) || this.facilities[0];

    return {
      facilityName: facility.facilityName,
      address: facility.address,
      contactNumber: facility.contactNumber,
      operatingHours: facility.operatingTimings,
      publishedChargeINR: facility.publishedFeeINR,
      chargePolicy: facility.isBplFree ? 'Nominal charges apply; completely exempt for families holding BPL / Antyodaya ration cards.' : 'Regulated municipal user fee.',
      accessibilityFeatures: facility.accessibility,
      mandatoryImmediateDocuments: this.documents,
      subsequentDeathRegistrationSteps: [
        '1. Obtain the Cremation/Burial Ground Acknowledgement Slip with Cremation Entry Serial Number.',
        '2. Within 21 statutory days, visit the local municipal ward office / Registrar of Births and Deaths or portal (e-Janma / CRS Org).',
        '3. Present the MCCD, crematorium slip, and deceased Aadhaar to receive the official Digital Death Certificate with QR code.'
      ],
      respectfulNotice: 'Civic Help Setu offers this informational guide with deepest respect and empathy. We collect zero family or bereavement records.'
    };
  }

  /**
   * Returns mandatory documentation required prior to approaching a facility.
   */
  getMandatoryDocuments() {
    return this.documents;
  }
}

export const defaultCremationService = new CremationBurialGuideService();
