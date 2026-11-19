export default function AccessibleCohortTable({ notices = [], flags = [] }) {
  const categories = ['works', 'goods', 'services', 'consultancy'];

  return (
    <div
      className="card cohort-table-card"
      style={{
        padding: '1.25rem',
        borderRadius: '0.75rem',
        border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
        background: 'var(--bg-card, #1e293b)',
        color: 'var(--text-primary)',
        marginTop: '1.5rem',
      }}
    >
      <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>
        Accessible Procurement Distribution &amp; Anomaly Matrix
      </h3>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 1rem 0' }}>
        Tabular breakdown of published notices, aggregate values, and detected red-flag anomalies per category.
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table
          className="accessible-cohort-table"
          style={{
            width: '100%',
            fontSize: '0.85rem',
            borderCollapse: 'collapse',
            textAlign: 'left',
          }}
        >
          <caption className="sr-only" style={{ display: 'none' }}>
            Comparison of procurement notices, estimated expenditures, and flagged patterns by category
          </caption>
          <thead>
            <tr style={{ borderBottom: '2px solid rgba(255, 255, 255, 0.15)', color: 'var(--text-muted)' }}>
              <th scope="col" style={{ padding: '0.5rem 0.75rem' }}>Procurement Category</th>
              <th scope="col" style={{ padding: '0.5rem 0.75rem' }}>Notices Published</th>
              <th scope="col" style={{ padding: '0.5rem 0.75rem' }}>Total Estimated Value</th>
              <th scope="col" style={{ padding: '0.5rem 0.75rem' }}>Detected Anomalies</th>
              <th scope="col" style={{ padding: '0.5rem 0.75rem' }}>Anomaly Rate</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((catKey) => {
              const catNotices = notices.filter((n) => n.category === catKey);
              const catTotalVal = catNotices.reduce((sum, n) => sum + Number(n.estimatedValue || 0), 0);
              const catFlags = flags.filter((f) => f.category === catKey);
              const rate = catNotices.length > 0 ? ((catFlags.length / catNotices.length) * 100).toFixed(0) : 0;

              return (
                <tr key={catKey} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <th scope="row" style={{ padding: '0.5rem 0.75rem', fontWeight: 600, textTransform: 'capitalize' }}>
                    {catKey}
                  </th>
                  <td style={{ padding: '0.5rem 0.75rem' }}>{catNotices.length}</td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>₹{catTotalVal.toLocaleString('en-IN')}</td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    {catFlags.length > 0 ? (
                      <span style={{ color: '#f87171', fontWeight: 600 }}>{catFlags.length} flags</span>
                    ) : (
                      <span style={{ color: '#4ade80' }}>0 flags</span>
                    )}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>{rate}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
