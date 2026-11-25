import { useEffect, useMemo, useState } from 'react';
import { Clipboard, Play, WifiOff } from 'lucide-react';

const textFilterFields = ['state', 'district', 'ward', 'q', 'category', 'metric', 'period', 'issuedAfter', 'issuedBefore'];

const emptyFilters = {
  state: '',
  district: '',
  ward: '',
  q: '',
  category: '',
  metric: '',
  period: '',
  issuedAfter: '',
  issuedBefore: '',
};

const fieldLabel = (field) => field.charAt(0).toUpperCase() + field.slice(1);

export default function CivicDataApiSandboxConsole({ datasets, isOnline, initialDatasetId, initialApiKey, onExecute }) {
  const [datasetId, setDatasetId] = useState(initialDatasetId || datasets[0]?.id || '');
  const [apiKey, setApiKey] = useState(initialApiKey || '');
  const [environment, setEnvironment] = useState('sandbox');
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState('1');
  const [pageSize, setPageSize] = useState('10');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const dataset = useMemo(() => datasets.find((item) => item.id === datasetId) || datasets[0], [datasets, datasetId]);

  useEffect(() => {
    if (initialDatasetId) setDatasetId(initialDatasetId);
  }, [initialDatasetId]);

  useEffect(() => {
    if (initialApiKey) setApiKey(initialApiKey);
  }, [initialApiKey]);

  useEffect(() => {
    if (dataset) setPageSize(String(dataset.defaultPageSize));
  }, [dataset]);

  const visibleFilters = (dataset?.filterFields || []).filter((field) => textFilterFields.includes(field));
  const columns = result?.data?.length ? Object.keys(result.data[0]) : [];

  const run = async (event) => {
    event.preventDefault();
    setError(null);
    setResult(null);
    setCopied(false);
    setLoading(true);
    try {
      const activeFilters = Object.fromEntries(Object.entries(filters).filter(([key, value]) => visibleFilters.includes(key) && value.trim() !== ''));
      const response = await onExecute({
        apiKey,
        datasetId: dataset.id,
        environment,
        page,
        pageSize,
        filters: activeFilters,
      });
      setResult(response);
    } catch (executionError) {
      setError({
        code: executionError?.code || 'INTERNAL_ERROR',
        message: executionError?.message || 'The request could not be completed.',
        retryAfterSeconds: executionError?.meta?.retryAfterSeconds || executionError?.retryAfterSeconds || null,
      });
    } finally {
      setLoading(false);
    }
  };

  const copyRequest = async () => {
    if (!dataset) return;
    const query = new URLSearchParams({ page, pageSize }).toString();
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${dataset.endpoint}?${query}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section aria-labelledby="sandbox-heading" style={{ border: '1px solid var(--border-main)', borderRadius: '0.9rem', padding: '1.25rem', background: 'var(--bg-surface)', display: 'grid', gap: '1rem' }}>
      <div>
        <h2 id="sandbox-heading" style={{ margin: 0 }}>Sandbox request console</h2>
        <p style={{ margin: '0.3rem 0 0', color: 'var(--text-secondary)' }}>
          Test approved endpoints with a scoped key. Sandbox responses are synthetic and labelled in every payload.
        </p>
      </div>

      {!isOnline && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 0.8rem', borderRadius: '0.5rem', border: '1px solid rgba(245, 158, 11, 0.45)', background: 'rgba(245, 158, 11, 0.1)' }}>
          <WifiOff size={16} aria-hidden="true" /> You are offline. Sandbox requests are paused until the connection returns.
        </div>
      )}

      <form onSubmit={run} style={{ display: 'grid', gap: '0.85rem' }}>
        <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
          <label style={{ display: 'grid', gap: '0.3rem', fontWeight: 600 }}>
            Dataset
            <select className="input" value={datasetId} onChange={(event) => setDatasetId(event.target.value)}>
              {datasets.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: '0.3rem', fontWeight: 600 }}>
            API key
            <input className="input" type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="cdk_sandbox_…" required />
          </label>
          <label style={{ display: 'grid', gap: '0.3rem', fontWeight: 600 }}>
            Environment
            <select className="input" value={environment} onChange={(event) => setEnvironment(event.target.value)}>
              <option value="sandbox">Sandbox</option>
              <option value="production">Production</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: '0.3rem', fontWeight: 600 }}>
            Page size
            <input className="input" type="number" min="1" max={dataset?.maxPageSize || 50} value={pageSize} onChange={(event) => setPageSize(event.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: '0.3rem', fontWeight: 600 }}>
            Page
            <input className="input" type="number" min="1" value={page} onChange={(event) => setPage(event.target.value)} />
          </label>
        </div>

        {visibleFilters.length > 0 && (
          <fieldset style={{ border: '1px solid var(--border-main)', borderRadius: '0.6rem', padding: '0.75rem' }}>
            <legend style={{ fontWeight: 700, padding: '0 0.35rem' }}>Filters</legend>
            <div style={{ display: 'grid', gap: '0.7rem', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
              {visibleFilters.map((field) => (
                <label key={field} style={{ display: 'grid', gap: '0.3rem', fontWeight: 600 }}>
                  {fieldLabel(field)}
                  <input
                    className="input"
                    type={field === 'issuedAfter' || field === 'issuedBefore' ? 'date' : 'text'}
                    maxLength={100}
                    value={filters[field]}
                    onChange={(event) => setFilters((previous) => ({ ...previous, [field]: event.target.value }))}
                    placeholder={field === 'q' ? 'Search text' : field === 'period' ? 'YYYY-MM' : 'All'}
                  />
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
          <button type="submit" className="btn btn-primary" disabled={loading || !isOnline}>
            <Play size={15} aria-hidden="true" /> {loading ? 'Running…' : 'Run request'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={copyRequest}>
            <Clipboard size={15} aria-hidden="true" /> {copied ? 'Copied' : 'Copy URL'}
          </button>
          {dataset && <code style={{ fontSize: '0.8rem', overflowWrap: 'anywhere' }}>GET {dataset.endpoint}</code>}
        </div>
      </form>

      <div aria-live="polite">
        {error && (
          <div role="alert" style={{ border: '1px solid rgba(220, 38, 38, 0.45)', background: 'rgba(220, 38, 38, 0.08)', borderRadius: '0.55rem', padding: '0.8rem' }}>
            <strong>{error.code}</strong>
            <p style={{ margin: '0.25rem 0 0' }}>{error.message}</p>
            {error.retryAfterSeconds && <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }}>Try again in {error.retryAfterSeconds} seconds.</p>}
          </div>
        )}
      </div>

      {result && (
        <div style={{ display: 'grid', gap: '0.8rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            <span>Request {result.requestId}</span>
            <span>· {result.meta.total} matching records</span>
            <span>· page {result.meta.page} of {result.meta.totalPages}</span>
            <span>· quota {result.quota.remaining} left today</span>
            <span>· generated {new Date(result.meta.generatedAt).toLocaleString()}</span>
          </div>
          {result.meta.synthetic && (
            <p style={{ margin: 0, padding: '0.55rem 0.7rem', borderRadius: '0.5rem', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.35)' }}>
              Synthetic sandbox data. No citizen-level records are included.
            </p>
          )}
          {result.data.length === 0 ? (
            <p role="status" style={{ margin: 0, color: 'var(--text-secondary)' }}>No records matched these filters. Clear a filter or try a different page.</p>
          ) : (
            <>
              <div style={{ overflowX: 'auto', border: '1px solid var(--border-main)', borderRadius: '0.6rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <caption style={{ textAlign: 'left', padding: '0.55rem 0.7rem', color: 'var(--text-secondary)' }}>Accessible table view of the sandbox response</caption>
                  <thead>
                    <tr>
                      {columns.map((column) => (
                        <th key={column} scope="col" style={{ textAlign: 'left', padding: '0.5rem 0.65rem', borderBottom: '1px solid var(--border-main)', whiteSpace: 'nowrap' }}>{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((row, index) => (
                      <tr key={row.id || index}>
                        {columns.map((column) => (
                          <td key={column} style={{ padding: '0.5rem 0.65rem', borderBottom: '1px solid var(--border-main)', verticalAlign: 'top' }}>
                            {typeof row[column] === 'object' ? JSON.stringify(row[column]) : String(row[column] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <details>
                <summary style={{ cursor: 'pointer', color: 'var(--accent-main)', fontWeight: 600 }}>Raw JSON response</summary>
                <pre style={{ overflowX: 'auto', background: 'var(--bg-main)', border: '1px solid var(--border-main)', borderRadius: '0.55rem', padding: '0.75rem', fontSize: '0.8rem' }}>
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </>
          )}
        </div>
      )}
    </section>
  );
}
