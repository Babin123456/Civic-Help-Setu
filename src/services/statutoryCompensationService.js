import { evaluateApplicationSla } from './statutorySlaService';

/**
 * Standard statutory rates under state Right to Public Services Legislation
 * (e.g., Maharashtra RTS Act 2015, Karnataka Sakala Act 2011, Delhi RTS Act 2011)
 */
export const STATUTORY_COMPENSATION_DEFAULTS = {
  dailyRate: 250, // INR per business day of delay
  maxCap: 5000,   // Maximum statutory compensation cap in INR
  limitationDays: 30 // Days within which claim must be lodged following SLA breach
};

/**
 * Calculates statutory delay compensation entitlement for an application.
 *
 * @param {Object} application The tracked application record
 * @param {Object} [overrides] Optional parameter overrides for dailyRate or maxCap
 * @returns {Object} Calculated compensation breakdown
 */
export function calculateStatutoryCompensation(application, overrides = {}) {
  if (!application) {
    return {
      isEligible: false,
      delayedDays: 0,
      dailyRate: overrides.dailyRate || STATUTORY_COMPENSATION_DEFAULTS.dailyRate,
      maxCap: overrides.maxCap || STATUTORY_COMPENSATION_DEFAULTS.maxCap,
      rawAmount: 0,
      claimAmount: 0,
      isCapped: false,
      actName: 'Right to Public Services Guarantee Act',
      firstAppellateAuthority: 'Designated Appellate Authority',
      limitationPeriodDays: STATUTORY_COMPENSATION_DEFAULTS.limitationDays,
      status: 'NOT_ELIGIBLE',
      reason: 'No application record provided.'
    };
  }

  const sla = evaluateApplicationSla(application);
  const dailyRate = Number(overrides.dailyRate) > 0
    ? Number(overrides.dailyRate)
    : STATUTORY_COMPENSATION_DEFAULTS.dailyRate;
  const maxCap = Number(overrides.maxCap) > 0
    ? Number(overrides.maxCap)
    : STATUTORY_COMPENSATION_DEFAULTS.maxCap;

  let delayedDays = sla.overdueDays || 0;

  // Fallback calculation if overdueDays is 0 but application status explicitly marks breach/delay
  if (delayedDays === 0 && (application.status === 'delayed' || application.status === 'sla-breach')) {
    delayedDays = 1;
  }

  const rawAmount = delayedDays * dailyRate;
  const claimAmount = Math.min(rawAmount, maxCap);
  const isCapped = rawAmount > maxCap;
  const isEligible = delayedDays > 0;

  return {
    isEligible,
    delayedDays,
    dailyRate,
    maxCap,
    rawAmount,
    claimAmount,
    isCapped,
    actName: sla.actName || 'Right to Public Services Guarantee Act',
    firstAppellateAuthority: sla.firstAppellateAuthority || 'First Appellate Authority (Revenue / District Office)',
    secondAppellateAuthority: sla.secondAppellateAuthority || 'Right to Services Commission / District Collector',
    statutoryDays: sla.statutoryDays || 30,
    businessDaysElapsed: sla.businessDaysElapsed || 0,
    limitationPeriodDays: STATUTORY_COMPENSATION_DEFAULTS.limitationDays,
    status: isEligible ? 'ELIGIBLE' : 'WITHIN_SLA',
    reason: isEligible
      ? `Delivery delayed by ${delayedDays} business day(s) beyond statutory limit of ${sla.statutoryDays} days.`
      : `Application is currently within statutory delivery window.`
  };
}

/**
 * Generates a formal, legally structured Claim Petition under Right to Public Services Legislation.
 *
 * @param {Object} application The tracked application record
 * @param {Object} citizenProfile Applicant contact and identity information
 * @param {Object} [options] Custom options including payout mode details
 * @returns {string} Formatted markdown text of the claim petition
 */
export function generateCompensationPetition(application = {}, citizenProfile = {}, options = {}) {
  const comp = calculateStatutoryCompensation(application, options);
  const today = options.currentDate || new Date().toISOString().split('T')[0];

  const applicantName = citizenProfile.name || citizenProfile.applicantName || application.applicantName || 'Citizen Applicant';
  const applicantContact = citizenProfile.phone || citizenProfile.mobile || 'Registered Mobile Number';
  const applicantAddress = citizenProfile.address || 'Address on Record';
  const disbursementInfo = options.bankAccount || options.upiId || citizenProfile.upiId || 'Direct Bank Credit / DBT Linked Account';

  const refId = application.id || application.referenceNumber || 'N/A';
  const serviceName = application.serviceName || application.title || 'Public Civic Service';
  const appliedDate = application.appliedDate || application.submissionDate || 'N/A';

  return `# PETITION FOR STATUTORY DELAY COMPENSATION
## Under Section 9 & 10 of the ${comp.actName}

**Date:** ${today}  
**Place:** Jurisdiction of Application

---

### TO:
**The Designated First Appellate Authority**  
Office of ${comp.firstAppellateAuthority}  
Government Public Service Grievance Redressal Mechanism  

---

### SUBJECT:
**Formal Claim Petition for payment of Compensatory Allowance of ₹${comp.claimAmount.toLocaleString('en-IN')} on account of unlawful statutory delay in delivery of service: "${serviceName}" (Ref: ${refId}).**

---

### RESPECTED SIR / MADAM,

I, the undersigned applicant, hereby submit this formal petition under the statutory provisions of the **${comp.actName}** for grant of compensatory delay allowance and penal recovery against the defaulting processing authority.

#### 1. PARTICULARS OF THE APPLICATION:
- **Name of Applicant:** ${applicantName}
- **Contact Number:** ${applicantContact}
- **Postal / Communication Address:** ${applicantAddress}
- **Service Requested:** ${serviceName}
- **Application Reference Number:** ${refId}
- **Date of Acknowledgment / Submission:** ${appliedDate}
- **Statutory Delivery Timeline Prescribed:** ${comp.statutoryDays} working days

#### 2. NATURE OF DEFAULT & STATUTORY SLA BREACH:
1. The statutory deadline for the completion and delivery of the requested service expired upon the lapse of **${comp.statutoryDays} working days**.
2. To date, a total of **${comp.businessDaysElapsed} working days** have elapsed since acknowledgment.
3. The processing desk has committed an unexcused delay of **${comp.delayedDays} business day(s)** beyond the statutory limit without communicating any lawful justification or deficiency notice.

#### 3. STATUTORY COMPENSATION COMPUTATION:
Under the notified Rules of the ${comp.actName}:
- **Statutory Daily Penalty / Allowance Rate:** ₹${comp.dailyRate} per working day of delay
- **Delay Period Exceeded:** ${comp.delayedDays} business day(s)
- **Computed Claim Amount:** ₹${comp.dailyRate} × ${comp.delayedDays} = ₹${comp.rawAmount.toLocaleString('en-IN')}${comp.isCapped ? ` (Subject to statutory ceiling of ₹${comp.maxCap.toLocaleString('en-IN')})` : ''}
- **Net Entitlement Claimed:** **₹${comp.claimAmount.toLocaleString('en-IN')}**

#### 4. RELIEF AND PRAYER SOUGHT:
In light of the statutory breach documented herein, the applicant respectfully requests the First Appellate Authority to:
1. **Order Immediate Disposal:** Direct the designated processing officer to immediately process and release the requested **${serviceName}** without further delay.
2. **Sanction Compensatory Payment:** Order the disbursement of **₹${comp.claimAmount.toLocaleString('en-IN')}** as statutory compensation directly payable to the applicant.
3. **Recovery from Officer:** Recover the sanctioned compensatory allowance from the salary / emoluments of the defaulting designated officer in accordance with law.

#### 5. DISBURSEMENT DETAILS:
- **Preferred Mode:** ${disbursementInfo}

---

### VERIFICATION & DECLARATION
I, **${applicantName}**, do hereby declare that the facts stated above are true and correct to the best of my knowledge and records, and that no prior compensation has been awarded for this specific application delay.

**Signature / Digital Submission of Applicant:**  
${applicantName}  
Application ID: ${refId}
`;
}
