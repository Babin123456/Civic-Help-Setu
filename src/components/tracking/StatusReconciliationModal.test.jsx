import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ToastProvider } from '../../context/ToastContext.jsx';
import StatusReconciliationModal from './StatusReconciliationModal.jsx';
import { saveReconciliationEvidence } from '../../services/statusEvidenceStorage.js';
import { ingestStatusEvidence } from '../../services/statusReconciliationEngine.js';

describe('StatusReconciliationModal', () => {
  let store = {};

  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((k) => store[k] || null),
      setItem: vi.fn((k, v) => {
        store[k] = String(v);
      }),
      removeItem: vi.fn((k) => {
        delete store[k];
      }),
      clear: vi.fn(() => {
        store = {};
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns null when closed or application is missing', () => {
    const html1 = renderToString(
      <ToastProvider>
        <StatusReconciliationModal isOpen={false} application={{ id: 'APP-1' }} onClose={() => {}} />
      </ToastProvider>
    );
    expect(html1).toBe('');

    const html2 = renderToString(
      <ToastProvider>
        <StatusReconciliationModal isOpen={true} application={null} onClose={() => {}} />
      </ToastProvider>
    );
    expect(html2).toBe('');
  });

  it('renders modal with application context and zero-scrape privacy notice when open', () => {
    const app = {
      id: 'MH-10293',
      serviceName: 'Income Certificate',
    };

    const html = renderToString(
      <ToastProvider>
        <StatusReconciliationModal isOpen={true} application={app} onClose={() => {}} />
      </ToastProvider>
    );

    expect(html).toContain('Cross-Portal Status Reconciliation Assistant');
    expect(html).toContain('MH-10293');
    expect(html).toContain('Zero-Scrape &amp; Privacy Protected');
    expect(html).toContain('Import New Status Evidence');
    expect(html).toContain('Civic Help Setu does not issue government decisions');
  });

  it('renders existing imported evidence and reconciliation consensus when present', () => {
    const app = {
      id: 'APP-99',
      serviceName: 'Caste Certificate',
    };

    const item = ingestStatusEvidence({
      rawText: 'SMS: Application APP-99 approved and dispatched',
      sourceType: 'SMS',
      referenceId: 'APP-99',
      date: '2026-05-15',
    });
    saveReconciliationEvidence('APP-99', item);

    const html = renderToString(
      <ToastProvider>
        <StatusReconciliationModal isOpen={true} application={app} onClose={() => {}} />
      </ToastProvider>
    );

    expect(html).toContain('Reconciled Consensus Status');
    expect(html).toContain('Reconciliation Confidence');
    expect(html).toContain('Imported Status Records (1)');
    expect(html).toContain('SMS Alert Gateway');
  });
});
