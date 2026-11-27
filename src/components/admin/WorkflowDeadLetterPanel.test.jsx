import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import WorkflowDeadLetterPanel from './WorkflowDeadLetterPanel';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    isSignedIn: true,
    getToken: async () => 'tok_admin_123456',
  }),
}));

describe('WorkflowDeadLetterPanel', () => {
  it('renders accessible dead-letter queue heading, refresh button, and live region', () => {
    const html = renderToStaticMarkup(<WorkflowDeadLetterPanel />);
    expect(html).toContain('id="dlq-heading"');
    expect(html).toContain('Durable Workflow Dead-Letter Queue');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Refresh');
  });
});
