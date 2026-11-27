import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import AccessibilityBarrierSlaDashboard from './AccessibilityBarrierSlaDashboard.jsx';
import { resetLocalBarrierSlaState } from '../services/accessibilityBarrierSlaStorage.js';

describe('AccessibilityBarrierSlaDashboard (#1443)', () => {
  beforeEach(() => {
    resetLocalBarrierSlaState();
  });

  it('renders heading, origin badges, ward/facility filters, SLA metrics, and suppression badge', () => {
    const html = renderToString(<AccessibilityBarrierSlaDashboard />);
    expect(html).toContain('Accessibility Barrier Resolution SLA Dashboard');
    expect(html).toContain('Citizen-Entered Barrier Report');
    expect(html).toContain('Official SLA Rule');
    expect(html).toContain('AI / Community Advisory');
    expect(html).toContain('Ward Filter');
    expect(html).toContain('Facility Filter');
    expect(html).toContain('SMALL_GROUP_SUPPRESSION');
  });
});
