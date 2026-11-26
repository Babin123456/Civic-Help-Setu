/**
 * Civic Payment Service (#647)
 *
 * Manages payment records for civic service journeys, enabling citizens to:
 * - Manually record payments and retain payment evidence.
 * - Does NOT initiate payments; only records user-entered payment evidence.
 * - Link multiple payments to a single service journey.
 * - Separate government fees from portal/service-centre/optional charges.
 * - Handle partial payments and calculate outstanding balance.
 * - Record refunds and audit net expenditures.
 * - Ensure disputed or unknown charges are never presented as official statutory fees.
 * - Export redacted expense records stripped of sensitive transaction identifiers.
 */

import {
  PAYMENT_STORAGE_KEY,
  defaultPaymentRecord,
  calculateTotalPaid,
  getOfficialPayments,
  getDisputedPayments,
  isDisputedPayment,
  isOfficiallyVerifiedPayment,
} from '../data/paymentRecords';
import { getServiceFeeBreakdown, isFeeScheduleExpired } from './feeTransparencyService';
import { SERVICE_FEE_BREAKDOWNS } from '../data/serviceFeeBreakdowns';

export const PAYMENT_RECORD_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  REFUNDED: 'refunded',
  DISPUTED: 'disputed',
};

export const PAYMENT_STATUS = ['pending', 'completed', 'confirmed', 'failed', 'refunded', 'disputed'];

/**
 * Storage adapter with localStorage synchronization and robust memory fallback.
 */
export const STORAGE = {
  data: {},

  clearAll() {
    this.data = {};
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(PAYMENT_STORAGE_KEY);
      } catch {
        // Non-fatal
      }
    }
  },

  get(serviceId) {
    if (!this.data[serviceId] && typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(`${PAYMENT_STORAGE_KEY}_${serviceId}`);
        if (raw) {
          this.data[serviceId] = JSON.parse(raw);
        }
      } catch {
        // Non-fatal
      }
    }
    return this.data[serviceId] || [];
  },

  set(serviceId, value) {
    const records = Array.isArray(value) ? value : [value];
    this.data[serviceId] = records;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(`${PAYMENT_STORAGE_KEY}_${serviceId}`, JSON.stringify(records));
      } catch {
        // Non-fatal
      }
    }
  },

  update(serviceId, recordId, updatedRecord) {
    const records = this.get(serviceId);
    const index = records.findIndex((r) => r.id === recordId);
    if (index !== -1) {
      records[index] = { ...records[index], ...updatedRecord, updatedAt: new Date().toISOString() };
      this.set(serviceId, records);
      return records[index];
    }
    return null;
  },

  delete(serviceId, recordId) {
    const records = this.get(serviceId);
    const index = records.findIndex((r) => r.id === recordId);
    if (index !== -1) {
      const removed = records.splice(index, 1)[0];
      this.set(serviceId, records);
      return removed;
    }
    return null;
  },
};

/**
 * Pure record creator / factory for manual payment entry (#647).
 *
 * @param {Object} params - Payment parameters
 * @returns {Object} Payment record
 */
export const recordPayment = ({
  serviceId,
  journeyId,
  amountPaid,
  amount,
  paymentMode,
  receiptNumber,
  paymentDate,
  source,
  notes,
  persist = false,
  ...rest
}) => {
  const feeRecord = SERVICE_FEE_BREAKDOWNS[serviceId];
  if (!feeRecord) {
    throw new Error(`Unknown service ID: ${serviceId}`);
  }

  const resolvedAmount = Number(amount !== undefined ? amount : amountPaid);

  const paymentRecord = {
    id: rest.id || `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    serviceId,
    journeyId: journeyId || undefined,
    amount: resolvedAmount,
    amountPaid: resolvedAmount,
    paymentMode,
    receiptNumber: receiptNumber || undefined,
    paymentDate: paymentDate || new Date().toISOString().split('T')[0],
    source: source || 'manual-entry',
    status: rest.status || PAYMENT_RECORD_STATUS.PENDING,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: notes || undefined,
    _redacted: false,
    isDisputed: Boolean(rest.isDisputed),
    isOfficialVerified: rest.isOfficialVerified !== undefined ? Boolean(rest.isOfficialVerified) : !rest.isDisputed,
    version: rest.version || 1,
  };

  if (persist) {
    STORAGE.set(serviceId, [...STORAGE.get(serviceId), paymentRecord]);
  }

  return paymentRecord;
};

/**
 * Creates and persists a payment record in STORAGE.
 *
 * @param {Object} options - Payment parameters
 * @returns {Object} The stored payment record
 */
export const createPaymentRecord = (options = {}) => {
  const serviceId = options.serviceId || defaultPaymentRecord.serviceId;
  if (!serviceId) {
    throw new Error('Service ID is required for payment record');
  }

  const rawAmount = options.amount !== undefined ? options.amount : options.amountPaid;
  const amount = Number(rawAmount);
  if (typeof rawAmount === 'undefined' || isNaN(amount) || amount < 0) {
    throw new Error('Amount must be a non-negative number');
  }

  const paymentMode = options.paymentMode || defaultPaymentRecord.paymentMode;
  const validModes = ['UPI', 'NET_BANKING', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'CHALLAN', 'OTHER'];
  if (!paymentMode || !validModes.includes(paymentMode)) {
    throw new Error('Valid payment mode is required');
  }

  const paymentDate = options.paymentDate || defaultPaymentRecord.paymentDate;
  if (paymentDate && !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
    throw new Error('Payment date must be in YYYY-MM-DD format');
  }

  const feeBreakdown = SERVICE_FEE_BREAKDOWNS[serviceId] || getServiceFeeBreakdown(serviceId);
  const feeVersion = options.feeScheduleVersion || feeBreakdown?.version || 1;

  const record = {
    ...defaultPaymentRecord,
    id: options.id || `pay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    serviceId,
    serviceName: options.serviceName || feeBreakdown?.serviceName || serviceId,
    journeyId: options.journeyId || null,
    amount,
    amountPaid: amount,
    currency: options.currency || feeBreakdown?.currency || 'INR',
    paymentDate,
    feeComponent: options.feeComponent || '',
    feeCategory: options.feeCategory || 'government-statutory',
    feeScheduleVersion: feeVersion,
    paymentMode,
    receiptAttachment: options.receiptAttachment || '',
    receiptNumber: options.receiptNumber || '',
    receipt: options.receipt || (options.receiptAttachment ? { fileName: options.receiptAttachment } : null),
    jurisdiction: options.jurisdiction || feeBreakdown?.jurisdiction || {},
    notes: options.notes !== undefined ? options.notes : defaultPaymentRecord.notes,
    isDisputed: Boolean(options.isDisputed),
    isOfficialVerified: options.isOfficialVerified !== undefined ? Boolean(options.isOfficialVerified) : !options.isDisputed,
    status: options.status || (options.isDisputed ? PAYMENT_RECORD_STATUS.DISPUTED : PAYMENT_RECORD_STATUS.CONFIRMED),
    refundInfo: options.refundInfo || null,
    createdAt: options.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: options.version || 1,
  };

  STORAGE.set(serviceId, [...STORAGE.get(serviceId), record]);
  return record;
};

/**
 * Retrieves all payment records for a service.
 */
export const getPaymentRecords = (serviceId) => {
  return STORAGE.get(serviceId) || [];
};

export const getPaymentsForService = (serviceId) => {
  return getPaymentRecords(serviceId);
};

/**
 * Retrieves payments for a service linked to a specific journey ID (#647).
 */
export const getPaymentsForJourney = (serviceId, journeyId) => {
  const records = getPaymentRecords(serviceId);
  if (!journeyId) return records;
  return records.filter((r) => r.journeyId === journeyId);
};

/**
 * Links an existing payment record to a specific service journey.
 */
export const linkPaymentToJourney = (serviceId, paymentId, journeyId) => {
  return STORAGE.update(serviceId, paymentId, { journeyId });
};

/**
 * Retrieves a single payment record by ID.
 */
export const getPaymentRecordById = (serviceId, recordId) => {
  const records = STORAGE.get(serviceId);
  return records.find((r) => r.id === recordId) || null;
};

/**
 * Updates an existing payment record.
 */
export const updatePaymentRecord = (serviceId, recordId, updates) => {
  return STORAGE.update(serviceId, recordId, updates);
};

/**
 * Deletes a payment record.
 */
export const deletePaymentRecord = (serviceId, recordId) => {
  return STORAGE.delete(serviceId, recordId);
};

/**
 * Attaches receipt metadata to a payment record (#647).
 */
export const attachReceipt = (paymentOrServiceId, fileOrPaymentId, dateOrFile, maybeDate) => {
  if (typeof paymentOrServiceId === 'object' && paymentOrServiceId !== null) {
    const payment = paymentOrServiceId;
    const file = fileOrPaymentId;
    const date = dateOrFile || new Date().toISOString().split('T')[0];
    const receipt = {
      fileName: file ? (file.name || file) : null,
      fileType: file ? file.type : null,
      size: file ? file.size : null,
      receiptDate: date,
      redacted: false,
    };
    return {
      ...payment,
      receipt,
      receiptAttachment: receipt.fileName || '',
    };
  }

  const serviceId = paymentOrServiceId;
  const paymentId = fileOrPaymentId;
  const file = dateOrFile;
  const date = maybeDate || new Date().toISOString().split('T')[0];

  const receipt = {
    fileName: file ? (file.name || file) : null,
    fileType: file ? file.type : null,
    size: file ? file.size : null,
    receiptDate: date,
    redacted: false,
  };

  return STORAGE.update(serviceId, paymentId, {
    receipt,
    receiptAttachment: receipt.fileName || '',
  });
};

/**
 * Records a refund for a payment (full or partial) (#647).
 */
export const recordRefund = (serviceId, paymentId, refundData = {}) => {
  const record = getPaymentRecordById(serviceId, paymentId);
  if (!record) return null;

  const refundAmount =
    refundData.refundAmount !== undefined ? Number(refundData.refundAmount) : record.amount;
  const refundDate = refundData.refundDate || new Date().toISOString().split('T')[0];
  const reason = refundData.reason || 'Citizen requested refund / administrative reversal';

  const refundInfo = {
    refundAmount,
    refundDate,
    reason,
    isFullRefund: refundAmount >= record.amount,
  };

  return STORAGE.update(serviceId, paymentId, {
    status: PAYMENT_RECORD_STATUS.REFUNDED,
    refundInfo,
  });
};

/**
 * Calculates partial payment balance and progress for a service journey (#647).
 */
export const calculateJourneyBalance = (serviceId, journeyId = null, feeComponentId = null) => {
  const feeBreakdown = getServiceFeeBreakdown(serviceId);
  const allPayments = getPaymentsForJourney(serviceId, journeyId);

  let statutoryRequired = 0;
  if (feeComponentId && feeBreakdown.conditionalTiers?.length) {
    const tier = feeBreakdown.conditionalTiers.find((t) => t.id === feeComponentId);
    if (tier) statutoryRequired = Number(tier.amount) || 0;
  } else if (feeBreakdown.officialStatutoryFees?.length && Number(feeBreakdown.officialStatutoryFees[0]?.amount) > 0) {
    statutoryRequired = Number(feeBreakdown.officialStatutoryFees[0].amount);
  } else if (feeBreakdown.minOfficialCost !== null && feeBreakdown.minOfficialCost !== undefined) {
    statutoryRequired = feeBreakdown.minOfficialCost;
  } else if (feeBreakdown.officialStatutoryFees?.length) {
    statutoryRequired = feeBreakdown.officialStatutoryFees.reduce(
      (sum, f) => sum + (Number(f.amount) || 0),
      0
    );
  }

  const officialPayments = allPayments.filter(
    (p) => !p.isDisputed && p.isOfficialVerified !== false
  );

  let totalPaid = 0;
  let totalRefunded = 0;

  officialPayments.forEach((p) => {
    if (p.status === PAYMENT_RECORD_STATUS.REFUNDED && p.refundInfo) {
      totalRefunded += Number(p.refundInfo.refundAmount) || 0;
    }
    totalPaid += Number(p.amount) || 0;
  });

  const netPaid = Math.max(0, totalPaid - totalRefunded);
  const remainingBalance = Math.max(0, statutoryRequired - netPaid);
  const isFullyPaid = statutoryRequired > 0 ? netPaid >= statutoryRequired : true;
  const isPartiallyPaid = netPaid > 0 && netPaid < statutoryRequired;

  return {
    serviceId,
    journeyId,
    statutoryRequired,
    totalPaid,
    totalRefunded,
    netPaid,
    remainingBalance,
    isPartiallyPaid,
    isFullyPaid,
    paymentCount: officialPayments.length,
    currency: feeBreakdown.currency || 'INR',
  };
};

export const recordPaymentForJourney = (options) => {
  return createPaymentRecord(options);
};

export const calculateServicePaymentTotals = (serviceId) => {
  const payments = STORAGE.get(serviceId) || [];

  const official = getOfficialPayments(payments);
  const disputed = getDisputedPayments(payments);
  const refunded = payments.filter((p) => p.status === PAYMENT_RECORD_STATUS.REFUNDED);

  const totalAmount = calculateTotalPaid(payments);
  const officialTotal = calculateTotalPaid(official);
  const disputedTotal = calculateTotalPaid(disputed);
  const refundedTotal = refunded.reduce((sum, p) => sum + (p.refundInfo?.refundAmount || p.amount || 0), 0);
  const netOfficialTotal = Math.max(0, officialTotal - refundedTotal);

  return {
    serviceId,
    totalPayments: payments.length,
    totalAmount,
    officialCount: official.length,
    officialTotalAmount: officialTotal,
    disputedCount: disputed.length,
    disputedTotalAmount: disputedTotal,
    refundedCount: refunded.length,
    refundedTotalAmount: refundedTotal,
    netOfficialTotal,
    pendingCount: payments.filter((p) => p.status === 'pending').length,
  };
};

/**
 * Redacts transaction identifiers from a payment record for safe sharing/export (#647).
 */
export const redactPaymentForExport = (payment) => {
  if (!payment) return null;

  const { receipt, ...rest } = payment;

  const redactedReceipt = {
    fileName: '[REDACTED]',
    receiptDate: '[REDACTED]',
    fileType: receipt?.fileType || 'application/pdf',
  };

  return {
    ...rest,
    id: '[REDACTED]',
    receiptNumber: null,
    receiptAttachment: '[REDACTED]',
    receipt: redactedReceipt,
    amountPaid: rest.amountPaid !== undefined ? rest.amountPaid : rest.amount,
    amount: rest.amount !== undefined ? rest.amount : rest.amountPaid,
    paymentMode: rest.paymentMode,
    _redacted: true,
  };
};

export const redactPaymentsForExport = (payments) => {
  if (!Array.isArray(payments)) return [];
  return payments.map(redactPaymentForExport);
};

export const exportPaymentRecords = (serviceId, options = {}) => {
  const payments = STORAGE.get(serviceId) || [];
  const redactIdentifiers = options.redactIdentifiers !== false && options.redact !== false;

  const records = redactIdentifiers
    ? payments.map((p) => {
        const redacted = redactPaymentForExport(p);
        return {
          ...redacted,
          receiptNumber: '[REDACTED]',
          receiptAttachment: '[REDACTED]',
        };
      })
    : payments.map((p) => ({ ...p }));

  const totals = calculateServicePaymentTotals(serviceId);

  return {
    serviceId,
    serviceName: payments[0]?.serviceName || serviceId,
    exportDate: new Date().toISOString().split('T')[0],
    totalRecords: payments.length,
    totalAmount: totals.totalAmount,
    records,
    summary: {
      officialTotal: totals.officialTotalAmount,
      disputedTotal: totals.disputedTotalAmount,
      refundedTotal: totals.refundedTotalAmount,
      netOfficialTotal: totals.netOfficialTotal,
      totalCount: payments.length,
      officialCount: totals.officialCount,
      disputedCount: totals.disputedCount,
      refundedCount: totals.refundedCount,
    },
    metadata: {
      exportIncludesIdentifiers: !redactIdentifiers,
      redacted: redactIdentifiers,
      exportDate: new Date().toISOString(),
    },
  };
};

export const validatePaymentRecord = (record) => {
  const errors = [];
  if (!record || typeof record !== 'object') {
    return { isValid: false, errors: ['Payment record must be an object'] };
  }
  if (!record.id || typeof record.id !== 'string') {
    errors.push('Payment record must have a valid string ID');
  }
  if (!record.serviceId || typeof record.serviceId !== 'string') {
    errors.push('Service ID is required and must be a non-empty string');
  }
  if (typeof record.amount !== 'number' || isNaN(record.amount) || record.amount < 0) {
    errors.push('Amount must be a non-negative number');
  }
  const validModes = ['UPI', 'NET_BANKING', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'CHALLAN', 'OTHER'];
  if (!record.paymentMode || !validModes.includes(record.paymentMode)) {
    errors.push('Valid payment mode is required');
  }
  if (record.paymentDate && !/^\d{4}-\d{2}-\d{2}$/.test(record.paymentDate)) {
    errors.push('Payment date must be in YYYY-MM-DD format');
  }
  if (record.receiptNumber && typeof record.receiptNumber !== 'string') {
    errors.push('Receipt number must be a string if provided');
  }
  if (record.notes && typeof record.notes !== 'string') {
    errors.push('Notes must be a string if provided');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const getEnrichedFeeBreakdown = (serviceId) => {
  const feeBreakdown = getServiceFeeBreakdown(serviceId);
  const payments = STORAGE.get(serviceId) || [];

  const paidComponents = new Set();
  const paymentAmounts = {};

  payments.forEach((p) => {
    if (p.feeComponent && !p.isDisputed) {
      paidComponents.add(p.feeComponent);
      paymentAmounts[p.feeComponent] = (paymentAmounts[p.feeComponent] || 0) + (p.amount || 0);
    }
  });

  return {
    ...feeBreakdown,
    conditionalTiers: (feeBreakdown.conditionalTiers || []).map((t) => ({
      ...t,
      isPaid: paidComponents.has(t.id),
      paidAmount: paymentAmounts[t.id] || 0,
      paymentCount: payments.filter((p) => p.feeComponent === t.id && !p.isDisputed).length,
    })),
    officialStatutoryFees: (feeBreakdown.officialStatutoryFees || []).map((f) => ({
      ...f,
      isPaid: paidComponents.has(f.id),
      paidAmount: paymentAmounts[f.id] || 0,
      paymentCount: payments.filter((p) => p.feeComponent === f.id && !p.isDisputed).length,
    })),
    paidComponents: Array.from(paidComponents),
    totalPaidAmount: calculateTotalPaid(getOfficialPayments(payments)),
  };
};

export const isFeeScheduleExpiredForPayment = (serviceId, referenceDate = new Date()) => {
  const record = SERVICE_FEE_BREAKDOWNS[serviceId];
  if (!record) return false;
  return isFeeScheduleExpired(record, referenceDate);
};

export const groupPaymentsByService = (payments) => {
  if (!Array.isArray(payments)) return {};
  const grouped = {};
  payments.forEach((p) => {
    const key = p.serviceId;
    if (!grouped[key]) {
      grouped[key] = {
        serviceId: p.serviceId,
        serviceName: p.serviceName,
        totalPayments: 0,
        payments: [],
        totalAmount: 0,
        officialTotal: 0,
        disputedTotal: 0,
      };
    }
    grouped[key].totalPayments += 1;
    grouped[key].payments.push(p);
    grouped[key].totalAmount += p.amount || 0;
    if (!p.isDisputed && p.isOfficialVerified !== false) {
      grouped[key].officialTotal += p.amount || 0;
    }
    if (p.isDisputed === true) {
      grouped[key].disputedTotal += p.amount || 0;
    }
  });
  return grouped;
};

export const formatCurrency = (amount, currency = 'INR') => {
  if (amount === 0) return 'Free';
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return 'Unverified';
  const prefix = currency === 'INR' ? '₹' : `${currency} `;
  return `${prefix}${amount.toLocaleString('en-IN')}`;
};

export {
  PAYMENT_STORAGE_KEY,
  defaultPaymentRecord,
  calculateTotalPaid,
  getOfficialPayments,
  getDisputedPayments,
  isDisputedPayment,
  isOfficiallyVerifiedPayment,
  getServiceFeeBreakdown,
};
