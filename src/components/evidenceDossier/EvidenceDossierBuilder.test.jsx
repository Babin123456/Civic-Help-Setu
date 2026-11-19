import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import EvidenceDossierBuilder from './EvidenceDossierBuilder.jsx';

describe('EvidenceDossierBuilder', () => {
  it('renders initial dossier creation form with inputs and instructions', () => {
    const html = renderToStaticMarkup(<EvidenceDossierBuilder />);

    expect(html).toContain('Create Evidence Dossier Manifest');
    expect(html).toContain('Dossier Title');
    expect(html).toContain('Grievance / Case Reference No.');
    expect(html).toContain('Select or Drop Evidence Files');
    expect(html).toContain('Supports PDF, PNG, JPG, JPEG, and TXT files. Max 20 files, up to 20 MiB each.');
  });
});
