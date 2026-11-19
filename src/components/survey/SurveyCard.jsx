import React from 'react';
import {
  ShieldCheck,
  Calendar,
  Users,
  Activity,
  FileText,
  Edit3,
  CheckCircle,
  Clock,
  Send,
} from 'lucide-react';
import { SURVEY_STATUS } from '../../data/surveyContract.js';

const getStatusBadge = (status) => {
  switch (status) {
    case SURVEY_STATUS.PUBLISHED:
      return { label: 'Active Consultation', bg: 'rgba(16, 185, 129, 0.12)', color: '#10b981', icon: CheckCircle };
    case SURVEY_STATUS.DRAFT:
      return { label: 'Draft', bg: 'rgba(107, 114, 128, 0.15)', color: '#9ca3af', icon: Clock };
    case SURVEY_STATUS.UNDER_REVIEW:
      return { label: 'Under Review', bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', icon: Clock };
    case SURVEY_STATUS.PAUSED:
      return { label: 'Paused', bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', icon: Clock };
    case SURVEY_STATUS.CLOSED:
      return { label: 'Consultation Closed', bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', icon: CheckCircle };
    default:
      return { label: status, bg: 'var(--glass-bg)', color: 'var(--text-secondary)', icon: Clock };
  }
};

const SurveyCard = ({
  survey,
  responseCount = 0,
  onTakeSurvey,
  onOpenDiagnostics,
  onOpenCodebook,
  onEditSurvey,
}) => {
  const badge = getStatusBadge(survey.status);
  const StatusIcon = badge.icon;
  const target = survey.samplingTarget?.totalTarget || 100;
  const progressPct = Math.min(100, Math.round((responseCount / target) * 100));

  const isPublished = survey.status === SURVEY_STATUS.PUBLISHED;

  return (
    <article
      className="card"
      style={{
        padding: '1.25rem',
        background: 'var(--bg-card)',
        borderRadius: '1rem',
        border: '1px solid var(--border-light)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'transform 0.15s, border-color 0.15s',
      }}
      aria-labelledby={`survey-title-${survey.id}`}
    >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <span
            style={{
              padding: '0.2rem 0.55rem',
              borderRadius: '99px',
              fontSize: '0.75rem',
              fontWeight: 700,
              background: badge.bg,
              color: badge.color,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            <StatusIcon size={12} /> {badge.label}
          </span>

          {survey.anonymousMode && (
            <span
              style={{
                fontSize: '0.72rem',
                color: 'var(--text-tertiary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
              title="Anonymous response mode enabled: answers are separated from consent tokens"
            >
              <ShieldCheck size={13} color="var(--accent-main)" /> Anonymous Mode
            </span>
          )}
        </div>

        <h3
          id={`survey-title-${survey.id}`}
          style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}
        >
          {survey.title}
        </h3>

        <p style={{ fontSize: '0.82rem', color: 'var(--accent-main)', fontWeight: 600, marginBottom: '0.4rem' }}>
          {survey.department}
        </p>

        <p
          style={{
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            lineHeight: '1.45',
            marginBottom: '1rem',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {survey.description}
        </p>

        {/* Quota Progress */}
        <div style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: '0.5rem', background: 'var(--glass-bg)', border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <Users size={13} /> Sampling Target
            </span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
              {responseCount} / {target} ({progressPct}%)
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: '6px',
              borderRadius: '99px',
              background: 'var(--border-light)',
              overflow: 'hidden',
            }}
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-label="Survey target progress"
          >
            <div
              style={{
                width: `${progressPct}%`,
                height: '100%',
                background: progressPct >= 100 ? '#10b981' : 'var(--accent-main)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        {/* Collection Window & Jurisdiction */}
        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1.25rem' }}>
          {survey.collectionWindow?.endDate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Calendar size={13} /> Closes: {new Date(survey.collectionWindow.endDate).toLocaleDateString()}
            </div>
          )}
          {survey.jurisdiction?.ward && (
            <div>Jurisdiction: {survey.jurisdiction.ward}, {survey.jurisdiction.state}</div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.85rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: isPublished ? '1fr 1fr' : '1fr', gap: '0.5rem' }}>
          {isPublished && (
            <button
              type="button"
              onClick={() => onTakeSurvey(survey)}
              className="btn btn-primary"
              style={{ fontSize: '0.82rem', padding: '0.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
            >
              <Send size={14} /> Respond
            </button>
          )}

          <button
            type="button"
            onClick={() => onOpenDiagnostics(survey)}
            className="btn btn-secondary"
            style={{ fontSize: '0.82rem', padding: '0.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
          >
            <Activity size={14} color="var(--accent-main)" /> Quality &amp; Bias
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => onOpenCodebook(survey)}
            className="btn btn-outline"
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
            title="Export variable codebook in CSV / JSON"
          >
            <FileText size={12} /> Codebook
          </button>

          <button
            type="button"
            onClick={() => onEditSurvey(survey)}
            className="btn btn-outline"
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
            title="Open Builder Editor"
          >
            <Edit3 size={12} /> Edit / Review
          </button>
        </div>
      </div>
    </article>
  );
};

export default SurveyCard;

