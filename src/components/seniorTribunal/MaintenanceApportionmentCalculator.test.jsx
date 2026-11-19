import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import MaintenanceApportionmentCalculator from './MaintenanceApportionmentCalculator.jsx';

describe('MaintenanceApportionmentCalculator component (#858)', () => {
  it('exports a valid React functional component', () => {
    expect(typeof MaintenanceApportionmentCalculator).toBe('function');
  });

  it('renders essential monthly needs inputs and net deficit computation', () => {
    const html = renderToStaticMarkup(<MaintenanceApportionmentCalculator />);

    expect(html).toContain('Equitable Maintenance &amp; Liability Apportionment Calculator');
    expect(html).toContain('Food &amp; Nutrition:');
    expect(html).toContain('Healthcare &amp; Medicines:');
    expect(html).toContain('Caregiver / Attendant:');
    expect(html).toContain('Total Monthly Need:');
    expect(html).toContain('Net Monthly Deficit (Claim):');
  });

  it('renders default respondent children list and recommended monthly shares', () => {
    const html = renderToStaticMarkup(<MaintenanceApportionmentCalculator />);

    expect(html).toContain('Adult Children / Respondents');
    expect(html).toContain('Add Child');
    expect(html).toContain('Recommended Equitable Apportionment Award');
    expect(html).toContain('Liability Share:');
  });
});
