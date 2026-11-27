import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import EventEditorModal from './EventEditorModal.jsx';
import { INITIAL_SAMPLE_CASES } from '../../services/accessibilityEscalationStorage.js';

describe('EventEditorModal Component (#950)', () => {
  const sampleEvent = INITIAL_SAMPLE_CASES[0].events[0];

  it('renders modal in add event mode when event is null', () => {
    const html = renderToStaticMarkup(
      <EventEditorModal
        event={null}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(html).toContain('Log Timeline Event');
    expect(html).toContain('Event Classification *');
    expect(html).toContain('Event Date (YYYY-MM-DD) *');
    expect(html).toContain('Event Summary / Action Taken *');
    expect(html).toContain('Evidence References &amp; Tracking Proof');
    expect(html).toContain('Target Follow-Up Date (Optional)');
    expect(html).toContain('Save Event');
  });

  it('renders modal in edit mode with pre-filled fields', () => {
    const html = renderToStaticMarkup(
      <EventEditorModal
        event={sampleEvent}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(html).toContain('Edit Timeline Event');
    expect(html).toContain('Submitted written grievance regarding missing entrance ramp and broken lift');
    expect(html).toContain('Save Event');
  });

  it('renders advisory notice regarding target follow-up date', () => {
    const html = renderToStaticMarkup(
      <EventEditorModal
        event={null}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(html).toContain('Setting a target date prompts a reminder if no departmental response is logged by this date.');
  });
});
