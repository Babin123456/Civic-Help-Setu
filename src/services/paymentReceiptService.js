/**
 * Civic Payment-Receipt Organizer Service (#647)
 *
 * Bridges the payment-receipt interface to the unified Civic Payment Service.
 * Allows recording payments, attaching receipts, retrieving journey payments,
 * redacting exports, and calculating balances.
 */

export {
  PAYMENT_RECORD_STATUS,
  PAYMENT_STATUS,
  recordPayment,
  createPaymentRecord,
  attachReceipt,
  getPaymentsForService,
  getPaymentsForJourney,
  linkPaymentToJourney,
  recordRefund,
  calculateJourneyBalance,
  calculateServicePaymentTotals,
  redactPaymentForExport,
  redactPaymentsForExport,
  isFeeScheduleExpiredForPayment,
  getPaymentRecords,
  getPaymentRecordById,
  updatePaymentRecord,
  deletePaymentRecord,
  validatePaymentRecord,
  formatCurrency,
  STORAGE,
} from './paymentService';

import * as paymentServiceModule from './paymentService';
export default paymentServiceModule;
