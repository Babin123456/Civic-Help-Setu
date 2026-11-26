/**
 * Civic Payment-Receipt Organizer Dataset (#647)
 *
 * Provides structured payment record tracking for civic service journeys,
 * enabling users to manually record payments, attach receipts, and export
 * redacted expense histories. Supports multiple payments per service journey
 * and historical fee version auditing.
 */

export const PAYMENT_STATUS = ['pending', 'completed', 'failed', 'refunded'];

/**
 * Payment record representing a single transaction linked to a service journey.
 * Users manually enter payment details; no payment initiation occurs here.
 */
export const paymentRecordSchema = {
  // Unique identifier for this payment record (generated client-side or server-side)
  id: { type: 'string', required: true },

  // Link to the civic service journey
  serviceId: { type: 'string', required: true },

  // The civic service name (for display purposes)
  serviceName: { type: 'string', required: true },

  // The fee breakdown ID from the service fee breakdowns
  feeBreakdownId: { type: 'string' },

  // The specific fee/component paid (e.g., 'tier-standard-36', 'officialStatutoryFees[0]')
  feeComponent: { type: 'string' },

  // Amount paid in smallest currency unit (paise for INR) or full amount
  amount: { type: 'number', required: true },

  // Currency code (e.g., 'INR')
  currency: { type: 'string', required: true, default: 'INR' },

  // Payment date in YYYY-MM-DD format
  paymentDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },

  // Payment mode (UPI, Netbanking, Cash, Card, etc.)
  paymentMode: {
    type: 'string',
    enum: ['UPI', 'NET_BANKING', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'CHALLAN', 'OTHER'],
    required: true,
  },

  // Receipt file/attachment reference (path, URL, or base64)
  receiptAttachment: { type: 'string' },

  // User-entered receipt number / reference from official receipt
  receiptNumber: { type: 'string' },

  // Jurisdiction where the payment was made (state, district)
  jurisdiction: {
    type: 'object',
    optional: true,
    schema: {
      level: 'string', // 'national', 'state', 'district', 'localBody'
      states: { type: 'array', items: { type: 'string' } },
      districts: { type: 'array', items: { type: 'string' } },
      localBody: { type: 'string' },
    },
  },

  // User-entered notes about the payment
  notes: { type: 'string' },

  // Creation timestamp
  createdAt: { type: 'string', format: 'date-time', pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}.\\d+Z' },

  // Last update timestamp
  updatedAt: { type: 'string', format: 'date-time', pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}.\\d+Z' },

  // Version tracking for audit trail
  version: { type: 'number', default: 1 },

  // Disputed flag - if user disputes this charge as unofficial
  isDisputed: { type: 'boolean', default: false },

  // Whether this charge has been verified as official
  isOfficialVerified: { type: 'boolean', default: true },
};

/**
 * Default payment record template - used when creating new payment records.
 * The id field should be overridden with a unique generator.
 */
export const defaultPaymentRecord = {
  serviceId: '',
  serviceName: '',
  feeComponent: '',
  amount: 0,
  currency: 'INR',
  paymentDate: new Date().toISOString().split('T')[0],
  paymentMode: 'UPI',
  receiptAttachment: '',
  receiptNumber: '',
  jurisdiction: {},
  notes: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: 1,
  isDisputed: false,
  isOfficialVerified: true,
};

/**
 * Storage key for payment records in localStorage.
 * Each serviceId maps to an array of payment records.
 */
export const PAYMENT_STORAGE_KEY = 'civic_payment_records';

/**
 * Extracts the jurisdictional state from a jurisdiction object.
 */
export const getJurisdictionState = (jurisdiction) => {
  if (!jurisdiction) return null;
  if (jurisdiction.states && jurisdiction.states.length > 0) return jurisdiction.states[0];
  if (jurisdiction.level) return jurisdiction.level;
  return null;
};

/**
 * Checks if a payment record represents a disputed/unknown charge.
 * Disputed charges are not presented as official.
 */
export const isDisputedPayment = (payment) => payment && payment.isDisputed === true;

/**
 * Checks if a payment record has an official verification status.
 */
export const isOfficiallyVerifiedPayment = (payment) =>
  payment && payment.isOfficialVerified !== false;

/**
 * Calculates the total amount across all payment records for a service.
 */
export const calculateTotalPaid = (payments) => {
  if (!Array.isArray(payments)) return 0;
  return payments.reduce((total, p) => total + (p.amount || 0), 0);
};

/**
 * Filters payments to only include official (non-disputed, verified) charges.
 */
export const getOfficialPayments = (payments) => {
  if (!Array.isArray(payments)) return [];
  return payments.filter(
    (p) => !p.isDisputed && p.isOfficialVerified !== false
  );
};

/**
 * Filters payments to only include disputed/unknown charges.
 */
export const getDisputedPayments = (payments) => {
  if (!Array.isArray(payments)) return [];
  return payments.filter((p) => p.isDisputed === true);
};

/**
 * Redacts transaction identifiers from a payment record for safe export.
 * Removes sensitive identifiers while preserving fee structure for auditing.
 */
export const redactPaymentForExport = (payment) => {
  if (!payment) return null;

  return {
    id: payment.id,
    serviceId: payment.serviceId,
    serviceName: payment.serviceName,
    feeComponent: payment.feeComponent,
    amount: payment.amount,
    currency: payment.currency,
    paymentDate: payment.paymentDate,
    paymentMode: payment.paymentMode,
    // Redact receipt number and attachment references
    receiptNumber: '[REDACTED]',
    receiptAttachment: '[REDACTED]',
    jurisdiction: payment.jurisdiction
      ? {
          level: payment.jurisdiction.level,
          states: payment.jurisdiction.states
            ? payment.jurisdiction.states.map(() => '[STATE REDACTED]')
            : undefined,
          districts: payment.jurisdiction.districts
            ? payment.jurisdiction.districts.map(() => '[DISTRICT REDACTED]')
            : undefined,
          localBody: payment.jurisdiction.localBody ? '[LOCAL BODY REDACTED]' : undefined,
        }
      : {},
    notes: payment.notes,
    version: payment.version,
    isDisputed: payment.isDisputed,
    isOfficialVerified: payment.isOfficialVerified,
    // Preserve creation timestamp but not sensitive details
    createdAt: payment.createdAt,
  };
};

/**
 * Redacts transaction identifiers from an array of payment records for export.
 * @param {Array} payments - Array of payment records
 * @returns {Array} Array of redacted payment objects
 */
export const redactPaymentsForExport = (payments) => {
  if (!Array.isArray(payments)) return [];
  return payments.map(redactPaymentForExport);
};

/**
 * Groups payment records by service journey for display/export.
 * Supports multiple payments linked to a single service journey.
 */
export const groupPaymentsByService = (payments) => {
  if (!Array.isArray(payments)) return {};

  const grouped = {};

  payments.forEach((payment) => {
    const key = payment.serviceId;
    if (!grouped[key]) {
      grouped[key] = {
        serviceId: payment.serviceId,
        serviceName: payment.serviceName,
        payments: [],
        totalAmount: 0,
        officialTotal: 0,
        disputedTotal: 0,
      };
    }

    grouped[key].payments.push(payment);
    grouped[key].totalAmount += payment.amount || 0;

    if (!payment.isDisputed && payment.isOfficialVerified !== false) {
      grouped[key].officialTotal += payment.amount || 0;
    }
    if (payment.isDisputed === true) {
      grouped[key].disputedTotal += payment.amount || 0;
    }
  });

  return grouped;
};