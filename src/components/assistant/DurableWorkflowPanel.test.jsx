import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DurableWorkflowPanel from './DurableWorkflowPanel';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    isSignedIn: true,
    getToken: async () => 'tok_synth_123456',
  }),
}));

describe('DurableWorkflowPanel', () => {
  it('renders accessible heading, untrusted-draft disclaimer, and polite live region', () => {
    const html = renderToStaticMarkup(<DurableWorkflowPanel serviceId="birth-certificate" />);
    expect(html).toContain('id="durable-workflow-heading"');
    expect(html).toContain('Human Approval Required');
    expect(html).toContain('untrusted drafts');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Start Run');
    expect(html).toContain('wf-type-select');
    expect(html).toContain('wf-query-input');
  });
});
