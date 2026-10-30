import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CatalogueMigrationPanel, { MigrationReport } from './CatalogueMigrationPanel.jsx';
import { CATALOGUE_KEY, MIGRATIONS, planMigration } from '../../services/catalogueMigration';
import { setCurrentActor } from '../../services/accessControl';

const legacy = { id: 'legacy-guide', name: 'Legacy guide', jurisdiction: 'Karnataka', documents: 'A\nB', customNote: 'x' };
const unmappable = { id: 'india-text', name: 'Text scope', jurisdiction: 'India' };

beforeEach(() => {
  const data = new Map([[CATALOGUE_KEY, JSON.stringify([legacy, unmappable, { id: 'ok', name: 'Fine' }])]]);
  vi.stubGlobal('localStorage', {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  });
  setCurrentActor({ role: 'admin', username: 'Test Admin' });
});

describe('CatalogueMigrationPanel', () => {
  it('explains the scope, lists every migration in order, and offers a dry run first', () => {
    const html = renderToStaticMarkup(<CatalogueMigrationPanel />);
    expect(html).toContain('Catalogue data migrations');
    expect(html).toContain('never runs by itself');
    expect(html).toContain('never profiles or the document vault');
    for (const m of MIGRATIONS) expect(html).toContain(m.title);
    expect(html).toContain('Run dry run');
    expect(html).toContain('Download a copy of the catalogue');
  });

  it('does not offer to apply before a dry run, and starts with no backups', () => {
    const html = renderToStaticMarkup(<CatalogueMigrationPanel />);
    expect(html).not.toContain('Apply migration');
    expect(html).toContain('No backups yet');
  });
});

describe('MigrationReport', () => {
  it('shows the counts and the records that change or are skipped, in words', () => {
    const html = renderToStaticMarkup(<MigrationReport report={planMigration()} />);
    expect(html).toContain('Records checked');
    expect(html).toContain('Would change');
    expect(html).toContain('Skipped as invalid');
    expect(html).toContain('legacy-guide');
    expect(html).toContain('Will change');
    expect(html).toContain('india-text');
    expect(html).toContain('Skipped (needs a decision)');
    expect(html).toContain('not a state or Union Territory');
  });

  it('lists the unknown fields it will keep, and labels the table', () => {
    const html = renderToStaticMarkup(<MigrationReport report={planMigration()} />);
    expect(html).toContain('customNote');
    expect(html).toContain('<caption>');
    expect(html).toContain('scope="col"');
    expect(html).toContain('tabindex="0"');
  });

  it('says so when there is nothing to migrate', () => {
    localStorage.setItem(CATALOGUE_KEY, JSON.stringify([{ id: 'ok', name: 'Fine' }]));
    const html = renderToStaticMarkup(<MigrationReport report={planMigration()} />);
    expect(html).toContain('Nothing to migrate');
    expect(html).not.toContain('<table');
  });
});
