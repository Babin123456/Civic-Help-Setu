import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Code2, KeyRound, ShieldCheck, TerminalSquare } from 'lucide-react';
import StandardPageHeader from '../components/common/StandardPageHeader';
import CivicDataApiDatasetCard from '../components/civicDataApi/CivicDataApiDatasetCard';
import CivicDataApiClientForm from '../components/civicDataApi/CivicDataApiClientForm';
import CivicDataApiClientCard from '../components/civicDataApi/CivicDataApiClientCard';
import CivicDataApiSandboxConsole from '../components/civicDataApi/CivicDataApiSandboxConsole';
import CivicDataApiGovernancePanel from '../components/civicDataApi/CivicDataApiGovernancePanel';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import {
  API_ERROR_CODES,
  changeApiClientState,
  createApiClient,
  createApiKey,
  executeReadOnlyQuery,
  getDeveloperPortalData,
  reviewUsageAnomaly,
  revokeApiKey,
  rotateApiKey,
  API_CLIENT_STATES,
} from '../services/civicDataApiService';

const EMPTY_PORTAL = {
  datasets: [],
  schemas: {},
  clients: [],
  usage: [],
  audits: [],
  anomalies: [],
  context: { authenticated: false, actorRole: 'citizen' },
};

const loadPortal = () => {
  try {
    return getDeveloperPortalData();
  } catch {
    return EMPTY_PORTAL;
  }
};

export default function CivicDataApi() {
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const [portal, setPortal] = useState(loadPortal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [issuedKey, setIssuedKey] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const isAdmin = portal.context?.actorRole === 'admin';
  const signedIn = Boolean(user);

  const refresh = useCallback(() => {
    setLoading(true);
    try {
      setPortal(loadPortal());
      setError('');
    } catch (loadError) {
      setError(loadError?.message || 'The developer portal could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, user?.id]);

  const handleCreateClient = async (values) => {
    setSubmitting(true);
    setError('');
    try {
      const client = createApiClient({
        name: values.name,
        description: values.description,
        environment: values.environment,
        allowedDatasetIds: values.allowedDatasetIds,
        jurisdiction: { state: values.jurisdictionState, district: values.jurisdictionDistrict },
      });
      setNotice(`${client.name} created in ${client.environment}. ${client.state === 'pending' ? 'An administrator must approve it before keys can be issued.' : 'Create a key to start testing.'}`);
      refresh();
    } catch (createError) {
      setError(createError?.message || 'The API client could not be created.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateKey = async (clientId) => {
    setError('');
    try {
      const result = await createApiKey({ clientId, label: `Sandbox key ${new Date().toLocaleDateString()}` });
      setIssuedKey({ clientId, plaintextKey: result.plaintextKey });
      setNotice('A new API key was issued. Copy it now: it is shown only once and only a hash is stored.');
      refresh();
    } catch (keyError) {
      setError(keyError?.message || 'The API key could not be created.');
    }
  };

  const handleRotateKey = async (keyId) => {
    const reason = globalThis.prompt?.('Why are you rotating this key?', 'Scheduled rotation') ?? 'Scheduled rotation';
    if (!reason) return;
    setError('');
    try {
      const result = await rotateApiKey({ keyId, reason });
      setIssuedKey({ clientId: result.key.clientId, plaintextKey: result.plaintextKey });
      setNotice('Key rotated. The previous key is revoked immediately; copy the new key now.');
      refresh();
    } catch (rotationError) {
      setError(rotationError?.message || 'The key could not be rotated.');
    }
  };

  const handleRevokeKey = async (keyId) => {
    const reason = globalThis.prompt?.('Why are you revoking this key?', 'Developer request') ?? 'Developer request';
    if (!reason) return;
    setError('');
    try {
      revokeApiKey({ keyId, reason });
      setNotice('Key revoked. Requests signed with it will receive KEY_REVOKED.');
      refresh();
    } catch (revokeError) {
      setError(revokeError?.message || 'The key could not be revoked.');
    }
  };

  const handleClientState = (clientId, state) => {
    const reason = globalThis.prompt?.(`Reason for marking this client ${state}:`, state === API_CLIENT_STATES.ACTIVE ? 'Approved after review' : 'Under review') ?? '';
    if (!reason) return;
    setError('');
    try {
      changeApiClientState(clientId, state, { reason });
      setNotice(`Client marked ${state}. Every change is written to the access audit trail.`);
      refresh();
    } catch (stateError) {
      setError(stateError?.message || 'The client state could not be changed.');
    }
  };

  const handleExecute = async (payload) => {
    const response = await executeReadOnlyQuery(payload);
    refresh();
    return response;
  };

  const handleReviewAnomaly = (payload) => {
    setError('');
    try {
      reviewUsageAnomaly(payload);
      setNotice('Anomaly recommendation reviewed. The rule version, window and source fields remain on the record.');
      refresh();
    } catch (reviewError) {
      setError(reviewError?.message || 'The recommendation could not be reviewed.');
    }
  };

  const copyIssuedKey = async () => {
    if (!issuedKey) return;
    try {
      await navigator.clipboard.writeText(issuedKey.plaintextKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      setCopiedKey(false);
    }
  };

  const endpointRows = useMemo(() => [
    { method: 'GET', path: '/api/v1/datasets', description: 'List approved public datasets, schemas and limits.' },
    { method: 'GET', path: '/api/v1/datasets/{id}/schema', description: 'Read the public schema and allowed filters for one dataset.' },
    { method: 'GET', path: '/api/v1/datasets/{id}/records', description: 'Read paginated approved records. Requires x-api-key.' },
  ], []);

  return (
    <div className="section" style={{ padding: '2rem 1rem' }}>
      <div className="container" style={{ maxWidth: '1180px', margin: '0 auto', display: 'grid', gap: '2rem' }}>
        <StandardPageHeader
          eyebrow="Read-only civic data"
          eyebrowIcon={<TerminalSquare size={16} />}
          title="Civic Data API & Developer Sandbox"
          subtitle="Discover approved public datasets, test versioned read-only requests with synthetic data, and manage scoped credentials, quotas and audits."
          badgeText="Public data only"
          badgeType="accent"
        />

        <div role="note" aria-label="API governance notice" style={{ border: '1px solid var(--border-main)', borderRadius: '0.8rem', padding: '1rem 1.2rem', background: 'var(--bg-surface)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <ShieldCheck size={20} aria-hidden="true" style={{ color: 'var(--accent-main)', flexShrink: 0, marginTop: '0.15rem' }} />
          <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--text-primary)' }}>Governance boundary:</strong> this API never exposes citizen-level applications, grievances, contact details or internal identifiers. Sandbox data is synthetic and every response carries the environment, dataset version, source and generation timestamp. Keys are hashed, scoped to approved datasets and limited by daily quota and per-minute rate.
          </p>
        </div>

        {error && <div role="alert" style={{ border: '1px solid rgba(220, 38, 38, 0.45)', background: 'rgba(220, 38, 38, 0.08)', padding: '0.75rem 0.9rem', borderRadius: '0.6rem' }}>{error}</div>}
        {notice && <div role="status" style={{ border: '1px solid rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.08)', padding: '0.75rem 0.9rem', borderRadius: '0.6rem' }}>{notice}</div>}

        <section aria-labelledby="catalog-heading" style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <h2 id="catalog-heading" style={{ margin: 0 }}>Dataset catalogue</h2>
            <p style={{ margin: '0.3rem 0 0', color: 'var(--text-secondary)' }}>Only approved datasets with explicit public fields appear here. Each dataset is versioned and has its own schema.</p>
          </div>
          {loading && portal.datasets.length === 0 ? (
            <p role="status">Loading the dataset catalogue…</p>
          ) : portal.datasets.length === 0 ? (
            <p role="status">No approved dataset is available. An administrator must publish a dataset before developers can use the API.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
              {portal.datasets.map((dataset) => (
                <CivicDataApiDatasetCard key={dataset.id} dataset={dataset} onUseInSandbox={(datasetId) => setSelectedDatasetId(datasetId)} />
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="credentials-heading" style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <h2 id="credentials-heading" style={{ margin: 0 }}>Scoped credentials</h2>
            <p style={{ margin: '0.3rem 0 0', color: 'var(--text-secondary)' }}>Sandbox clients are owner-scoped. Administrators approve production requests, suspend access and read audit logs.</p>
          </div>

          {!signedIn ? (
            <div role="status" style={{ border: '1px solid var(--border-main)', borderRadius: '0.8rem', padding: '1rem', background: 'var(--bg-surface)' }}>
              <p style={{ margin: 0 }}>Sign in to create a sandbox client and issue a scoped API key. Dataset discovery stays available without an account.</p>
              <p style={{ margin: '0.6rem 0 0' }}><Link className="btn btn-primary" to="/login">Sign in to continue</Link></p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div style={{ border: '1px solid var(--border-main)', borderRadius: '0.85rem', padding: '1.15rem', background: 'var(--bg-surface)' }}>
                <CivicDataApiClientForm datasets={portal.datasets} onCreate={handleCreateClient} submitting={submitting} error="" />
              </div>

              {issuedKey && (
                <div role="status" style={{ border: '1px solid rgba(56, 189, 248, 0.5)', background: 'rgba(56, 189, 248, 0.08)', borderRadius: '0.7rem', padding: '0.9rem', display: 'grid', gap: '0.45rem' }}>
                  <strong style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><KeyRound size={16} aria-hidden="true" /> Copy this key now</strong>
                  <code style={{ overflowWrap: 'anywhere', padding: '0.55rem', borderRadius: '0.45rem', background: 'var(--bg-main)' }}>{issuedKey.plaintextKey}</code>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-secondary" onClick={copyIssuedKey}>{copiedKey ? 'Copied' : 'Copy key'}</button>
                    <button type="button" className="btn btn-secondary" onClick={() => setIssuedKey(null)}>Dismiss</button>
                  </div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Only a SHA-256 hash is stored. This value cannot be retrieved again.</span>
                </div>
              )}

              {portal.clients.length === 0 ? (
                <p role="status" style={{ color: 'var(--text-secondary)' }}>No API client yet. Create a sandbox client above to receive your first scoped key.</p>
              ) : (
                <div style={{ display: 'grid', gap: '0.8rem' }}>
                  {portal.clients.map((client) => (
                    <CivicDataApiClientCard
                      key={client.id}
                      client={client}
                      canAdmin={isAdmin}
                      onApprove={(clientId) => handleClientState(clientId, API_CLIENT_STATES.ACTIVE)}
                      onSuspend={(clientId) => handleClientState(clientId, API_CLIENT_STATES.SUSPENDED)}
                      onRevoke={(clientId) => handleClientState(clientId, API_CLIENT_STATES.REVOKED)}
                      onCreateKey={handleCreateKey}
                      onRotateKey={handleRotateKey}
                      onRevokeKey={handleRevokeKey}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <CivicDataApiSandboxConsole
          datasets={portal.datasets}
          isOnline={isOnline}
          initialDatasetId={selectedDatasetId}
          initialApiKey={issuedKey?.plaintextKey || ''}
          onExecute={handleExecute}
        />

        <CivicDataApiGovernancePanel
          usage={portal.usage}
          clients={portal.clients}
          audits={portal.audits}
          anomalies={portal.anomalies}
          isAdmin={isAdmin}
          onReviewAnomaly={handleReviewAnomaly}
        />

        <section aria-labelledby="api-reference-heading" style={{ display: 'grid', gap: '0.85rem' }}>
          <div>
            <h2 id="api-reference-heading" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}><Code2 size={20} aria-hidden="true" /> Versioned API reference</h2>
            <p style={{ margin: '0.3rem 0 0', color: 'var(--text-secondary)' }}>Send <code>x-api-key</code> with every records request. Pagination is bounded and errors return stable codes.</p>
          </div>
          <div style={{ overflowX: 'auto', border: '1px solid var(--border-main)', borderRadius: '0.7rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <caption style={{ textAlign: 'left', padding: '0.6rem 0.7rem', color: 'var(--text-secondary)' }}>Read-only endpoint contract (v1)</caption>
              <thead>
                <tr>
                  <th scope="col" style={{ textAlign: 'left', padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--border-main)' }}>Method</th>
                  <th scope="col" style={{ textAlign: 'left', padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--border-main)' }}>Path</th>
                  <th scope="col" style={{ textAlign: 'left', padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--border-main)' }}>Purpose</th>
                </tr>
              </thead>
              <tbody>
                {endpointRows.map((row) => (
                  <tr key={row.path}>
                    <td style={{ padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--border-main)' }}>{row.method}</td>
                    <td style={{ padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--border-main)' }}><code>{row.path}</code></td>
                    <td style={{ padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--border-main)' }}>{row.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details>
            <summary style={{ cursor: 'pointer', color: 'var(--accent-main)', fontWeight: 600 }}>Stable error codes</summary>
            <ul style={{ columns: 'repeat(auto-fit, minmax(220px, 1fr))', margin: '0.6rem 0 0', paddingLeft: '1.2rem', fontSize: '0.85rem' }}>
              {Object.values(API_ERROR_CODES).map((code) => (
                <li key={code}><code>{code}</code></li>
              ))}
            </ul>
          </details>
        </section>
      </div>
    </div>
  );
}
