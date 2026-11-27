import { useState } from 'react';
import { Download, ShieldCheck, Lock } from 'lucide-react';

export default function CleanRoomResultsTable({ queryResult }) {
  const [downloadNotice, setDownloadNotice] = useState('');

  if (!queryResult || !queryResult.results) return null;

  const { results, template, meta } = queryResult;

  if (results.length === 0) {
    return (
      <div
        className="card"
        style={{
          padding: '2rem',
          textAlign: 'center',
          borderRadius: '0.75rem',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          color: 'var(--text-secondary)',
        }}
      >
        <p style={{ margin: 0, fontSize: '0.95rem' }}>No records matched the selected query filter parameters.</p>
      </div>
    );
  }

  // Extract table columns
  const dimensionKeys = template?.groupDimensions || [];
  const aggregationKeys = template?.aggregations?.map((a) => a.alias) || [];

  const handleDownloadCSV = () => {
    const headers = [...dimensionKeys, ...aggregationKeys];
    const csvRows = [headers.join(',')];

    for (const row of results) {
      const values = headers.map((h) => {
        const val = row[h] !== undefined ? row[h] : '';
        return `"${String(val).replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `cleanroom-aggregate-${template?.id || 'export'}-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadNotice('Aggregate export downloaded. Row-level citizen data excluded by design.');
    setTimeout(() => setDownloadNotice(''), 4000);
  };

  return (
    <div
      className="card"
      style={{
        padding: '1.25rem',
        borderRadius: '0.75rem',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        marginBottom: '1.5rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={18} color="#10b981" />
            Clean Room Aggregate Results ({results.length} Buckets)
          </h3>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Digest: <code style={{ fontSize: '0.75rem', color: 'var(--text-primary)' }}>{meta?.resultDigest}</code>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={handleDownloadCSV}
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem',
              padding: '0.45rem 0.85rem',
            }}
          >
            <Download size={14} />
            Export Aggregate CSV
          </button>
        </div>
      </div>

      {downloadNotice && (
        <div
          style={{
            padding: '0.5rem 0.75rem',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid #10b981',
            borderRadius: '0.4rem',
            fontSize: '0.8rem',
            color: '#10b981',
            marginBottom: '1rem',
          }}
        >
          {downloadNotice}
        </div>
      )}

      {/* Suppression Notification Banner */}
      {meta?.suppressedBuckets > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 0.8rem',
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid #f59e0b',
            borderRadius: '0.4rem',
            fontSize: '0.85rem',
            color: '#d97706',
            marginBottom: '1rem',
          }}
        >
          <Lock size={15} />
          <span>
            <strong>k-Anonymity Guard Notice:</strong> {meta.suppressedBuckets} bucket(s) matched fewer than{' '}
            {meta.kThreshold || 10} records and were masked to protect citizen identity.
          </span>
        </div>
      )}

      {/* Results Table */}
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.85rem',
            textAlign: 'left',
          }}
        >
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
              {dimensionKeys.map((dim) => (
                <th key={dim} style={{ padding: '0.6rem 0.8rem', fontWeight: 600 }}>
                  {dim.replace(/_/g, ' ').toUpperCase()}
                </th>
              ))}
              {aggregationKeys.map((agg) => (
                <th key={agg} style={{ padding: '0.6rem 0.8rem', fontWeight: 600 }}>
                  {agg.replace(/_/g, ' ').toUpperCase()}
                </th>
              ))}
              <th style={{ padding: '0.6rem 0.8rem', fontWeight: 600, textAlign: 'center' }}>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {results.map((row, idx) => {
              const isSuppressed = row._isSuppressed;
              return (
                <tr
                  key={row._groupKey || idx}
                  style={{
                    borderBottom: '1px solid var(--border-light)',
                    background: isSuppressed ? 'rgba(245, 158, 11, 0.05)' : 'transparent',
                  }}
                >
                  {dimensionKeys.map((dim) => (
                    <td key={dim} style={{ padding: '0.6rem 0.8rem', fontWeight: 500 }}>
                      {String(row[dim] ?? '—')}
                    </td>
                  ))}
                  {aggregationKeys.map((agg) => (
                    <td
                      key={agg}
                      style={{
                        padding: '0.6rem 0.8rem',
                        fontFamily: isSuppressed ? 'inherit' : 'monospace',
                        color: isSuppressed ? '#d97706' : 'var(--text-primary)',
                      }}
                    >
                      {String(row[agg] ?? '—')}
                    </td>
                  ))}
                  <td style={{ padding: '0.6rem 0.8rem', textAlign: 'center' }}>
                    {isSuppressed ? (
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: 'rgba(245, 158, 11, 0.2)',
                          color: '#d97706',
                        }}
                      >
                        Suppressed (k &lt; 10)
                      </span>
                    ) : (
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981',
                        }}
                      >
                        Safe Aggregate
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
