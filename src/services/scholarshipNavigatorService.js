/**
 * @file scholarshipNavigatorService.js
 * @description Evaluates scholarship eligibility based on student academic level, family income,
 * state of residence, target demographic, and course type without storing sensitive PII.
 */

import { SCHOLARSHIP_DIRECTORY } from '../data/scholarshipDirectoryData.js';

export class ScholarshipNavigatorService {
  constructor(directory = SCHOLARSHIP_DIRECTORY) {
    this.directory = directory;
  }

  /**
   * Filters available scholarships based on multi-attribute criteria.
   */
  filterScholarships(criteria = {}) {
    return this.directory.filter(sch => {
      if (criteria.state && sch.jurisdiction !== 'ALL_INDIA' && sch.jurisdiction !== criteria.state) {
        return false;
      }
      if (criteria.level && sch.level !== criteria.level) {
        return false;
      }
      if (criteria.category && sch.category !== criteria.category) {
        return false;
      }
      if (criteria.demographic && !sch.targetDemographics.includes(criteria.demographic)) {
        return false;
      }
      if (criteria.course && !sch.eligibleCourses.some(c => c.toLowerCase().includes(criteria.course.toLowerCase()))) {
        return false;
      }
      if (criteria.maxIncome && sch.incomeCeilingAnnualINR !== null && criteria.maxIncome > sch.incomeCeilingAnnualINR) {
        return false;
      }
      return true;
    });
  }

  /**
   * Evaluates student's likely eligibility for each scheme, identifying matching factors and missing/conflicting items.
   */
  evaluateEligibility(studentProfile = {}) {
    const results = [];

    for (const sch of this.directory) {
      const positiveFactors = [];
      const negativeFactors = [];
      const missingInformation = [];

      // 1. Check Jurisdiction
      if (sch.jurisdiction === 'ALL_INDIA') {
        positiveFactors.push('Open to students across all Indian States and Union Territories.');
      } else if (studentProfile.state) {
        if (sch.jurisdiction === studentProfile.state) {
          positiveFactors.push(`Matches State requirement (${studentProfile.state}).`);
        } else {
          negativeFactors.push(`Requires residence/admission in ${sch.jurisdiction}, but student specified ${studentProfile.state}.`);
        }
      } else {
        missingInformation.push(`State of residence required to verify if eligible for ${sch.jurisdiction}.`);
      }

      // 2. Check Demographic
      if (studentProfile.demographic) {
        if (sch.targetDemographics.includes(studentProfile.demographic)) {
          positiveFactors.push(`Eligible for category: ${studentProfile.demographic}.`);
        } else {
          negativeFactors.push(`Scheme reserved for categories: ${sch.targetDemographics.join(', ')}.`);
        }
      } else if (sch.targetDemographics.length > 0 && !sch.targetDemographics.includes('GENERAL')) {
        missingInformation.push(`Social category/demographic not provided (applicable for ${sch.targetDemographics.join(', ')}).`);
      }

      // 3. Check Family Income
      if (sch.incomeCeilingAnnualINR !== null) {
        if (studentProfile.annualFamilyIncomeINR !== undefined && studentProfile.annualFamilyIncomeINR !== null) {
          if (studentProfile.annualFamilyIncomeINR <= sch.incomeCeilingAnnualINR) {
            positiveFactors.push(`Income ₹${studentProfile.annualFamilyIncomeINR.toLocaleString('en-IN')} within permissible limit of ₹${sch.incomeCeilingAnnualINR.toLocaleString('en-IN')}.`);
          } else {
            negativeFactors.push(`Annual income ₹${studentProfile.annualFamilyIncomeINR.toLocaleString('en-IN')} exceeds limit of ₹${sch.incomeCeilingAnnualINR.toLocaleString('en-IN')}.`);
          }
        } else {
          missingInformation.push(`Annual family income not specified (income ceiling is ₹${sch.incomeCeilingAnnualINR.toLocaleString('en-IN')}).`);
        }
      } else {
        positiveFactors.push('No family income ceiling (purely merit-based).');
      }

      // 4. Course Match
      if (studentProfile.course) {
        const matchesCourse = sch.eligibleCourses.some(c => c.toLowerCase().includes(studentProfile.course.toLowerCase()));
        if (matchesCourse) {
          positiveFactors.push(`Course '${studentProfile.course}' is supported.`);
        } else {
          negativeFactors.push(`Course '${studentProfile.course}' not in standard list (${sch.eligibleCourses.join(', ')}).`);
        }
      }

      // Determine classification
      let eligibilityStatus = 'LIKELY_ELIGIBLE';
      if (negativeFactors.length > 0) {
        eligibilityStatus = 'INELIGIBLE';
      } else if (missingInformation.length > 0) {
        eligibilityStatus = 'MORE_INFO_NEEDED';
      }

      results.push({
        scholarshipId: sch.id,
        name: sch.name,
        administeringBody: sch.administeringBody,
        eligibilityStatus,
        positiveFactors,
        negativeFactors,
        missingInformation,
        portalUrl: sch.applicationPortal.url,
        portalName: sch.applicationPortal.name,
        applicationCycle: sch.applicationPortal.applicationCycle,
        renewalCycle: sch.applicationPortal.renewalCycle,
        requiredDocuments: sch.requiredDocuments,
        lastVerifiedDate: sch.verificationDate,
        officialGuidelineUrl: sch.guidelineSourceUrl,
        disclaimer: sch.disclaimer
      });
    }

    return results;
  }

  /**
   * Generates a printable, downloadable checklist for application preparation without storing user data.
   */
  generatePersonalizedChecklist(scholarshipId) {
    const sch = this.directory.find(s => s.id === scholarshipId);
    if (!sch) {
      throw new Error(`Scholarship with id ${scholarshipId} not found.`);
    }

    return {
      title: `Application Checklist: ${sch.name}`,
      administeringBody: sch.administeringBody,
      portal: sch.applicationPortal,
      requiredDocuments: sch.requiredDocuments.map((doc, idx) => ({
        step: idx + 1,
        documentName: doc,
        ready: false,
        notes: 'Keep original and attested scanned PDF under 200KB.'
      })),
      renewalRules: sch.applicationPortal.renewalCycle,
      guidelineSource: sch.guidelineSourceUrl,
      lastVerifiedDate: sch.verificationDate,
      plainLanguageAdvice: 'Always confirm that your bank account is seeded with your Aadhaar in the NPCI mapper to avoid Direct Benefit Transfer (DBT) rejection.'
    };
  }
}

export const defaultScholarshipNavigator = new ScholarshipNavigatorService();
