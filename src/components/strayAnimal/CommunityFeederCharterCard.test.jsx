import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CommunityFeederCharterCard from './CommunityFeederCharterCard.jsx';

describe('CommunityFeederCharterCard', () => {
  it('renders community feeder charter under Rule 20', () => {
    const html = renderToStaticMarkup(<CommunityFeederCharterCard />);
    expect(html).toContain('Community Animal &amp; Street Feeder Regulatory Charter');
    expect(html).toContain('CONSTITUTIONAL PROTECTION FOR ANIMAL CARETAKERS (ARTICLE 51A(g))');
    expect(html).toContain('Caretaker Rights (Rule 20 Protected)');
    expect(html).toContain('Civic Responsibilities &amp; Cleanliness');
  });
});
