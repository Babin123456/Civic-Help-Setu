import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import SavedServiceRecommendationsPanel from './SavedServiceRecommendationsPanel';

describe('SavedServiceRecommendationsPanel component', () => {
  const mockCatalogue = [
    {
      id: 'caste-certificate',
      name: 'Caste Certificate',
      category: 'Certificates',
      department: 'Revenue & Social Welfare'
    },
    {
      id: 'non-creamy-layer-certificate',
      name: 'Non-Creamy Layer Certificate',
      category: 'Certificates',
      department: 'Revenue & Social Welfare'
    }
  ];

  it('exports a valid React functional component', () => {
    expect(typeof SavedServiceRecommendationsPanel).toBe('function');
  });

  it('renders nothing when no recommendations exist or saved list is empty', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <SavedServiceRecommendationsPanel savedServices={[]} catalogueServices={mockCatalogue} />
      </MemoryRouter>
    );
    expect(html).toBe('');
  });

  it('renders recommended related services with relationship badge and view link', () => {
    const saved = [{ id: 'caste-certificate', name: 'Caste Certificate' }];
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <SavedServiceRecommendationsPanel savedServices={saved} catalogueServices={mockCatalogue} />
      </MemoryRouter>
    );

    expect(html).toContain('Related Services You May Need');
    expect(html).toContain('Non-Creamy Layer Certificate');
    expect(html).toContain('Often needed after Caste Certificate');
    expect(html).toContain('href="/services/non-creamy-layer-certificate"');
  });
});
