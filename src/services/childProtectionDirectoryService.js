/**
 * @file childProtectionDirectoryService.js
 * @description Provides a carefully moderated official child protection directory (CWC, DCPU, SJPU, 1098).
 * Enforces emergency-first routing and strict safeguards against collecting or publishing names/photos of minors.
 */

import {
  NATIONAL_CHILD_PROTECTION_FRAMEWORK,
  STATUTORY_DISTRICT_AUTHORITIES
} from '../data/childProtectionOfficialData.js';

export class ChildProtectionDirectoryService {
  constructor(framework = NATIONAL_CHILD_PROTECTION_FRAMEWORK, authorities = STATUTORY_DISTRICT_AUTHORITIES) {
    this.framework = framework;
    this.authorities = authorities;
    this.correctionReports = [];
  }

  /**
   * Emergency first guidance when a child is missing or in immediate distress.
   */
  getImmediateEmergencyGuidance() {
    return {
      emergencyHotlines: [
        { service: 'Child Helpline (Mission Vatsalya)', number: this.framework.CHILDLINE_EMERGENCY.helplineNumber, notes: '24x7 toll-free dedicated child distress line.' },
        { service: 'National Emergency Response Support System (ERSS)', number: this.framework.CHILDLINE_EMERGENCY.unifiedEmergencyNumber, notes: 'Immediate police / ambulance dispatch.' }
      ],
      firstActionsWhenChildMissing: [
        '1. Dial 112 / 1098 immediately. Report the exact last seen location and physical description.',
        '2. Visit the nearest police station immediately to lodge an FIR. Under Supreme Court guidelines (Bachpan Bachao Andolan vs Union of India), an FIR is MANDATORY in every case of a missing child without any waiting period.',
        '3. Request the police to immediately upload the missing report onto the national TrackChild portal (https://trackchild.gov.in).',
        '4. Provide a recent, clear photograph to the Investigating Officer ONLY.'
      ],
      legalSafeguardSection74Warning: this.framework.LEGAL_MANDATE_SECTION_74.rule,
      platformSafetyGuarantee: 'Civic Help Setu does NOT host any public missing child noticeboards, photos, or citizen bulletin boards in strict adherence to Section 74 of the Juvenile Justice Act, 2015.'
    };
  }

  /**
   * Retrieves official district child protection institutions (CWC, DCPU, SJPU).
   */
  findDistrictAuthorities(state, district) {
    return this.authorities.filter(auth => {
      if (state && !auth.state.toLowerCase().includes(state.toLowerCase())) return false;
      if (district && !auth.district.toLowerCase().includes(district.toLowerCase())) return false;
      return true;
    });
  }

  /**
   * Information checklist of details authorities may legally request when an incident is reported.
   */
  getAuthorizedReportingInformationChecklist() {
    return {
      title: 'Information Law Enforcement / CWC May Request from Informant',
      items: [
        'Exact date, time, and location where the child was last seen.',
        'Child height, approximate age, clothing worn, and distinctive physical marks (birthmarks, scars).',
        'Names and phone numbers of friends, school companions, or relatives the child may have visited.',
        'Recent uncropped passport-size photograph handed directly to the police IO.',
        'Identity and contact proof of the reporting parent or guardian.'
      ],
      safetyNote: 'Do NOT circulate mobile numbers or address details of the family on public social media groups to prevent extortion or harassment by scammers.'
    };
  }

  /**
   * Submits a report if an official authority contact or address in the directory has changed.
   */
  submitContactCorrection(authId, details) {
    if (!authId || !details) {
      throw new Error('authId and details are required');
    }

    const report = {
      reportId: `cwc_corr_${Date.now()}`,
      authId,
      details,
      submittedAt: new Date().toISOString(),
      status: 'PENDING_OFFICIAL_VERIFICATION'
    };

    this.correctionReports.push(report);
    return report;
  }
}

export const defaultChildProtectionService = new ChildProtectionDirectoryService();
