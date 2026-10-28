import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  CheckSquare,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Ban,
  CheckCircle2,
  Calendar,
  Share2,
  ArrowLeft,
} from 'lucide-react';
import {
  getSharedChecklistView,
  toggleSharedTask,
  HANDOFF_STATUSES,
} from '../services/journeyHandoffService';

const SharedChecklistView = () => {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    const res = getSharedChecklistView(token);
    setData(res);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleToggle = (taskId) => {
    try {
      toggleSharedTask(token, taskId);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="section container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading shared checklist...</p>
      </div>
    );
  }

  // --- REVOKED VIEW ---
  if (data?.status === HANDOFF_STATUSES.REVOKED) {
    return (
      <div className="section container" style={{ maxWidth: '640px', padding: '4rem 1rem', textAlign: 'center' }}>
        <div
          className="glass-panel"
          style={{
            padding: '2.5rem',
            borderRadius: '1.25rem',
            border: '1px solid #ef4444',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ban size={28} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
            Shared Link Revoked
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            This shared preparation checklist link was revoked by the citizen owner. For your privacy and security, access to these delegated tasks is no longer permitted.
          </p>
          {data.revokedAt && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
              Revoked on: {new Date(data.revokedAt).toLocaleString()}
            </div>
          )}
          <Link to="/" className="btn btn-secondary" style={{ marginTop: '0.5rem' }}>
            Go to Civic Help Setu Home
          </Link>
        </div>
      </div>
    );
  }

  // --- EXPIRED VIEW ---
  if (data?.status === HANDOFF_STATUSES.EXPIRED) {
    return (
      <div className="section container" style={{ maxWidth: '640px', padding: '4rem 1rem', textAlign: 'center' }}>
        <div
          className="glass-panel"
          style={{
            padding: '2.5rem',
            borderRadius: '1.25rem',
            border: '1px solid #f59e0b',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Clock size={28} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
            Shared Link Expired
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            This shared preparation checklist expired on {new Date(data.expiresAt).toLocaleDateString()}. To safeguard personal workflows, temporary shared links automatically expire after their scheduled window.
          </p>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-tertiary)', margin: 0 }}>
            Please contact the citizen if you need a refreshed preparation link.
          </p>
          <Link to="/" className="btn btn-secondary" style={{ marginTop: '0.5rem' }}>
            Return to Homepage
          </Link>
        </div>
      </div>
    );
  }

  // --- NOT FOUND VIEW ---
  if (data?.status === HANDOFF_STATUSES.NOT_FOUND) {
    return (
      <div className="section container" style={{ maxWidth: '640px', padding: '4rem 1rem', textAlign: 'center' }}>
        <div className="glass-panel" style={{ padding: '2.5rem', borderRadius: '1.25rem' }}>
          <AlertTriangle size={36} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.5rem' }}>
            Checklist Not Found
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            The link you opened is invalid or does not correspond to an active Civic Help Setu shared checklist.
          </p>
          <Link to="/" className="btn btn-secondary">
            Go to Civic Help Setu
          </Link>
        </div>
      </div>
    );
  }

  // --- ACTIVE HELPER CHECKLIST VIEW ---
  const totalTasks = data.tasks.length;
  const completedTasks = data.tasks.filter((t) => t.completed).length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="section container" style={{ maxWidth: '720px', paddingBottom: '4rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: 'var(--text-secondary)',
            fontSize: '0.85rem',
            fontWeight: '500',
          }}
        >
          <ArrowLeft size={16} /> Civic Help Setu Home
        </Link>
      </div>

      <div
        className="glass-panel"
        style={{
          borderRadius: '1.25rem',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          border: '1px solid var(--border-light)',
        }}
      >
        {/* Header */}
        <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: '700',
                padding: '0.2rem 0.55rem',
                borderRadius: '99px',
                background: 'rgba(56, 189, 248, 0.15)',
                color: 'var(--accent-main)',
                textTransform: 'uppercase',
              }}
            >
              Delegated to {data.recipientLabel || 'Trusted Helper'}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
              Service: {data.serviceName}
            </span>
          </div>

          <h1 style={{ fontSize: '1.65rem', fontWeight: '800', margin: '0.35rem 0 0', color: 'var(--text-primary)' }}>
            {data.title}
          </h1>
        </div>

        {/* Security & Data Isolation Callout */}
        <div
          style={{
            padding: '0.85rem 1rem',
            borderRadius: '0.65rem',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            display: 'flex',
            gap: '0.65rem',
            alignItems: 'flex-start',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.45,
          }}
        >
          <ShieldCheck size={18} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: '#10b981' }}>Limited Handoff Scope: </strong>
            {data.securityNotice}
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', marginBottom: '0.4rem' }}>
            <span style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>Preparation Progress</span>
            <span style={{ fontWeight: '700', color: 'var(--accent-main)' }}>
              {completedTasks} of {totalTasks} Tasks Completed ({progressPercent}%)
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: '10px',
              borderRadius: '99px',
              background: 'rgba(255, 255, 255, 0.08)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: progressPercent === 100 ? '#10b981' : 'var(--accent-main)',
                borderRadius: '99px',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        {/* Tasks Checklist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {data.tasks.map((task) => (
            <div
              key={task.id}
              onClick={() => handleToggle(task.id)}
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '0.65rem',
                border: '1px solid',
                borderColor: task.completed ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-light)',
                background: task.completed ? 'rgba(16, 185, 129, 0.05)' : 'rgba(0, 0, 0, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '0.4rem',
                  border: `2px solid ${task.completed ? '#10b981' : 'var(--text-tertiary)'}`,
                  background: task.completed ? '#10b981' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  flexShrink: 0,
                }}
              >
                {task.completed && <CheckCircle2 size={16} />}
              </div>

              <div style={{ flex: 1 }}>
                <span
                  style={{
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    color: task.completed ? 'var(--text-tertiary)' : 'var(--text-primary)',
                    textDecoration: task.completed ? 'line-through' : 'none',
                  }}
                >
                  {task.title}
                </span>
                {task.description && (
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {task.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Expiration Footnote */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            borderTop: '1px solid var(--border-light)',
            paddingTop: '1rem',
            fontSize: '0.78rem',
            color: 'var(--text-tertiary)',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div>
            <strong>Expires:</strong> {new Date(data.expiresAt).toLocaleString()}
          </div>
          <div>
            <strong>Created:</strong> {new Date(data.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SharedChecklistView;
