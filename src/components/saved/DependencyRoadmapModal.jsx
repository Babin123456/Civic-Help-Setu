import { useEffect } from 'react';
import { X, GitMerge, Clock, ArrowRight, ShieldCheck, AlertCircle, Printer, CheckCircle2 } from 'lucide-react';
import { buildDependencyRoadmap } from '../../services/savedDependencyRoadmapService';

export default function DependencyRoadmapModal({ savedServices = [], isOpen, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const roadmap = buildDependencyRoadmap(savedServices);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="roadmap-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="card animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-main)',
          border: '1px solid var(--border-main)',
          borderRadius: '1rem',
          padding: '1.75rem',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '2.4rem',
                height: '2.4rem',
                borderRadius: '0.6rem',
                background: 'rgba(168, 85, 247, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#a855f7',
              }}
            >
              <GitMerge size={20} />
            </div>
            <div>
              <h2 id="roadmap-modal-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                Prerequisite Dependency Roadmap Planner
              </h2>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Sequential application ordering &amp; prerequisite timeline for {savedServices.length} saved guide(s).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close roadmap modal"
            className="btn-icon"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: '0.4rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Overview Banner */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: '0.75rem',
            background: 'var(--glass-bg)',
            border: '1px solid var(--border-light)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
              Total Cumulative Execution Timeline
            </span>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--accent-main)' }}>
              ~{roadmap.totalEstimatedDays} Days
              <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                ({roadmap.stages.length} Application Phases)
              </span>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handlePrint}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
          >
            <Printer size={15} /> Print Roadmap Plan
          </button>
        </div>

        {/* Roadmap Phases */}
        {roadmap.stages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)' }}>
            No saved services found to construct a prerequisite roadmap.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {roadmap.stages.map((stage) => (
              <div
                key={stage.stageNumber}
                style={{
                  borderRadius: '0.75rem',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-card)',
                  padding: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '99px',
                        background: stage.stageNumber === 1 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: stage.stageNumber === 1 ? '#10b981' : '#f59e0b',
                      }}
                    >
                      Step {stage.stageNumber}
                    </span>
                    <h3 style={{ margin: '0.4rem 0 0.2rem', fontSize: '1.05rem', fontWeight: 700 }}>
                      {stage.title}
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {stage.description}
                    </p>
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-main)', whiteSpace: 'nowrap' }}>
                    Est. {stage.phaseDays} Days
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.85rem' }}>
                  {stage.services.map((svc) => (
                    <div
                      key={svc.id}
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '0.5rem',
                        background: 'var(--glass-bg)',
                        border: '1px solid var(--border-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{svc.name}</span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                            ({svc.processingTime})
                          </span>
                        </div>
                        {svc.internalPrereqs.length > 0 && (
                          <div style={{ fontSize: '0.76rem', color: '#f59e0b', marginTop: '0.2rem' }}>
                            Prerequisite needed: {svc.internalPrereqs.join(', ')}
                          </div>
                        )}
                      </div>

                      <span
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.6rem',
                          borderRadius: '99px',
                          background: svc.isBlocked ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                          color: svc.isBlocked ? '#ef4444' : '#10b981',
                        }}
                      >
                        {svc.isBlocked ? 'Blocked Until Phase 1' : 'Ready to Apply'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ fontSize: '0.85rem' }}
          >
            Close Roadmap
          </button>
        </div>
      </div>
    </div>
  );
}
