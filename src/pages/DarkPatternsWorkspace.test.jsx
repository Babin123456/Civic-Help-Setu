import { it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DarkPatternsWorkspace from './DarkPatternsWorkspace.jsx';
it('renders the workspace and all major tools', () => {
  const html = renderToStaticMarkup(<DarkPatternsWorkspace />);
  expect(html).toContain('Dark Patterns &amp; Consumer Redressal Workspace');
  expect(html).toContain('Drip pricing audit');
  expect(html).toContain('Local evidence vault');
  expect(html).toContain('Rogue malwares');
});
