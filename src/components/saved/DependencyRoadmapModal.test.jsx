import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import DependencyRoadmapModal from './DependencyRoadmapModal';

describe('DependencyRoadmapModal', () => {
  it('returns null when closed', () => {
    const html = renderToString(<DependencyRoadmapModal isOpen={false} savedServices={[]} onClose={() => {}} />);
    expect(html).toBe('');
  });

  it('renders modal with stages, prerequisite alerts, and cumulative days', () => {
    const services = [
      { id: 'income-certificate', name: 'Income Certificate', processingTime: '15 days' },
      { id: 'ews-certificate', name: 'EWS Certificate', processingTime: '21 days' },
    ];
    const html = renderToString(
      <DependencyRoadmapModal
        isOpen={true}
        savedServices={services}
        onClose={() => {}}
      />
    );

    expect(html).toContain('Prerequisite Dependency Roadmap Planner');
    expect(html).toContain('Phase 1: Foundational Civic Prerequisites');
    expect(html).toContain('Phase 2: Dependent Applications');
    expect(html).toContain('Income Certificate');
    expect(html).toContain('EWS Certificate');
    expect(html).toContain('Blocked Until Phase 1');
    expect(html).toContain('Ready to Apply');
    expect(html).toContain('Print Roadmap Plan');
  });
});
