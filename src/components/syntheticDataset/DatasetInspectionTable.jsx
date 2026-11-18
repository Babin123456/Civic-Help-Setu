import { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, FileText, AlertCircle, Building2, BookOpen } from 'lucide-react';

export default function DatasetInspectionTable({ bundle }) {
  const [activeTab, setActiveTab] = useState('applications');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const currentList = useMemo(() => {
    if (!bundle) return [];
    if (activeTab === 'applications') return bundle.applications || [];
    if (activeTab === 'grievances') return bundle.grievances || [];
    if (activeTab === 'services') return bundle.services || [];
    if (activeTab === 'offices') return bundle.offices || [];
    return [];
  }, [bundle, activeTab]);

  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return currentList;
    const q = searchQuery.toLowerCase();
    return currentList.filter((item) => {
      const matchId = item.id?.toLowerCase().includes(q);
      const matchName = (item.applicantPseudonym || item.name || item.title || '').toLowerCase().includes(q);
      const matchStatus = (item.status || item.category || '').toLowerCase().includes(q);
      return matchId || matchName || matchStatus;
    });
  }, [currentList, searchQuery]);

  const totalPages = Math.ceil(filteredList.length / pageSize) || 1;
  const paginatedList = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, page, pageSize]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchQuery('');
    setPage(1);
  };

  return (
    <section aria-labelledby="dataset-records-heading" style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.85rem', marginBottom: '1rem' }}>
        <h2 id="dataset-records-heading" style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
          Generated Civic Records Inspection
        </h2>

        {/* Tab switcher */}
        <div
          role="tablist"
          aria-label="Civic entity views"
          style={{
            display: 'flex',
            gap: '0.25rem',
            background: 'var(--bg-secondary, #f1f5f9)',
            padding: '0.25rem',
            borderRadius: '0.5rem',
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'applications'}
            onClick={() => handleTabChange('applications')}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '0.4rem',
              border: 'none',
              background: activeTab === 'applications' ? 'var(--bg-card, #ffffff)' : 'transparent',
              fontWeight: activeTab === 'applications' ? 600 : 500,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              boxShadow: activeTab === 'applications' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            <FileText size={14} aria-hidden="true" />
            Applications ({bundle?.applications?.length || 0})
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'grievances'}
            onClick={() => handleTabChange('grievances')}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '0.4rem',
              border: 'none',
              background: activeTab === 'grievances' ? 'var(--bg-card, #ffffff)' : 'transparent',
              fontWeight: activeTab === 'grievances' ? 600 : 500,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              boxShadow: activeTab === 'grievances' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            <AlertCircle size={14} aria-hidden="true" />
            Grievances ({bundle?.grievances?.length || 0})
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'services'}
            onClick={() => handleTabChange('services')}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '0.4rem',
              border: 'none',
              background: activeTab === 'services' ? 'var(--bg-card, #ffffff)' : 'transparent',
              fontWeight: activeTab === 'services' ? 600 : 500,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              boxShadow: activeTab === 'services' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            <BookOpen size={14} aria-hidden="true" />
            Services ({bundle?.services?.length || 0})
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'offices'}
            onClick={() => handleTabChange('offices')}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '0.4rem',
              border: 'none',
              background: activeTab === 'offices' ? 'var(--bg-card, #ffffff)' : 'transparent',
              fontWeight: activeTab === 'offices' ? 600 : 500,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              boxShadow: activeTab === 'offices' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            <Building2 size={14} aria-hidden="true" />
            Offices ({bundle?.offices?.length || 0})
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '360px' }}>
          <Search size={15} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary, #94a3b8)' }} aria-hidden="true" />
          <input
            type="search"
            placeholder={`Filter ${activeTab} by ID, name, or status...`}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            aria-label={`Search ${activeTab}`}
            style={{
              width: '100%',
              padding: '0.4rem 0.65rem 0.4rem 2.1rem',
              borderRadius: '0.45rem',
              border: '1px solid var(--border-light, #cbd5e1)',
              fontSize: '0.85rem',
              background: 'var(--bg-card, #ffffff)',
            }}
          />
        </div>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #64748b)', alignSelf: 'center' }}>
          Showing {filteredList.length} of {currentList.length} records
        </span>
      </div>

      {/* Table presentation */}
      <div
        style={{
          border: '1px solid var(--border-light, #cbd5e1)',
          borderRadius: '0.65rem',
          overflowX: 'auto',
          background: 'var(--bg-card, #ffffff)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
          <caption style={{ textAlign: 'left', padding: '0.5rem 0.85rem', fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-tertiary, #94a3b8)' }}>
            List of {activeTab} generated with seed {bundle?.seed}
          </caption>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-light, #cbd5e1)', background: 'var(--bg-secondary, #f8fafc)' }}>
              <th scope="col" style={{ padding: '0.65rem 0.85rem', fontWeight: 600 }}>Record ID</th>
              {activeTab === 'applications' && (
                <>
                  <th scope="col" style={{ padding: '0.65rem 0.85rem', fontWeight: 600 }}>Applicant (Pseudonym)</th>
                  <th scope="col" style={{ padding: '0.65rem 0.85rem', fontWeight: 600 }}>Service Guide</th>
                  <th scope="col" style={{ padding: '0.65rem 0.85rem', fontWeight: 600 }}>Status</th>
                  <th scope="col" style={{ padding: '0.65rem 0.85rem', fontWeight: 600 }}>Applied Date</th>
                  <th scope="col" style={{ padding: '0.65rem 0.85rem', fontWeight: 600 }}>Timeline Steps</th>
                </>
              )}
              {activeTab === 'grievances' && (
                <>
                  <th scope="col" style={{ padding: '0.65rem 0.85rem', fontWeight: 600 }}>Category & Title</th>
                  <th scope="col" style={{ padding: '0.65rem 0.85rem', fontWeight: 600 }}>Severity</th>
                  <th scope="col" style={{ padding: '0.65rem 0.85rem', fontWeight: 600 }}>Status</th>
                  <th scope="col" style={{ padding: '0.65rem 0.85rem', fontWeight: 600 }}>Escalation Level</th>
                </>
              )}
              {activeTab === 'services' && (
                <>
                  <th scope="col" style={{ padding: '0.65rem 0.85rem', fontWeight: 600 }}>Service Title</th>
                  <th scope="col" style={{ padding: '0.65rem 0.85rem', fontWeight: 600 }}>Category</th>
                  <th scope="col" style={{ padding: '0.65rem 0.85rem', fontWeight: 600 }}>Department</th>
                  <th scope="col" style={{ padding: '0.65rem 0.85rem', fontWeight: 600 }}>SLA (Days)</th>
                  <th scope="col" style={{ padding: '0.65rem 0.85rem', fontWeight: 600 }}>Statutory Fee</th>
                </>
              )}
              {activeTab === 'offices' && (
                <>
                  <th scope="col" style={{ padding: '0.65rem 0.85rem', fontWeight: 600 }}>Office Name</th>
                  <th scope="col" style={{ padding: '0.65rem 0.85rem', fontWeight: 600 }}>Type</th>
                  <th scope="col" style={{ padding: '0.65rem 0.85rem', fontWeight: 600 }}>Ward / District</th>
                  <th scope="col" style={{ padding: '0.65rem 0.85rem', fontWeight: 600 }}>PIN Code</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {paginatedList.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary, #64748b)' }}>
                  No matching records found.
                </td>
              </tr>
            ) : (
              paginatedList.map((row) => (
                <tr key={row.id} style={{ borderBottom: '1px solid var(--border-light, #f1f5f9)' }}>
                  <th scope="row" style={{ padding: '0.55rem 0.85rem', fontWeight: 600, fontFamily: 'monospace' }}>
                    {row.id}
                  </th>

                  {activeTab === 'applications' && (
                    <>
                      <td style={{ padding: '0.55rem 0.85rem' }}>
                        <div>{row.applicantPseudonym}</div>
                        {row.applicantLanguage !== 'en' && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary, #94a3b8)' }}>
                            ({row.applicantLatinName})
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.55rem 0.85rem' }}>{row.serviceName}</td>
                      <td style={{ padding: '0.55rem 0.85rem' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '999px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            background:
                              row.status === 'APPROVED'
                                ? 'rgba(16, 185, 129, 0.12)'
                                : row.status === 'REJECTED'
                                ? 'rgba(239, 68, 68, 0.12)'
                                : 'rgba(245, 158, 11, 0.12)',
                            color:
                              row.status === 'APPROVED'
                                ? '#065f46'
                                : row.status === 'REJECTED'
                                ? '#991b1b'
                                : '#92400e',
                          }}
                        >
                          {row.status}
                        </span>
                        {row.isOverdue && (
                          <span style={{ display: 'block', fontSize: '0.68rem', color: '#b91c1c', fontWeight: 600, marginTop: '0.15rem' }}>
                            Breached SLA
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.55rem 0.85rem' }}>{row.appliedDate}</td>
                      <td style={{ padding: '0.55rem 0.85rem' }}>{row.timeline?.length || 0} events</td>
                    </>
                  )}

                  {activeTab === 'grievances' && (
                    <>
                      <td style={{ padding: '0.55rem 0.85rem' }}>{row.title}</td>
                      <td style={{ padding: '0.55rem 0.85rem' }}>
                        <span style={{ fontWeight: 600, color: row.severity === 'CRITICAL' ? '#b91c1c' : '#475569' }}>
                          {row.severity}
                        </span>
                      </td>
                      <td style={{ padding: '0.55rem 0.85rem' }}>{row.status}</td>
                      <td style={{ padding: '0.55rem 0.85rem', fontSize: '0.75rem' }}>{row.escalationLevel}</td>
                    </>
                  )}

                  {activeTab === 'services' && (
                    <>
                      <td style={{ padding: '0.55rem 0.85rem', fontWeight: 500 }}>{row.name}</td>
                      <td style={{ padding: '0.55rem 0.85rem' }}>{row.category}</td>
                      <td style={{ padding: '0.55rem 0.85rem' }}>{row.department}</td>
                      <td style={{ padding: '0.55rem 0.85rem' }}>{row.statutoryDays} days</td>
                      <td style={{ padding: '0.55rem 0.85rem' }}>{row.fee === 0 ? 'Exempt' : `₹${row.fee}`}</td>
                    </>
                  )}

                  {activeTab === 'offices' && (
                    <>
                      <td style={{ padding: '0.55rem 0.85rem', fontWeight: 500 }}>{row.name}</td>
                      <td style={{ padding: '0.55rem 0.85rem' }}>{row.type}</td>
                      <td style={{ padding: '0.55rem 0.85rem' }}>{row.ward}, {row.district}</td>
                      <td style={{ padding: '0.55rem 0.85rem', fontFamily: 'monospace' }}>{row.pincode}</td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #64748b)' }}>
            Page {page} of {totalPages}
          </span>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="btn btn-secondary"
              style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
              aria-label="Previous page"
            >
              <ChevronLeft size={14} aria-hidden="true" />
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="btn btn-secondary"
              style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
              aria-label="Next page"
            >
              Next
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
