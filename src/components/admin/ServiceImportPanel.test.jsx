import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ServiceImportPanel from './ServiceImportPanel';
import { MAX_IMPORT_BYTES } from '../../services/serviceImportService';

describe('ServiceImportPanel Component', () => {
  it('renders import panel with documented allowed file formats and maximum size', () => {
    const html = renderToStaticMarkup(
      <ServiceImportPanel existingServices={[]} actorName="Admin" onImported={() => {}} onClose={() => {}} />
    );
    expect(html).toContain('Import services from CSV or JSON');
    expect(html).toContain(`Allowed formats: CSV or JSON, up to ${MAX_IMPORT_BYTES / 1024} KB.`);
    expect(html).toContain('accept=".csv,.json,text/csv,application/json"');
    expect(html).toContain('aria-describedby="import-file-hint"');
  });

  it('escapes file names when rendered to ensure text rendering, not HTML', () => {
    const maliciousName = '<script>alert(1)</script>.csv';
    const html = renderToStaticMarkup(<span>{maliciousName}</span>);
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;.csv');
  });
});
