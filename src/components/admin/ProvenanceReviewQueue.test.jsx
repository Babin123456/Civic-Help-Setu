import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ProvenanceReviewQueue from './ProvenanceReviewQueue.jsx';
import { ToastProvider } from '../../context/ToastContext';

describe('ProvenanceReviewQueue (#777)', () => {
  it('renders pending statutory provenance reviews and cryptographic seals', () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <ProvenanceReviewQueue />
      </ToastProvider>
    );

    expect(html).toContain('Statutory Provenance Review Queue');
    expect(html).toContain('PROV-SEAL-');
    expect(html).toContain('tree-pruning-permission:processingTime');
    expect(html).toContain('aadhaar-card:fees');
    expect(html).toContain('Approve');
    expect(html).toContain('Dismiss');
  });
});

