import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import ServiceCard from './ServiceCard';
import { LanguageProvider } from '../context/LanguageContext';

describe('ServiceCard component (#568)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    });
  });

  const sampleService = {
    id: 'pan-card',
    name: 'PAN Card (Permanent Account Number)',
    category: 'Identity',
    department: 'Income Tax Department (CBDT)',
    difficulty: 'Easy',
    type: 'Central',
    shortDescription: '10-digit alphanumeric identity issued by the Income Tax Department.',
    processingTime: '15-20 days',
  };

  const renderCard = (props = {}) => {
    return renderToStaticMarkup(
      <MemoryRouter>
        <LanguageProvider>
          <ServiceCard service={sampleService} {...props} />
        </LanguageProvider>
      </MemoryRouter>
    );
  };

  it('renders service title, category, department, difficulty, and type', () => {
    const html = renderCard();

    expect(html).toContain('PAN Card (Permanent Account Number)');
    expect(html).toContain('Identity');
    expect(html).toContain('Income Tax Department (CBDT)');
    expect(html).toContain('Easy');
    expect(html).toContain('Central');
  });

  it('renders primary View Guide link pointing to the service details route', () => {
    const html = renderCard();

    expect(html).toContain('href="/services/pan-card"');
    expect(html).toContain('View Guide');
    expect(html).toContain('15-20 days');
  });

  it('gracefully renders without department if department is omitted', () => {
    const serviceWithoutDept = {
      ...sampleService,
      department: undefined,
    };
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <LanguageProvider>
          <ServiceCard service={serviceWithoutDept} />
        </LanguageProvider>
      </MemoryRouter>
    );

    expect(html).toContain('PAN Card (Permanent Account Number)');
    expect(html).toContain('Identity');
    expect(html).not.toContain('undefined');
  });

  it('renders comparison checkbox with accessible label when onToggleCompare is provided', () => {
    const html = renderCard({
      onToggleCompare: vi.fn(),
      isCompared: false,
      compareDisabled: false,
    });

    expect(html).toContain('type="checkbox"');
    expect(html).toContain('aria-label="Compare PAN Card (Permanent Account Number)"');
    expect(html).toContain('Compare');
    expect(html).not.toContain('checked=""');
  });

  it('reflects isCompared=true by setting checked attribute on checkbox', () => {
    const html = renderCard({
      onToggleCompare: vi.fn(),
      isCompared: true,
      compareDisabled: false,
    });

    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked=""');
  });

  it('reflects compareDisabled=true by setting disabled attribute and is-disabled class', () => {
    const html = renderCard({
      onToggleCompare: vi.fn(),
      isCompared: false,
      compareDisabled: true,
    });

    expect(html).toContain('disabled=""');
    expect(html).toContain('is-disabled');
  });

  it('does not render comparison toggle when onToggleCompare is omitted', () => {
    const html = renderCard({ onToggleCompare: undefined });

    expect(html).not.toContain('type="checkbox"');
    expect(html).not.toContain('compare-toggle');
  });

  it('returns null safely when service is null or undefined', () => {
    const htmlNull = renderToStaticMarkup(
      <MemoryRouter>
        <LanguageProvider>
          <ServiceCard service={null} />
        </LanguageProvider>
      </MemoryRouter>
    );
    expect(htmlNull).toBe('');

    const htmlUndefined = renderToStaticMarkup(
      <MemoryRouter>
        <LanguageProvider>
          <ServiceCard service={undefined} />
        </LanguageProvider>
      </MemoryRouter>
    );
    expect(htmlUndefined).toBe('');
  });
});
