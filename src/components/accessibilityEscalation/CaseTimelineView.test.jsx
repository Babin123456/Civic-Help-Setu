import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CaseTimelineView from './CaseTimelineView.jsx';
import { INITIAL_SAMPLE_CASES } from '../../services/accessibilityEscalationStorage.js';

describe('CaseTimelineView Component (#950)', () => {
  const sampleEvents = INITIAL_SAMPLE_CASES[0].events;

  it('renders empty state when there are no events', () => {
    const html = renderToStaticMarkup(
      <CaseTimelineView
        events={[]}
        onAddEvent={vi.fn()}
        onEditEvent={vi.fn()}
        onDeleteEvent={vi.fn()}
      />
    );

    expect(html).toContain('No Correspondence or Timeline Events Recorded');
    expect(html).toContain('Log First Event');
  });

  it('renders chronological list of events with details and evidence refs', () => {
    const html = renderToStaticMarkup(
      <CaseTimelineView
        events={sampleEvents}
        onAddEvent={vi.fn()}
        onEditEvent={vi.fn()}
        onDeleteEvent={vi.fn()}
      />
    );

    expect(html).toContain('Chronological Correspondence &amp; Inspection Timeline');
    expect(html).toContain('Submitted written grievance regarding missing entrance ramp and broken lift');
    expect(html).toContain('Target Follow-up:');
    expect(html).toContain('Dispatched formal speed post letter requesting joint site inspection');
    expect(html).toContain('Evidence &amp; Proof:');
    expect(html).toContain('Speed Post Consignment Receipt #ED992817263IN');
  });

  it('renders action buttons for editing and deleting events', () => {
    const html = renderToStaticMarkup(
      <CaseTimelineView
        events={sampleEvents}
        onAddEvent={vi.fn()}
        onEditEvent={vi.fn()}
        onDeleteEvent={vi.fn()}
      />
    );

    expect(html).toContain('Edit');
    expect(html).toContain('Add Timeline Event');
  });
});
