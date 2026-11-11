/**
 * Civic Benefit Disbursement and Payment-Status Reconciliation Workspace Service
 *
 * Provides a user-controlled financial timeline and reconciliation engine for welfare
 * benefits and direct benefit transfers (DBT) without claiming integration with private
 * banking systems:
 *
 * 1. User-Controlled Benefit & Instalment Tracking:
 *    - Records sanction orders, instalment numbers, expected dates, and receipt references.
 *    - Allows citizens to update, correct, and annotate payment records.
 * 2. Distinct User-Reported vs. Verified Status:
 *    - Explicitly distinguishes citizen self-reported statuses (USER_REPORTED_RECEIVED,
 *      PENDING_CONFIRMATION, DISPUTED_DELAYED) from verified administrative statuses.
 * 3. Scheme- & Jurisdiction-Specific Redressal Guidance:
 *    - Maps delayed or failed disbursements to verified official escalation channels
 *      (e.g., PFMS public grievance portal, state treasury desks, district welfare offices).
 * 4. Strict Financial Privacy Guardrails:
 *    - Absolutely prohibits full bank account numbers, debit card details, PINs, OTPs, or net banking passwords.
 *    - Allows only safe masked identifiers (e.g., last 4 digits of bank account).
 * 5. Anomaly & Discrepancy Detection:
 *    - Detects duplicate instalment numbers, payment reversals, and amounts differing from statutory sanctions.
 * 6. Redacted Chronology Export:
 *    - Prepares clean, exportable PDF/JSON payment chronologies suitable for submission in formal grievances.
 */

export const DISBURSEMENT_STATUS = {
  EXPECTED: 'EXPECTED',
  USER_REPORTED_RECEIVED: 'USER_REPORTED_RECEIVED',
  PENDING_CONFIRMATION: 'PENDING_CONFIRMATION',
  DISPUTED_DELAYED: 'DISPUTED_DELAYED',
  REVERSED_OR_FAILED: 'REVERSED_OR_FAILED',
  UNKNOWN: 'UNKNOWN',
};

export const VERIFICATION_STATUS = {
  UNVERIFIED_SELF_REPORTED: 'UNVERIFIED_SELF_REPORTED',
  SANCTION_ORDER_MATCHED: 'SANCTION_ORDER_MATCHED',
  OFFICIAL_PFMS_PUBLIC_REFERENCE: 'OFFICIAL_PFMS_PUBLIC_REFERENCE',
};

export const JURISDICTION_TROUBLESHOOTING = {
  CENTRAL: {
    authority: 'Public Financial Management System (PFMS) / Central DBT Mission',
    portalUrl: 'https://pfms.nic.in',
    helpline: '1800-118-111',
    guidance:
      'For central sector schemes (e.g. PM-KISAN, National Social Assistance Program), verify ' +
      'Aadhaar seeding status with your bank and check DBT payment status on the official PFMS public portal.',
  },
  TAMIL_NADU: {
    authority: 'Tamil Nadu Treasury & Accounts Department / Integrated Financial System',
    portalUrl: 'https://treasury.tn.gov.in',
    helpline: '1800-425-4567',
    guidance:
      'Verify scheme registration status on the e-Sevai portal. For state direct disbursements ' +
      '(such as KMUT), visit your local Special Tahsildar (Social Security Schemes) counter.',
  },
  MAHARASHTRA: {
    authority: 'Aaple Sarkar DBT Portal / Directorate of Accounts & Treasuries',
    portalUrl: 'https://mahadbt.maharashtra.gov.in',
    helpline: '022-49150800',
    guidance:
      'Check Aadhaar-bank account link on Aaple Sarkar DBT portal. In case of failed credit, ' +
      'request an NPCI mapping update at your local bank branch.',
  },
};

/**
 * Validates and records a new payment event in the benefit timeline.
 * Strictly prevents banking credentials from entering the system.
 *
 * @param {Object} input
 * @returns {Object} Clean payment event record
 */
export function recordBenefitPaymentEvent(input = {}) {
  const {
    id,
    schemeId,
    schemeName,
    jurisdiction = 'CENTRAL',
    instalmentNumber,
    sanctionedAmount,
    receivedAmount,
    expectedDate,
    receivedDate,
    paymentReference = '',
    bankAccountMask = '',
    status = DISBURSEMENT_STATUS.EXPECTED,
    userNotes = '',
    // Credentials that must be strictly rejected
    accountNumber,
    fullAccountNumber,
    pin,
    cvv,
    otp,
    password,
  } = input;

  if (accountNumber || fullAccountNumber || pin || cvv || otp || password) {
    throw new Error(
      'Security Policy Violation: Banking credentials (account number, PIN, CVV, OTP) must never be entered or stored.'
    );
  }

  if (bankAccountMask && !/^([Xx*•]{0,12}\d{4}|\d{4})$/.test(bankAccountMask.trim())) {
    throw new Error('Invalid account reference: only the last 4 digits (e.g., ••••1234) are permitted');
  }

  if (!schemeName || typeof schemeName !== 'string') {
    throw new Error('Valid scheme name is required');
  }

  const generatedId = id || `pay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  return {
    id: generatedId,
    schemeId: schemeId || schemeName.toLowerCase().replace(/\s+/g, '_'),
    schemeName: schemeName.trim(),
    jurisdiction: jurisdiction.toUpperCase(),
    instalmentNumber: typeof instalmentNumber === 'number' ? instalmentNumber : Number(instalmentNumber) || 1,
    sanctionedAmount: Number(sanctionedAmount) || 0,
    receivedAmount: receivedAmount !== undefined ? Number(receivedAmount) : null,
    expectedDate: expectedDate ? new Date(expectedDate).toISOString().slice(0, 10) : null,
    receivedDate: receivedDate ? new Date(receivedDate).toISOString().slice(0, 10) : null,
    paymentReference: String(paymentReference).trim(),
    bankAccountMask: bankAccountMask ? `••••${bankAccountMask.slice(-4)}` : '••••N/A',
    status,
    verificationStatus: VERIFICATION_STATUS.UNVERIFIED_SELF_REPORTED,
    userNotes: String(userNotes).trim(),
    recordedAt: new Date().toISOString(),
  };
}

/**
 * Evaluates reconciliation state and identifies discrepancies:
 * - Duplicate instalment numbers
 * - Partial or mismatched received amounts
 * - Overdue disbursements
 * - Payment reversals
 *
 * @param {Array<Object>} events Array of benefit payment events
 * @returns {Object} Reconciliation summary
 */
export function reconcileBenefitTimeline(events = []) {
  const anomalies = [];
  const instalmentMap = new Map();

  let totalSanctioned = 0;
  let totalReceived = 0;
  let pendingCount = 0;

  for (const ev of events) {
    totalSanctioned += ev.sanctionedAmount || 0;
    if (ev.receivedAmount) {
      totalReceived += ev.receivedAmount;
    }

    // Check duplicate instalments for same scheme
    const key = `${ev.schemeId}_inst_${ev.instalmentNumber}`;
    if (instalmentMap.has(key)) {
      anomalies.push({
        type: 'DUPLICATE_INSTALMENT',
        eventId: ev.id,
        schemeName: ev.schemeName,
        instalmentNumber: ev.instalmentNumber,
        message: `Duplicate instalment #${ev.instalmentNumber} recorded for ${ev.schemeName}.`,
      });
    } else {
      instalmentMap.set(key, ev.id);
    }

    // Check payment reversals
    if (ev.status === DISBURSEMENT_STATUS.REVERSED_OR_FAILED) {
      anomalies.push({
        type: 'PAYMENT_REVERSED',
        eventId: ev.id,
        schemeName: ev.schemeName,
        instalmentNumber: ev.instalmentNumber,
        message: `Instalment #${ev.instalmentNumber} has been reversed or failed at the banking gateway.`,
      });
    }

    // Check amount mismatch (for non-reversed events)
    if (
      ev.status !== DISBURSEMENT_STATUS.REVERSED_OR_FAILED &&
      ev.receivedAmount !== null &&
      ev.sanctionedAmount > 0 &&
      ev.receivedAmount < ev.sanctionedAmount
    ) {
      anomalies.push({
        type: 'PARTIAL_DISBURSEMENT',
        eventId: ev.id,
        schemeName: ev.schemeName,
        shortfall: ev.sanctionedAmount - ev.receivedAmount,
        message: `Received amount (₹${ev.receivedAmount}) is less than sanctioned amount (₹${ev.sanctionedAmount}).`,
      });
    }

    // Check overdue
    if (
      ev.status === DISBURSEMENT_STATUS.EXPECTED &&
      ev.expectedDate &&
      new Date(ev.expectedDate) < new Date()
    ) {
      pendingCount += 1;
      anomalies.push({
        type: 'OVERDUE_DISBURSEMENT',
        eventId: ev.id,
        schemeName: ev.schemeName,
        expectedDate: ev.expectedDate,
        message: `Instalment #${ev.instalmentNumber} expected on ${ev.expectedDate} has passed without receipt confirmation.`,
      });
    }
  }

  return {
    totalSanctioned,
    totalReceived,
    totalDiscrepancy: Math.max(0, totalSanctioned - totalReceived),
    anomalies,
    hasAnomalies: anomalies.length > 0,
  };
}

/**
 * Retrieves official jurisdiction-specific troubleshooting instructions.
 *
 * @param {string} jurisdiction
 * @returns {Object} Guidance details
 */
export function getRedressalGuidance(jurisdiction = 'CENTRAL') {
  const norm = jurisdiction.toUpperCase();
  return JURISDICTION_TROUBLESHOOTING[norm] || JURISDICTION_TROUBLESHOOTING.CENTRAL;
}

/**
 * Exports a clean, redacted chronological summary suitable for filing grievance appeals.
 *
 * @param {Array<Object>} events
 * @returns {Object} Chronological export package
 */
export function exportRedactedChronology(events = []) {
  // Sort events chronologically by date
  const sorted = [...events].sort((a, b) => {
    const dateA = a.receivedDate || a.expectedDate || '';
    const dateB = b.receivedDate || b.expectedDate || '';
    return dateA.localeCompare(dateB);
  });

  const timelineEntries = sorted.map((ev) => ({
    schemeName: ev.schemeName,
    instalmentNumber: ev.instalmentNumber,
    date: ev.receivedDate || ev.expectedDate || 'N/A',
    amount: ev.receivedAmount !== null ? `₹${ev.receivedAmount}` : `₹${ev.sanctionedAmount} (Expected)`,
    status: ev.status,
    verificationTier: ev.verificationStatus,
    paymentReferenceMasked: ev.paymentReference
      ? `${ev.paymentReference.slice(0, 3)}••••${ev.paymentReference.slice(-3)}`
      : 'NONE',
    accountMask: ev.bankAccountMask,
    userNotes: ev.userNotes,
  }));

  return {
    exportedAt: new Date().toISOString(),
    totalEntries: timelineEntries.length,
    disclaimer:
      'This payment chronology is citizen-recorded for grievance reconciliation. It does not replace ' +
      'official bank statements or treasury scrolls.',
    timelineEntries,
  };
}
