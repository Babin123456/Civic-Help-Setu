/**
 * CoachDashboard - Main dashboard for the Multi-Agent Office Visit Preparation and Follow-Up Coach.
 * 
 * Provides the central UI for:
 * - Viewing/editing visit preparation plans
 * - Managing printable checklists
 * - Recording visit outcomes with explicit approval
 * - Tracking office data verification status
 * - Accessing question prompts and guidance
 * 
 * Engineering constraints:
 * - Accessible, mobile-first design
 * - Non-AI fallback for essential workflows (all classification is deterministic)
 * - Explicit human approval for outcome recording
 * - No autonomous filing or benefit denial
 */

import { useState, useMemo } from 'react';
import { inferOfficeType } from '../../../services/physicalVisitDossierService';
import {
  COACH_CONSTANTS,
  generateVisitPlan,
  updateVisitOutcome,
} from '../multiAgentOfficeCoachService';
import { CONFIRM_WITH_DEPARTMENT } from '../../../services/makeChecklistService';
import { SAMPLE_RTO_SERVICE } from '../__fixtures__/sample-service-all';

const STATUS_LABELS = {
  PENDING_VISIT: 'Preparing for visit',
  COMPLETED: 'Visit completed',
  RESCHEDULED: 'Rescheduled',
  TOKEN_ISSUED: 'Token issued',
  ADDITIONAL_DOCS_REQUESTED: 'Additional documents requested',
  CANCELLED: 'Cancelled',
};

/**
 * Main Coach Dashboard component
 * @param {Object} props - Component props
 * @param {Object} props.service - Civic service record
 * @param {Object} props.office - Office location record
 * @param {string} [props.citizenId] - Opaque citizen identifier
 * @returns {JSX} Coach dashboard UI
 */
const CoachDashboard = ({ service, office, citizenId }) => {
  const [selectedService, setSelectedService] = useState(service);
  const currentService = service || selectedService;
  const [showUserNotes, setShowUserNotes] = useState(false);
  const [planOverride, setPlanOverride] = useState(null);

  const generatedPlan = useMemo(() => {
    if (!currentService) return null;
    return generateVisitPlan({
      service: currentService,
      office,
      citizenContext: { citizenId },
      includeUserNotes: showUserNotes,
    });
  }, [currentService, office, citizenId, showUserNotes]);

  const displayPlan = planOverride || generatedPlan;

  const officeDataStatus = useMemo(() => {
    if (displayPlan?.officeDataStatus) {
      return displayPlan.officeDataStatus.toLowerCase();
    }
    if (currentService?.lastVerified) {
      const lastVerified = new Date(currentService.lastVerified);
      const now = new Date();
      const diffDays = (now - lastVerified) / (1000 * 60 * 60 * 24);
      return diffDays <= COACH_CONSTANTS.OFFICE_DATA_TTL_DAYS ? 'fresh' : 'stale';
    }
    return 'unverified';
  }, [displayPlan, currentService]);

  // Handle outcome recording
  const handleRecordOutcome = async (outcomeStatus, outcomeNotes, approved) => {
    if (!displayPlan) return;

    try {
      const updatedOutcome = updateVisitOutcome(
        displayPlan.outcome,
        {
          status: outcomeStatus,
          outcome: outcomeStatus,
          outcomeNotes: outcomeNotes || displayPlan.outcome.outcomeNotes,
        },
        approved
      );

      // Update the plan state
      const updatedPlan = {
        ...displayPlan,
        outcome: {
          ...displayPlan.outcome,
          ...updatedOutcome,
          status: updatedOutcome.status,
          outcome: updatedOutcome.outcome,
          outcomeNotes: updatedOutcome.outcomeNotes,
        },
        provenance: {
          ...displayPlan.provenance,
          lastModifiedBy: 'citizen-dashboard',
          lastModifiedAt: new Date().toISOString(),
        },
      };

      setPlanOverride(updatedPlan);
    } catch (err) {
      console.error('Failed to record outcome:', err);
      // User-facing error: explicit approval required
      alert(
        'Explicit approval required: Outcome recording is a high-impact action. ' +
        'Please confirm that you want to record this visit result.'
      );
    }
  };

  // Printable HTML
  const handlePrintHtml = () => {
    if (!displayPlan) return;
    const html = displayPlan.buildPrintableHtml ? displayPlan.buildPrintableHtml() : '';
    // In a real app, this would open a print dialog or download
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visit-pack-${displayPlan.planId}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Printable text
  const handlePrintText = () => {
    if (!displayPlan) return;
    const text = displayPlan.buildPrintableText ? displayPlan.buildPrintableText() : '';
    // Copy to clipboard or download
    navigator.clipboard.writeText(text).then(() => {
      // Success feedback
    });
  };

  // Office type display
  const officeTypeLabel = useMemo(() => {
    if (!office) return 'General';
    const type = inferOfficeType(office, selectedService);
    const typeLabels = {
      rto: 'RTO (Regional Transport Office)',
      passport: 'PSK (Passport Seva Kendra)',
      tehsildar: 'Tehsildar (Revenue Office)',
      municipal: 'Municipal Corporation',
      csc_aadhaar: 'CSC / Aadhaar Seva Kendra',
      general: 'General Facilitation Center',
    };
    return typeLabels[type] || type;
  }, [office, selectedService]);

  if (!currentService) {
    return (
      <div className="coach-dashboard" aria-label="Office Visit Preparation Coach">
        <h2>Office Visit Preparation Coach</h2>
        <p>Select a civic service and office to begin preparation.</p>
        <button
          onClick={() => setSelectedService(SAMPLE_RTO_SERVICE)}
          className="btn-primary"
        >
          Use Sample: Driving License Renewal (RTO)
        </button>
      </div>
    );
  }

  return (
    <div className="coach-dashboard" aria-label="Office Visit Preparation Coach">
      <header className="coach-header">
        <h1>Office Visit Preparation & Follow-Up Coach</h1>
        
        {/* Office verification status badge */}
        <div className="office-status-badge" role="status">
          {officeDataStatus === 'fresh' && (
            <span className="badge badge-success">
              {officeDataStatus} office data
            </span>
          )}
          {officeDataStatus === 'stale' && (
            <span className="badge badge-warning">
              {officeDataStatus} office data — verify at counter
            </span>
          )}
          {officeDataStatus === 'unverified' && (
            <span className="badge badge-info">
              {officeDataStatus} office data
            </span>
          )}
        </div>
      </header>

      <main className="coach-main">
        {/* Service & Office Summary */}
        <section className="service-summary">
          <h2>{currentService.name}</h2>
          <p><strong>Department:</strong> {currentService.department}</p>
          <p><strong>Fees:</strong> {currentService.fees || 'To be verified at counter'}</p>
          <p><strong>Processing Time:</strong> {currentService.processingTime || 'To be confirmed'}</p>
          <p><strong>Office:</strong> {office?.name || 'Not specified'}</p>
          {office?.city && <p><strong>Location:</strong> {office.city}{office.state ? `, ${office.state}` : ''}</p>}
          <p><strong>Office Type:</strong> {officeTypeLabel}</p>
          <p><strong>Operating Hours:</strong> {office?.operatingHours || 'Not specified'}</p>
        </section>

        {/* Checklist Section */}
        <section className="checklist-section">
          <h2>Checklist {displayPlan?.checklist?.items?.length || 0} items</h2>
          
          <div className="section-controls">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showUserNotes}
                onChange={() => setShowUserNotes(!showUserNotes)}
                className="control-checkbox"
                aria-label="Show personal notes section"
              />
              {showUserNotes ? 'Hide' : 'Show'} personal notes section
            </label>
            
            <button
              onClick={handlePrintHtml}
              className="btn-print"
              aria-label="Print visit pack"
            >
              🖨️ Print Pack
            </button>
            <button
              onClick={handlePrintText}
              className="btn-print"
              aria-label="Print text summary"
            >
              📄 Text Summary
            </button>
          </div>

          <ul className="checklist-list">
            {displayPlan?.checklist?.items?.map((item) => (
              <li key={item.id} className="checklist-item">
                <div className="checklist-item-content">
                  <label className="checklist-item-label">
                    <input
                      type="checkbox"
                      checked={item.isPacked}
                      onChange={() => {
                        // Toggle packed status
                      }}
                      className="checklist-checkbox"
                      aria-label={`Checklist item: ${item.label}`}
                    />
                    <span className="checklist-item-text">
                      {item.label}
                      {item.isAmbiguous && (
                        <span className="ambiguous-badge">
                          {CONFIRM_WITH_DEPARTMENT}
                        </span>
                      )}
                    </span>
                  </label>
                  {item.description && (
                    <p className="checklist-item-desc">{item.description}</p>
                  )}
                </div>
                {item.condition && (
                  <small className="checklist-condition">
                    {item.condition}
                  </small>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Visit Outcome Recording */}
        <section className="outcome-recording">
          <h2>Record Visit Outcome</h2>
          
          {displayPlan?.outcome?.status === 'PENDING_VISIT' && (
            <div className="outcome-options">
              <p>Select the outcome of your visit:</p>
              <div className="outcome-options-grid">
                {['COMPLETED', 'RESCHEDULED', 'TOKEN_ISSUED', 'ADDITIONAL_DOCS_REQUESTED', 'CANCELLED'].map((status) => (
                  <button
                    key={status}
                    className={`outcome-btn ${displayPlan.outcome.status === status ? 'selected' : ''}`}
                    onClick={() => handleRecordOutcome(status, '', false)}
                    aria-label={`Record ${status} outcome`}
                  >
                    {STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
              <p className="approval-required">
                <em>
                  Note: First outcome recording from 'Pending Visit' status requires explicit confirmation.
                </em>
              </p>
            </div>
          )}

          {displayPlan?.outcome && displayPlan.outcome.status !== 'PENDING_VISIT' && (
            <div className="recorded-outcome" role="status" aria-label="outcome recorded">
              <p>Outcome recorded: <strong>{STATUS_LABELS[displayPlan.outcome.status]}</strong></p>
              {displayPlan.outcome.outcomeNotes && (
                <p><em>{displayPlan.outcome.outcomeNotes}</em></p>
              )}
              <button
                onClick={() => handleRecordOutcome(
                  displayPlan.outcome.status,
                  prompt('Enter outcome notes (optional)') || '',
                  true
                )}
                className="btn-edit"
                aria-label="Edit outcome recording"
              >
                Edit
              </button>
              <button
                onClick={() => handleRecordOutcome('PENDING_VISIT', '', false)}
                className="btn-reset"
                aria-label="Reset to pending visit status"
              >
                Reset
              </button>
            </div>
          )}
        </section>

        {/* Printable Pack Preview */}
        {displayPlan && (
          <section className="printable-preview">
            <h2>Printable Visit Pack Preview</h2>
            <button onClick={handlePrintHtml} className="btn-print-small">
              View HTML Preview
            </button>
            <button onClick={handlePrintText} className="btn-print-small">
              View Text Summary
            </button>
          </section>
        )}
      </main>

      <footer className="coach-footer">
        <p>
          {COACH_CONSTANTS.DISCLAIMER}
        </p>
        <p>
          <small>
            Generated via Civic Help Setu Multi-Agent Coach • Does not replace statutory government paperwork
          </small>
        </p>
      </footer>
    </div>
  );
};

export default CoachDashboard;