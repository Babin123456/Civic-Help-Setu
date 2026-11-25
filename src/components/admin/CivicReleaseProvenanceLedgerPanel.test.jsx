import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CivicReleaseProvenanceLedgerPanel from './CivicReleaseProvenanceLedgerPanel.jsx';
import {
  initializeSyntheticReleaseLedger,
  saveStoredLedger,
  saveStoredKeyring,
} from '../../services/civicReleaseLedgerService.js';

describe('CivicReleaseProvenanceLedgerPanel (#1178)', () => {
  beforeEach(async () => {
    saveStoredLedger([]);
    saveStoredKeyring([]);
    await initializeSyntheticReleaseLedger();
  });

  const renderPanel = () => {
    return renderToStaticMarkup(<CivicReleaseProvenanceLedgerPanel />);
  };

  it('renders the provenance signature and release ledger header and buttons', () => {
    const html = renderPanel();
    expect(html).toContain('Civic Content Provenance Signatures &amp; Release Ledger');
    expect(html).toContain('Verify Cryptographic Integrity');
    expect(html).toContain('Reset Synthetic Ledger');
  });

  it('renders authoritative keyring section and key metadata', () => {
    const html = renderPanel();
    expect(html).toContain('Authoritative Signing Keyring');
    expect(html).toContain('authority-key-dept-rev-2026');
    expect(html).toContain('Revenue &amp; Municipal Administration');
  });

  it('renders chained release ledger blocks and cryptographic algorithm', () => {
    const html = renderPanel();
    expect(html).toContain('Chained Release Ledger Blocks');
    expect(html).toContain('Block #0');
    expect(html).toContain('Block #1');
    expect(html).toContain('tree-pruning-permission');
  });
});
