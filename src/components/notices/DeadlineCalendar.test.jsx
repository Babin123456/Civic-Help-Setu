import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DeadlineCalendar from './DeadlineCalendar';
import { DEADLINE_STORAGE_KEY } from '../../services/dateCandidateService';

const NOTICE_STORAGE_KEY = 'civicbridge_public_notices_digest_v1';

const makeStorage = (initialData = {}) => {
  const map = new Map(Object.entries(initialData));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
    clear: () => map.clear(),
  };
};

const makeNotice = (overrides = {}) => ({
  id: 'notice_test',
  title: 'Test Gazette Notification',
  sourceUrl: 'https://example.gov.in/notice.pdf',
  gazettePublicationDate: '2026-02-15T00:00:00.000Z',
  category: 'rule_amendment',
  summary: 'Notice summary used as the source passage.',
  affectedServiceIds: ['sample-service'],
  status: 'approved',
  reviewedAtDate: '2026-02-18T10:30:00.000Z',
  reviewedBy: 'Legal Review Cell',
  ...overrides,
});

describe('DeadlineCalendar', () => {
  it('exports a valid React function component', () => {
    expect(typeof DeadlineCalendar).toBe('function');
  });

  it('renders nothing when the service has no linked notice', () => {
    const html = renderToStaticMarkup(<DeadlineCalendar serviceId="no-notice-service" storage={makeStorage()} />);
    expect(html).toBe('');
  });

  it('renders the disclaimer, notice title and timeline actions', () => {
    const html = renderToStaticMarkup(<DeadlineCalendar notice={makeNotice()} storage={makeStorage()} />);

    expect(html).toContain('aria-labelledby="notice-deadline-heading"');
    expect(html).toContain('Public notice deadline calendar');
    expect(html).toContain('Test Gazette Notification');
    expect(html).toContain('AI-suggested dates are labelled as suggestions');
    expect(html).toContain('Only dates you confirm are treated as');
    expect(html).toContain('Official field');
    expect(html).toContain('Suggested');
    expect(html).toContain('need your review');
    expect(html).toContain('aria-label="Confirm Objection deadline on 17 Mar 2026"');
    expect(html).toContain('aria-label="Edit Appeal deadline"');
    expect(html).toContain('aria-label="Dismiss Submission deadline"');
    expect(html).toContain('Dependencies between actions');
    expect(html).toContain('Hearing date comes after Gazette publication, Objection deadline');
  });

  it('marks confirmed deadlines from storage and counts them', () => {
    const storage = makeStorage({
      [DEADLINE_STORAGE_KEY]: JSON.stringify({
        deadline_notice_test_objection: {
          state: 'confirmed',
          note: 'Confirmed at the ward office',
          updatedAt: '2026-03-01T00:00:00.000Z',
        },
      }),
    });

    const html = renderToStaticMarkup(<DeadlineCalendar notice={makeNotice()} storage={storage} />);

    expect(html).toContain('Confirmed by you');
    expect(html).toContain('1 confirmed');
    expect(html).toContain('Note: Confirmed at the ward office');
  });

  it('flags expired deadlines instead of hiding them', () => {
    const html = renderToStaticMarkup(<DeadlineCalendar notice={makeNotice()} storage={makeStorage()} />);
    expect(html).toContain('Expired');
    expect(html).toContain('17 Mar 2026');
  });

  it('renders a printable list with a table and caption', () => {
    const html = renderToStaticMarkup(
      <DeadlineCalendar notice={makeNotice()} storage={makeStorage()} defaultView="list" />
    );

    expect(html).toContain('<table');
    expect(html).toContain('<caption');
    expect(html).toContain('Printable deadline list');
    expect(html).toContain('scope="col"');
    expect(html).toContain('Appeal deadline');
    expect(html).toContain('55%');
  });

  it('renders the monthly calendar view with labelled month grids', () => {
    const html = renderToStaticMarkup(
      <DeadlineCalendar notice={makeNotice()} storage={makeStorage()} defaultView="calendar" />
    );

    expect(html).toContain('role="grid"');
    expect(html).toContain('2026');
    expect(html).toContain('role="columnheader"');
    expect(html).toContain('role="gridcell"');
  });

  it('renders the empty state when no date can be derived', () => {
    const html = renderToStaticMarkup(
      <DeadlineCalendar
        notice={makeNotice({ gazettePublicationDate: null })}
        storage={makeStorage()}
      />
    );

    expect(html).toContain('No deadlines can be derived yet');
    expect(html).toContain('no official publication date');
  });

  it('renders a busy loading state', () => {
    const html = renderToStaticMarkup(
      <DeadlineCalendar notice={makeNotice()} loading storage={makeStorage()} />
    );

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Loading public notice deadlines');
  });

  it('renders an accessible error alert', () => {
    const html = renderToStaticMarkup(
      <DeadlineCalendar notice={makeNotice()} error="Notice service is offline" storage={makeStorage()} />
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('Deadline calendar unavailable');
    expect(html).toContain('Notice service is offline');
  });

  it('resolves a linked notice from serviceId', () => {
    const storage = makeStorage({
      [NOTICE_STORAGE_KEY]: JSON.stringify([makeNotice()]),
    });

    const html = renderToStaticMarkup(<DeadlineCalendar serviceId="sample-service" storage={storage} />);
    expect(html).toContain('Test Gazette Notification');
    expect(html).toContain('Public notice deadline calendar');
  });

  it('offers a notice selector when several notices affect the service', () => {
    const storage = makeStorage({
      [NOTICE_STORAGE_KEY]: JSON.stringify([
        makeNotice(),
        makeNotice({ id: 'notice_test_2', title: 'Second Gazette Notification' }),
      ]),
    });

    const html = renderToStaticMarkup(<DeadlineCalendar serviceId="sample-service" storage={storage} />);
    expect(html).toContain('Choose a linked notice');
    expect(html).toContain('Second Gazette Notification');
  });
});
