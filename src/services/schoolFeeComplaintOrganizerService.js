/**
 * @file schoolFeeComplaintOrganizerService.js
 * @description Compares official school fee schedules/circulars with actual fee payment receipts,
 * detects arithmetic discrepancies, highlights unexplained charges, and drafts neutral clarification letters.
 * Avoids declaring charges illegal without judicial/DFRC determination.
 */

import {
  STATE_SCHOOL_FEE_REGULATORS,
  STANDARD_FEE_HEADS
} from '../data/schoolFeeRegulatoryData.js';

export class SchoolFeeComplaintOrganizerService {
  constructor(regulators = STATE_SCHOOL_FEE_REGULATORS, standardHeads = STANDARD_FEE_HEADS) {
    this.regulators = regulators;
    this.standardHeads = standardHeads;
  }

  /**
   * Compares scheduled fee notices with actual receipt charges line-by-line.
   */
  reconcileFeeReceipts(sanctionedNoticeItems = [], receiptChargedItems = []) {
    const discrepancies = [];
    const unexplainedCharges = [];
    let totalSanctionedINR = 0;
    let totalChargedINR = 0;

    const noticeMap = new Map();
    sanctionedNoticeItems.forEach(item => {
      totalSanctionedINR += Number(item.amountINR || 0);
      noticeMap.set(item.headName.toLowerCase().trim(), Number(item.amountINR || 0));
    });

    receiptChargedItems.forEach(item => {
      const head = item.headName.toLowerCase().trim();
      const chargedAmt = Number(item.amountINR || 0);
      totalChargedINR += chargedAmt;

      if (noticeMap.has(head)) {
        const sanctionedAmt = noticeMap.get(head);
        if (chargedAmt !== sanctionedAmt) {
          discrepancies.push({
            headName: item.headName,
            sanctionedAmountINR: sanctionedAmt,
            chargedAmountINR: chargedAmt,
            differenceINR: chargedAmt - sanctionedAmt,
            nature: chargedAmt > sanctionedAmt ? 'SURCHARGE_OR_HIKE' : 'UNDERCHARGE'
          });
        }
      } else {
        // Not listed in official fee notice
        unexplainedCharges.push({
          headName: item.headName,
          amountChargedINR: chargedAmt,
          isStandardRecognizedHead: this.standardHeads.some(sh => sh.toLowerCase() === head),
          observation: 'Item does not appear in official school fee circular/notice.'
        });
      }
    });

    const netVarianceINR = totalChargedINR - totalSanctionedINR;

    return {
      totalSanctionedINR,
      totalChargedINR,
      netVarianceINR,
      hasDiscrepancies: discrepancies.length > 0 || unexplainedCharges.length > 0,
      discrepancies,
      unexplainedCharges,
      disclaimer: 'This comparison identifies arithmetic differences and missing explanations between documents. It does not constitute a legal finding of illegal fee levying.'
    };
  }

  /**
   * Generates a neutral, polite clarification letter from parent to the School Management / Principal.
   */
  draftParentClarificationLetter(parentDetails = {}, reconciliationResult, schoolDetails = {}) {
    const letterDate = new Date().toISOString().split('T')[0];

    const lines = [
      `Date: ${letterDate}`,
      `To: The Principal / School Management Committee`,
      `School Name: ${schoolDetails.schoolName || '[School Name]'}`,
      `Branch / Campus: ${schoolDetails.campus || '[Campus Name]'}`,
      '',
      `Subject: Request for clarification regarding Quarter/Annual Fee Receipt - Student: ${parentDetails.studentName || '[Student Name]'} (Class/Section: ${parentDetails.gradeSection || '[Grade]'})`,
      '',
      `Respected Principal / Management,`,
      '',
      `I am writing as the parent/guardian of ${parentDetails.studentName || '[Student Name]'}. While reviewing our latest fee payment receipt against the official school fee circular, we noted the following arithmetic variances and unnotified heads:`,
      ''
    ];

    reconciliationResult.discrepancies.forEach(d => {
      lines.push(`- ${d.headName}: Sanctioned amount ₹${d.sanctionedAmountINR}, billed as ₹${d.chargedAmountINR} (Variance of ₹${d.differenceINR}).`);
    });

    reconciliationResult.unexplainedCharges.forEach(u => {
      lines.push(`- ${u.headName}: Billed ₹${u.amountChargedINR} (Not specified in official fee schedule).`);
    });

    lines.push('');
    lines.push('We kindly request you to provide a detailed line-item breakdown or clarify the governing circular authorizing these adjustments.');
    lines.push('');
    lines.push('Thanking you,');
    lines.push(`Yours faithfully,`);
    lines.push(`${parentDetails.parentName || '[Parent/Guardian Name]'}`);
    lines.push(`Contact: ${parentDetails.contactNumber || '[Contact Number]'}`);

    return lines.join('\n');
  }

  /**
   * Retrieves state-specific statutory escalation regulator details.
   */
  getStateRegulator(stateCode) {
    return this.regulators.find(r => r.state === stateCode) || null;
  }
}

export const defaultSchoolFeeService = new SchoolFeeComplaintOrganizerService();
