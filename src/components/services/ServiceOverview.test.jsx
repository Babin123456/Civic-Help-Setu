import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import ServiceOverview, { OverviewPanel } from './ServiceOverview.jsx';
import ServiceCard from '../ServiceCard';
import { LanguageProvider } from '../../context/LanguageContext';
import { OVERVIEW_LABEL, OVERVIEW_NOTICE, INSUFFICIENT_MESSAGE } from '../../ai/serviceOverview';

const service = {
  id: 'pan-card',
  name: 'PAN Card (Permanent Account Number)',
  category: 'Identity',
  department: 'Income Tax Department (CBDT)',
  difficulty: 'Easy',
  type: 'Central',
  shortDescription: '10-digit alphanumeric identity issued by the Income Tax Department.',
  processingTime: '15-20 days',
};

describe('OverviewPanel (#384)', () => {
  it('shows nothing until it is asked for', () => {
    expect(renderToStaticMarkup(<OverviewPanel phase="idle" />)).toBe('');
  });

  it('shows a loading state that is announced and marked busy', () => {
    const html = renderToStaticMarkup(<OverviewPanel phase="loading" />);
    expect(html).toContain('Preparing an overview');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
  });

  it('labels the sentence as AI-generated and says it is not official', () => {
    const html = renderToStaticMarkup(<OverviewPanel phase="done" result={{ status: 'ready', sentence: 'Does a thing, handled by Somebody.' }} />);
    expect(html).toContain(OVERVIEW_LABEL);
    expect(html).toContain('Does a thing, handled by Somebody.');
    expect(html).toContain('Not official.');
    expect(OVERVIEW_NOTICE).toContain('Not official');
  });

  it('says there is not enough, without a sentence, when the guide is incomplete', () => {
    const html = renderToStaticMarkup(<OverviewPanel phase="done" result={{ status: 'insufficient', message: INSUFFICIENT_MESSAGE }} />);
    expect(html).toContain('not enough in this guide');
    expect(html).not.toContain(OVERVIEW_LABEL);
  });

  it('shows an error that says the guide is unchanged and offers Try again', () => {
    const html = renderToStaticMarkup(<OverviewPanel phase="error" onRetry={() => {}} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('could not be made');
    expect(html).toContain('unchanged');
    expect(html).toContain('Try again');
  });

  it('writes text from the guide as text, never as markup', () => {
    const html = renderToStaticMarkup(<OverviewPanel phase="done" result={{ status: 'ready', sentence: '<img src=x onerror=alert(1)>' }} />);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
});

describe('ServiceOverview', () => {
  it('starts closed: a button that says it controls a panel, and no overview text', () => {
    const html = renderToStaticMarkup(<ServiceOverview service={service} />);
    expect(html).toContain('AI overview');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="overview-pan-card"');
    expect(html).toContain('for PAN Card (Permanent Account Number)');
    expect(html).not.toContain(OVERVIEW_LABEL);
  });
});

describe('the overview on a search result', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} });
  });

  const render = (props = {}) =>
    renderToStaticMarkup(
      <MemoryRouter>
        <LanguageProvider>
          <ServiceCard service={service} {...props} />
        </LanguageProvider>
      </MemoryRouter>,
    );

  const link = (html) => /<a [^>]*class="card service-card"[\s\S]*?<\/a>/.exec(html)[0];

  it('adds the button under the card', () => {
    const html = render({ showOverview: true });
    expect(html).toContain('service-card-wrap');
    expect(html).toContain('AI overview');
  });

  it('leaves the card, its title and its details exactly as they were', () => {
    const plain = link(render());
    const withOverview = link(render({ showOverview: true }));
    expect(withOverview).toBe(plain);
    expect(withOverview).toContain('PAN Card (Permanent Account Number)');
    expect(withOverview).toContain('Income Tax Department (CBDT)');
  });

  it('keeps the button out of the card link, where a button would not belong', () => {
    expect(link(render({ showOverview: true }))).not.toContain('AI overview');
  });

  it('renders the card alone, as before, when no overview is asked for', () => {
    const html = render();
    expect(html).not.toContain('service-card-wrap');
    expect(html).not.toContain('AI overview');
  });

  it('works together with the compare toggle', () => {
    const html = render({ showOverview: true, onToggleCompare: () => {} });
    expect(html).toContain('Compare');
    expect(html).toContain('AI overview');
  });
});
