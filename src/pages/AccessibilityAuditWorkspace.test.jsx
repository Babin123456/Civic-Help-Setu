import { it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AccessibilityAuditWorkspace from './AccessibilityAuditWorkspace.jsx';
it('renders accessibility screening and redressal', () => {
  const html = renderToStaticMarkup(<AccessibilityAuditWorkspace />);
  expect(html).toContain('Universal Accessibility Audit Workspace');
  expect(html).toContain('Section 89 penalty guidance');
  expect(html).toContain('Commissioner petition');
  expect(html).toContain('Local audit vault');
});
