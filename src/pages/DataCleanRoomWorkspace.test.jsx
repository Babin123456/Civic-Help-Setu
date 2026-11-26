import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DataCleanRoomWorkspace from './DataCleanRoomWorkspace.jsx';
import { resetCleanRoomStorage } from '../services/cleanRoomStorage.js';

describe('DataCleanRoomWorkspace (#1164)', () => {
  beforeEach(() => {
    resetCleanRoomStorage();
  });

  it('renders clean room workspace header, DPDP Act compliance, and active workspace selector', () => {
    const html = renderToStaticMarkup(<DataCleanRoomWorkspace />);

    expect(html).toContain('Civic Data Clean Room');
    expect(html).toContain('DPDP Act 2023 Compliant');
    expect(html).toContain('Zero Citizen PII Invariant Guaranteed');
    expect(html).toContain('Active Workspace:');
    expect(html).toContain('Urban Governance &amp; Public Policy Institute');
  });

  it('renders tab list with partner analytics, steward governance, and audit logs', () => {
    const html = renderToStaticMarkup(<DataCleanRoomWorkspace />);

    expect(html).toContain('Partner Analytics Workbench');
    expect(html).toContain('Data Steward Governance');
    expect(html).toContain('Tamper-Evident Audit Logs');
  });

  it('renders budget badge with query tokens and differential privacy meter', () => {
    const html = renderToStaticMarkup(<DataCleanRoomWorkspace />);

    expect(html).toContain('Query Tokens');
    expect(html).toContain('Privacy Budget (ε)');
    expect(html).toContain('Lead Researcher: Prof. Alok Verma');
  });

  it('renders template selector with AST-validated filters and execution controls', () => {
    const html = renderToStaticMarkup(<DataCleanRoomWorkspace />);

    expect(html).toContain('Select Approved Query Template');
    expect(html).toContain('Ward Service Demand by Category');
    expect(html).toContain('Bounded Query Filters');
    expect(html).toContain('Execute In Clean Room');
  });
});
