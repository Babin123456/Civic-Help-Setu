import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CounterJourneySimulator from './CounterJourneySimulator';
import { JOURNEY_DOCUMENTS } from '../../data/civicCounterJourneyData';

// ---- tiny helpers for test only ----
const getDocumentLabel = (id) => JOURNEY_DOCUMENTS[id]?.label || id;

describe('CounterJourneySimulator static markup', () => {
  it('renders loading state', () => {
    const html = renderToStaticMarkup(
      <CounterJourneySimulator
        initialServiceId="income-certificate"
        mode="interactive"
        evaluationLoading
      />
    );
    expect(html).toContain('Loading counter sequence…');
    expect(html).toContain('income-certificate');
  });

  it('renders empty state before evaluation', () => {
    const html = renderToStaticMarkup(
      <CounterJourneySimulator
        initialServiceId="income-certificate"
        mode="interactive"
      />
    );
    expect(html).toContain('No evaluation yet');
    expect(html).toContain('Mark at least one document');
  });

  it('renders error state when evaluation fails', () => {
    const html = renderToStaticMarkup(
      <CounterJourneySimulator
        initialServiceId="income-certificate"
        mode="interactive"
        evaluationError={{ message: 'Unable to load' }}
      />
    );
    expect(html).toContain('Error loading the counter sequence');
    expect(html).toContain('Unable to load');
    expect(html).toContain('Retry');
  });

  it('renders stale data banner when review date is old', () => {
    const html = renderToStaticMarkup(
      <CounterJourneySimulator
        initialServiceId="income-certificate"
        mode="interactive"
        evaluationStale
      />
    );
    expect(html).toContain('Data review date');
    expect(html).toContain('past the');
  });

  it('renders official status banner', () => {
    const html = renderToStaticMarkup(
      <CounterJourneySimulator
        initialServiceId="income-certificate"
        mode="interactive"
        evaluation={{
          journey: {
            id: 'income-certificate-delhi-south',
            title: 'Income Certificate — counter sequence',
            serviceId: 'income-certificate',
            officeId: 'delhi-south-collectorate',
            dataVersion: '2026.11.18-r1',
            processNote: 'Illustrative',
            reviewedAt: '2026-11-18',
          },
          officialStatus: {
            isOfficial: false,
            label: 'Private preparation progress',
            message:
              'These ticks are stored only in this browser for your own preparation. They are not an official government application status and are not sent to any department.',
          },
          // provide minimal other required props
          availableDocumentIds: [],
          counters: [],
          blockers: [],
          comparison: {
            completeVisit: { label: 'If every checkpoint is ready', counterCount: 0, countersCleared: 0, blockedCounters: 0, missingDocuments: 0, repeatVisitRisk: 0, summary: 'The process path can be followed in the reviewed order without a document-related repeat visit. Approval and timing still depend on the office.' },
            incompleteVisit: { label: 'With the documents marked today', counterCount: 0, countersCleared: 0, blockedCounters: 0, missingDocuments: 0, repeatVisitRisk: 0, missingDocumentIds: [], summary: 'No document checkpoint currently blocks the reviewed path. This is not an official approval.' },
            delta: { blockedCounters: 0, missingDocuments: 0, repeatVisitRisk: 0 },
            isComplete: true,
          },
          aiSuggestions: [],
          dataQuality: {
            dataVersion: '2026.11.18-r1',
            reviewDate: '2026-11-18',
            ageDays: 0,
            staleAfterDays: 365,
            isStale: false,
            staleMessage: null,
            disclaimer: 'Process order only. This simulator does not show a live queue, token number, waiting time or official application status.',
          },
          progress: { clearedCounters: 0, totalCounters: 0, percent: 0 },
        }}
      />
    );
    expect(html).toContain('Private preparation progress');
    expect(html).toContain('These ticks are stored only in this browser');
  });

  it('renders source links for checkpoints', () => {
    const html = renderToStaticMarkup(
      <CounterJourneySimulator
        initialServiceId="income-certificate"
        mode="interactive"
        evaluation={{
          journey: {
            id: 'income-certificate-delhi-south',
            title: 'Income Certificate — counter sequence',
            serviceId: 'income-certificate',
            officeId: 'delhi-south-collectorate',
            dataVersion: '2026.11.18-r1',
            processNote: 'Illustrative',
            reviewedAt: '2026-11-18',
          },
          officialStatus: {
            isOfficial: false,
            label: 'Private preparation progress',
            message: 'These ticks are stored only in this browser for your own preparation. They are not an official government application status and are not sent to any department.',
          },
          availableDocumentIds: ['aadhaar', 'address-proof'],
          counters: [
            {
              id: 'help-desk',
              order: 1,
              title: 'Help desk and form issuance',
              purpose: 'Confirm the service, collect the application form and ask which counter handles verification.',
              guidance:
                'Reviewed guidance asks applicants to submit the application with identity and address proof. The help desk issues the form; it does not approve the certificate.',
              dependsOn: [],
              effortBand: null,
              checkpoints: [
                {
                  id: 'help-aadhaar',
                  documentId: 'aadhaar',
                  label: 'Aadhaar card (original for sighting)',
                  requirement: 'REQUIRED',
                  sourceIds: ['delhi-edistrict-revenue'],
                },
              ],
              branchCounters: [],
            },
          ],
          branchCounters: [],
          blockers: [],
          comparison: {
            completeVisit: { label: 'Complete', counterCount: 1, countersCleared: 1, blockedCounters: 0, missingDocuments: 0, repeatVisitRisk: 0, summary: 'OK' },
            incompleteVisit: { label: 'Incomplete', counterCount: 1, countersCleared: 0, blockedCounters: 1, missingDocuments: 1, repeatVisitRisk: 0, missingDocumentIds: [], summary: 'Blocked' },
            delta: { blockedCounters: 1, missingDocuments: 1, repeatVisitRisk: 0 },
            isComplete: false,
          },
          aiSuggestions: [],
          dataQuality: {
            dataVersion: '2026.11.18-r1',
            reviewDate: '2026-11-18',
            ageDays: 0,
            staleAfterDays: 365,
            isStale: false,
            staleMessage: null,
            disclaimer: 'Process order only.',
          },
          progress: { clearedCounters: 1, totalCounters: 1, percent: 100 },
        }}
      />
    );
    // Source links appear in the checkpoint chips
    expect(html).toContain('delhi-edistrict-revenue');
    expect(html).toContain('Aadhaar card');
  });

  it('renders AI suggestion panel when suggestions exist', () => {
    const html = renderToStaticMarkup(
      <CounterJourneySimulator
        initialServiceId="income-certificate"
        mode="interactive"
        evaluation={{
          journey: {
            id: 'income-certificate-delhi-south',
            title: 'Income Certificate — counter sequence',
            serviceId: 'income-certificate',
            officeId: 'delhi-south-collectorate',
            dataVersion: '2026.11.18-r1',
            processNote: 'Illustrative',
            reviewedAt: '2026-11-18',
          },
          officialStatus: {
            isOfficial: false,
            label: 'Private preparation progress',
            message: 'These ticks are stored only in this browser for your own preparation. They are not an official government application status and are not sent to any department.',
          },
          availableDocumentIds: [],
          counters: [
            {
              id: 'help-desk',
              order: 1,
              title: 'Help desk and form issuance',
              purpose: 'Confirm the service, collect the application form and ask which counter handles verification.',
              guidance:
                'Reviewed guidance asks applicants to submit the application with identity and address proof. The help desk issues the form; it does not approve the certificate.',
              dependsOn: [],
              effortBand: null,
              checkpoints: [
                {
                  id: 'help-aadhaar',
                  documentId: 'aadhaar',
                  label: 'Aadhaar card (original for sighting)',
                  requirement: 'REQUIRED',
                  sourceIds: ['delhi-edistrict-revenue'],
                },
              ],
              branchCounters: [],
            },
          ],
          branchCounters: [],
          blockers: [],
          comparison: {
            completeVisit: { label: 'Complete', counterCount: 1, countersCleared: 1, blockedCounters: 0, missingDocuments: 0, repeatVisitRisk: 0, summary: 'OK' },
            incompleteVisit: { label: 'Incomplete', counterCount: 1, countersCleared: 0, blockedCounters: 1, missingDocuments: 1, repeatVisitRisk: 0, missingDocumentIds: [], summary: 'Blocked' },
            delta: { blockedCounters: 1, missingDocuments: 1, repeatVisitRisk: 0 },
            isComplete: false,
          },
          aiSuggestions: [
            {
              counterId: 'help-desk',
              counterTitle: 'Help desk and form issuance',
              label: 'SUGGESTION',
              text: 'Suggestion (unconfirmed): reviewed guidance asks applicants to submit the application with identity and address proof.',
              confidence: 0.9,
              requiresReview: false,
              sourceRefs: [
                { id: 'delhi-edistrict-revenue', title: 'Delhi eDistrict — Revenue Certificate Services', url: 'https://edistrict.delhigovt.nic.in', official: true },
              ],
              dataVersion: '2026.11.18-r1',
              containsQueueClaim: false,
              requiresConfirmation: true,
            },
          ],
          dataQuality: {
            dataVersion: '2026.11.18-r1',
            reviewDate: '2026-11-18',
            ageDays: 0,
            staleAfterDays: 365,
            isStale: false,
            staleMessage: null,
            disclaimer: 'Process order only.',
          },
          progress: { clearedCounters: 0, totalCounters: 1, percent: 0 },
        }}
      />
    );
    expect(html).toContain('AI suggestion (unconfirmed)');
    expect(html).toContain('Suggestion (unconfirmed)');
    expect(html).toContain('Delhi eDistrict');
    expect(html).toContain('Confirm');
  });

  it('renders comparison table', () => {
    const html = renderToStaticMarkup(
      <CounterJourneySimulator
        initialServiceId="income-certificate"
        mode="interactive"
        evaluation={{
          journey: {
            id: 'income-certificate-delhi-south',
            title: 'Income Certificate — counter sequence',
            serviceId: 'income-certificate',
            officeId: 'delhi-south-collectorate',
            dataVersion: '2026.11.18-r1',
            processNote: 'Illustrative',
            reviewedAt: '2026-11-18',
          },
          officialStatus: {
            isOfficial: false,
            label: 'Private preparation progress',
            message: 'These ticks are stored only in this browser for your own preparation. They are not an official government application status and are not sent to any department.',
          },
          availableDocumentIds: ['aadhaar'],
          counters: [
            {
              id: 'help-desk',
              order: 1,
              title: 'Help desk and form issuance',
              purpose: 'Confirm the service, collect the application form and ask which counter handles verification.',
              guidance:
                'Reviewed guidance asks applicants to submit the application with identity and address proof. The help desk issues the form; it does not approve the certificate.',
              dependsOn: [],
              effortBand: null,
              checkpoints: [
                {
                  id: 'help-aadhaar',
                  documentId: 'aadhaar',
                  label: 'Aadhaar card (original for sighting)',
                  requirement: 'REQUIRED',
                  sourceIds: ['delhi-edistrict-revenue'],
                },
              ],
              branchCounters: [],
            },
          ],
          branchCounters: [],
          blockers: [
            {
              id: 'help-desk:help-aadhaar',
              counterId: 'help-desk',
              counterTitle: 'Help desk and form issuance',
              documentId: 'aadhaar',
              documentLabel: 'Aadhaar card (original for sighting)',
              kind: 'MISSING_DOCUMENT',
              repeatVisit: true,
              message: 'Aadhaar card is missing. This may cause a repeat visit.',
              branch: null,
              sourceIds: ['delhi-edistrict-revenue'],
              sources: [{ id: 'delhi-edistrict-revenue', title: 'Delhi eDistrict', url: 'https://edistrict.delhigovt.nic.in', official: true }],
            },
          ],
          comparison: {
            completeVisit: { label: 'Complete', counterCount: 1, countersCleared: 1, blockedCounters: 0, missingDocuments: 0, repeatVisitRisk: 0, summary: 'The process path can be followed in the reviewed order without a document-related repeat visit. Approval and timing still depend on the office.' },
            incompleteVisit: { label: 'Current ticks', counterCount: 1, countersCleared: 0, blockedCounters: 1, missingDocuments: 1, repeatVisitRisk: 0, missingDocumentIds: ['aadhaar'], summary: 'Blocked' },
            delta: { blockedCounters: 1, missingDocuments: 1, repeatVisitRisk: 0 },
            isComplete: false,
          },
          aiSuggestions: [],
          dataQuality: {
            dataVersion: '2026.11.18-r1',
            reviewDate: '2026-11-18',
            ageDays: 0,
            staleAfterDays: 365,
            isStale: false,
            staleMessage: null,
            disclaimer: 'Process order only.',
          },
          progress: { clearedCounters: 0, totalCounters: 1, percent: 0 },
        }}
      />
    );
    expect(html).toContain('Complete vs incomplete visit');
    expect(html).toContain('Counters');
    expect(html).toContain('Missing documents');
    expect(html).toContain('1 of 1 counters clear');
    expect(html).toContain('1 missing document type');
  });

  it('renders board view and linear checklist toggles', () => {
    const html = renderToStaticMarkup(
      <CounterJourneySimulator
        initialServiceId="income-certificate"
        mode="interactive"
        evaluation={{
          journey: {
            id: 'income-certificate-delhi-south',
            title: 'Income Certificate — counter sequence',
            serviceId: 'income-certificate',
            officeId: 'delhi-south-collectorate',
            dataVersion: '2026.11.18-r1',
            processNote: 'Illustrative',
            reviewedAt: '2026-11-18',
          },
          officialStatus: {
            isOfficial: false,
            label: 'Private preparation progress',
            message: 'These ticks are stored only in this browser for your own preparation. They are not an official government application status and are not sent to any department.',
          },
          availableDocumentIds: ['aadhaar', 'address-proof'],
          counters: [
            {
              id: 'help-desk',
              order: 1,
              title: 'Help desk and form issuance',
              purpose: 'Confirm the service, collect the application form and ask which counter handles verification.',
              guidance:
                'Reviewed guidance asks applicants to submit the application with identity and address proof. The help desk issues the form; it does not approve the certificate.',
              dependsOn: [],
              effortBand: null,
              checkpoints: [
                {
                  id: 'help-aadhaar',
                  documentId: 'aadhaar',
                  label: 'Aadhaar card (original for sighting)',
                  requirement: 'REQUIRED',
                  sourceIds: ['delhi-edistrict-revenue'],
                },
                {
                  id: 'verify-income',
                  documentId: 'income-proof',
                  label: 'Income proof (salary slips / employer certificate / ITR)',
                  requirement: 'REQUIRED',
                  sourceIds: ['delhi-edistrict-revenue'],
                },
              ],
              branchCounters: [],
            },
            {
              id: 'verification',
              order: 2,
              title: 'Document verification counter',
              purpose: 'Clerk verifies identity and address documents against the submitted form.',
              guidance: 'Original documents are inspected and returned.',
              dependsOn: ['help-desk'],
              effortBand: null,
              checkpoints: [],
              branchCounters: [],
            },
          ],
          branchCounters: [],
          blockers: [],
          comparison: {
            completeVisit: { label: 'Complete', counterCount: 2, countersCleared: 2, blockedCounters: 0, missingDocuments: 0, repeatVisitRisk: 0, summary: 'OK' },
            incompleteVisit: { label: 'Current ticks', counterCount: 2, countersCleared: 2, blockedCounters: 0, missingDocuments: 0, repeatVisitRisk: 0, missingDocumentIds: [], summary: 'OK' },
            delta: { blockedCounters: 0, missingDocuments: 0, repeatVisitRisk: 0 },
            isComplete: true,
          },
          aiSuggestions: [],
          dataQuality: {
            dataVersion: '2026.11.18-r1',
            reviewDate: '2026-11-18',
            ageDays: 0,
            staleAfterDays: 365,
            isStale: false,
            staleMessage: null,
            disclaimer: 'Process order only.',
          },
          progress: { clearedCounters: 2, totalCounters: 2, percent: 100 },
        }}
      />
    );
    // Board view renders counter sections
    expect(html).toContain('Help desk and form issuance');
    expect(html).toContain('Document verification counter');
    // Linear checklist button text should be present
    expect(html).toContain('Linear checklist');
    expect(html).toContain('Board view');
  });
});