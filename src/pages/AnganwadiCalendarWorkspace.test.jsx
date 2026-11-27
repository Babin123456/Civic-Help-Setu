import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import AnganwadiCalendarWorkspace from './AnganwadiCalendarWorkspace.jsx';
import { resetLocalAnganwadiState } from '../services/anganwadiCalendarStorage.js';

describe('AnganwadiCalendarWorkspace (#1438)', () => {
  beforeEach(() => {
    resetLocalAnganwadiState();
  });

  it('renders heading, origin badges, stale-status expiry, escalation hierarchy, and community channel', () => {
    const html = renderToString(<AnganwadiCalendarWorkspace />);
    expect(html).toContain('Public Anganwadi Service Availability &amp; Nutrition-Day Calendar');
    expect(html).toContain('Official Centre Record');
    expect(html).toContain('Community Status Channel');
    expect(html).toContain('AI / Community Advisory');
    expect(html).toContain('stale_expired');
    expect(html).toContain('Mukhya Sevika');
    expect(html).toContain('Post Community Status');
  });
});
