import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, Printer, Scale } from 'lucide-react';
import { Link } from 'react-router-dom';
import { comparisonService, NOT_AVAILABLE } from '../../services/comparisonService';
import { useModalKeyboard } from '../../hooks/useModalKeyboard';

export const ComparisonValue = ({ value }) => {
  if (!value || value.length === 0) {
    return <span className="compare-missing">{NOT_AVAILABLE}</span>;
  }
  if (value.length === 1) return <span>{value[0]}</span>;
  return (
    <ul className="compare-list">
      {value.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
};

const ServiceComparisonModal = ({ isOpen, onClose, comparedServices, onRemove, onClear }) => {
  const [highlightDiffs, setHighlightDiffs] = useState(false);
  const [showOnlyDiffs, setShowOnlyDiffs] = useState(false);
  const modalRef = useModalKeyboard(isOpen, onClose);

  if (!isOpen) return null;

  const matrix = comparisonService.buildComparisonMatrix(comparedServices);
  const diffSummary = comparisonService.getDifferencesSummary(comparedServices);

  const modal = (
    <div
      className="compare-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="compare-dialog animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-modal-title"
        tabIndex={-1}
      >
        <header className="compare-header">
          <div>
            <h2 id="compare-modal-title">Compare services</h2>
            <p>
              Comparing {comparedServices.length} of up to 3 services using the details listed in
              each service guide.
            </p>
          </div>
          <div className="compare-header-actions">
            <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
              <Printer size={16} aria-hidden="true" /> Print
            </button>
            <button type="button" className="compare-icon-btn" onClick={onClose} aria-label="Close comparison">
              <X size={22} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="compare-toolbar" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={highlightDiffs}
              onChange={(e) => setHighlightDiffs(e.target.checked)}
            />
            <span>Highlight rows that differ</span>
          </label>
          {comparedServices.length > 1 && (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showOnlyDiffs}
                onChange={(e) => setShowOnlyDiffs(e.target.checked)}
              />
              <span>Show only differences</span>
            </label>
          )}
          {diffSummary.totalRows > 0 && (
            <span style={{ fontSize: '0.78rem', padding: '0.2rem 0.6rem', borderRadius: '999px', background: 'rgba(56, 189, 248, 0.1)', color: 'var(--accent-main)', fontWeight: 600 }}>
              {diffSummary.differingRows} of {diffSummary.totalRows} fields differ
            </span>
          )}
          {comparedServices.length > 0 && (
            <button type="button" className="compare-link-btn" onClick={onClear} style={{ marginLeft: 'auto' }}>
              Clear all
            </button>
          )}
        </div>

        <div className="compare-body">
          {comparedServices.length === 0 ? (
            <div className="compare-empty">
              <Scale size={40} aria-hidden="true" />
              <p>No services selected for comparison.</p>
              <p>Tick Compare on up to 3 service cards to see them side by side.</p>
            </div>
          ) : (
            <table className="compare-table">
              <caption className="sr-only">Side-by-side comparison of selected services</caption>
              <thead>
                <tr>
                  <th scope="col">Detail</th>
                  {comparedServices.map((service) => (
                    <th scope="col" key={service.id}>
                      <div className="compare-col-head">
                        <span>{service.name}</span>
                        <button
                          type="button"
                          className="compare-icon-btn"
                          onClick={() => onRemove(service.id)}
                          aria-label={`Remove ${service.name} from comparison`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix
                  .filter((row) => {
                    if (!showOnlyDiffs) return true;
                    const differs = new Set(row.values.map((v) => v.join('\n'))).size > 1;
                    return differs;
                  })
                  .map((row) => {
                    const differs = new Set(row.values.map((v) => v.join('\n'))).size > 1;
                    return (
                      <tr key={row.attribute} className={highlightDiffs && differs ? 'compare-diff' : undefined}>
                        <th scope="row">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                            <span>{row.attribute}</span>
                            {differs && (
                              <span
                                className="compare-diff-badge"
                                aria-label="Attribute differs across services"
                                style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}
                              >
                                Differs
                              </span>
                            )}
                          </div>
                        </th>
                      {row.values.map((value, i) => (
                        <td key={comparedServices[i].id} data-label={comparedServices[i].name}>
                          <ComparisonValue value={value} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
                <tr>
                  <th scope="row">Full guide</th>
                  {comparedServices.map((service) => (
                    <td key={service.id} data-label={service.name}>
                      <Link to={`/services/${service.id}`} className="btn btn-primary" onClick={onClose}>
                        View guide
                      </Link>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );

  // Portal to body so the fixed overlay is not trapped by animated page ancestors.
  return typeof document === 'undefined' ? modal : createPortal(modal, document.body);
};

export default ServiceComparisonModal;
