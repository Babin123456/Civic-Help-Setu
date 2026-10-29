import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Lock,
  Layers,
  Filter,
} from 'lucide-react';
import {
  getAggregatedBarrierInsights,
  getAllBarrierReports,
  moderateBarrierReport,
  BARRIER_CATEGORY_LABELS,
  BARRIER_STATUS,
} from '../../services/barrierReportService';
import { useAuth } from '../../context/AuthContext';
import { can } from '../../services/accessControl';
import { useToast } from '../../context/ToastContext';

const BarrierInsightsDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('insights'); // 'insights' | 'moderation'
  const [reports, setReports] = useState([]);
  const [moderationNotes, setModerationNotes] = useState({});

  const isModerator = can('barriers.moderate', user);

  const refreshData = () => {
    setReports(getAllBarrierReports());
  };

  useEffect(() => {
    refreshData();
  }, []);

  const insights = useMemo(() => {
    return getAggregatedBarrierInsights();
  }, [reports]);

  const pendingReports = useMemo(() => {
    return reports.filter((r) => r.status === BARRIER_STATUS.PENDING_MODERATION);
  }, [reports]);

  const handleModerate = (reportId, action) => {
    try {
      const notes = moderationNotes[reportId] || '';
      moderateBarrierReport({
        reportId,
        action,
        reviewerNotes: notes,
        reviewerName: user?.username || 'Community Moderator',
      });

      toast?.success?.(
        action === 'approve'
          ? 'Barrier report approved and added to anonymous public insights.'
          : 'Barrier report rejected.'
      );
      refreshData();
    } catch (err) {
      toast?.error?.(err.message || 'Failed to moderate report.');
    }
  };

  return (
    <div
      className="barrier-insights-dashboard card-glass animate-fade-in"
      style={{
        borderRadius: '1.25rem',
        background: 'var(--bg-card, #111827)',
        border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
        padding: '1.75rem',
        marginBottom: '2rem',
      }}
      role="region"
      aria-label="Citizen Service Barrier Insights Dashboard"
    >
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: '#f59e0b',
              fontSize: '0.8rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '0.35rem',
            }}
          >
            <BarChart3 size={16} aria-hidden="true" />
            Systemic Accessibility Intelligence
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            Service Barrier Insights Dashboard
          </h3>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Aggregated, privacy-conscious citizen reports highlighting ground obstacles across public services.
          </p>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'inline-flex',
            background: 'var(--glass-bg)',
            padding: '0.25rem',
            borderRadius: '0.6rem',
            border: '1px solid var(--border-light)',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('insights')}
            style={{
              padding: '0.4rem 0.9rem',
              borderRadius: '0.45rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: activeTab === 'insights' ? 'var(--accent-main)' : 'transparent',
              color: activeTab === 'insights' ? '#000000' : 'var(--text-secondary)',
            }}
          >
            Aggregated Insights ({insights.approvedCount})
          </button>

          {isModerator && (
            <button
              type="button"
              onClick={() => setActiveTab('moderation')}
              style={{
                padding: '0.4rem 0.9rem',
                borderRadius: '0.45rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                background: activeTab === 'moderation' ? 'var(--accent-main)' : 'transparent',
                color: activeTab === 'moderation' ? '#000000' : 'var(--text-secondary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <ShieldCheck size={14} />
              <span>Moderation Queue ({pendingReports.length})</span>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'insights' ? (
        <div>
          {/* Key Metric KPI Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            <div
              style={{
                background: 'var(--bg-card-hover, rgba(255, 255, 255, 0.03))',
                borderRadius: '0.85rem',
                padding: '1rem',
                border: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Moderated Barriers
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981', marginTop: '0.2rem' }}>
                {insights.approvedCount}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Verified citizen reports</div>
            </div>

            <div
              style={{
                background: 'var(--bg-card-hover, rgba(255, 255, 255, 0.03))',
                borderRadius: '0.85rem',
                padding: '1rem',
                border: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Pending in Moderation
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.2rem' }}>
                {insights.pendingCount}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Awaiting review</div>
            </div>

            <div
              style={{
                background: 'var(--bg-card-hover, rgba(255, 255, 255, 0.03))',
                borderRadius: '0.85rem',
                padding: '1rem',
                border: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Top Barrier Category
              </div>
              <div
                style={{
                  fontSize: '1rem',
                  fontWeight: 800,
                  color: 'var(--accent-main)',
                  marginTop: '0.4rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {insights.categoryBreakdown[0]?.count > 0
                  ? insights.categoryBreakdown[0]?.label
                  : 'No verified reports yet'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                {insights.categoryBreakdown[0]?.count || 0} incidents ({insights.categoryBreakdown[0]?.percentage || 0}%)
              </div>
            </div>
          </div>

          {/* Aggregated Category Breakdown Progress Bars */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.85rem' }}>
              Barrier Distribution by Structured Category
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {insights.categoryBreakdown.map((item) => (
                <div
                  key={item.categoryKey}
                  style={{
                    background: 'var(--bg-card-hover, rgba(255, 255, 255, 0.02))',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.65rem',
                    border: '1px solid var(--border-light, rgba(255, 255, 255, 0.06))',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      marginBottom: '0.35rem',
                    }}
                  >
                    <span>{item.label}</span>
                    <span style={{ color: 'var(--accent-main)' }}>
                      {item.count} ({item.percentage}%)
                    </span>
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: '6px',
                      borderRadius: '999px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${item.percentage}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #38bdf8, #10b981)',
                        borderRadius: '999px',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Privacy Safeguard Notice (Mandatory Acceptance Criteria) */}
          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '0.75rem',
              background: 'rgba(56, 189, 248, 0.05)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <ShieldCheck size={16} color="var(--accent-main)" style={{ flexShrink: 0 }} />
            <span>{insights.dataPrivacyNotice}</span>
          </div>
        </div>
      ) : (
        /* Moderation Queue Tab (Permission Checked) */
        <div>
          <div style={{ marginBottom: '1rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Review pending citizen barrier submissions. Only approved reports appear in public aggregated metrics.
          </div>

          {pendingReports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-tertiary)' }}>
              <CheckCircle2 size={32} color="#10b981" style={{ margin: '0 auto 0.5rem auto' }} />
              <div>All citizen barrier reports have been reviewed!</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {pendingReports.map((report) => (
                <div
                  key={report.id}
                  style={{
                    background: 'var(--bg-card-hover, rgba(255, 255, 255, 0.03))',
                    borderRadius: '0.75rem',
                    border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
                    padding: '1rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '0.5rem',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '0.4rem',
                          background: 'rgba(245, 158, 11, 0.15)',
                          color: '#f59e0b',
                        }}
                      >
                        {BARRIER_CATEGORY_LABELS[report.barrierCategory] || report.barrierCategory}
                      </span>
                      <h5 style={{ margin: '0.35rem 0 0 0', fontSize: '1rem', fontWeight: 700 }}>
                        {report.serviceName} ({report.department})
                      </h5>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                      Ref: {report.trackingCode} • {new Date(report.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {report.description && (
                    <div
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                        background: 'rgba(0,0,0,0.2)',
                        padding: '0.6rem 0.8rem',
                        borderRadius: '0.5rem',
                        margin: '0.5rem 0',
                      }}
                    >
                      {report.description}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleModerate(report.id, 'approve')}
                      style={{
                        fontSize: '0.78rem',
                        background: '#10b981',
                        borderColor: '#10b981',
                        color: '#ffffff',
                      }}
                    >
                      <CheckCircle2 size={13} style={{ marginRight: '0.3rem' }} /> Approve & Aggregate
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleModerate(report.id, 'reject')}
                      style={{ fontSize: '0.78rem' }}
                    >
                      <XCircle size={13} style={{ marginRight: '0.3rem' }} /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BarrierInsightsDashboard;
