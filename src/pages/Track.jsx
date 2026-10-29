import { useState, useEffect } from 'react';
import SharedDeviceNotice from '../components/privacy/SharedDeviceNotice';
import { parseReferenceParam } from '../utils/searchParams';
import { useLocation } from 'react-router-dom';
import {
  Search,
  FileText,
  ArrowRight,
  Copy,
  Plus,
  AlertTriangle,
  ShieldCheck,
  MessageSquare,
  Send,
  Compass,
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
import GrievanceEvidenceOrganizerModal from '../components/grievance/GrievanceEvidenceOrganizerModal';

const Track = () => {
  const location = useLocation();
  const { toast } = useToast();

  const [applications, setApplications] = useState(() => getApplications());
  const [metrics, setMetrics] = useState(() => getTrackingMetrics());
  const [appIdInput, setAppIdInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [activeApp, setActiveApp] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);

  const [newNoteText, setNewNoteText] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isJourneyModalOpen, setIsJourneyModalOpen] = useState(false);
  const [isGrievanceModalOpen, setIsGrievanceModalOpen] = useState(false);

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
      toast?.warning?.('Please enter an application reference ID to track status.');
      return;
    }

    setIsSearching(true);
    setNotFound(false);

    setTimeout(() => {
      const match = getApplicationById(query);
      if (match) {
        setActiveApp(match);
        setNotFound(false);
        toast?.success?.(`Application record ${match.id} loaded successfully.`);
      } else {
        setActiveApp(null);
        setNotFound(true);
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
    setIsAddModalOpen(false);
  };

  const pendingAction = activeApp ? resolveApplicationPendingAction(activeApp) : null;
  const statusMeta = activeApp ? getStatusMeta(activeApp.status) : null;
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

        <div style={{ display: 'grid', gap: '1.5rem' }}>
          <ActiveApplicationsSummaryGrid metrics={metrics} applications={applications} />

          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <form onSubmit={handleSearch} style={{ display: 'flex', flex: 1, minWidth: '260px', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={18} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input
                    type="text"
                    value={appIdInput}
                    onChange={(e) => setAppIdInput(e.target.value)}
                    placeholder="Enter application reference ID"
                    style={{ width: '100%', padding: '0.9rem 1rem 0.9rem 2.6rem', borderRadius: '0.75rem', border: '1px solid var(--border-main)' }}
                  />
                </div>

                <button type="submit" className="btn btn-primary" disabled={isSearching}>
                  {isSearching ? 'Searching...' : 'Track'}
                </button>
              </form>

              <button type="button" className="btn btn-secondary" onClick={() => setIsJourneyModalOpen(true)}>
                <Compass size={16} /> Journey Planner
              </button>
            </div>

            {notFound && (
              <div style={{ marginTop: '1rem', color: '#ef4444', fontWeight: 600 }}>
                No application found matching that reference.
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

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                  <ApplicationTimeline stages={activeApp.stages || []} currentStageIndex={activeApp.currentStageIndex || 0} />
                  <LinkedDocumentsManager documents={activeApp.linkedDocs || []} />
                </div>

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
                  <SlaBreachAlertWidget app={activeApp} />
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
        onSave={handleManualAdd}
      />

      <TrackingReceiptModal app={activeApp} isOpen={showReceipt} onClose={() => setShowReceipt(false)} />

      <GrievanceEvidenceOrganizerModal
        isOpen={isGrievanceModalOpen}
        onClose={() => setIsGrievanceModalOpen(false)}
        defaultServiceId={activeApp?.serviceId}
      />
    </section>
  );
};

export default Track;
