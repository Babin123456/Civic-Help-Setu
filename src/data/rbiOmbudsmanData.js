/**
 * @file rbiOmbudsmanData.js
 * @description Official criteria of the Reserve Bank - Integrated Ombudsman Scheme, 2021 (RB-IOS).
 * Prerequisite 30-day bank complaint rules, covered and excluded matters, compensation caps, and CMS portal details.
 */

export const RBI_OMBUDSMAN_RULES = {
  SCHEME_NAME: 'Reserve Bank - Integrated Ombudsman Scheme, 2021',
  MANDATORY_BANK_WAIT_DAYS: 30, // Must lodge complaint with bank first and wait 30 days
  OMBUDSMAN_LIMITATION_YEARS: 1, // Must approach within 1 year of bank's final reply or 1 year 30 days of filing
  MAX_COMPENSATION_CONSEQUENTIAL_LOSS_INR: 2000000, // ₹20 Lakhs max award
  MAX_COMPENSATION_HARASSMENT_TIME_LOSS_INR: 100000, // ₹1 Lakh max for harassment/mental agony
  PORTAL_URL: 'https://cms.rbi.org.in',
  CRPC_ADDRESS: 'Centralised Receipt and Processing Centre, Reserve Bank of India, 4th Floor, Sector 17, Chandigarh, 160017',
  TOLL_FREE_CONTACT: '14448'
};

export const RBI_COVERED_COMPLAINT_CATEGORIES = [
  {
    code: 'ATM_CASH_DISPENSATION_FAILURE',
    categoryName: 'ATM / Cash Deposit Machine Transaction Failure',
    turnaroundTimeDays: 5, // T+5 days auto-reversal under RBI Harmonisation Circular
    penaltyPerDayDelayINR: 100, // ₹100 per day penalty to customer beyond T+5
    description: 'Account debited but cash not dispensed or partially dispensed at ATM, and bank failed to reverse within T+5 working days.'
  },
  {
    code: 'UNAUTHORIZED_ELECTRONIC_TRANSACTION',
    categoryName: 'Unauthorized Electronic Banking Transaction',
    turnaroundTimeDays: 10,
    penaltyPerDayDelayINR: null,
    description: 'Fraudulent debit without customer consent where customer notified bank within 3 working days (zero customer liability rule).'
  },
  {
    code: 'EXCESSIVE_UNREASONABLE_CHARGES',
    categoryName: 'Levy of Non-Transparent / Unnotified Charges',
    turnaroundTimeDays: 30,
    penaltyPerDayDelayINR: null,
    description: 'Deductions for minimum balance, SMS alerts, or penal interest without prior notice or contrary to schedule of charges.'
  },
  {
    code: 'LOAN_PAPERS_DELAY_NOC',
    categoryName: 'Delay in Return of Original Property Documents after Loan Closure',
    turnaroundTimeDays: 30,
    penaltyPerDayDelayINR: 5000, // ₹5,000 per day delay beyond 30 days from full repayment
    description: 'Bank failing to release original property deeds within 30 days of full loan settlement.'
  }
];

export const RBI_EXCLUDED_MATTERS = [
  'Disputes between banks/financial institutions (inter-bank commercial disputes).',
  'Commercial decisions regarding lending, credit rating, or margin percentages taken in accordance with board policies.',
  'Matters pending before a court of law, debt recovery tribunal (DRT), consumer commission, or arbitrator.',
  'Complaints filed more than one year after receiving the bank final rejection letter.',
  'Frivolous, vexatious, or anonymous complaints.'
];
