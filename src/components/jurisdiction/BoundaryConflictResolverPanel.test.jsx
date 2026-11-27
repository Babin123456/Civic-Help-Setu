import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import BoundaryConflictResolverPanel from './BoundaryConflictResolverPanel';

describe('BoundaryConflictResolverPanel (#1434)', () => {
  it('renders boundary dataset version selector, source metadata, and conflict check form', () => {
    const html = renderToStaticMarkup(<BoundaryConflictResolverPanel locality="Wakad 411057" stateCode="MAHARASHTRA" />);
    expect(html).toContain('Boundary Conflict &amp; Border-Area Resolver');
    expect(html).toContain('Boundary Dataset Version');
    expect(html).toContain('2026.2');
    expect(html).toContain('Check Boundary Conflicts');
  });
});

