import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../context/LanguageContext';
import DocumentValidityCalendar from './DocumentValidityCalendar';
import DocumentValidityCalendarTable from './DocumentValidityCalendarTable';

describe('DocumentValidityCalendar component', () => {
  beforeEach(() => {
    // Mock localStorage for the component
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    });
  });

  const renderCalendar = (props = {}) => {
    return renderToStaticMarkup(
      <MemoryRouter>
        <LanguageProvider>
          <DocumentValidityCalendar {...props} />
        </LanguageProvider>
      </MemoryRouter>
    );
  };

  const renderTable = (props = {}) => {
    return renderToStaticMarkup(
      <MemoryRouter>
        <LanguageProvider>
          <DocumentValidityCalendarTable {...props} />
        </LanguageProvider>
      </MemoryRouter>
    );
  };

  it('renders calendar view by default', () => {
    const html = renderCalendar({
      documentTypes: ['INCOME_CERTIFICATE', 'PUC_CERTIFICATE'],
      issueDate: '2026-01-01',
      stateKey: 'TAMIL_NADU',
    });

    expect(html).toContain('Document Validity Calendar');
    expect(html).toContain('INCOME_CERTIFICATE');
    expect(html).toContain('PUC_CERTIFICATE');
  });

  it('renders table view when showTableView is true', () => {
    const html = renderCalendar({
      documentTypes: ['INCOME_CERTIFICATE'],
      issueDate: '2026-01-01',
      stateKey: 'TAMIL_NADU',
      showTableView: true,
    });

    expect(html).toContain('Document Validity Across Services');
    expect(html).toContain('INCOME_CERTIFICATE');
  });

  it('shows loading state when no document types provided', () => {
    const html = renderCalendar({
      documentTypes: [],
    });

    expect(html).toContain('Loading document validity calendar');
  });

  it('shows empty state when document types empty', () => {
    const html = renderCalendar({
      documentTypes: [],
      issueDate: '2026-01-01',
    });

    expect(html).toContain('No documents tracked');
  });

  it('renders error state when error prop is provided', () => {
    const html = renderCalendar({
      documentTypes: ['INCOME_CERTIFICATE'],
      issueDate: '2026-01-01',
      stateKey: 'TAMIL_NADU',
      status: 'error',
      error: 'Test error',
    });

    expect(html).toContain('Error loading document validity data');
    expect(html).toContain('Test error');
  });

  it('renders stale-data state', () => {
    const html = renderCalendar({
      documentTypes: ['INCOME_CERTIFICATE'],
      issueDate: '2026-01-01',
      stateKey: 'TAMIL_NADU',
      status: 'stale-data',
    });

    expect(html).toContain('Data may be stale');
  });

  it('renders permission-denied state', () => {
    const html = renderCalendar({
      documentTypes: ['INCOME_CERTIFICATE'],
      issueDate: '2026-01-01',
      stateKey: 'TAMIL_NADU',
      status: 'permission-denied',
    });

    expect(html).toContain('Permission denied');
  });

  it('table view shows document types and validity info', () => {
    const html = renderTable({
      documentTypes: ['INCOME_CERTIFICATE', 'PUC_CERTIFICATE'],
      issueDate: '2026-01-01',
      stateKey: 'TAMIL_NADU',
    });

    expect(html).toContain('Document');
    expect(html).toContain('Validity Type');
    expect(html).toContain('Status');
    expect(html).toContain('INCOME_CERTIFICATE');
    expect(html).toContain('PUC_CERTIFICATE');
  });

  it('table has proper caption with service info', () => {
    const html = renderTable({
      documentTypes: ['INCOME_CERTIFICATE'],
      issueDate: '2026-01-01',
      stateKey: 'TAMIL_NADU',
      serviceIds: ['income-certificate'],
    });

    expect(html).toContain('Document Validity Across Services');
  });

  it('renders AI explanation suggestion when showAIExplanation is true', () => {
    const html = renderCalendar({
      documentTypes: ['INCOME_CERTIFICATE'],
      issueDate: '2026-01-01',
      stateKey: 'TAMIL_NADU',
      showAIExplanation: true,
    });

    expect(html).toContain('AI explanation (suggestion until confirmed)');
  });

  it('renders reminder toggle for non-permanent documents', () => {
    const html = renderCalendar({
      documentTypes: ['INCOME_CERTIFICATE'],
      issueDate: '2026-01-01',
      stateKey: 'TAMIL_NADU',
    });

    // Income certificate is not permanent, so reminder should be rendered
    expect(html).toContain('Set renewal reminder');
  });

  it('renders lifetime validity for permanent documents', () => {
    // Community certificate is non-expiring
    const html = renderCalendar({
      documentTypes: ['COMMUNITY_CERTIFICATE'],
      issueDate: '2026-01-01',
      stateKey: 'TAMIL_NADU',
    });

    expect(html).toContain('Lifetime validity');
  });

  it('renders dependency lanes for services that depend on document freshness', () => {
    const html = renderCalendar({
      documentTypes: ['INCOME_CERTIFICATE'],
      issueDate: '2026-01-01',
      stateKey: 'TAMIL_NADU',
      serviceIds: ['passport'],
    });

    expect(html).toContain('service(s) depend on freshness');
  });

  it('handles Tamil Nadu state key correctly', () => {
    const html = renderCalendar({
      documentTypes: ['INCOME_CERTIFICATE'],
      issueDate: '2026-01-01',
      stateKey: 'TAMIL_NADU',
    });

    expect(html).toContain('Tamil Nadu');
  });

  it('renders calendar bands visualization', () => {
    const html = renderCalendar({
      documentTypes: ['INCOME_CERTIFICATE'],
      issueDate: '2026-01-01',
      stateKey: 'TAMIL_NADU',
    });

    expect(html).toContain('Validity bands');
  });

  it('renders official expiry badge', () => {
    const html = renderCalendar({
      documentTypes: ['INCOME_CERTIFICATE'],
      issueDate: '2026-01-01',
      stateKey: 'TAMIL_NADU',
    });

    expect(html).toContain('Official expiry');
  });

  it('renders freshness limit badge', () => {
    const html = renderCalendar({
      documentTypes: ['INCOME_CERTIFICATE'],
      issueDate: '2026-01-01',
      stateKey: 'TAMIL_NADU',
    });

    expect(html).toContain('Freshness');
  });

  it('renders days remaining', () => {
    const html = renderCalendar({
      documentTypes: ['INCOME_CERTIFICATE'],
      issueDate: '2026-01-01',
      stateKey: 'TAMIL_NADU',
    });

    expect(html).toContain('days remaining');
  });

  it('returns null when no document types and no showTableView', () => {
    const html = renderCalendar({
      documentTypes: [],
      showTableView: true,
    });

    expect(html).toBe('');
  });

  it('table view shows empty state when no records', () => {
    const html = renderTable({
      documentTypes: [],
    });

    expect(html).toContain('No documents tracked');
  });
});

describe('DocumentValidityCalendar accessibility', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    });
  });

  it('has proper aria-labels on record regions', () => {
    const html = renderCalendar({
      documentTypes: ['INCOME_CERTIFICATE'],
      issueDate: '2026-01-01',
      stateKey: 'TAMIL_NADU',
    });

    // Check for aria-label in the output
    expect(html).toMatch(/aria-label="Document validity record/i);
  });

  it('has toolbar role', () => {
    const html = renderCalendar({
      documentTypes: ['INCOME_CERTIFICATE'],
      issueDate: '2026-01-01',
      stateKey: 'TAMIL_NADU',
    });

    expect(html).toMatch(/role="toolbar"/i);
  });

  it('has region role for document records', () => {
    const html = renderCalendar({
      documentTypes: ['INCOME_CERTIFICATE'],
      issueDate: '2026-01-01',
      stateKey: 'TAMIL_NADU',
    });

    expect(html).toMatch(/role="region"/i);
  });

  it('table has proper aria-label', () => {
    const html = renderTable({
      documentTypes: ['INCOME_CERTIFICATE'],
      issueDate: '2026-01-01',
      stateKey: 'TAMIL_NADU',
    });

    expect(html).toMatch(/aria-label="Document validity across services/i);
  });
});