import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  EVENT_CATEGORY,
  EVENT_SOURCE,
  normalizeApplicationEvent,
} from '../../services/applicationEventService';
import ApplicationTimelineReplay from './ApplicationTimelineReplay';
import EventDiffViewer from './EventDiffViewer';
import { filterTimelineEvents, toggleSelectedEvent } from './timelineReplayModel';

const buildEvent = (overrides = {}) =>
  normalizeApplicationEvent({
    applicationId: 'SRV-55500001',
    category: EVENT_CATEGORY.REVIEW,
    sourceType: EVENT_SOURCE.OFFICIAL_PORTAL,
    sourceRef: 'State services portal',
    sourceTimestamp: '2026-10-14T10:00:00.000Z',
    ingestedAt: '2026-10-14T10:05:00.000Z',
    status: 'in-progress',
    actorRole: 'reviewer',
    payloadVersion: 2,
    sourceUrl: 'https://services.example.org/application/555',
    payload: { title: 'Document scrutiny started', description: 'Review is underway.' },
    ...overrides,
  });

const timelineFor = (events, overrides = {}) => ({
  applicationId: 'SRV-55500001',
  events,
  anomalies: [],
  dataVersion: 'abc12345',
  state: 'ready',
  ...overrides,
});

describe('ApplicationTimelineReplay component (#839)', () => {
  it('renders chronological event cards with source badges, timestamps, and event IDs', () => {
    const events = [
      buildEvent({ eventId: 'evt-submit', category: EVENT_CATEGORY.SUBMISSION }),
      buildEvent({
        eventId: 'evt-note',
        category: EVENT_CATEGORY.QUERY,
        sourceType: EVENT_SOURCE.CITIZEN_NOTE,
        sourceRef: 'Citizen note',
        status: null,
        actorRole: 'citizen',
        sourceTimestamp: '2026-10-15T09:00:00.000Z',
        payload: { text: 'Private reminder to call the office.', privateGuidance: true },
      }),
    ];

    const html = renderToStaticMarkup(
      <ApplicationTimelineReplay
        timeline={timelineFor(events)}
        officialSourceUrl="https://www.india.gov.in/services?id=839"
      />
    );

    expect(html).toContain('Application timeline replay');
    expect(html).toContain('Official portal');
    expect(html).toContain('Citizen note — private guidance');
    expect(html).toContain('Private guidance only. This note is not an official');
    expect(html).toContain('2026-10-14T10:00:00.000Z');
    expect(html).toContain('2026-10-15T09:00:00.000Z');
    expect(html).toContain('evt-submit');
    expect(html).toContain('evt-note');
    expect(html).toContain('Data version');
    expect(html).toContain('abc12345');
    expect(html).toContain('https://services.example.org/application/555');
    expect(html).toContain('https://www.india.gov.in/services?id=839');
    expect(html).toContain('Open the official service source');
    expect(html).toContain('Open recorded source');
  });

  it('provides filter controls, a table alternative, and labelled event selection', () => {
    const html = renderToStaticMarkup(
      <ApplicationTimelineReplay timeline={timelineFor([buildEvent({ eventId: 'evt-1' })])} />
    );

    expect(html).toContain('Filter by category');
    expect(html).toContain('Filter by source');
    expect(html).toContain('Read the timeline as a table');
    expect(html).toContain('<caption>Recorded application events in chronological order</caption>');
    expect(html).toContain('Select event');
    expect(html).toContain('for comparison');
    expect(html).toContain('Compare events');
    expect(html).toContain('Report inconsistency');
    expect(html).toContain('Timeline steps for small screens');
    expect(html).toContain('<ul class="timeline-category-summary"');
    expect(html).toContain('aria-label="Event counts by category"');
  });

  it('toggles comparison selection and replaces the oldest choice at two', () => {
    expect(toggleSelectedEvent([], 'evt-a')).toEqual(['evt-a']);
    expect(toggleSelectedEvent(['evt-a'], 'evt-a')).toEqual([]);
    expect(toggleSelectedEvent(['evt-a'], 'evt-b')).toEqual(['evt-a', 'evt-b']);
    expect(toggleSelectedEvent(['evt-a', 'evt-b'], 'evt-c')).toEqual(['evt-b', 'evt-c']);
  });

  it('shows anomaly and review routing notices without overwriting events', () => {
    const event = buildEvent({ eventId: 'evt-1' });
    const anomalies = [
      {
        type: 'out_of_order',
        severity: 'medium',
        eventIds: ['evt-1'],
        message: 'This event was ingested after a later-dated event.',
      },
    ];

    const html = renderToStaticMarkup(
      <ApplicationTimelineReplay timeline={timelineFor([event], { anomalies })} />
    );

    expect(html).toContain('timeline inconsistency record(s) need review');
    expect(html).toContain('This event was ingested after a later-dated event.');
    expect(html).toContain('Needs review');
  });

  it('renders loading, empty, error, stale, and permission-denied states', () => {
    const loading = renderToStaticMarkup(
      <ApplicationTimelineReplay timeline={timelineFor([])} state="loading" />
    );
    expect(loading).toContain('Loading recorded events');
    expect(loading).toContain('<h3>Loading recorded events</h3>');

    const empty = renderToStaticMarkup(
      <ApplicationTimelineReplay timeline={timelineFor([])} />
    );
    expect(empty).toContain('No recorded events yet');

    const error = renderToStaticMarkup(
      <ApplicationTimelineReplay
        timeline={timelineFor([buildEvent({ eventId: 'evt-1' })])}
        state="error"
        errorMessage="Records unavailable."
      />
    );
    expect(error).toContain('Records unavailable.');

    const stale = renderToStaticMarkup(
      <ApplicationTimelineReplay
        timeline={timelineFor([buildEvent({ eventId: 'evt-1' })])}
        isStale
      />
    );
    expect(stale).toContain('Timeline may be stale');

    const denied = renderToStaticMarkup(
      <ApplicationTimelineReplay
        timeline={timelineFor([buildEvent({ eventId: 'evt-1' })])}
        permissionDenied
      />
    );
    expect(denied).toContain('You do not have access to this timeline');
  });

  it('filters events by category and source', () => {
    const official = buildEvent({ eventId: 'official' });
    const note = buildEvent({
      eventId: 'note',
      category: EVENT_CATEGORY.QUERY,
      sourceType: EVENT_SOURCE.CITIZEN_NOTE,
      status: null,
      payload: { text: 'note' },
    });

    expect(filterTimelineEvents([official, note], { category: 'query' })).toEqual([
      note,
    ]);
    expect(
      filterTimelineEvents([official, note], { source: EVENT_SOURCE.OFFICIAL_PORTAL })
    ).toEqual([official]);
  });
});

describe('EventDiffViewer component (#839)', () => {
  const left = buildEvent({ eventId: 'evt-a', payload: { note: 'before' } });
  const right = buildEvent({
    eventId: 'evt-b',
    status: 'action-required',
    sourceTimestamp: '2026-10-16T10:00:00.000Z',
    payload: { note: 'after' },
  });

  const diff = {
    left,
    right,
    fields: [
      { field: 'status', before: 'in-progress', after: 'action-required', changed: true },
      { field: 'actorRole', before: 'reviewer', after: 'reviewer', changed: false },
    ],
    changedCount: 1,
    unchangedCount: 1,
    dataVersion: 'diff123',
  };

  it('renders side-by-side stored values and change markers', () => {
    const html = renderToStaticMarkup(<EventDiffViewer diff={diff} />);

    expect(html).toContain('Event difference viewer');
    expect(html).toContain('Earlier event');
    expect(html).toContain('Later event');
    expect(html).toContain('evt-a');
    expect(html).toContain('evt-b');
    expect(html).toContain('action-required');
    expect(html).toContain('1 changed field');
    expect(html).toContain('diff123');
    expect(html).toContain('Comparison uses only the stored records');
    expect(html).toContain('<caption>Field-by-field comparison');
    expect(html).toContain('Changed');
  });

  it('renders an accessible empty comparison state', () => {
    const html = renderToStaticMarkup(<EventDiffViewer diff={null} />);
    expect(html).toContain('Select exactly two recorded events');
  });
});

describe('ApplicationTimelineReplay responsive and accessibility styles (#839)', () => {
  const css = readFileSync(
    new URL('./ApplicationTimelineReplay.css', import.meta.url),
    'utf8'
  );

  it('keeps the mobile stepper, list, and table available at small widths', () => {
    expect(css).toMatch(/@media \(max-width: 720px\)/);
    expect(css).toMatch(/\.timeline-mobile-stepper \{\s*display: flex;/);
    expect(css).not.toMatch(/\.timeline-replay-list \{\s*display: none/);
  });

  it('provides print, focus, and reduced-motion rules', () => {
    expect(css).toMatch(/@media print/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(css).toContain(':focus-visible');
    expect(css).toMatch(/\.timeline-replay-controls,/);
  });
});
