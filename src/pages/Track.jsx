import { useState, useEffect } from 'react';
import SharedDeviceNotice from '../components/privacy/SharedDeviceNotice';
import { parseReferenceParam } from '../utils/searchParams';
import { useLocation } from 'react-router-dom';
import {
  Search,
  FileText,
  FileCheck2,
  ArrowRight,
  Copy,
  Plus,
  AlertTriangle,
  ShieldCheck,
  MessageSquare,
  Send,
  Compass,
  Scale,
} from 'lucide-react';

import { useToast } from '../context/ToastContext';
import {
  getApplications,
  getApplicationById,
  addNoteToApplication,
  resolveApplicationPendingAction,
  getTrackingMetrics,
  getStatusMeta,
  formatDisplayDate,
} from '../services/trackingService';

import JourneyPlannerModal from '../components/journey/JourneyPlannerModal';
import ActiveApplicationsSummaryGrid from '../components/tracking/ActiveApplicationsSummaryGrid';
import ApplicationTimeline from '../components/tracking/ApplicationTimeline';
import ActionRequiredAlert from '../components/tracking/ActionRequiredAlert';
import LinkedDocumentsManager from '../components/tracking/LinkedDocumentsManager';
import ManualAddApplicationModal from '../components/tracking/ManualAddApplicationModal';
import Checklist from '../components/Checklist';
import { toRequirementMap } from '../services/requirementTypes';
import { services } from '../data/services';
import TrackEmptyState from '../components/tracking/TrackEmptyState';
import TrackingReceiptModal from '../components/tracking/TrackingReceiptModal';
import SlaBreachAlertWidget from '../components/tracking/SlaBreachAlertWidget';
import AppellateEscalationLadder from '../components/tracking/AppellateEscalationLadder';
import GrievanceEscalationAlertBanner from '../components/tracking/GrievanceEscalationAlertBanner';
import GrievanceEvidenceOrganizerModal from '../components/grievance/GrievanceEvidenceOrganizerModal';
import CivicGrievanceDraftingAssistantModal from '../components/grievance/CivicGrievanceDraftingAssistantModal';
import ApplicationMilestoneTracker from '../components/tracking/ApplicationMilestoneTracker';
import StatutoryCompensationClaimModal from '../components/tracking/StatutoryCompensationClaimModal';
import { calculateStatutoryCompensation } from '../services/statutoryCompensationService';
import DeficiencyCureModal from '../components/tracking/DeficiencyCureModal';
import RejectionNoticeExplainerModal from '../components/tracking/RejectionNoticeExplainerModal';
import InlineStatusLegend from '../components/common/InlineStatusLegend';
import './TrackSearch.css';

const Track = () => {
  const location = useLocation();
  const { toast } = useToast();

  const [applications, setApplications] = useState(() => getApplications());
  const [metrics, setMetrics] = useState(() => getTrackingMetrics());
  const [appIdInput, setAppIdInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [activeApp, setActiveApp] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);

  const [newNoteText, setNewNoteText] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isJourneyModalOpen, setIsJourneyModalOpen] = useState(false);
  const [isGrievanceModalOpen, setIsGrievanceModalOpen] = useState(false);
  const [isGrievanceDraftModalOpen, setIsGrievanceDraftModalOpen] = useState(false);
  const [isCompensationModalOpen, setIsCompensationModalOpen] = useState(false);
  const [isCureModalOpen, setIsCureModalOpen] = useState(false);
  const [isExplainerModalOpen, setIsExplainerModalOpen] = useState(false);

  useEffect(() => {
    const freshApps = getApplications();
    setApplications(freshApps);
    setMetrics(getTrackingMetrics());

    const searchParams = new URLSearchParams(location.search);
    const queryId = parseReferenceParam(searchParams.get('id') || searchParams.get('ref'));

    if (queryId) {
      setAppIdInput(queryId);
      const match = getApplicationById(queryId);
      if (match) {
        setActiveApp(match);
      } else {
        setNotFound(true);
      }
    } else if (freshApps.length > 0) {
      setActiveApp(freshApps[0]);
    }
  }, [location.search]);

  const handleSearch = (e) => {
    e?.preventDefault();
    const query = appIdInput.trim();
    if (!query) {
      setSearchError('Enter the reference ID from your application receipt.');
      setNotFound(false);
      toast?.warning?.('Please enter an application reference ID to track status.');
      return;
    }

    setIsSearching(true);
    setSearchError('');
    setNotFound(false);

    setTimeout(() => {
      const match = getApplicationById(query);
      if (match) {
        setActiveApp(match);
        setNotFound(false);
        toast?.success?.(`Application record ${match.id} loaded successfully.`);
      } else {
        setActiveApp(null);
        if (!parseReferenceParam(query)) {
          setSearchError('This reference has no readable characters. Check the ID on your receipt.');
        } else {
          setNotFound(true);
        }
        toast?.error?.(`No record found matching "${query}".`);
      }
      setIsSearching(false);
    }, 400);
  };

  const handleCopyId = () => {
    if (!activeApp) return;
    navigator.clipboard?.writeText(activeApp.id);
    toast?.info?.(`Reference ID ${activeApp.id} copied to clipboard.`);
  };

  const handleSelectApp = (app) => {
    setActiveApp(app);
    setAppIdInput(app.id);
    setNotFound(false);
    setSearchError('');
  };

  const handleAddNote = (e) => {
    e.preventDefault();
    if (!activeApp || !newNoteText.trim()) return;

    const updated = addNoteToApplication(activeApp.id, newNoteText);
    if (updated) {
      setActiveApp({ ...updated });
      setApplications(getApplications());
      setNewNoteText('');
      toast?.success?.('Note added to application.');
    }
  };

  const handleManualAdd = (newApp) => {
    setApplications(getApplications());
    setActiveApp(newApp);
    setAppIdInput(newApp.id);
    setNotFound(false);
    setSearchError('');
    setIsAddModalOpen(false);
  };

  const pendingAction = activeApp ? resolveApplicationPendingAction(activeApp) : null;
  const statusMeta = activeApp ? getStatusMeta(activeApp.status) : null;
  const compensationClaim = activeApp ? calculateStatutoryCompensation(activeApp) : null;
  const activeService = activeApp
    ? services.find((svc) => svc.id === activeApp.serviceId)
    : null;
  const requiredDocuments = activeService?.documents || [];

  if (!applications.length && !activeApp) {
    return (
      <section className="section">
        <div className="container">
          <TrackEmptyState onAdd={() => setIsAddModalOpen(true)} />
        </div>
      </section>
    );
  }

  return (
    <section className="section" style={{ paddingTop: '2rem' }}>
      <div className="container">
        <header style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <p style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)' }}>
                Application Tracking
              </p>
              <h1 style={{ margin: 0, fontSize: 'clamp(2rem, 4vw, 3rem)' }}>Track your civic service status</h1>
              <SharedDeviceNotice what="tracked applications" />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsGrievanceDraftModalOpen(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <MessageSquare size={16} color="var(--accent-main)" /> Grievance Drafter
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsGrievanceModalOpen(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <FileText size={16} color="var(--accent-main)" /> Grievance Organizer
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
                <Plus size={16} /> Add Application
              </button>
            </div>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '1.5rem', minWidth: 0 }}>
          <ActiveApplicationsSummaryGrid metrics={metrics} applications={applications} />

          <div className="card track-search-card">
            <div className="track-search-layout">
              <form onSubmit={handleSearch} className="track-search-form" noValidate>
                <label htmlFor="track-reference" className="track-search-label">Application reference ID</label>
                <p id="track-reference-help" className="track-search-help">Use the ID on your receipt, for example SRV-98234710. Formats vary by service. Search checks applications saved on this device.</p>
                <div className="track-search-controls" aria-busy={isSearching}>
                  <div className="track-search-input-wrap">
                  <Search size={18} aria-hidden="true" className="track-search-icon" />
                  <input
                    id="track-reference"
                    type="text"
                    value={appIdInput}
                    onChange={(e) => { setAppIdInput(e.target.value); setSearchError(''); setNotFound(false); }}
                    placeholder="e.g. SRV-98234710"
                    disabled={isSearching}
                    aria-invalid={searchError ? 'true' : undefined}
                    aria-describedby={searchError ? 'track-reference-help track-reference-error' : 'track-reference-help'}
                  />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={isSearching}>
                    {isSearching ? 'Searching…' : 'Track application'}
                  </button>
                </div>
                {searchError && <p id="track-reference-error" className="track-search-error" role="alert">{searchError}</p>}
                <p className="track-search-loading" role="status" aria-live="polite">{isSearching ? 'Searching saved applications…' : ''}</p>
              </form>

              <button type="button" className="btn btn-secondary" onClick={() => setIsJourneyModalOpen(true)}>
                <Compass size={16} /> Journey Planner
              </button>
            </div>

            {notFound && (
              <div className="track-search-not-found">
                <p role="status"><strong>No saved application found.</strong> Check the reference on your receipt and try again, or add it to this device.</p>
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(true)}><Plus size={16} aria-hidden="true" /> Add application</button>
              </div>
            )}
          </div>

          {activeApp ? (
            <>
              <div style={{ display: 'grid', gap: '1.5rem' }}>
                <div className="card" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Active Application
                      </p>
                      <h2 style={{ margin: '0.35rem 0 0.2rem' }}>{activeApp.serviceName || 'Application'}</h2>
                      <div style={{ color: 'var(--text-secondary)' }}>
                        Reference ID: <strong>{activeApp.id}</strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      {compensationClaim?.isEligible && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setIsCompensationModalOpen(true)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            color: '#dc2626',
                            borderColor: '#fca5a5',
                            backgroundColor: 'rgba(239, 68, 68, 0.05)'
                          }}
                        >
                          <Scale size={16} /> Claim Delay Compensation
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setIsExplainerModalOpen(true)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          color: '#b45309',
                          borderColor: '#fcd34d',
                          backgroundColor: 'rgba(245, 158, 11, 0.08)',
                        }}
                      >
                        <FileText size={16} /> Explain Rejection / Notice
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={handleCopyId}>
                        <Copy size={16} /> Copy ID
                      </button>
                      <button type="button" className="btn btn-primary" onClick={() => setShowReceipt(true)}>
                        <FileText size={16} /> View Receipt
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
                    <div className="stat-card">
                      <span>Status</span>
                      <strong>{statusMeta?.label || activeApp.status}</strong>
                    </div>
                    <div className="stat-card">
                      <span>Applied On</span>
                      <strong>{formatDisplayDate(activeApp.appliedDate) || activeApp.appliedDate}</strong>
                    </div>
                    <div className="stat-card">
                      <span>Estimated Resolution</span>
                      <strong>{activeApp.estimatedCompletion || 'Pending'}</strong>
                    </div>
                    <div className="stat-card">
                      <span>Applicant</span>
                      <strong>{activeApp.applicantName || 'Citizen'}</strong>
                    </div>
                  </div>
                </div>

                {pendingAction && (
                  <ActionRequiredAlert
                    title={pendingAction.title}
                    message={pendingAction.description}
                    actionLabel={pendingAction.actionLabel || 'Review'}
                    onAction={pendingAction.onAction}
                  />
                )}

                {pendingAction && (
                  <div style={{ marginTop: '0.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setIsCureModalOpen(true)}
                      style={{ fontSize: '0.82rem', padding: '0.4rem 0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <FileCheck2 size={15} color="#ef4444" />
                      Statutory Objection Resolution & Rectification
                    </button>
                  </div>
                )}

                <GrievanceEscalationAlertBanner application={activeApp} />

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                  <ApplicationTimeline stages={activeApp.stages || []} currentStageIndex={activeApp.currentStageIndex || 0} />
                  <LinkedDocumentsManager documents={activeApp.linkedDocs || []} />
                </div>

                <ApplicationMilestoneTracker application={activeApp} />

                <InlineStatusLegend
                  categories={[
                    'application',
                    'requirement',
                    'fee',
                    'eligibility',
                  ]}
                  title="Status Legend for Tracking"
                  fullLegendLabel="View full legend"
                />

                {requiredDocuments.length > 0 && (
                  <section className="card" style={{ padding: '1.25rem' }} aria-labelledby="track-checklist-title">
                    <h3 id="track-checklist-title" style={{ margin: '0 0 1rem' }}>Documents to prepare</h3>
                    <Checklist
                      key={activeApp.id}
                      checklistId={activeApp.id}
                      items={requiredDocuments}
                      requirements={toRequirementMap(activeService)}
                      label={`Documents to prepare for ${activeApp.serviceName || 'this application'}`}
                    />
                  </section>
                )}

                <div className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <MessageSquare size={18} />
                    <h3 style={{ margin: 0 }}>Notes & updates</h3>
                  </div>

                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {(activeApp.notes || []).map((note) => (
                      <div key={note.id} style={{ padding: '0.85rem 1rem', border: '1px solid var(--border-main)', borderRadius: '0.75rem' }}>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{note.text}</div>
                        <small style={{ display: 'block', marginTop: '0.35rem', color: 'var(--text-tertiary)' }}>{note.date}</small>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleAddNote} style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
                    <textarea
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      rows={3}
                      placeholder="Add an update or reminder"
                      style={{ width: '100%', padding: '0.9rem', borderRadius: '0.75rem', border: '1px solid var(--border-main)' }}
                    />
                    <button type="submit" className="btn btn-primary">
                      <Send size={16} /> Add Note
                    </button>
                  </form>
                </div>

                <AppellateEscalationLadder application={activeApp} />

                {activeApp.status === 'sla-breach' && (
                  <SlaBreachAlertWidget app={activeApp} application={activeApp} citizenName={activeApp.applicantName} />
                )}
              </div>
            </>
          ) : (
            <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
              <AlertTriangle size={28} style={{ marginBottom: '0.75rem', color: '#f59e0b' }} />
              <h3 style={{ margin: '0 0 0.5rem' }}>No application selected</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Enter a reference ID or choose an application from the list above.</p>
            </div>
          )}
        </div>
      </div>

      <JourneyPlannerModal isOpen={isJourneyModalOpen} onClose={() => setIsJourneyModalOpen(false)} app={activeApp} />

      <ManualAddApplicationModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onApplicationAdded={handleManualAdd}
      />

      <TrackingReceiptModal app={activeApp} isOpen={showReceipt} onClose={() => setShowReceipt(false)} />

      <GrievanceEvidenceOrganizerModal
        isOpen={isGrievanceModalOpen}
        onClose={() => setIsGrievanceModalOpen(false)}
        defaultServiceId={activeApp?.serviceId}
      />

      <CivicGrievanceDraftingAssistantModal
        isOpen={isGrievanceDraftModalOpen}
        onClose={() => setIsGrievanceDraftModalOpen(false)}
        defaultApplication={activeApp}
      />

      <StatutoryCompensationClaimModal
        isOpen={isCompensationModalOpen}
        onClose={() => setIsCompensationModalOpen(false)}
        application={activeApp}
     />
      <DeficiencyCureModal
        application={activeApp}
        isOpen={isCureModalOpen}
        onClose={() => setIsCureModalOpen(false)}
        citizenName={activeApp?.applicantName || 'Citizen Applicant'}
      />

      <RejectionNoticeExplainerModal
        isOpen={isExplainerModalOpen}
        onClose={() => setIsExplainerModalOpen(false)}
        application={activeApp}
        initialNotice={activeApp?.rejectionReason || activeApp?.pendingAction?.description || ''}
      />
    </section>
  );
};

export default Track;
