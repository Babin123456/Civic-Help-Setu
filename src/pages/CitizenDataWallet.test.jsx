import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import CitizenDataWallet from './CitizenDataWallet';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { resetWalletStorage } from '../services/dataWalletStorageService';
import { clearConsentReceipts } from '../services/consentReceiptService';

describe('CitizenDataWallet Workspace (#1159)', () => {
  beforeEach(() => {
    resetWalletStorage();
    clearConsentReceipts();
  });

  const renderComponent = () => {
    return renderToString(
      <AuthProvider>
        <ToastProvider>
          <CitizenDataWallet />
        </ToastProvider>
      </AuthProvider>
    );
  };

  it('renders workspace hero title and DPDP Act summary', () => {
    const html = renderComponent();
    expect(html).toContain('Consent-Driven Citizen Data Wallet');
    expect(html).toContain('Digital Personal Data Protection (DPDP) Act, 2023');
  });

  it('renders statutory non-government verification notice', () => {
    const html = renderComponent();
    expect(html).toContain('Statutory &amp; Legal Notice');
    expect(html).toContain('does NOT claim statutory government authority');
  });

  it('renders summary stat metric tiles', () => {
    const html = renderComponent();
    expect(html).toContain('Stored Credentials');
    expect(html).toContain('Active Disclosures');
    expect(html).toContain('Data Minimization');
    expect(html).toContain('At-Rest Encryption');
  });

  it('renders accessible tab list and default credentials tab', () => {
    const html = renderComponent();
    expect(html).toContain('My Credentials');
    expect(html).toContain('Consent Receipts &amp; Revocation');
    expect(html).toContain('Verifier Inspection Sandbox');
    expect(html).toContain('Wallet Security');
    expect(html).toContain('Add Credential');
  });

  it('renders synthetic seed credentials with trust tier badges and action buttons', () => {
    const html = renderComponent();
    expect(html).toContain('Ward 12 Municipal Domicile Certificate');
    expect(html).toContain('Self-Asserted (Citizen Declared)');
    expect(html).toContain('Present &amp; Share Minimally');
  });
});
