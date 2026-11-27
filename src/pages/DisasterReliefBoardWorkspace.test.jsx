import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DisasterReliefBoardWorkspace from './DisasterReliefBoardWorkspace';

describe('DisasterReliefBoardWorkspace (#1435)', () => {
  it('renders accessible headings, offline helplines, verified camps, and unverified rule badge', () => {
    const html = renderToStaticMarkup(<DisasterReliefBoardWorkspace />);
    expect(html).toContain('Disaster Relief Entitlement &amp; Camp Information Board');
    expect(html).toContain('Offline Emergency Helplines');
    expect(html).toContain('Official Authority Record');
    expect(html).toContain('Unverified Rule');
  });
});
