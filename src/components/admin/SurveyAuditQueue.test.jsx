import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import SurveyAuditQueue from './SurveyAuditQueue.jsx';
import { ToastProvider } from '../../context/ToastContext';

describe('SurveyAuditQueue', () => {
  it('renders survey audit queue with initial items and receipt seals', () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <SurveyAuditQueue />
      </ToastProvider>
    );

    expect(html).toContain('Civic Survey Quality &amp; Response Audit Queue');
    expect(html).toContain('Ward 12 Municipal Water Supply &amp; Pipeline Reliability Survey');
    expect(html).toContain('SRV-SEAL-8F12-3D91');
    expect(html).toContain('Verify');
    expect(html).toContain('Dismiss');
  });
});

