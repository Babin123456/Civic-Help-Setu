import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import CaregiverChecklistWorkspace from './CaregiverChecklistWorkspace.jsx';

describe('CaregiverChecklistWorkspace', () => {
  it('renders accessible household workspace creation form and privacy notice', () => {
    const html = renderToStaticMarkup(<CaregiverChecklistWorkspace actorId="caregiver-ssr" />);
    expect(html).toContain('Caregiver-Managed Multi-Person Document Checklist');
    expect(html).toContain('Start a Household Workspace');
    expect(html).toContain('Household Label');
    expect(html).toContain('Do not enter Aadhaar numbers, PAN, passwords, OTPs, or biometrics.');
  });
});
