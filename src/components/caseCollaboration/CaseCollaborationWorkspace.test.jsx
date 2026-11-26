import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CaseCollaborationLoading,
  CaseCollaborationEmpty,
  CaseCollaborationError,
  CaseCollaborationRevoked,
  CaseCollaborationPermissionDenied,
} from './CaseCollaborationStates';
import { ShareCreator } from './ShareCreator';
import { ShareViewer } from './ShareViewer';
import { ShareManager } from './ShareManager';
import { listCases, listCaseItems, listRecipients, listScopes, listExpiryOptions } from '../../data/civicCaseCollaborationData.js';

const cases = listCases();
const items = listCaseItems();
const recipients = listRecipients();
const scopes = listScopes();
const expiry = listExpiryOptions();

describe('CaseCollaboration states', () => {
  it('renders loading', () => {
    const html = renderToStaticMarkup(<CaseCollaborationLoading />);
    expect(html).toContain('Preparing share');
  });
  it('renders empty', () => {
    const html = renderToStaticMarkup(<CaseCollaborationEmpty />);
    expect(html).toContain('No share configured');
  });
  it('renders error with retry', () => {
    const html = renderToStaticMarkup(<CaseCollaborationError message="Boom" onRetry={() => {}} />);
    expect(html).toContain('Collaboration error');
    expect(html).toContain('Boom');
    expect(html).toContain('Retry');
  });
  it('renders revoked', () => {
    const html = renderToStaticMarkup(<CaseCollaborationRevoked message="Revoked" onRetry={() => {}} />);
    expect(html).toContain('Share access revoked or expired');
  });
  it('renders permission denied', () => {
    const html = renderToStaticMarkup(<CaseCollaborationPermissionDenied />);
    expect(html).toContain('Authentication required');
  });
});

describe('ShareCreator markup', () => {
  it('renders case, items, recipient, scope, expiry, create button', () => {
    const html = renderToStaticMarkup(
      <ShareCreator
        cases={cases}
        caseItems={items}
        recipients={recipients}
        scopes={scopes}
        expiryOptions={expiry}
        onCreate={() => {}}
        defaultCaseId={cases[0]?.id}
      />
    );
    expect(html).toContain('Create case share');
    expect(html).toContain(cases[0]?.title);
    expect(html).toContain('Case items to share');
    expect(html).toContain('Trusted helper');
    expect(html).toContain('Share scope');
    expect(html).toContain('Expires after');
    expect(html).toContain('Create share link');
    expect(html).toContain('Granular');
    expect(html).toContain('revocable');
  });
});

describe('ShareViewer markup', () => {
  const view = {
    title: 'Test Share',
    description: 'desc',
    scope: 'view-download',
    itemIds: ['item-income-cert-application'],
    itemSnapshot: [{ id: 'item-income-cert-application', title: 'Income Certificate Application Form', category: 'application-form', mime: 'application/pdf' }],
    viewsRemaining: 2,
    viewCount: 1,
    watermark: 'Civic Help Setu — Shared Case Item — Illustrative Only',
    readOnly: true,
    integrityVerified: true,
  };
  it('renders viewer with items and download', () => {
    const html = renderToStaticMarkup(<ShareViewer view={view} onDownload={() => {}} />);
    expect(html).toContain('Test Share');
    expect(html).toContain('Income Certificate Application Form');
    expect(html).toContain('Download');
    expect(html).toContain('Integrity verified');
  });
  it('renders view-only without download', () => {
    const html = renderToStaticMarkup(<ShareViewer view={{ ...view, scope: 'view-only' }} />);
    expect(html).not.toContain('Download');
  });
});

describe('ShareManager markup', () => {
  it('renders loading state in SSR', () => {
    const html = renderToStaticMarkup(<ShareManager ownerId='user-1' onRevoke={() => {}} />);
    expect(html).toContain('Loading shares');
  });
});
