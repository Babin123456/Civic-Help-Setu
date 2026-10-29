import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import IntakeWindowPanel from '../components/services/IntakeWindowPanel';
import {
  isValidIsoDate,
  validateWindow,
  validateWindows,
  findOverlaps,
  describeWindow,
  windowWarnings,
  windowToRow,
  rowToWindow,
  getWindowViews,
} from './applicationWindowService';

const notice = { title: 'Notification 12/2026', url: 'https://example.gov.in/notice' };
const win = (extra = {}) => ({ label: 'Round 1', startDate: '2026-11-01', endDate: '2026-11-30', notice, reviewedOn: '2026-10-20', ...extra });
const TODAY = '2026-10-29';

describe('date validation (#256)', () => {
  it('accepts only real calendar dates', () => {
    expect(isValidIsoDate('2026-02-28')).toBe(true);
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('29-10-2026')).toBe(false);
    expect(isValidIsoDate('')).toBe(false);
  });

  it('rejects an end date before the start date and a missing notice', () => {
    expect(validateWindow(win({ startDate: '2026-12-01', endDate: '2026-11-01' }))).toContain('End date cannot be before the start date.');
    expect(validateWindow(win({ notice: {} }))).toContain('Add the official notice title or link.');
    expect(validateWindow(win({ notice: { title: 'x', url: 'http://insecure.example' } }))).toContain('Notice link must be an https URL.');
    expect(validateWindow(win({ startDate: '2026-13-01' }))).toContain('Start date is not a valid date.');
    expect(validateWindow(win())).toEqual([]);
  });

  it('allows a window with only one boundary published', () => {
    expect(validateWindow(win({ endDate: '' }))).toEqual([]);
  });
});

describe('window states (#256)', () => {
  it('future window opens on a date', () => {
    const v = describeWindow(win(), TODAY);
    expect(v.state).toBe('upcoming');
    expect(v.stateLabel).toBe('Opens on 1 November 2026');
  });

  it('active window is open, including on its boundary days', () => {
    expect(describeWindow(win({ startDate: '2026-10-29' }), TODAY).stateLabel).toBe('Open');
    expect(describeWindow(win({ startDate: '2026-10-01', endDate: '2026-10-29' }), TODAY).stateLabel).toBe('Open');
  });

  it('expired window is closed', () => {
    expect(describeWindow(win({ startDate: '2026-09-01', endDate: '2026-10-28' }), TODAY).state).toBe('closed');
  });

  it('window without dates is not published and never gets an invented date', () => {
    const v = describeWindow(win({ startDate: '', endDate: '' }), TODAY);
    expect(v.stateLabel).toBe('Window not published');
    expect(v.rangeText).toBe('Start and end dates not published');
  });

  it('uses a recorded status only when no dates exist', () => {
    expect(describeWindow(win({ startDate: '', endDate: '', status: 'closed' }), TODAY).stateLabel).toBe('Closed');
    expect(describeWindow(win({ startDate: '', endDate: '', status: 'open' }), TODAY).stateLabel).toBe('Open');
    expect(describeWindow(win({ status: 'closed' }), TODAY).state).toBe('upcoming');
  });

  it('does not infer a missing boundary', () => {
    const endOnly = describeWindow(win({ startDate: '' }), TODAY);
    expect(endOnly.stateLabel).toBe('Open (start date not published)');
    expect(endOnly.rangeText).toBe('Until 30 November 2026');
    const startOnly = describeWindow(win({ startDate: '2026-10-01', endDate: '' }), TODAY);
    expect(startOnly.stateLabel).toBe('Open (end date not published)');
    expect(startOnly.rangeText).toBe('From 1 October 2026');
  });

  it('uses a neutral label when the review is not confirmed', () => {
    expect(describeWindow(win({ startDate: '2026-10-01', reviewedOn: '' }), TODAY).stateLabel).toBe('Listed as open');
  });

  it('round-trips a window through the admin form row', () => {
    const w = win({ status: 'open' });
    expect(rowToWindow(windowToRow(w))).toEqual(w);
    expect(windowToRow({ label: ' A  b ' }).label).toBe('A b');
  });

  it('marks stale, missing and future review dates as not confirmed', () => {
    expect(describeWindow(win(), TODAY).confirmed).toBe(true);
    expect(describeWindow(win({ reviewedOn: '2026-01-01' }), TODAY).confirmed).toBe(false);
    expect(describeWindow(win({ reviewedOn: '' }), TODAY).confirmed).toBe(false);
    expect(describeWindow(win({ reviewedOn: '2027-01-01' }), TODAY).confirmed).toBe(false);
  });
});

describe('multiple and overlapping windows (#256)', () => {
  it('supports zero, one or many windows', () => {
    expect(getWindowViews({}, TODAY)).toEqual([]);
    expect(getWindowViews({ intakeWindows: [] }, TODAY)).toEqual([]);
    expect(getWindowViews({ intakeWindows: [win(), win({ startDate: '2027-03-01', endDate: '2027-03-31' })] }, TODAY)).toHaveLength(2);
  });

  it('detects overlapping rounds and ignores rounds with an unpublished boundary', () => {
    const rounds = [win(), win({ startDate: '2026-11-15', endDate: '2026-12-15' }), win({ startDate: '2027-01-01', endDate: '2027-01-31' })];
    expect(findOverlaps(rounds)).toEqual([[0, 1]]);
    expect(validateWindows(rounds)).toEqual([]);
    expect(windowWarnings(rounds)).toEqual(['Rounds 1 and 2 overlap. Check that both are correct.']);
    expect(findOverlaps([win(), win({ endDate: '' })])).toEqual([]);
  });

  it('treats absent data as valid', () => {
    expect(validateWindows(undefined)).toEqual([]);
    expect(validateWindows('nope')).toEqual(['Intake windows must be a list.']);
  });
});

describe('IntakeWindowPanel (#256)', () => {
  it('renders nothing for a service without window data', () => {
    expect(renderToStaticMarkup(<IntakeWindowPanel service={{ id: 'x' }} today={TODAY} />)).toBe('');
  });

  it('shows status, source and review date, and separates windows from appointments', () => {
    const html = renderToStaticMarkup(<IntakeWindowPanel service={{ intakeWindows: [win()] }} today={TODAY} />);
    expect(html).toContain('Application intake windows');
    expect(html).toContain('Opens on 1 November 2026');
    expect(html).toContain('Notification 12/2026');
    expect(html).toContain('Last reviewed 20 October 2026');
    expect(html).toContain('not an office appointment');
    expect(html).not.toContain('Not confirmed');
  });

  it('flags unconfirmed and overlapping windows', () => {
    const html = renderToStaticMarkup(
      <IntakeWindowPanel
        service={{ intakeWindows: [win({ reviewedOn: '' }), win({ startDate: '2026-11-10', endDate: '2026-12-01' })] }}
        today={TODAY}
      />
    );
    expect(html).toContain('Not confirmed');
    expect(html).toContain('rounds overlap');
  });
});
