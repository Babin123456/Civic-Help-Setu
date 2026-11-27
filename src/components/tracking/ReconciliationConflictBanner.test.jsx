import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import ReconciliationConflictBanner from './ReconciliationConflictBanner.jsx';
import { CONFLICT_TYPES, CONFLICT_SEVERITY } from '../../services/statusReconciliationEngine.js';

describe('ReconciliationConflictBanner', () => {
  it('renders default call-to-action when no evidence has been imported', () => {
    const html = renderToString(<ReconciliationConflictBanner record={null} onOpenModal={() => {}} />);
    expect(html).toContain('Cross-Portal Status Reconciliation');
    expect(html).toContain('Reconcile Updates');
  });

  it('renders tamper alert when record fails cryptographic checksum seal', () => {
    const record = {
      isTampered: true,
      evidenceList: [{ id: '1' }],
      lastReport: { hasConflicts: false },
    };
    const html = renderToString(<ReconciliationConflictBanner record={record} onOpenModal={() => {}} />);
    expect(html).toContain('Integrity Seal Invalid (Tamper Detected)');
    expect(html).toContain('Review Data');
  });

  it('renders conflict alert when report contains discrepancies', () => {
    const record = {
      isTampered: false,
      evidenceList: [{ id: '1' }, { id: '2' }],
      lastReport: {
        hasConflicts: true,
        conflicts: [
          {
            type: CONFLICT_TYPES.CONTRADICTORY_TERMINAL,
            severity: CONFLICT_SEVERITY.HIGH,
          },
        ],
        consensusStatus: 'APPROVED',
        confidenceScore: 45,
        guidance: { summary: 'Conflicting official outcomes detected.' },
      },
    };

    const html = renderToString(<ReconciliationConflictBanner record={record} onOpenModal={() => {}} />);
    expect(html).toContain('Status Conflict Detected (1 discrepancy)');
    expect(html).toContain('45% Confidence');
    expect(html).toContain('CONTRADICTORY TERMINAL');
    expect(html).toContain('Resolve Conflicts');
  });

  it('renders green consensus badge when evidence aligns without conflicts', () => {
    const record = {
      isTampered: false,
      evidenceList: [{ id: '1' }, { id: '2' }],
      lastReport: {
        hasConflicts: false,
        conflicts: [],
        consensusStatus: 'UNDER_REVIEW',
        confidenceScore: 88,
        guidance: { summary: 'Application active under review.' },
      },
    };

    const html = renderToString(<ReconciliationConflictBanner record={record} onOpenModal={() => {}} />);
    expect(html).toContain('Reconciled Status:');
    expect(html).toContain('Under Review / Scrutiny');
    expect(html).toContain('(88% confidence across 2 sources)');
    expect(html).toContain('View Reconciliation (2)');
  });
});
