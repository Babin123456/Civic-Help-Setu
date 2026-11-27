import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DependencyEdgeWorkflowPanel from './DependencyEdgeWorkflowPanel';

describe('DependencyEdgeWorkflowPanel (#1429)', () => {
  it('renders accessible dependency list and human-reviewed edge proposal form', () => {
    const html = renderToStaticMarkup(<DependencyEdgeWorkflowPanel />);
    expect(html).toContain('Accessible Dependency List &amp; Human-Reviewed Edge Publication');
    expect(html).toContain('Propose Edge');
    expect(html).toContain('Official Source URL');
  });
});
