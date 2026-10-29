import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../context/LanguageContext';
import Services from './Services';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ isClerkConfigured: false })),
}));

const render = (url) =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[url]}>
      <LanguageProvider>
        <Services />
      </LanguageProvider>
    </MemoryRouter>
  );

describe('Services page with hostile or malformed URL parameters', () => {
  it('renders the directory with no parameters', () => {
    expect(() => render('/services')).not.toThrow();
  });

  it.each([
    ['an unknown sort key', '/services?sort=__proto__'],
    ['unsupported filters', '/services?cat=Nope&dept=Nope&mode=Teleport&diff=Impossible&fee=Bribe&speed=Instant'],
    ['empty values', '/services?q=&sort=&cat=&mode=&fee=&speed=&diff=&dept='],
    ['a very long search', `/services?q=${'a'.repeat(200000)}`],
    ['malformed percent encoding', '/services?q=%E0%A4%A&sort=%'],
    ['encoded markup', `/services?q=${encodeURIComponent('<img src=x onerror=alert(1)>')}`],
    ['repeated keys', '/services?sort=name-asc&sort=name-desc&q=a&q=b'],
  ])('does not throw for %s', (_name, url) => {
    expect(() => render(url)).not.toThrow();
  });

  it('never writes the search text out as markup', () => {
    const html = render(`/services?q=${encodeURIComponent('<img src=x onerror=alert(1)>')}`);
    expect(html).not.toContain('<img src=x');
  });

  it('caps the search box at the length limit and shows at most that many characters', () => {
    const html = render(`/services?q=${'a'.repeat(5000)}`);
    expect(html).toContain('maxLength="100"');
    expect(html).not.toContain('a'.repeat(101));
  });

  it('falls back to the default sort for an unknown key, and keeps a valid one', () => {
    const selected = (html, value) => new RegExp(`<option[^>]*value="${value}"[^>]*selected`).test(html);
    expect(selected(render('/services?sort=drop-table'), 'relevance')).toBe(true);
    expect(selected(render('/services?sort=name-asc'), 'name-asc')).toBe(true);
    expect(selected(render('/services?sort=name-asc'), 'relevance')).toBe(false);
  });
});
