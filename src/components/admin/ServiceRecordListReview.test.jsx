import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ServiceRecordList from './ServiceRecordList';

const good = { type: 'helpdesk', method: 'phone', value: '1800111555', sourceUrl: 'https://example.gov.in', lastVerified: new Date().toISOString().slice(0, 10) };
const bad = { type: 'helpdesk', method: 'phone', value: 'abc', lastVerified: '' };

describe('ServiceRecordList contact review marker', () => {
  it('shows a needs-review marker only for services with contacts to review', () => {
    const html = renderToStaticMarkup(
      <ServiceRecordList onEdit={() => {}} services={[
        { id: 'a', name: 'Alpha', category: 'c', contacts: [bad] },
        { id: 'b', name: 'Beta', category: 'c', contacts: [good] },
        { id: 'c', name: 'Gamma', category: 'c' },
      ]} />
    );
    expect(html).toContain('1 contact needs review');
    expect(html.match(/needs review/g).length).toBe(2); // table row + card for Alpha only
  });
});
