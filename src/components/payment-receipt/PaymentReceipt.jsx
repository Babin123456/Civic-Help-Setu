import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  CheckCircle,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Plus,
  ShieldCheck,
  Download,
} from 'lucide-react';
import {
  createPaymentRecord,
  getPaymentsForJourney,
  deletePaymentRecord,
  recordRefund,
  calculateJourneyBalance,
  redactPaymentForExport,
  formatCurrency,
  PAYMENT_RECORD_STATUS,
} from '../../services/paymentService';
import {
  exportPaymentsMarkdown,
  exportPaymentsPlainText,
  exportPaymentsCsv,
} from '../../services/expenseExportService';

/**
 * PaymentReceipt (#647)
 *
 * A private payment-receipt organizer for civic service journeys.
 * Citizens can manually record payments, attach receipt references,
 * track partial payments against statutory requirements, audit refunds,
 * and export redacted expense summaries.
 *
 * Acceptance criteria coverage:
 * - Lets citizens manually record payments and attach receipts; does NOT initiate payments.
 * - Multiple payments can be linked to a single service journey.
 * - Exports and view can redact transaction identifiers.
 * - Disputed/unknown charges are never presented or counted as official statutory fees.
 * - Partial payments and refunds are tracked with real-time balance calculations.
 */
const PaymentReceipt = ({ serviceId = 'passport', journeyId = 'journey-default-01' }) => {
  const [payments, setPayments] = useState(() => getPaymentsForJourney(serviceId, journeyId));
  const [showForm, setShowForm] = useState(false);
  const [redactedView, setRedactedView] = useState(false);
  const [copiedNotice, setCopiedNotice] = useState('');

  // Form states
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [receiptFileName, setReceiptFileName] = useState('');
  const [feeCategory, setFeeCategory] = useState('government-statutory');
  const [notes, setNotes] = useState('');
  const [isDisputed, setIsDisputed] = useState(false);

  // Sync payments from persistent storage
  const refreshPayments = useCallback(() => {
    const list = getPaymentsForJourney(serviceId, journeyId);
    setPayments(list);
  }, [serviceId, journeyId]);

  useEffect(() => {
    refreshPayments();
  }, [refreshPayments]);

  const handleAddPayment = (e) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < 0) return;

    createPaymentRecord({
      serviceId,
      journeyId,
      amount: numAmount,
      paymentMode,
      paymentDate,
      feeCategory,
      receiptNumber: receiptNumber || undefined,
      receiptAttachment: receiptFileName || undefined,
      receipt: receiptFileName
        ? { fileName: receiptFileName, fileType: 'application/pdf', receiptDate: paymentDate }
        : null,
      notes: notes || undefined,
      isDisputed,
      isOfficialVerified: !isDisputed,
      status: isDisputed ? PAYMENT_RECORD_STATUS.DISPUTED : PAYMENT_RECORD_STATUS.CONFIRMED,
    });

    // Reset form
    setAmount('');
    setReceiptNumber('');
    setReceiptFileName('');
    setNotes('');
    setIsDisputed(false);
    setShowForm(false);
    refreshPayments();
  };

  const handleDelete = (paymentId) => {
    deletePaymentRecord(serviceId, paymentId);
    refreshPayments();
  };

  const handleRefund = (paymentId, currentAmount) => {
    recordRefund(serviceId, paymentId, {
      refundAmount: currentAmount,
      refundDate: new Date().toISOString().split('T')[0],
      reason: 'Citizen refund adjustment recorded in organizer',
    });
    refreshPayments();
  };

  const handleCopyExport = (format) => {
    let text;
    if (format === 'markdown') {
      text = exportPaymentsMarkdown(serviceId, journeyId, { redact: redactedView });
    } else if (format === 'csv') {
      text = exportPaymentsCsv(serviceId, journeyId, { redact: redactedView });
    } else {
      text = exportPaymentsPlainText(serviceId, journeyId, { redact: redactedView });
    }

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedNotice(`${format.toUpperCase()} statement copied!`);
        setTimeout(() => setCopiedNotice(''), 2500);
      });
    }
  };

  const balance = calculateJourneyBalance(serviceId, journeyId);
  const displayPayments = redactedView
    ? payments.map((p) => redactPaymentForExport(p))
    : payments;

  return (
    <div
      className="civic-payment-receipt-organizer"
      style={{
        marginTop: '2rem',
        padding: '1.5rem',
        borderRadius: '1rem',
        background: 'var(--bg-card, rgba(255, 255, 255, 0.03))',
        border: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
      }}
      aria-labelledby="payment-receipt-heading"
    >
      {/* 1. Header & Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <FileText size={20} color="var(--accent-main, #38bdf8)" />
            <h3 id="payment-receipt-heading" style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>
              Official Payment-Receipt Organizer
            </h3>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)', margin: 0 }}>
            Retain payment evidence, track partial payments, audit refunds, and export redacted expense histories
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Redaction Toggle */}
          <button
            type="button"
            onClick={() => setRedactedView(!redactedView)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.8rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
              background: redactedView ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.04)',
              color: redactedView ? 'var(--accent-main, #38bdf8)' : 'var(--text-secondary, #cbd5e1)',
              fontSize: '0.8rem',
              cursor: 'pointer',
              fontWeight: '600',
            }}
            aria-pressed={redactedView}
          >
            {redactedView ? <EyeOff size={14} /> : <Eye size={14} />}
            {redactedView ? 'Redaction: ON (IDs Masked)' : 'Redaction: OFF'}
          </button>

          {/* Record Payment Button */}
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.85rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: 'var(--accent-main, #38bdf8)',
              color: '#0f172a',
              fontSize: '0.8rem',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            <Plus size={14} /> Record Payment
          </button>
        </div>
      </div>

      {/* 2. Non-Initiation & Privacy Notice */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.6rem 0.85rem',
          background: 'rgba(56, 189, 248, 0.06)',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          borderRadius: '0.5rem',
          marginBottom: '1.25rem',
          fontSize: '0.8rem',
          color: 'var(--text-secondary, #cbd5e1)',
        }}
      >
        <ShieldCheck size={16} color="var(--accent-main, #38bdf8)" style={{ flexShrink: 0 }} />
        <span>
          <strong>Citizen Record-Keeping Only:</strong> Civic Help Setu does NOT initiate or process financial payments. This private organizer helps you retain official challan and portal payment records for reimbursement and audit.
        </span>
      </div>

      {/* 3. Partial Payment & Journey Balance Card */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.75rem',
          padding: '1rem',
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '0.75rem',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary, #94a3b8)', textTransform: 'uppercase' }}>
            Statutory Required
          </span>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)' }}>
            {formatCurrency(balance.statutoryRequired, balance.currency)}
          </div>
        </div>

        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary, #94a3b8)', textTransform: 'uppercase' }}>
            Total Official Paid
          </span>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#22c55e' }}>
            {formatCurrency(balance.netPaid, balance.currency)}
          </div>
        </div>

        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary, #94a3b8)', textTransform: 'uppercase' }}>
            Outstanding Balance
          </span>
          <div
            style={{
              fontSize: '1.2rem',
              fontWeight: '800',
              color: balance.remainingBalance === 0 ? '#22c55e' : '#f59e0b',
            }}
          >
            {formatCurrency(balance.remainingBalance, balance.currency)}
          </div>
        </div>

        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary, #94a3b8)', textTransform: 'uppercase' }}>
            Status
          </span>
          <div style={{ marginTop: '0.2rem' }}>
            {balance.isFullyPaid ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.2rem 0.5rem',
                  background: 'rgba(34, 197, 94, 0.15)',
                  color: '#22c55e',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                }}
              >
                <CheckCircle size={12} /> Statutory Fully Paid
              </span>
            ) : balance.isPartiallyPaid ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.2rem 0.5rem',
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: '#f59e0b',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                }}
              >
                Partial Payment Recorded
              </span>
            ) : (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.2rem 0.5rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--text-secondary, #94a3b8)',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                }}
              >
                Awaiting Payment
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 4. Manual Payment Recording Form Drawer */}
      {showForm && (
        <form
          onSubmit={handleAddPayment}
          style={{
            padding: '1.25rem',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
            borderRadius: '0.75rem',
            marginBottom: '1.25rem',
          }}
        >
          <h4 style={{ margin: '0 0 1rem', fontSize: '1rem', color: 'var(--text-primary)' }}>
            Record Official Payment Evidence
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.775rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.25rem' }}>
                Amount Paid (₹) *
              </label>
              <input
                type="number"
                required
                min="0"
                step="1"
                placeholder="e.g. 1500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '0.4rem',
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.775rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.25rem' }}>
                Payment Mode *
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '0.4rem',
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box',
                }}
              >
                <option value="UPI">BHIM UPI</option>
                <option value="NET_BANKING">Net Banking</option>
                <option value="CREDIT_CARD">Credit Card</option>
                <option value="DEBIT_CARD">Debit Card</option>
                <option value="CHALLAN">Treasury / SBI Challan</option>
                <option value="CASH">Official Counter Cash</option>
                <option value="OTHER">Other Authorized Mode</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.775rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.25rem' }}>
                Official Category *
              </label>
              <select
                value={feeCategory}
                onChange={(e) => setFeeCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '0.4rem',
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box',
                }}
              >
                <option value="government-statutory">Government Statutory Fee</option>
                <option value="portal-charge">Portal / Gateway Processing Fee</option>
                <option value="service-centre-charge">Authorized Service-Centre Cap</option>
                <option value="optional-third-party">Optional Add-on / Facilitation</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.775rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.25rem' }}>
                Payment Date
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '0.4rem',
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.775rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.25rem' }}>
                Receipt / Challan Number (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. ARN-2026-98124"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '0.4rem',
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.775rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.25rem' }}>
                Receipt File Attachment Reference
              </label>
              <input
                type="text"
                placeholder="e.g. passport_challan_scan.pdf"
                value={receiptFileName}
                onChange={(e) => setReceiptFileName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '0.4rem',
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', fontSize: '0.775rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.25rem' }}>
              Notes / Remarks
            </label>
            <input
              type="text"
              placeholder="e.g. Paid online at Parivahan portal"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '0.4rem',
                color: 'var(--text-primary)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Disputed Checkbox (#647: Disputed/unknown charges not presented as official) */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8rem',
                color: '#f87171',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={isDisputed}
                onChange={(e) => setIsDisputed(e.target.checked)}
              />
              <span>Mark as Disputed / Unofficial Demand (Excluded from official statutory totals)</span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: '0.4rem',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: 'transparent',
                color: 'var(--text-secondary, #cbd5e1)',
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: '0.45rem 1rem',
                borderRadius: '0.4rem',
                border: 'none',
                background: 'var(--accent-main, #38bdf8)',
                color: '#0f172a',
                fontWeight: '700',
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              Save Payment Record
            </button>
          </div>
        </form>
      )}

      {/* 5. Payments List Linked to Service Journey */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Linked Payment Evidence ({displayPayments.length})</span>
          {copiedNotice && (
            <span style={{ fontSize: '0.75rem', color: '#22c55e', fontWeight: '600' }}>
              ✓ {copiedNotice}
            </span>
          )}
        </h4>

        {displayPayments.length === 0 ? (
          <div
            style={{
              padding: '1.5rem',
              textAlign: 'center',
              background: 'rgba(255, 255, 255, 0.01)',
              borderRadius: '0.5rem',
              border: '1px dashed rgba(255, 255, 255, 0.08)',
              color: 'var(--text-tertiary, #94a3b8)',
              fontSize: '0.85rem',
            }}
          >
            No payments recorded yet for this journey. Click &ldquo;Record Payment&rdquo; above to log payment evidence.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {displayPayments.map((p) => {
              const isRef = p.status === PAYMENT_RECORD_STATUS.REFUNDED;
              const isDisp = p.isDisputed;

              return (
                <div
                  key={p.id}
                  style={{
                    padding: '0.85rem 1rem',
                    borderRadius: '0.5rem',
                    background: isDisp
                      ? 'rgba(239, 68, 68, 0.06)'
                      : isRef
                      ? 'rgba(245, 158, 11, 0.06)'
                      : 'rgba(255, 255, 255, 0.02)',
                    border: isDisp
                      ? '1px solid rgba(239, 68, 68, 0.3)'
                      : isRef
                      ? '1px solid rgba(245, 158, 11, 0.3)'
                      : '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                          {formatCurrency(p.amount || p.amountPaid, p.currency)}
                        </span>
                        <span
                          style={{
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            background: isDisp
                              ? 'rgba(239, 68, 68, 0.2)'
                              : isRef
                              ? 'rgba(245, 158, 11, 0.2)'
                              : 'rgba(56, 189, 248, 0.15)',
                            color: isDisp ? '#ef4444' : isRef ? '#f59e0b' : '#38bdf8',
                          }}
                        >
                          {isDisp ? 'Disputed / Unofficial' : isRef ? 'Refunded' : 'Official Payment'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary, #94a3b8)' }}>
                          {p.paymentMode} • {p.paymentDate}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary, #94a3b8)', marginTop: '0.25rem' }}>
                        <strong>Txn ID:</strong> {p.id}
                        {p.receiptNumber && (
                          <span style={{ marginLeft: '0.75rem' }}>
                            <strong>Receipt No:</strong> {p.receiptNumber}
                          </span>
                        )}
                        {p.receiptAttachment && (
                          <span style={{ marginLeft: '0.75rem' }}>
                            <strong>Attachment:</strong> {p.receiptAttachment}
                          </span>
                        )}
                      </div>

                      {p.notes && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary, #94a3b8)', marginTop: '0.2rem' }}>
                          <em>{p.notes}</em>
                        </div>
                      )}

                      {isRef && p.refundInfo && (
                        <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.25rem' }}>
                          ↩ Refunded: ₹{p.refundInfo.refundAmount} on {p.refundInfo.refundDate} ({p.refundInfo.reason})
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      {!isRef && !isDisp && (
                        <button
                          type="button"
                          onClick={() => handleRefund(p.id, p.amount)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: '#f59e0b',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.7rem',
                            fontWeight: '600',
                          }}
                          title="Record Refund"
                        >
                          Record Refund
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDelete(p.id)}
                        style={{
                          padding: '0.25rem 0.5rem',
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: '#ef4444',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.7rem',
                        }}
                        title="Delete Record"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. Redacted Expense Export Bar (#647: Exports can redact transaction identifiers) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
          fontSize: '0.8rem',
        }}
      >
        <div style={{ color: 'var(--text-tertiary, #94a3b8)' }}>
          <span>Journey ID: <code>{journeyId}</code></span>
          {redactedView && (
            <span style={{ marginLeft: '0.5rem', color: '#38bdf8' }}>
              ✓ Sensitive transaction numbers will be redacted in export
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => handleCopyExport('markdown')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '0.4rem',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(255, 255, 255, 0.04)',
              color: 'var(--text-primary)',
              fontSize: '0.775rem',
              cursor: 'pointer',
            }}
          >
            <Copy size={13} /> Copy Markdown
          </button>

          <button
            type="button"
            onClick={() => handleCopyExport('text')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '0.4rem',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(255, 255, 255, 0.04)',
              color: 'var(--text-primary)',
              fontSize: '0.775rem',
              cursor: 'pointer',
            }}
          >
            <Download size={13} /> Copy Plain Text
          </button>

          <button
            type="button"
            onClick={() => handleCopyExport('csv')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '0.4rem',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(255, 255, 255, 0.04)',
              color: 'var(--text-primary)',
              fontSize: '0.775rem',
              cursor: 'pointer',
            }}
          >
            <Download size={13} /> Copy CSV
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentReceipt;
