import { useState, useEffect } from 'react';
import { Calendar, Trash2, CheckCircle2, AlertTriangle, ArrowRight, BookOpen } from 'lucide-react';
import { getSavedAssessments, getAssessmentsForApplicant, deleteAssessment } from '../../services/assessmentStorage';
import { useToast } from '../../context/ToastContext';
import { Link } from 'react-router-dom';
import GroundedEligibilityExplanationCard from './GroundedEligibilityExplanationCard';

const SavedAssessmentsList = ({
  refreshTrigger = 0,
  applicantId = null,
  applicantName = '',
}) => {
  const { toast } = useToast();
  const [assessments, setAssessments] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  // Only the selected applicant's records are shown, so one person's results never appear under another.
  const load = () => (applicantId ? getAssessmentsForApplicant(applicantId) : getSavedAssessments());

  useEffect(() => {
    setAssessments(load());
    setExpandedId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger, applicantId]);

  const handleDelete = (id) => {
    deleteAssessment(id);
    setAssessments(load());
    toast.info('Assessment record removed from profile.');
  };

  const whose = applicantName ? (
    <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
      Showing saved assessments for <strong>{applicantName}</strong>
    </p>
  ) : null;

  if (assessments.length === 0) {
    return (
      <>
        {whose}
        <div
          className="card"
          style={{
            textAlign: 'center',
            padding: '3rem 2rem',
            borderRadius: '1.25rem',
            background: 'var(--glass-bg)',
            border: '1px solid var(--border-light)',
          }}
        >
          <BookOpen size={36} color="var(--text-tertiary)" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: '700', margin: '0 0 0.5rem' }}>
            {applicantName ? `No saved assessments for ${applicantName}` : 'No Saved Eligibility Assessments'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto' }}>
            Run the interactive eligibility wizard and click "Save Assessment to Profile" to preserve your personalized entitlement records here.
          </p>
        </div>
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {whose}
      {assessments.map((item) => {
        const isExpanded = expandedId === item.id;
        return (
          <div
            key={item.id}
            className="card animate-fade-in"
            style={{
              padding: '1.25rem 1.5rem',
              borderRadius: '1rem',
              background: 'var(--glass-bg)',
              border: '1px solid var(--border-light)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <Calendar size={15} color="var(--accent-main)" />
                  <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                    Assessment on {item.date}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <span>Age: <strong>{item.profileSummary.age}</strong></span>
                  <span>•</span>
                  <span>Income: <strong>₹{Number(item.profileSummary.annualIncome).toLocaleString('en-IN')}/yr</strong></span>
                  <span>•</span>
                  <span>Category: <strong>{item.profileSummary.category}</strong></span>
                  <span>•</span>
                  <span>State: <strong>{item.profileSummary.state}</strong></span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span
                  style={{
                    fontSize: '0.78rem',
                    padding: '0.2rem 0.65rem',
                    borderRadius: '99px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    fontWeight: '700',
                  }}
                >
                  {item.eligibleCount} Qualified
                </span>

                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="btn btn-secondary"
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                >
                  {isExpanded ? 'Hide Details' : 'View Scheme Verdicts'}
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  title="Delete assessment"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    padding: '0.25rem',
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Expanded details */}
            {isExpanded && (
              <div
                style={{
                  marginTop: '1.25rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--border-light)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                {item.results?.map((res) => (
                  <div
                    key={res.schemeId}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '0.6rem',
                      background: 'rgba(0, 0, 0, 0.2)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{res.schemeName}</strong>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{res.reason}</p>
                      <GroundedEligibilityExplanationCard assessment={res} />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          color: res.status === 'eligible' ? '#10b981' : res.status === 'conditional' ? '#f59e0b' : res.status === 'unknown' ? 'var(--text-secondary)' : '#ef4444',
                          textTransform: 'uppercase',
                        }}
                      >
                        {res.status}
                      </span>
                      <Link
                        to={res.actionLink || '/services'}
                        style={{ color: 'var(--accent-main)', display: 'flex', alignItems: 'center' }}
                      >
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SavedAssessmentsList;
