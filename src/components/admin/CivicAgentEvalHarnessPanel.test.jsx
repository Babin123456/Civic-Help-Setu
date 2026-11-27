import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CivicAgentEvalHarnessPanel from './CivicAgentEvalHarnessPanel.jsx';
import { ToastProvider } from '../../context/ToastContext.jsx';

describe('CivicAgentEvalHarnessPanel (#1147)', () => {
  it('renders accessible controls, policy notice, and scenario table', () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <CivicAgentEvalHarnessPanel />
      </ToastProvider>
    );

    expect(html).toContain('Civic Agent Evaluation Harness');
    expect(html).toContain('Synthetic-Only &amp; Untrusted Proposal Policy');
    expect(html).toContain('for="eval-target-select"');
    expect(html).toContain('for="eval-category-select"');
    expect(html).toContain('for="eval-language-select"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('scope="col"');
    expect(html).toContain('eval-core-birth-docs');
    expect(html).toContain('eval-adversarial-prompt-injection');
    expect(html).toContain('eval-multilingual-hi-hinglish');
  });
});
