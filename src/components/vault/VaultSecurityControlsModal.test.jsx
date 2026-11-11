import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import VaultSecurityControlsModal from './VaultSecurityControlsModal';
import { ToastProvider } from '../../context/ToastContext';
import { vaultSecurityStore } from '../../services/vaultRiskBasedAccessService';

describe('VaultSecurityControlsModal Component', () => {
  beforeEach(() => {
    vaultSecurityStore.reset();
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    });
  });

  it('returns empty markup when closed', () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <VaultSecurityControlsModal isOpen={false} onClose={() => {}} />
      </ToastProvider>
    );
    expect(html).toBe('');
  });

  it('renders at-rest encryption setup, active sessions, and privacy-safe audit section', () => {
    vaultSecurityStore.registerSession({
      id: 'sess-ui-1',
      userId: 'u1',
      deviceLabel: 'Test Browser',
      isCurrent: true,
    });
    vaultSecurityStore.logSecurityEvent({
      eventType: 'SECURITY_CHECK',
      sessionId: 'sess-ui-1',
      riskLevel: 'LOW',
      reason: 'Vault session initialized',
    });

    const html = renderToStaticMarkup(
      <ToastProvider>
        <VaultSecurityControlsModal
          isOpen={true}
          onClose={() => {}}
          userId="u1"
          currentSessionId="sess-ui-1"
          stepUpActive={false}
        />
      </ToastProvider>
    );

    expect(html).toContain('Vault Encryption &amp; Session Security');
    expect(html).toContain('Enable At-Rest Vault Encryption');
    expect(html).toContain('Active Sessions (1)');
    expect(html).toContain('Test Browser (Current)');
    expect(html).toContain('Recent Security Events (No Document Data Logged)');
    expect(html).toContain('SECURITY_CHECK');
  });
});
