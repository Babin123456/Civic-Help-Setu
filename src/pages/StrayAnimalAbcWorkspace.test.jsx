import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import StrayAnimalAbcWorkspace from './StrayAnimalAbcWorkspace.jsx';

describe('StrayAnimalAbcWorkspace', () => {
  it('renders workspace title, statutory badges, and tabs', () => {
    const html = renderToStaticMarkup(<StrayAnimalAbcWorkspace />);
    expect(html).toContain('Municipal Stray Animal Conflict &amp; Rabies PEP Emergency Workspace');
    expect(html).toContain('ANIMAL BIRTH CONTROL RULES, 2023');
    expect(html).toContain('Rabies PEP Tracker');
    expect(html).toContain('ABC Rules 2023 Auditor');
    expect(html).toContain('Rule 20 Feeder Charter');
    expect(html).toContain('Legal Requisition Drafter');
    expect(html).toContain('Saved Vault');
  });
});
