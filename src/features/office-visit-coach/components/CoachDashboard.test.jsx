/**
 * CoachDashboard React Component Tests
 * Tests for the Multi-Agent Office Visit Preparation and Follow-Up Coach UI.
 * 
 * Uses renderToStaticMarkup to match repository testing conventions in Vitest node environment.
 */

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CoachDashboard from './CoachDashboard';

describe('CoachDashboard - Office Visit Preparation Coach UI', () => {
  const mockService = {
    name: 'Driving License Renewal',
    category: 'Transport',
    department: 'Regional Transport Office',
    fees: '₹200',
    processingTime: '15 - 30 working days',
    documents: ['Valid Driving License'],
    steps: [{ title: 'Token Collection' }],
    officialSources: [{ name: 'Parivahan Portal', url: 'https://parivahan.gov.in', verified: true }],
    lastVerified: '2026-11-20',
  };

  const mockOffice = {
    name: 'Regional Transport Office, City Center',
    address: '123 Transport Marg',
    city: 'Test City',
    state: 'Test State',
    pincode: '123456',
    landmark: 'Near City Hall',
    operatingHours: '08:00 AM - 04:00 PM (Mon-Sat)',
    contact: { helpline: '1800-123-4567' },
  };

  it('renders empty state when no service is provided', () => {
    const html = renderToStaticMarkup(<CoachDashboard />);
    
    expect(html).toContain('Office Visit Preparation Coach');
    expect(html).toContain('Select a civic service and office to begin preparation.');
  });

  it('renders service and office summary when service and office are provided', () => {
    const html = renderToStaticMarkup(
      <CoachDashboard service={mockService} office={mockOffice} citizenId="citizen_001" />
    );
    
    expect(html).toContain('Driving License Renewal');
    expect(html).toContain('Regional Transport Office');
    expect(html).toContain('₹200');
    expect(html).toContain('15 - 30 working days');
    expect(html).toContain('Regional Transport Office, City Center');
    expect(html).toContain('Test City');
  });

  it('renders office verification status badge', () => {
    const html = renderToStaticMarkup(
      <CoachDashboard service={mockService} office={mockOffice} citizenId="citizen_001" />
    );
    
    // With recent lastVerified (2026-11-20), status should be 'fresh'
    expect(html).toContain('role="status"');
    expect(html).toContain('fresh office data');
  });

  it('renders office type label', () => {
    const html = renderToStaticMarkup(
      <CoachDashboard service={mockService} office={mockOffice} citizenId="citizen_001" />
    );
    
    // Should infer RTO type from office name
    expect(html).toContain('RTO (Regional Transport Office)');
  });

  it('renders personal notes section checkbox', () => {
    const html = renderToStaticMarkup(
      <CoachDashboard service={mockService} office={mockOffice} citizenId="citizen_001" />
    );
    
    expect(html).toContain('Show personal notes section');
    expect(html).toContain('type="checkbox"');
  });

  it('renders checklist items', () => {
    const html = renderToStaticMarkup(
      <CoachDashboard service={mockService} office={mockOffice} citizenId="citizen_001" />
    );
    
    expect(html).toContain('checklist-checkbox');
    expect(html).toContain('Checklist');
  });

  it('renders ambiguous badge for unverified items', () => {
    const ambiguousService = {
      ...mockService,
      documents: ['Document that may be required (may vary by region)'],
    };
    const html = renderToStaticMarkup(
      <CoachDashboard service={ambiguousService} office={mockOffice} citizenId="citizen_001" />
    );
    
    expect(html).toContain('Confirm with the department.');
  });

  it('renders print pack button', () => {
    const html = renderToStaticMarkup(
      <CoachDashboard service={mockService} office={mockOffice} citizenId="citizen_001" />
    );
    
    expect(html).toContain('Print Pack');
  });

  it('renders text summary button', () => {
    const html = renderToStaticMarkup(
      <CoachDashboard service={mockService} office={mockOffice} citizenId="citizen_001" />
    );
    
    expect(html).toContain('Text Summary');
  });

  it('renders outcome recording section when visit is pending', () => {
    const html = renderToStaticMarkup(
      <CoachDashboard service={mockService} office={mockOffice} citizenId="citizen_001" />
    );
    
    expect(html).toContain('Record Visit Outcome');
    expect(html).toContain('Visit completed');
  });

  it('displays disclaimer in footer', () => {
    const html = renderToStaticMarkup(
      <CoachDashboard service={mockService} office={mockOffice} citizenId="citizen_001" />
    );
    
    expect(html).toContain(
      'Notice: This coach stores your visit preparation and follow-up plan locally.'
    );
  });

  it('renders citizenship disclaimer footer text', () => {
    const html = renderToStaticMarkup(
      <CoachDashboard service={mockService} office={mockOffice} citizenId="citizen_001" />
    );
    
    expect(html).toContain(
      'Does not replace statutory government paperwork'
    );
  });
});
