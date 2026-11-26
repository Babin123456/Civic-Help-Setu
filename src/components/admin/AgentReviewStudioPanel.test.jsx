import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AgentReviewStudioPanel from './AgentReviewStudioPanel.jsx';
import { ToastProvider } from '../../context/ToastContext.jsx';
import { setCurrentActor } from '../../services/accessControl.js';

describe('AgentReviewStudioPanel (#1150)', () => {
  beforeEach(() => {
    setCurrentActor({ role: 'admin', username: 'ReviewerAdmin' });
  });

  afterEach(() => {
    setCurrentActor(null);
  });

  it('renders side-by-side claims, source passages, provenance, and accessible decision controls', () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <AgentReviewStudioPanel />
      </ToastProvider>
    );

    expect(html).toContain('Human-in-the-Loop Agent Review Studio');
    expect(html).toContain('Generated Claims');
    expect(html).toContain('Source Passages &amp; Provenance');
    expect(html).toContain('Reviewer Decision');
    expect(html).toContain('Reviewer Rationale');
    expect(html).toContain('Approve');
    expect(html).toContain('Edit &amp; Approve');
    expect(html).toContain('Escalate');
    expect(html).toContain('Reject');
  });
});
