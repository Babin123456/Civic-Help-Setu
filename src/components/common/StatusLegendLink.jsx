import { useState, useEffect } from 'react';
import { BookOpen, X, ExternalLink } from 'lucide-react';
import { createPortal } from 'react-dom';
import StatusLegend from './StatusLegend';
import './StatusLegendLink.css';

const StatusLegendLink = ({
  categories,
  triggerLabel = 'View status legend',
  showIcon = true,
  className = '',
  modalTitle = 'Status & Terminology Legend',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) {
      setIsOpen(false);
    }
  };

  const modalContent = (
    <div
      className="status-legend-modal-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="status-legend-modal-title"
    >
      <div className="status-legend-modal" onClick={(e) => e.stopPropagation()}>
        <header className="status-legend-modal__header">
          <h2 id="status-legend-modal-title" className="status-legend-modal__title">
            <BookOpen size={22} aria-hidden="true" />
            {modalTitle}
          </h2>
          <button
            type="button"
            className="status-legend-modal__close"
            onClick={() => setIsOpen(false)}
            aria-label="Close status legend"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="status-legend-modal__content">
          <StatusLegend categories={categories} showHeader={false} />
        </div>
        <footer className="status-legend-modal__footer">
          <p className="status-legend-modal__disclaimer">
            <ExternalLink size={14} aria-hidden="true" />
            Civic Help Setu is an independent platform. Status labels reflect our assessment of public data, not official government decisions.{' '}
            <a
              href="https://github.com/GoldRay19/Civic-Help-Setu"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--accent-main)',
                textDecoration: 'underline',
                fontWeight: '600',
              }}
            >
              View on GitHub
            </a>
          </p>
        </footer>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        className={`status-legend-link ${className}`}
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-label={triggerLabel}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.375rem 0.75rem',
          fontSize: '0.8125rem',
          fontWeight: '500',
          color: 'var(--accent-main)',
          background: 'rgba(56, 189, 248, 0.1)',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          borderRadius: '99px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          textDecoration: 'none',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)';
          e.currentTarget.style.borderColor = 'var(--accent-main)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)';
          e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.2)';
        }}
      >
        {showIcon && <BookOpen size={14} aria-hidden="true" />}
        {triggerLabel}
      </button>
      {isOpen && createPortal(modalContent, document.body)}
    </>
  );
};

export default StatusLegendLink;