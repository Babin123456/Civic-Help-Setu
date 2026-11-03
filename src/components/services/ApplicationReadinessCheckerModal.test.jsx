import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ApplicationReadinessCheckerModal from './ApplicationReadinessCheckerModal';

const mockService = {
  id: 'voter-id-test',
  name: 'Voter ID Card Issuance',
  officialWebsite: 'https://voters.eci.gov.in',
  eligibility: [
    'Must be an Indian Citizen',
    'Must be 18 years of age or older on qualifying date',
  ],
  documents: [
    'Proof of Age (Birth certificate / Matriculation certificate)',
    'Proof of Ordinary Residence (Electricity bill or Water bill)',
  ],
};

describe('ApplicationReadinessCheckerModal', () => {
  it('does not render when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <ApplicationReadinessCheckerModal
        isOpen={false}
        service={mockService}
        onClose={() => {}}
      />
    );
    expect(html).toBe('');
  });

  it('renders modal dialog with grounded title and disclaimer when open', () => {
    const html = renderToStaticMarkup(
      <ApplicationReadinessCheckerModal
        isOpen={true}
        service={mockService}
        onClose={() => {}}
      />
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('AI Application Readiness Checker');
    expect(html).toContain('Voter ID Card Issuance');
    expect(html).toContain('Informational Guidance Only');
    expect(html).toContain('Readiness Status:');
    expect(html).toContain('Must be an Indian Citizen');
    expect(html).toContain('https://voters.eci.gov.in');
  });

  it('renders abstention message when service data is contradictory', () => {
    const contradictoryService = {
      id: 'contradictory-service',
      name: 'Contradictory Scheme',
      description: 'Zero documentation required and no documents needed.',
      documents: ['Aadhaar', 'Income Certificate'],
    };

    const html = renderToStaticMarkup(
      <ApplicationReadinessCheckerModal
        isOpen={true}
        service={contradictoryService}
        onClose={() => {}}
      />
    );

    expect(html).toContain('Readiness Check Abstained');
    expect(html).toContain('contradictory');
  });
});

