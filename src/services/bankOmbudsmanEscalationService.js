/**
 * @file bankOmbudsmanEscalationService.js
 * @description Educational decision tree and complaint readiness evaluation service
 * based on the Reserve Bank - Integrated Ombudsman Scheme, 2021 (RB-IOS).
 * Does not make legally binding admissibility determinations where facts are disputed.
 */

import {
  RBI_OMBUDSMAN_RULES,
  RBI_COVERED_COMPLAINT_CATEGORIES,
  RBI_EXCLUDED_MATTERS
} from '../data/rbiOmbudsmanData.js';

export class BankOmbudsmanEscalationService {
  constructor(rules = RBI_OMBUDSMAN_RULES, categories = RBI_COVERED_COMPLAINT_CATEGORIES, exclusions = RBI_EXCLUDED_MATTERS) {
    this.rules = rules;
    this.categories = categories;
    this.exclusions = exclusions;
  }

  /**
   * Assesses whether a banking dispute is ready for escalation to the RBI Integrated Ombudsman.
   */
  evaluateEscalationReadiness(complaintContext = {}) {
    const blockers = [];
    const prerequisitesMet = [];
    const warnings = [];

    // 1. Mandatory Bank-First Complaint Check
    if (!complaintContext.lodgedWithBankFirst) {
      blockers.push({
        code: 'PREREQUISITE_BANK_COMPLAINT_MISSING',
        rule: 'You must first submit a written complaint to the concerned bank branch or bank Principal Nodal Officer (PNO).'
      });
    } else {
      prerequisitesMet.push('Initial complaint lodged with the regulated bank entity.');
    }

    // 2. Timeline Check (30 days from bank complaint or rejection)
    if (complaintContext.bankComplaintDate) {
      const filingDate = new Date(complaintContext.bankComplaintDate);
      const now = new Date();
      const elapsedDays = Math.floor((now - filingDate) / (1000 * 60 * 60 * 24));

      if (complaintContext.bankGaveFinalRejection) {
        prerequisitesMet.push(`Bank issued rejection letter on ${complaintContext.rejectionDate || 'recorded date'}; customer may escalate immediately within 1 year.`);
      } else if (elapsedDays < this.rules.MANDATORY_BANK_WAIT_DAYS) {
        blockers.push({
          code: 'STATUTORY_30_DAY_WINDOW_PENDING',
          rule: `Mandatory waiting period: The bank has 30 calendar days to resolve the issue. ${30 - elapsedDays} day(s) remaining.`
        });
      } else {
        prerequisitesMet.push(`30 days have elapsed (${elapsedDays} days since bank complaint) without satisfactory bank resolution.`);
      }

      // Check 1-year limitation
      if (elapsedDays > 365 + 30) {
        blockers.push({
          code: 'LIMITATION_PERIOD_EXPIRED',
          rule: 'More than 1 year and 30 days have elapsed since the original bank grievance. The Ombudsman may dismiss as time-barred.'
        });
      }
    } else if (complaintContext.lodgedWithBankFirst) {
      warnings.push('Date of initial bank complaint not provided; cannot verify if 30 days have elapsed.');
    }

    // 3. Excluded Matters Check
    if (complaintContext.isPendingInCourtOrConsumerForum) {
      blockers.push({
        code: 'PARALLEL_JUDICIAL_PROCEEDING',
        rule: 'Matters already pending before a court, Consumer Forum, or Arbitrator are barred from Ombudsman consideration.'
      });
    }

    const isReadyForOmbudsman = blockers.length === 0 && prerequisitesMet.length >= 2;

    return {
      isReadyForOmbudsman,
      status: isReadyForOmbudsman ? 'READY_FOR_ESCALATION' : 'PREREQUISITES_NOT_MET',
      blockers,
      prerequisitesMet,
      warnings,
      cmsPortalUrl: this.rules.PORTAL_URL,
      tollFreeHelpline: this.rules.TOLL_FREE_CONTACT,
      disclaimer: 'This evaluation is informational and reflects RB-IOS 2021 procedural requirements. Official admissibility is decided by the RBI Ombudsman.'
    };
  }

  /**
   * Generates a structured evidence checklist and complaint memo draft.
   */
  generateEscalationDossier(complaintData = {}) {
    const category = this.categories.find(c => c.code === complaintData.categoryCode) || this.categories[0];

    return {
      title: `RBI Integrated Ombudsman Complaint Dossier: ${category.categoryName}`,
      cmsPortalUrl: this.rules.PORTAL_URL,
      rbiHelpline: this.rules.TOLL_FREE_CONTACT,
      applicableCompensationLimitINR: this.rules.MAX_COMPENSATION_CONSEQUENTIAL_LOSS_INR,
      categorySpecificStatutoryNote: category.penaltyPerDayDelayINR
        ? `Statutory compensation rule: ₹${category.penaltyPerDayDelayINR} per day penalty applies if resolution exceeded turnaround time.`
        : null,
      mandatoryEvidenceChecklist: [
        'Copy of initial written complaint submitted to bank (Branch Manager / Net Banking Ticket / PNO)',
        'Proof of submission (Bank acknowledgement seal, email delivery receipt, or ticket ID)',
        'Bank response letter or rejection email (if received)',
        'Relevant bank account statement highlighting disputed line-item debits',
        'Summary chronology of events and communication with branch staff'
      ],
      eventChronologyTemplate: [
        { step: 1, event: 'Incident occurred / Unauthorized debit observed' },
        { step: 2, event: 'Grievance lodged with Bank Branch / Grievance Portal' },
        { step: 3, event: 'Expiry of 30-day resolution deadline / Received inadequate bank reply' },
        { step: 4, event: 'Lodge online complaint on RBI CMS portal (https://cms.rbi.org.in)' }
      ]
    };
  }

  getExcludedMatters() {
    return this.exclusions;
  }
}

export const defaultBankOmbudsmanService = new BankOmbudsmanEscalationService();
