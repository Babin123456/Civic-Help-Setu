import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import WaterbodyRestorationWorkspace from './WaterbodyRestorationWorkspace.jsx';
import { resetLocalWaterbodyState } from '../services/waterbodyRestorationStorage.js';

describe('WaterbodyRestorationWorkspace (#1442)', () => {
  beforeEach(() => {
    resetLocalWaterbodyState();
  });

  it('renders heading, origin badges, milestones table, community evidence, and preserved corrections', () => {
    const html = renderToString(<WaterbodyRestorationWorkspace />);
    expect(html).toContain('Public Waterbody Restoration Milestone &amp; Evidence Tracker');
    expect(html).toContain('Official Work Plan &amp; Milestone');
    expect(html).toContain('Community Observation');
    expect(html).toContain('AI / Community Advisory');
    expect(html).toContain('inlet_cleanup');
    expect(html).toContain('desilting');
    expect(html).toContain('water_testing');
    expect(html).toContain('boundary_protection');
    expect(html).toContain('Preserved Official Corrections');
  });
});
