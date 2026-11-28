import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import SeniorProxyAssistanceWorkspace from './SeniorProxyAssistanceWorkspace.jsx';

describe('SeniorProxyAssistanceWorkspace', () => {
  it('renders accessible delegation form and privacy notice', () => {
    const html = renderToStaticMarkup(<SeniorProxyAssistanceWorkspace seniorOwnerId="senior-ssr" />);
    expect(html).toContain('Senior-Citizen Public Service Proxy');
    expect(html).toContain('Invite a Trusted Proxy Helper');
    expect(html).toContain('Granular Permissions');
    expect(html).toContain('Never enter Aadhaar numbers, PAN, OTPs, or passwords.');
  });
});
