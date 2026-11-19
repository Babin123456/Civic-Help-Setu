import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PaymentReceipt from './PaymentReceipt.jsx';
import { createPaymentRecord, STORAGE } from '../../services/paymentService';

describe('PaymentReceipt Component (#647)', () => {
  const TEST_SERVICE = 'passport';
  const TEST_JOURNEY = 'journey-test-888';

  beforeEach(() => {
    STORAGE.clearAll();
  });

  afterEach(() => {
    STORAGE.clearAll();
  });

  it('renders official payment-receipt organizer header and non-initiation disclaimer', () => {
    const html = renderToStaticMarkup(
      <PaymentReceipt serviceId={TEST_SERVICE} journeyId={TEST_JOURNEY} />
    );

    expect(html).toContain('Official Payment-Receipt Organizer');
    expect(html).toContain('Citizen Record-Keeping Only');
    expect(html).toContain('Civic Help Setu does NOT initiate or process financial payments');
    expect(html).toContain('Record Payment');
  });

  it('displays statutory requirements and outstanding journey balance', () => {
    const html = renderToStaticMarkup(
      <PaymentReceipt serviceId={TEST_SERVICE} journeyId={TEST_JOURNEY} />
    );

    expect(html).toContain('Statutory Required');
    expect(html).toContain('₹1,500');
    expect(html).toContain('Outstanding Balance');
  });

  it('renders recorded payments linked to the journey with official badge', () => {
    createPaymentRecord({
      serviceId: TEST_SERVICE,
      journeyId: TEST_JOURNEY,
      amount: 1500,
      paymentMode: 'UPI',
      receiptNumber: 'BHIM-2026-XYZ',
      receiptAttachment: 'passport_receipt.pdf',
    });

    const html = renderToStaticMarkup(
      <PaymentReceipt serviceId={TEST_SERVICE} journeyId={TEST_JOURNEY} />
    );

    expect(html).toContain('Linked Payment Evidence (1)');
    expect(html).toContain('Official Payment');
    expect(html).toContain('UPI');
    expect(html).toContain('BHIM-2026-XYZ');
    expect(html).toContain('passport_receipt.pdf');
    expect(html).toContain('Statutory Fully Paid');
  });

  it('displays partial payment status when payments are less than statutory requirement', () => {
    createPaymentRecord({
      serviceId: TEST_SERVICE,
      journeyId: TEST_JOURNEY,
      amount: 500,
      paymentMode: 'UPI',
    });

    const html = renderToStaticMarkup(
      <PaymentReceipt serviceId={TEST_SERVICE} journeyId={TEST_JOURNEY} />
    );

    expect(html).toContain('Partial Payment Recorded');
    expect(html).toContain('Outstanding Balance');
    expect(html).toContain('₹1,000');
  });

  it('displays disputed/unofficial charge callout and excludes it from official paid total', () => {
    createPaymentRecord({
      serviceId: TEST_SERVICE,
      journeyId: TEST_JOURNEY,
      amount: 2500,
      paymentMode: 'CASH',
      isDisputed: true,
      notes: 'Demanded by unauthorized agent outside center',
    });

    const html = renderToStaticMarkup(
      <PaymentReceipt serviceId={TEST_SERVICE} journeyId={TEST_JOURNEY} />
    );

    expect(html).toContain('Disputed / Unofficial');
    expect(html).toContain('Demanded by unauthorized agent outside center');
    // Total official paid should still be 0 because the charge was disputed
    expect(html).toContain('Awaiting Payment');
  });

  it('renders refund indicators when a payment is marked refunded', () => {
    createPaymentRecord({
      serviceId: TEST_SERVICE,
      journeyId: TEST_JOURNEY,
      amount: 1500,
      paymentMode: 'UPI',
      status: 'refunded',
      refundInfo: { refundAmount: 1500, refundDate: '2026-06-01', reason: 'Appointment cancelled' },
    });

    const html = renderToStaticMarkup(
      <PaymentReceipt serviceId={TEST_SERVICE} journeyId={TEST_JOURNEY} />
    );

    expect(html).toContain('Refunded');
    expect(html).toContain('Refunded: ₹1500 on 2026-06-01');
    expect(html).toContain('Appointment cancelled');
  });

  it('renders export buttons for redacted markdown and plain text', () => {
    const html = renderToStaticMarkup(
      <PaymentReceipt serviceId={TEST_SERVICE} journeyId={TEST_JOURNEY} />
    );

    expect(html).toContain('Copy Markdown');
    expect(html).toContain('Copy Plain Text');
    expect(html).toContain('Copy CSV');
    expect(html).toContain(`Journey ID: <code>${TEST_JOURNEY}</code>`);
  });
});
