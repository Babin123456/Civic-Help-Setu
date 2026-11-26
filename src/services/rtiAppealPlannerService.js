/**
 * @file rtiAppealPlannerService.js
 * @description Date-driven RTI First Appeal and Transfer Decision Planner. Computes statutory limitation dates,
 * highlights deemed refusals, and constructs printable procedural chronologies.
 * Informational only; does not file legal appeals directly.
 */

import {
  RTI_STATUTORY_RULES,
  RTI_EVENT_TYPES,
  RTI_STATUTORY_CITATIONS
} from '../data/rtiStatutoryTimelineData.js';

export class RtiAppealPlannerService {
  constructor(rules = RTI_STATUTORY_RULES, citations = RTI_STATUTORY_CITATIONS) {
    this.rules = rules;
    this.citations = citations;
  }

  /**
   * Calculates key statutory dates given an initial RTI filing date and case attributes.
   */
  calculateFilingDeadlines(filingDateStr, options = {}) {
    if (!filingDateStr) {
      throw new Error('Filing date is required');
    }

    const filingDate = new Date(filingDateStr);
    if (isNaN(filingDate.getTime())) {
      throw new Error('Invalid filing date format. Use YYYY-MM-DD');
    }

    const isLifeAndLiberty = Boolean(options.isLifeAndLiberty);

    // 1. Calculate PIO Response Due Date
    const pioDue = new Date(filingDate);
    if (isLifeAndLiberty) {
      pioDue.setHours(pioDue.getHours() + this.rules.LIFE_AND_LIBERTY_PIO_HOURS);
    } else {
      pioDue.setDate(pioDue.getDate() + this.rules.STANDARD_PIO_RESPONSE_DAYS);
    }

    // 2. Calculate Deemed Refusal Date
    const deemedRefusalDate = new Date(pioDue);

    // 3. Calculate First Appeal Limitation Deadline (30 days from deemed refusal)
    const firstAppealDeadline = new Date(deemedRefusalDate);
    firstAppealDeadline.setDate(firstAppealDeadline.getDate() + this.rules.FIRST_APPEAL_LIMITATION_DAYS);

    // 4. Calculate Condonation of Delay Expiry (further 30 days)
    const condonationDeadline = new Date(firstAppealDeadline);
    condonationDeadline.setDate(condonationDeadline.getDate() + this.rules.FIRST_APPEAL_CONDONATION_DAYS);

    return {
      filingDate: filingDate.toISOString().split('T')[0],
      isLifeAndLiberty,
      statutoryPioDeadline: pioDue.toISOString().split('T')[0],
      deemedRefusalDate: deemedRefusalDate.toISOString().split('T')[0],
      firstAppealLimitationDeadline: firstAppealDeadline.toISOString().split('T')[0],
      discretionaryCondonationWindowUntil: condonationDeadline.toISOString().split('T')[0],
      citations: [
        this.citations.find(c => c.section === 'Section 7(1)'),
        this.citations.find(c => c.section === 'Section 7(2)'),
        this.citations.find(c => c.section === 'Section 19(1)')
      ].filter(Boolean)
    };
  }

  /**
   * Plans the immediate next procedural step based on a specific event.
   */
  planNextStep(event = {}) {
    if (!event.eventType) {
      return {
        warning: 'Cannot plan next step without specifying the current event type.',
        suggestedAction: 'Select an event: APPLICATION_FILED, APPLICATION_TRANSFERRED, NO_RESPONSE_DEEMED_REFUSAL, etc.'
      };
    }

    switch (event.eventType) {
      case RTI_EVENT_TYPES.APPLICATION_TRANSFERRED:
        return {
          currentStatus: 'Application Transferred under Section 6(3)',
          statutoryRule: 'Section 6(3) mandates transfer within 5 days of receipt. The new public authority receives standard 30-day clock from receipt date.',
          actionRequired: 'Note transferred authority name and new dispatch tracking number. If transfer was delayed beyond 5 days without cause, record this as grounds in subsequent appeal.',
          checklist: [
            'Copy of initial RTI application',
            'Postal acknowledgement or online filing receipt',
            'Section 6(3) transfer intimation letter'
          ]
        };

      case RTI_EVENT_TYPES.NO_RESPONSE_DEEMED_REFUSAL:
        return {
          currentStatus: 'Deemed Refusal under Section 7(2)',
          statutoryRule: 'Section 7(2) establishes deemed refusal upon expiry of 30 days without communication.',
          actionRequired: 'File First Appeal under Section 19(1) before the designated First Appellate Authority (FAA) of the public authority. Under Section 7(6), information must now be supplied free of cost.',
          freeOfCostBenefit: 'Eligible under Section 7(6) (no additional photocopying or inspection fees can be charged).',
          checklist: [
            'Form-A First Appeal Memo addressed to First Appellate Authority',
            'Original RTI application copy',
            'Speed-post / online payment receipt showing date of delivery'
          ]
        };

      case RTI_EVENT_TYPES.REJECTION_NOTICE_RECEIVED:
        return {
          currentStatus: 'Application Rejected under Section 8 or 9',
          statutoryRule: 'Section 7(1) mandates that PIO specify grounds for rejection and particulars of First Appellate Authority.',
          actionRequired: 'Inspect whether cited exemption (e.g., Section 8(1)(j) personal info or Section 8(1)(h) investigation) is accompanied by speaking reasoning and public interest override test.',
          checklist: [
            'PIO Rejection order copy',
            'Proof of date of receipt of rejection order (starts 30-day appeal clock)',
            'Grounds of Appeal refuting specific Section 8/9 exemptions'
          ]
        };

      default:
        return {
          currentStatus: 'Awaiting Response',
          statutoryRule: 'PIO has 30 statutory days to respond.',
          actionRequired: 'Monitor speed post tracking or online portal status.'
        };
    }
  }

  /**
   * Compiles an event chronology and document checklist for inclusion in the First Appeal memo.
   */
  generateAppealChronology(events = []) {
    const sorted = [...events].sort((a, b) => new Date(a.date) - new Date(b.date));

    const chronologyLines = sorted.map((evt, idx) => {
      return `${idx + 1}. [${evt.date}] - ${evt.title}: ${evt.description || 'N/A'}`;
    });

    return {
      title: 'CHRONOLOGY OF EVENTS (FOR RTI FIRST APPEAL)',
      totalMilestones: sorted.length,
      chronologyText: chronologyLines.join('\n'),
      mandatoryAttachments: [
        'Annexure A: Original RTI Application with Fee Receipt',
        'Annexure B: Proof of Delivery / Speed Post Tracking Acknowledgement',
        'Annexure C: Copy of PIO Reply or Section 6(3) Transfer Letter (if received)',
        'Annexure D: Grounds of First Appeal with signature of Appellant'
      ],
      disclaimer: 'This planner is informational. It organizes your dates and arguments but does not constitute legal representation or official filing.'
    };
  }
}

export const defaultRtiAppealPlanner = new RtiAppealPlannerService();
