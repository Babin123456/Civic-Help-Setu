import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import CounterDemandReviewQueue from './CounterDemandReviewQueue';
import { ToastProvider } from '../../context/ToastContext';

describe('CounterDemandReviewQueue (#764)', () => {
  it('renders review queue heading, seed items, and verification seals', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ToastProvider>
          <CounterDemandReviewQueue />
        </ToastProvider>
      </MemoryRouter>
    );

    expect(html).toContain('Counter Demand &amp; Queue Anomaly Moderation Queue');
    expect(html).toContain('AGGREGATE ANOMALY');
    expect(html).toContain('UNEXPECTED CLOSURE');
    expect(html).toContain('off_delhi_south_01');
    expect(html).toContain('Seal: CDR-5E21-7A11');
    expect(html).toContain('Open Workspace');
    expect(html).toContain('Accept for Recalibration');
    expect(html).toContain('Dismiss');
  });
});

