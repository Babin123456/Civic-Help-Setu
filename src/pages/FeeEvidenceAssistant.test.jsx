import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import FeeEvidenceAssistant from './FeeEvidenceAssistant';
import { AuthProvider } from '../context/AuthContext';
import { resetFeeEvidenceAssistantData } from '../services/nationalPublicServiceCentreService';

describe('FeeEvidenceAssistant page (#1003)', () => {
  beforeEach(() => {
    resetFeeEvidenceAssistantData();
  });

  const renderPage = () =>
    renderToString(
      <AuthProvider>
        <FeeEvidenceAssistant />
      </AuthProvider>,
    );

  it('renders the assistant heading and evidence-based framing', () => {
    const html = renderPage();
    expect(html).toContain('Public Service Centre Fee Evidence Assistant');
    expect(html).toContain('Fee evidence');
    expect(html).toContain('Unknown components are labelled');
  });

  it('renders the non-collection and no-payments safeguard', () => {
    const html = renderPage();
    expect(html).toContain(
      'We never collect payment credentials or initiate payments.',
    );
    expect(html).toContain('card numbers');
    expect(html).toContain('CVV/PIN/OTP');
    expect(html).toContain('does not decide whether a charge is lawful');
  });

  it('renders receipt entry, OCR correction, and redaction controls', () => {
    const html = renderPage();
    expect(html).toContain('Paste receipt text or OCR output');
    expect(html).toContain('Correct OCR and extract charges');
    expect(html).toContain('Receipt identifiers are redacted by default');
    expect(html).toContain('id="keep-receipt-id"');
    expect(html).not.toMatch(/id="keep-receipt-id"[^>]*checked/);
    expect(html).toContain('Generate redacted');
  });

  it('renders service and jurisdiction selectors with verified services', () => {
    const html = renderPage();
    expect(html).toContain('id="fee-service"');
    expect(html).toContain('New Passport Application');
    expect(html).toContain('id="fee-jurisdiction"');
    expect(html).toContain('National');
    expect(html).toContain('Check date');
  });

  it('renders versioned fee history from the published schedule', () => {
    const html = renderPage();
    expect(html).toContain('Versioned fee history');
    expect(html).toContain('Standard Adult Passport Fee');
    expect(html).toContain('Baseline');
    expect(html).toContain('verified 2026-07-10');
  });

  it('renders the official grievance route', () => {
    const html = renderPage();
    expect(html).toContain('Official grievance route');
    expect(html).toContain('Passport Grievance Redressal');
    expect(html).toContain('CPGRAMS complaint portal');
  });

  it('renders community observations with pre-moderation messaging', () => {
    const html = renderPage();
    expect(html).toContain('Community fee observations');
    expect(html).toContain('Submit observation for moderation');
    expect(html).toContain('Pending moderation');
    expect(html).toContain('No approved observations yet');
    expect(html).toContain('Only approved entries appear here');
  });
});
