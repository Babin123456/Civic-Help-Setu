import { useState, useMemo, useCallback } from 'react';
import {
  Calendar,
  FileText,
  Clock,
  MapPin,
  Building2,
  ShieldCheck,
  AlertTriangle,
  Search,
  ExternalLink,
  Printer,
  Plus,
  HelpCircle,
  X,
  Copy,
  Check,
  BookmarkCheck,
  FileCheck,
  Trash2,
} from 'lucide-react';
import StandardPageHeader from '../components/common/StandardPageHeader';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { UP_JAN_SUNWAI_EVENTS } from '../data/upJanSunwaiEvents';
import {
  ACKNOWLEDGEMENT_TYPE,
  ACKNOWLEDGEMENT_TYPE_LABELS,
  ATTENDANCE_STATUS,
  ATTENDANCE_STATUS_LABELS,
  FOLLOW_UP_STATE,
  ISSUE_CATEGORIES,
  ISSUE_CATEGORY_OPTIONS,
  OUTCOME_DISTINCTION_NOTICE,
  OUTCOME_DISTINCTIONS,
  PREPARATION_DISCLAIMER,
  PRIVACY_NOTICE,
  buildPreparationChecklist,
  buildPreparationPack,
  buildPreparationPackText,
  formatHearingDate,
  generateHearingNote,
  getDistricts,
  queryEvents,
  upJanSunwaiStore,
} from '../services/upJanSunwaiService';

export default function UpJanSunwaiWorkspace() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const citizenId = user?.id || user?.email || 'citizen_anon';
  const citizenDisplayName = user?.name || user?.email?.split('@')[0] || '';

  // Active tab: 'calendar' | 'prepare' | 'followup' | 'outcomes'
  const [activeTab, setActiveTab] = useState('calendar');

  // Calendar filter state
  const [selectedDistrict, setSelectedDistrict] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [includeExpired, setIncludeExpired] = useState(false);

  // Selected event for detail modal or preparation
  const [detailEvent, setDetailEvent] = useState(null);
  const [correctionEvent, setCorrectionEvent] = useState(null);
  const [selectedHearingId, setSelectedHearingId] = useState(
    UP_JAN_SUNWAI_EVENTS[0]?.id || '',
  );

  // Preparation form state
  const [prepCategory, setPrepCategory] = useState(
    ISSUE_CATEGORIES.REVENUE_LAND.id,
  );
  const [prepCitizenName, setPrepCitizenName] = useState(citizenDisplayName);
  const [prepChronology, setPrepChronology] = useState('');
  const [prepPriorComplaints, setPrepPriorComplaints] = useState('');
  const [prepRequestedRemedy, setPrepRequestedRemedy] = useState('');
  const [prepAdditionalNotes, setPrepAdditionalNotes] = useState('');
  const [prepAttachments, setPrepAttachments] = useState([
    { label: 'Government Photo ID Photocopy', pages: 1, date: '' },
  ]);
  const [newAttachmentLabel, setNewAttachmentLabel] = useState('');
  const [newAttachmentPages, setNewAttachmentPages] = useState('');

  // Print pack modal state
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [includePrivateInPrint, setIncludePrivateInPrint] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Follow-up state
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const [followUpEvent, setFollowUpEvent] = useState(null);
  const [followUpAttendance, setFollowUpAttendance] = useState(
    ATTENDANCE_STATUS.ATTENDED,
  );
  const [followUpAckType, setFollowUpAckType] = useState(
    ACKNOWLEDGEMENT_TYPE.HEARING_SLIP,
  );
  const [followUpAckNumber, setFollowUpAckNumber] = useState('');
  const [followUpOfficerDesk, setFollowUpOfficerDesk] = useState('');
  const [followUpNextAction, setFollowUpNextAction] = useState('');
  const [followUpDateVal, setFollowUpDateVal] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');

  // Resolution modal state
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [recordToResolve, setRecordToResolve] = useState(null);
  const [resolutionRef, setResolutionRef] = useState('');
  const [resolutionDate, setResolutionDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [resolutionNotes, setResolutionNotes] = useState('');

  // Source correction modal state
  const [correctionField, setCorrectionField] = useState('eventDate');
  const [correctionProposedVal, setCorrectionProposedVal] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionEvidenceUrl, setCorrectionEvidenceUrl] = useState('');

  // Refresh counter for store-backed changes
  const [version, setVersion] = useState(0);

  // Available districts
  const districts = useMemo(() => getDistricts(UP_JAN_SUNWAI_EVENTS), []);

  // Filtered events
  const filteredEvents = useMemo(() => {
    return queryEvents(UP_JAN_SUNWAI_EVENTS, {
      district: selectedDistrict === 'all' ? '' : selectedDistrict,
      issueCategory: selectedCategory === 'all' ? '' : selectedCategory,
      searchQuery,
      includeExpired,
    });
  }, [selectedDistrict, selectedCategory, searchQuery, includeExpired]);

  // Citizen's saved follow-up records
  const followUpSummary = useMemo(() => {
    void version;
    try {
      return upJanSunwaiStore.getFollowUpSummary(citizenId);
    } catch {
      return { total: 0, counts: {}, records: [] };
    }
  }, [citizenId, version]);

  // Selected event object for preparation tab
  const currentPrepEvent = useMemo(() => {
    return (
      upJanSunwaiStore.getEvent(selectedHearingId) ||
      UP_JAN_SUNWAI_EVENTS.find((e) => e.id === selectedHearingId) ||
      UP_JAN_SUNWAI_EVENTS[0]
    );
  }, [selectedHearingId]);

  // Generated preparation checklist
  const currentChecklist = useMemo(() => {
    if (!currentPrepEvent) return null;
    try {
      return buildPreparationChecklist(currentPrepEvent, {
        issueCategory: prepCategory,
        priorComplaints: prepPriorComplaints ? [prepPriorComplaints] : [],
        attachments: prepAttachments,
      });
    } catch {
      return null;
    }
  }, [currentPrepEvent, prepCategory, prepPriorComplaints, prepAttachments]);

  // Generated hearing note
  const currentHearingNote = useMemo(() => {
    if (!currentPrepEvent) return null;
    try {
      return generateHearingNote({
        event: currentPrepEvent,
        issueCategory: prepCategory,
        citizenName: prepCitizenName,
        chronology: prepChronology,
        priorComplaints: prepPriorComplaints ? [prepPriorComplaints] : [],
        requestedRemedy: prepRequestedRemedy,
        additionalNotes: prepAdditionalNotes,
        attachments: prepAttachments,
      });
    } catch {
      return null;
    }
  }, [
    currentPrepEvent,
    prepCategory,
    prepCitizenName,
    prepChronology,
    prepPriorComplaints,
    prepRequestedRemedy,
    prepAdditionalNotes,
    prepAttachments,
  ]);

  // Load existing draft if present when switching selected hearing
  const handleSelectHearing = useCallback((eventId) => {
    setSelectedHearingId(eventId);
    if (!eventId || !citizenId) return;
    const draft = upJanSunwaiStore.getPreparationDraft(citizenId, eventId);
    if (draft) {
      if (draft.issueCategory) setPrepCategory(draft.issueCategory);
      if (draft.citizenName) setPrepCitizenName(draft.citizenName);
      if (draft.chronology) setPrepChronology(draft.chronology);
      if (draft.priorComplaints) {
        setPrepPriorComplaints(
          Array.isArray(draft.priorComplaints)
            ? draft.priorComplaints.join(', ')
            : String(draft.priorComplaints),
        );
      }
      if (draft.requestedRemedy) setPrepRequestedRemedy(draft.requestedRemedy);
      if (draft.additionalNotes) setPrepAdditionalNotes(draft.additionalNotes);
      if (draft.attachments?.length) setPrepAttachments(draft.attachments);
    }
  }, [citizenId]);

  // Save draft helper
  const handleSaveDraft = useCallback(() => {
    if (!selectedHearingId) return;
    try {
      upJanSunwaiStore.savePreparationDraft(citizenId, selectedHearingId, {
        issueCategory: prepCategory,
        citizenName: prepCitizenName,
        chronology: prepChronology,
        priorComplaints: prepPriorComplaints,
        requestedRemedy: prepRequestedRemedy,
        additionalNotes: prepAdditionalNotes,
        attachments: prepAttachments,
      });
      setVersion((v) => v + 1);
      showToast?.('Preparation draft saved locally in your browser.', 'success');
    } catch (err) {
      showToast?.(err.message || 'Failed to save draft', 'error');
    }
  }, [
    citizenId,
    selectedHearingId,
    prepCategory,
    prepCitizenName,
    prepChronology,
    prepPriorComplaints,
    prepRequestedRemedy,
    prepAdditionalNotes,
    prepAttachments,
    showToast,
  ]);

  // Attachment add helper
  const handleAddAttachment = () => {
    if (!newAttachmentLabel.trim()) return;
    const pagesNum = parseInt(newAttachmentPages, 10);
    setPrepAttachments((prev) => [
      ...prev,
      {
        label: newAttachmentLabel.trim(),
        pages: Number.isFinite(pagesNum) && pagesNum > 0 ? pagesNum : null,
        date: '',
      },
    ]);
    setNewAttachmentLabel('');
    setNewAttachmentPages('');
  };

  const handleRemoveAttachment = (idx) => {
    setPrepAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  // Record follow up submission
  const handleSaveFollowUp = (e) => {
    e.preventDefault();
    if (!followUpEvent) return;
    try {
      upJanSunwaiStore.recordFollowUp(citizenId, followUpEvent.id, {
        attendanceStatus: followUpAttendance,
        acknowledgementType: followUpAckType,
        acknowledgementNumber: followUpAckNumber,
        officerOrDesk: followUpOfficerDesk,
        nextAction: followUpNextAction,
        followUpDate: followUpDateVal,
        notes: followUpNotes,
      });
      setVersion((v) => v + 1);
      setFollowUpModalOpen(false);
      showToast?.(
        'Post-hearing record saved privately under your account.',
        'success',
      );
    } catch (err) {
      showToast?.(err.message || 'Error recording follow-up', 'error');
    }
  };

  // Confirm resolution submission
  const handleConfirmResolution = (e) => {
    e.preventDefault();
    if (!recordToResolve) return;
    try {
      upJanSunwaiStore.recordResolution(recordToResolve.id, citizenId, {
        resolutionReference: resolutionRef,
        resolvedDate: resolutionDate,
        notes: resolutionNotes,
      });
      setVersion((v) => v + 1);
      setResolveModalOpen(false);
      setRecordToResolve(null);
      showToast?.('Resolution confirmed and saved.', 'success');
    } catch (err) {
      showToast?.(err.message || 'Error recording resolution', 'error');
    }
  };

  // Submit source correction
  const handleSubmitCorrection = (e) => {
    e.preventDefault();
    if (!correctionEvent) return;
    try {
      upJanSunwaiStore.submitSourceCorrection(citizenId, correctionEvent.id, {
        field: correctionField,
        proposedValue: correctionProposedVal,
        reason: correctionReason,
        evidenceUrl: correctionEvidenceUrl,
      });
      setVersion((v) => v + 1);
      setCorrectionEvent(null);
      setCorrectionProposedVal('');
      setCorrectionReason('');
      setCorrectionEvidenceUrl('');
      showToast?.(
        'Correction suggestion queued for editor verification.',
        'success',
      );
    } catch (err) {
      showToast?.(err.message || 'Error submitting correction', 'error');
    }
  };

  // Printable Pack Compiled Object
  const compiledPack = useMemo(() => {
    if (!currentPrepEvent) return null;
    try {
      return buildPreparationPack({
        event: currentPrepEvent,
        issueCategory: prepCategory,
        citizenName: prepCitizenName,
        chronology: prepChronology,
        priorComplaints: prepPriorComplaints,
        requestedRemedy: prepRequestedRemedy,
        additionalNotes: prepAdditionalNotes,
        attachments: prepAttachments,
        includePrivateDetails: includePrivateInPrint,
        followUpRecord: followUpSummary.records.find(
          (r) => r.eventId === currentPrepEvent.id,
        ),
      });
    } catch {
      return null;
    }
  }, [
    currentPrepEvent,
    prepCategory,
    prepCitizenName,
    prepChronology,
    prepPriorComplaints,
    prepRequestedRemedy,
    prepAdditionalNotes,
    prepAttachments,
    includePrivateInPrint,
    followUpSummary,
  ]);

  const packText = useMemo(() => {
    return compiledPack ? buildPreparationPackText(compiledPack) : '';
  }, [compiledPack]);

  const handlePrintPack = () => {
    if (typeof window !== 'undefined' && window.print) {
      window.print();
    }
  };

  const handleCopyPackText = async () => {
    if (!packText) return;
    try {
      await navigator.clipboard.writeText(packText);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
      showToast?.('Preparation pack copied to clipboard.', 'success');
    } catch {
      showToast?.('Could not copy to clipboard', 'error');
    }
  };

  return (
    <div className="section" style={{ padding: '2rem 1rem' }}>
      <div className="container" style={{ maxWidth: '1180px', margin: '0 auto' }}>
        {/* Page Header */}
        <StandardPageHeader
          eyebrow="Uttar Pradesh Public Grievance Hearings"
          eyebrowIcon={<Building2 size={16} style={{ color: 'var(--accent-main)' }} />}
          title="UP Public Hearing &amp; Jan Sunwai Workspace"
          subtitle="Prepare structured, fact-checked submissions for District Jan Sunwai, Tehsil Diwas, and Municipal public hearings across UP, secure written acknowledgements, and manage follow-ups."
          badgeText="Verified Pilot Workflows"
          badgeType="accent"
        />

        {/* Ethical Guardrail Banner */}
        <div
          role="note"
          aria-label="Statutory and Verification Notice"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-main)',
            borderLeft: '4px solid var(--accent-main)',
            borderRadius: '0.75rem',
            padding: '1rem 1.25rem',
            marginBottom: '1.75rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
          }}
        >
          <ShieldCheck
            size={22}
            style={{ color: 'var(--accent-main)', flexShrink: 0, marginTop: '2px' }}
          />
          <div style={{ fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '0.2rem' }}>
              Official Verification &amp; Ethical Guardrail:
            </strong>
            Only events backed by dated notices on authorized government portals (<code>*.gov.in</code> / <code>*.nic.in</code>) with venue, eligibility, and registration instructions are shown as official appointments.
            <strong> Hearing attendance is an opportunity to be heard—it is NOT complaint registration and NOT a guarantee of grievance resolution.</strong> We never fabricate facts, complaints, or legal citations.
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            borderBottom: '1px solid var(--border-main)',
            marginBottom: '1.5rem',
            overflowX: 'auto',
          }}
          role="tablist"
        >
          <button
            role="tab"
            aria-selected={activeTab === 'calendar'}
            onClick={() => setActiveTab('calendar')}
            className={`tab-btn ${activeTab === 'calendar' ? 'is-active' : ''}`}
            style={{
              padding: '0.6rem 1.2rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              border: 'none',
              borderBottom: activeTab === 'calendar' ? '3px solid var(--accent-main)' : '3px solid transparent',
              background: 'transparent',
              color: activeTab === 'calendar' ? 'var(--accent-main)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <Calendar size={16} />
            Verified Hearings ({filteredEvents.length})
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'prepare'}
            onClick={() => setActiveTab('prepare')}
            className={`tab-btn ${activeTab === 'prepare' ? 'is-active' : ''}`}
            style={{
              padding: '0.6rem 1.2rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              border: 'none',
              borderBottom: activeTab === 'prepare' ? '3px solid var(--accent-main)' : '3px solid transparent',
              background: 'transparent',
              color: activeTab === 'prepare' ? 'var(--accent-main)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <FileText size={16} />
            Preparation &amp; Hearing Note
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'followup'}
            onClick={() => setActiveTab('followup')}
            className={`tab-btn ${activeTab === 'followup' ? 'is-active' : ''}`}
            style={{
              padding: '0.6rem 1.2rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              border: 'none',
              borderBottom: activeTab === 'followup' ? '3px solid var(--accent-main)' : '3px solid transparent',
              background: 'transparent',
              color: activeTab === 'followup' ? 'var(--accent-main)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <BookmarkCheck size={16} />
            Private Follow-Up ({followUpSummary.total})
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'outcomes'}
            onClick={() => setActiveTab('outcomes')}
            className={`tab-btn ${activeTab === 'outcomes' ? 'is-active' : ''}`}
            style={{
              padding: '0.6rem 1.2rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              border: 'none',
              borderBottom: activeTab === 'outcomes' ? '3px solid var(--accent-main)' : '3px solid transparent',
              background: 'transparent',
              color: activeTab === 'outcomes' ? 'var(--accent-main)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <HelpCircle size={16} />
            Attendance vs. Resolution Rights
          </button>
        </div>

        {/* TAB 1: VERIFIED HEARINGS CALENDAR */}
        {activeTab === 'calendar' && (
          <div>
            {/* Filter Bar */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-main)',
                borderRadius: '0.75rem',
                padding: '1rem',
                marginBottom: '1.5rem',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.75rem',
                alignItems: 'center',
              }}
            >
              <div style={{ flex: '1 1 200px', position: 'relative' }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-secondary)',
                  }}
                />
                <input
                  type="text"
                  placeholder="Search by venue, authority, department..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem 0.5rem 2rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-main)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              <div style={{ flex: '0 1 180px' }}>
                <select
                  aria-label="Filter by district"
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-main)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem',
                  }}
                >
                  <option value="all">All UP Districts</option>
                  {districts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ flex: '0 1 200px' }}>
                <select
                  aria-label="Filter by issue category"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-main)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem',
                  }}
                >
                  <option value="all">All Issue Categories</option>
                  {ISSUE_CATEGORY_OPTIONS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                }}
              >
                <input
                  type="checkbox"
                  checked={includeExpired}
                  onChange={(e) => setIncludeExpired(e.target.checked)}
                />
                Show expired / past hearings
              </label>
            </div>

            {/* Events Grid */}
            {filteredEvents.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '3rem 1rem',
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--border-main)',
                  color: 'var(--text-secondary)',
                }}
              >
                <AlertTriangle size={36} style={{ color: 'var(--accent-main)', marginBottom: '0.5rem' }} />
                <h3>No verified hearings matched your filter</h3>
                <p style={{ fontSize: '0.9rem' }}>
                  Try resetting your district filter or searching for another term.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                  gap: '1rem',
                }}
              >
                {filteredEvents.map((evt) => {
                  const isExpired = evt.isExpired;
                  const freshness = evt.freshness;

                  return (
                    <div
                      key={evt.id}
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-main)',
                        borderRadius: '0.75rem',
                        padding: '1.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        opacity: isExpired ? 0.75 : 1,
                      }}
                    >
                      <div>
                        {/* Top Badges */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: '0.5rem',
                            marginBottom: '0.5rem',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '0.25rem',
                              backgroundColor: 'rgba(56, 189, 248, 0.1)',
                              color: 'var(--accent-main)',
                              fontWeight: 600,
                            }}
                          >
                            {evt.eventType.replace('_', ' ')}
                          </span>

                          <span
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '0.25rem',
                              backgroundColor: isExpired
                                ? 'rgba(239, 68, 68, 0.1)'
                                : 'rgba(16, 185, 129, 0.1)',
                              color: isExpired ? '#ef4444' : '#10b981',
                              fontWeight: 600,
                            }}
                          >
                            {evt.statusLabel}
                          </span>
                        </div>

                        <h3
                          style={{
                            fontSize: '1.1rem',
                            margin: '0.25rem 0 0.5rem 0',
                            color: 'var(--text-main)',
                          }}
                        >
                          {evt.title}
                        </h3>

                        <div
                          style={{
                            fontSize: '0.85rem',
                            color: 'var(--text-secondary)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.35rem',
                            marginBottom: '1rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Building2 size={14} />
                            <span>{evt.authority}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Clock size={14} />
                            <span>
                              {formatHearingDate(evt.eventDate)} ({evt.startTime} - {evt.endTime})
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                            <MapPin size={14} style={{ marginTop: '2px', flexShrink: 0 }} />
                            <span>
                              {evt.venue?.name}, {evt.venue?.address}
                            </span>
                          </div>
                        </div>

                        {/* Verification Metadata */}
                        <div
                          style={{
                            fontSize: '0.78rem',
                            backgroundColor: 'var(--bg-main)',
                            padding: '0.5rem',
                            borderRadius: '0.4rem',
                            border: '1px solid var(--border-main)',
                            marginBottom: '1rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                            <span>Official Source:</span>
                            <a
                              href={evt.officialSource?.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: 'var(--accent-main)',
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                              }}
                            >
                              {evt.sourceHost}
                              <ExternalLink size={10} />
                            </a>
                          </div>
                          <div style={{ color: 'var(--text-secondary)' }}>
                            Verified on: {formatHearingDate(evt.lastVerifiedDate)} • {freshness.label}
                          </div>
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '0.5rem',
                          borderTop: '1px solid var(--border-main)',
                          paddingTop: '0.75rem',
                        }}
                      >
                        <button
                          onClick={() => {
                            handleSelectHearing(evt.id);
                            setActiveTab('prepare');
                          }}
                          style={{
                            flex: 1,
                            padding: '0.45rem 0.6rem',
                            borderRadius: '0.4rem',
                            border: 'none',
                            backgroundColor: 'var(--accent-main)',
                            color: '#fff',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Prepare Pack
                        </button>

                        <button
                          onClick={() => setDetailEvent(evt)}
                          style={{
                            padding: '0.45rem 0.6rem',
                            borderRadius: '0.4rem',
                            border: '1px solid var(--border-main)',
                            backgroundColor: 'transparent',
                            color: 'var(--text-main)',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                          }}
                        >
                          Notice Details
                        </button>

                        <button
                          onClick={() => {
                            setFollowUpEvent(evt);
                            setFollowUpModalOpen(true);
                          }}
                          title="Record post-hearing outcome"
                          style={{
                            padding: '0.45rem 0.6rem',
                            borderRadius: '0.4rem',
                            border: '1px solid var(--border-main)',
                            backgroundColor: 'transparent',
                            color: 'var(--text-main)',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                          }}
                        >
                          Log Outcome
                        </button>

                        <button
                          onClick={() => setCorrectionEvent(evt)}
                          title="Propose notice update"
                          style={{
                            padding: '0.45rem 0.5rem',
                            borderRadius: '0.4rem',
                            border: '1px solid var(--border-main)',
                            backgroundColor: 'transparent',
                            color: 'var(--text-secondary)',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          Correction
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PREPARATION & NOTE GENERATOR */}
        {activeTab === 'prepare' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {/* Left Column: Input Form & Checklist */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-main)',
                borderRadius: '0.75rem',
                padding: '1.25rem',
              }}
            >
              <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem', color: 'var(--text-main)' }}>
                1. Submission Checklist &amp; Citizen Inputs
              </h3>

              {/* Hearing Event Picker */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Target Public Hearing:
                </label>
                <select
                  value={selectedHearingId}
                  onChange={(e) => handleSelectHearing(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '0.4rem',
                    border: '1px solid var(--border-main)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                  }}
                >
                  {UP_JAN_SUNWAI_EVENTS.map((evt) => (
                    <option key={evt.id} value={evt.id}>
                      {evt.title} ({evt.jurisdiction.district}) — {formatHearingDate(evt.eventDate)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Issue Category */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Issue Category:
                </label>
                <select
                  value={prepCategory}
                  onChange={(e) => setPrepCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '0.4rem',
                    border: '1px solid var(--border-main)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                  }}
                >
                  {ISSUE_CATEGORY_OPTIONS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Citizen Name */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Citizen / Applicant Name:
                </label>
                <input
                  type="text"
                  placeholder="Your full legal name as per photo ID"
                  value={prepCitizenName}
                  onChange={(e) => setPrepCitizenName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '0.4rem',
                    border: '1px solid var(--border-main)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                  }}
                />
              </div>

              {/* Facts & Chronology */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Chronology of Facts (Oldest First):
                </label>
                <textarea
                  rows={3}
                  placeholder="2026-08-10 — Demarcation application submitted at Tehsil&#10;2026-09-15 — Revenue inspector visited but report not completed"
                  value={prepChronology}
                  onChange={(e) => setPrepChronology(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '0.4rem',
                    border: '1px solid var(--border-main)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              {/* Prior Complaint References */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Prior Complaint References (IGRS / Diary / Portal Nos.):
                </label>
                <input
                  type="text"
                  placeholder="e.g. IGRS/2026/88129 or write 'None'"
                  value={prepPriorComplaints}
                  onChange={(e) => setPrepPriorComplaints(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '0.4rem',
                    border: '1px solid var(--border-main)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                  }}
                />
              </div>

              {/* Specific Requested Remedy */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Specific Remedy Requested from Authority:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Expedite demarcation report and provide written status"
                  value={prepRequestedRemedy}
                  onChange={(e) => setPrepRequestedRemedy(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '0.4rem',
                    border: '1px solid var(--border-main)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                  }}
                />
              </div>

              {/* Attachments Builder */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Attachments Index (Auto-numbered as A1, A2...):
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Document description (e.g. Khatauni copy)"
                    value={newAttachmentLabel}
                    onChange={(e) => setNewAttachmentLabel(e.target.value)}
                    style={{
                      flex: 2,
                      padding: '0.45rem',
                      borderRadius: '0.4rem',
                      border: '1px solid var(--border-main)',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-main)',
                      fontSize: '0.85rem',
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Pages"
                    min="1"
                    max="100"
                    value={newAttachmentPages}
                    onChange={(e) => setNewAttachmentPages(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '0.45rem',
                      borderRadius: '0.4rem',
                      border: '1px solid var(--border-main)',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-main)',
                      fontSize: '0.85rem',
                    }}
                  />
                  <button
                    onClick={handleAddAttachment}
                    type="button"
                    style={{
                      padding: '0.45rem 0.8rem',
                      borderRadius: '0.4rem',
                      border: 'none',
                      backgroundColor: 'var(--accent-main)',
                      color: '#fff',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    Add
                  </button>
                </div>

                {prepAttachments.length > 0 && (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem' }}>
                    {prepAttachments.map((att, idx) => (
                      <li
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.35rem 0.5rem',
                          backgroundColor: 'var(--bg-main)',
                          borderRadius: '0.3rem',
                          marginBottom: '0.3rem',
                        }}
                      >
                        <span>
                          <strong>A{idx + 1}</strong>: {att.label} {att.pages ? `(${att.pages} pages)` : ''}
                        </span>
                        <button
                          onClick={() => handleRemoveAttachment(idx)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#ef4444',
                            cursor: 'pointer',
                          }}
                        >
                          <X size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Checklist Guidance Box */}
              {currentChecklist && (
                <div
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-main)',
                    borderRadius: '0.4rem',
                    padding: '0.75rem',
                    fontSize: '0.8rem',
                    marginBottom: '1rem',
                  }}
                >
                  <strong style={{ display: 'block', marginBottom: '0.3rem', color: 'var(--text-main)' }}>
                    Preparation Requirements ({currentChecklist.issueCategoryLabel}):
                  </strong>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-secondary)' }}>
                    {currentChecklist.items.slice(0, 4).map((item) => (
                      <li key={item.id} style={{ marginBottom: '0.2rem' }}>
                        {item.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  style={{
                    flex: 1,
                    padding: '0.6rem',
                    borderRadius: '0.4rem',
                    border: '1px solid var(--border-main)',
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-main)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Save Draft Locally
                </button>

                <button
                  type="button"
                  onClick={() => setPrintModalOpen(true)}
                  style={{
                    flex: 1,
                    padding: '0.6rem',
                    borderRadius: '0.4rem',
                    border: 'none',
                    backgroundColor: 'var(--accent-main)',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <Printer size={16} />
                  Print / Export Pack
                </button>
              </div>
            </div>

            {/* Right Column: Live Generated Hearing Note Preview */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-main)',
                borderRadius: '0.75rem',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem',
                  }}
                >
                  <h3 style={{ fontSize: '1.15rem', margin: 0, color: 'var(--text-main)' }}>
                    2. Live Hearing Note Preview
                  </h3>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '0.25rem',
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      color: '#10b981',
                      fontWeight: 600,
                    }}
                  >
                    No Fabricated Citations
                  </span>
                </div>

                {/* Preformatted Note Box */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-main)',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace',
                    whiteHeight: '1.6',
                    maxHeight: '480px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                    color: 'var(--text-main)',
                  }}
                >
                  {currentHearingNote?.text}
                </div>
              </div>

              {/* Statutory Note */}
              <div
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  marginTop: '1rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid var(--border-main)',
                }}
              >
                <em>{PREPARATION_DISCLAIMER}</em>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PRIVATE POST-HEARING FOLLOW-UP TRACKER */}
        {activeTab === 'followup' && (
          <div>
            {/* Privacy Guarantee Header */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-main)',
                borderRadius: '0.75rem',
                padding: '1rem 1.25rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.25rem 0', color: 'var(--text-main)' }}>
                  Private Post-Hearing Tracking
                </h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {PRIVACY_NOTICE}
                </p>
              </div>

              <button
                onClick={() => {
                  setFollowUpEvent(UP_JAN_SUNWAI_EVENTS[0]);
                  setFollowUpModalOpen(true);
                }}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.4rem',
                  border: 'none',
                  backgroundColor: 'var(--accent-main)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <Plus size={16} />
                Log Outcome
              </button>
            </div>

            {/* Status Summary Pills */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '0.75rem',
                marginBottom: '1.5rem',
              }}
            >
              <div
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-main)',
                  borderRadius: '0.5rem',
                  padding: '0.75rem 1rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Tracked</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {followUpSummary.total}
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-main)',
                  borderRadius: '0.5rem',
                  padding: '0.75rem 1rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>Overdue Follow-Ups</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ef4444' }}>
                  {followUpSummary.counts[FOLLOW_UP_STATE.OVERDUE] || 0}
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-main)',
                  borderRadius: '0.5rem',
                  padding: '0.75rem 1rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--warning, #f59e0b)' }}>Due Soon (7 Days)</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--warning, #f59e0b)' }}>
                  {(followUpSummary.counts[FOLLOW_UP_STATE.DUE_SOON] || 0) +
                    (followUpSummary.counts[FOLLOW_UP_STATE.DUE_TODAY] || 0)}
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-main)',
                  borderRadius: '0.5rem',
                  padding: '0.75rem 1rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#10b981' }}>Confirmed Resolved</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#10b981' }}>
                  {followUpSummary.counts[FOLLOW_UP_STATE.COMPLETED] || 0}
                </div>
              </div>
            </div>

            {/* Follow-up Cards */}
            {followUpSummary.records.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '3rem 1rem',
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--border-main)',
                  color: 'var(--text-secondary)',
                }}
              >
                <FileCheck size={36} style={{ color: 'var(--accent-main)', marginBottom: '0.5rem' }} />
                <h3>No private follow-ups logged yet</h3>
                <p style={{ fontSize: '0.9rem', maxWidth: '480px', margin: '0 auto 1rem auto' }}>
                  After attending a Jan Sunwai or Tehsil Diwas, log whether you received a hearing slip, complaint number, or receipt so you don&apos;t lose track of your next step.
                </p>
                <button
                  onClick={() => {
                    setFollowUpEvent(UP_JAN_SUNWAI_EVENTS[0]);
                    setFollowUpModalOpen(true);
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.4rem',
                    border: 'none',
                    backgroundColor: 'var(--accent-main)',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Record Your First Outcome
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {followUpSummary.records.map((rec) => (
                  <div
                    key={rec.id}
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-main)',
                      borderRadius: '0.75rem',
                      padding: '1.25rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '0.5rem',
                      }}
                    >
                      <div>
                        <h4 style={{ fontSize: '1.05rem', margin: '0 0 0.2rem 0', color: 'var(--text-main)' }}>
                          {rec.eventTitle}
                        </h4>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          Hearing Date: {formatHearingDate(rec.eventDate)}
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '0.25rem',
                          backgroundColor:
                            rec.followUpState.state === FOLLOW_UP_STATE.OVERDUE
                              ? 'rgba(239, 68, 68, 0.1)'
                              : rec.followUpState.state === FOLLOW_UP_STATE.COMPLETED
                                ? 'rgba(16, 185, 129, 0.1)'
                                : 'rgba(56, 189, 248, 0.1)',
                          color:
                            rec.followUpState.state === FOLLOW_UP_STATE.OVERDUE
                              ? '#ef4444'
                              : rec.followUpState.state === FOLLOW_UP_STATE.COMPLETED
                                ? '#10b981'
                                : 'var(--accent-main)',
                          fontWeight: 600,
                        }}
                      >
                        {rec.followUpStateLabel}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '0.75rem',
                        fontSize: '0.85rem',
                        margin: '1rem 0',
                        backgroundColor: 'var(--bg-main)',
                        padding: '0.75rem',
                        borderRadius: '0.4rem',
                      }}
                    >
                      <div>
                        <strong style={{ color: 'var(--text-secondary)', display: 'block' }}>Attendance:</strong>
                        <span>{rec.attendanceStatusLabel}</span>
                      </div>
                      <div>
                        <strong style={{ color: 'var(--text-secondary)', display: 'block' }}>Written Acknowledgement:</strong>
                        <span>
                          {rec.acknowledgementTypeLabel}{' '}
                          {rec.acknowledgementNumber ? `(#${rec.acknowledgementNumber})` : ''}
                        </span>
                      </div>
                      <div>
                        <strong style={{ color: 'var(--text-secondary)', display: 'block' }}>Officer / Desk:</strong>
                        <span>{rec.officerOrDesk || 'Not recorded'}</span>
                      </div>
                      <div>
                        <strong style={{ color: 'var(--text-secondary)', display: 'block' }}>Follow-Up Date:</strong>
                        <span>{formatHearingDate(rec.followUpDate)}</span>
                      </div>
                    </div>

                    {rec.nextAction && (
                      <div style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                        <strong>Next Action:</strong> {rec.nextAction}
                      </div>
                    )}

                    {rec.notes && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                        <strong>Notes:</strong> {rec.notes}
                      </div>
                    )}

                    {rec.isResolved && (
                      <div
                        style={{
                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                          color: '#065f46',
                          padding: '0.5rem',
                          borderRadius: '0.3rem',
                          fontSize: '0.8rem',
                          marginBottom: '0.75rem',
                        }}
                      >
                        ✓ Confirmed Resolved: Reference {rec.resolutionReference} on {formatHearingDate(rec.resolvedDate)}
                      </div>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '0.5rem',
                        borderTop: '1px solid var(--border-main)',
                        paddingTop: '0.75rem',
                      }}
                    >
                      {!rec.isResolved && (
                        <button
                          onClick={() => {
                            setRecordToResolve(rec);
                            setResolveModalOpen(true);
                          }}
                          style={{
                            padding: '0.4rem 0.8rem',
                            borderRadius: '0.3rem',
                            border: 'none',
                            backgroundColor: '#10b981',
                            color: '#fff',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Confirm Written Resolution
                        </button>
                      )}

                      <button
                        onClick={() => {
                          upJanSunwaiStore.deleteFollowUpRecord(rec.id, citizenId);
                          setVersion((v) => v + 1);
                          showToast?.('Record deleted.', 'info');
                        }}
                        style={{
                          padding: '0.4rem 0.6rem',
                          borderRadius: '0.3rem',
                          border: '1px solid var(--border-main)',
                          backgroundColor: 'transparent',
                          color: '#ef4444',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: OUTCOME DISTINCTIONS GUIDE */}
        {activeTab === 'outcomes' && (
          <div>
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-main)',
                borderRadius: '0.75rem',
                padding: '1.25rem',
                marginBottom: '1.5rem',
              }}
            >
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                Understanding Your Rights: Attendance vs. Registration vs. Resolution
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0' }}>
                {OUTCOME_DISTINCTION_NOTICE}
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                  gap: '1rem',
                }}
              >
                {OUTCOME_DISTINCTIONS.map((item) => (
                  <div
                    key={item.key}
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-main)',
                      borderRadius: '0.5rem',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <h4
                        style={{
                          fontSize: '1.05rem',
                          marginTop: 0,
                          marginBottom: '0.5rem',
                          color: 'var(--text-main)',
                        }}
                      >
                        {item.title}
                      </h4>
                      <p style={{ fontSize: '0.85rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                        {item.summary}
                      </p>
                    </div>

                    <div
                      style={{
                        marginTop: '1rem',
                        padding: '0.5rem',
                        backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        borderRadius: '0.3rem',
                        fontSize: '0.75rem',
                        color: '#b91c1c',
                        fontWeight: 600,
                      }}
                    >
                      Does NOT equal: {item.notEquivalentTo}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Event Detail Modal */}
        {detailEvent && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              zIndex: 1000,
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-main)',
                borderRadius: '0.75rem',
                maxWidth: '600px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: '1.5rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-main)' }}>
                  {detailEvent.title}
                </h3>
                <button
                  onClick={() => setDetailEvent(null)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <strong>Authority &amp; Department:</strong>
                  <div>{detailEvent.authority} ({detailEvent.department})</div>
                </div>

                <div>
                  <strong>Jurisdiction:</strong>
                  <div>{detailEvent.jurisdiction.district}, Tehsil {detailEvent.jurisdiction.tehsil}</div>
                </div>

                <div>
                  <strong>Date &amp; Venue:</strong>
                  <div>{formatHearingDate(detailEvent.eventDate)} ({detailEvent.startTime} - {detailEvent.endTime})</div>
                  <div>{detailEvent.venue?.name}, {detailEvent.venue?.address}</div>
                </div>

                <div>
                  <strong>Eligibility Rules:</strong>
                  <ul style={{ paddingLeft: '1.25rem', margin: '0.25rem 0' }}>
                    {detailEvent.eligibility?.map((el, i) => (
                      <li key={i}>{el}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <strong>Walk-in &amp; Registration Instructions:</strong>
                  <div>{detailEvent.registration?.instructions}</div>
                </div>

                <div>
                  <strong>Official Verification Source:</strong>
                  <div>
                    {detailEvent.officialSource?.name} —{' '}
                    <a
                      href={detailEvent.officialSource?.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--accent-main)' }}
                    >
                      {detailEvent.officialSource?.url}
                    </a>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '2px' }}>
                    Last verified: {formatHearingDate(detailEvent.lastVerifiedDate)}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
                <button
                  onClick={() => setDetailEvent(null)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.4rem',
                    border: 'none',
                    backgroundColor: 'var(--accent-main)',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Record Follow-Up Modal */}
        {followUpModalOpen && followUpEvent && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              zIndex: 1000,
            }}
          >
            <form
              onSubmit={handleSaveFollowUp}
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-main)',
                borderRadius: '0.75rem',
                maxWidth: '540px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: '1.5rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)' }}>
                  Record Outcome: {followUpEvent.title}
                </h3>
                <button
                  type="button"
                  onClick={() => setFollowUpModalOpen(false)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.2rem' }}>Attendance Status:</label>
                  <select
                    value={followUpAttendance}
                    onChange={(e) => setFollowUpAttendance(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid var(--border-main)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}
                  >
                    {Object.values(ATTENDANCE_STATUS).map((st) => (
                      <option key={st} value={st}>
                        {ATTENDANCE_STATUS_LABELS[st]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.2rem' }}>Written Acknowledgement Type:</label>
                  <select
                    value={followUpAckType}
                    onChange={(e) => setFollowUpAckType(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid var(--border-main)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}
                  >
                    {Object.values(ACKNOWLEDGEMENT_TYPE).map((ak) => (
                      <option key={ak} value={ak}>
                        {ACKNOWLEDGEMENT_TYPE_LABELS[ak]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.2rem' }}>Acknowledgement Number / Receipt Reference:</label>
                  <input
                    type="text"
                    placeholder="e.g. SLIP-2026/092 or IGRS-8820"
                    value={followUpAckNumber}
                    onChange={(e) => setFollowUpAckNumber(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid var(--border-main)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.2rem' }}>Officer / Desk (Optional):</label>
                  <input
                    type="text"
                    placeholder="e.g. Counter 3, Tehsildar Sadar"
                    value={followUpOfficerDesk}
                    onChange={(e) => setFollowUpOfficerDesk(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid var(--border-main)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.2rem' }}>Next Action Needed:</label>
                  <input
                    type="text"
                    placeholder="e.g. Collect copy of demarcation report from tehsil record room"
                    value={followUpNextAction}
                    onChange={(e) => setFollowUpNextAction(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid var(--border-main)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.2rem' }}>Follow-Up Due Date:</label>
                  <input
                    type="date"
                    value={followUpDateVal}
                    onChange={(e) => setFollowUpDateVal(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid var(--border-main)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.2rem' }}>Notes:</label>
                  <textarea
                    rows={2}
                    placeholder="Private notes about what was discussed"
                    value={followUpNotes}
                    onChange={(e) => setFollowUpNotes(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid var(--border-main)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setFollowUpModalOpen(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.4rem',
                    border: '1px solid var(--border-main)',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.4rem',
                    border: 'none',
                    backgroundColor: 'var(--accent-main)',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Save Outcome
                </button>
              </div>
            </form>
          </div>
        )}

        {/* MODAL: Confirm Resolution Modal */}
        {resolveModalOpen && recordToResolve && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              zIndex: 1000,
            }}
          >
            <form
              onSubmit={handleConfirmResolution}
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-main)',
                borderRadius: '0.75rem',
                maxWidth: '480px',
                width: '100%',
                padding: '1.5rem',
              }}
            >
              <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>
                Confirm Written Resolution
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                A grievance can only be marked resolved if you hold a written closure, compliance letter, or formal order.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.2rem' }}>
                    Written Order / Compliance Reference:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ORDER/REV/2026/102"
                    value={resolutionRef}
                    onChange={(e) => setResolutionRef(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid var(--border-main)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.2rem' }}>
                    Date of Written Resolution:
                  </label>
                  <input
                    type="date"
                    required
                    value={resolutionDate}
                    onChange={(e) => setResolutionDate(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid var(--border-main)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.2rem' }}>
                    Resolution Notes (Optional):
                  </label>
                  <textarea
                    rows={2}
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid var(--border-main)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setResolveModalOpen(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.4rem',
                    border: '1px solid var(--border-main)',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.4rem',
                    border: 'none',
                    backgroundColor: '#10b981',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Confirm Resolved
                </button>
              </div>
            </form>
          </div>
        )}

        {/* MODAL: Source Correction Modal */}
        {correctionEvent && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              zIndex: 1000,
            }}
          >
            <form
              onSubmit={handleSubmitCorrection}
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-main)',
                borderRadius: '0.75rem',
                maxWidth: '520px',
                width: '100%',
                padding: '1.5rem',
              }}
            >
              <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>
                Suggest Notice Correction: {correctionEvent.title}
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                If an authority published a rescheduled date, updated venue, or corrigendum, submit the details with a valid government portal link.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.2rem' }}>Field to Correct:</label>
                  <select
                    value={correctionField}
                    onChange={(e) => setCorrectionField(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid var(--border-main)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}
                  >
                    <option value="eventDate">Event Date (YYYY-MM-DD)</option>
                    <option value="startTime">Start Time (HH:MM)</option>
                    <option value="endTime">End Time (HH:MM)</option>
                    <option value="venueName">Venue Name</option>
                    <option value="venueAddress">Venue Address</option>
                    <option value="officialSourceUrl">Official Source Portal (*.gov.in / *.nic.in)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.2rem' }}>Proposed Correct Value:</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter the updated official value"
                    value={correctionProposedVal}
                    onChange={(e) => setCorrectionProposedVal(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid var(--border-main)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.2rem' }}>Reason &amp; Context (min 10 characters):</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Explain where this update was published or reason for change"
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid var(--border-main)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.2rem' }}>Official Evidence URL (Optional https://):</label>
                  <input
                    type="url"
                    placeholder="https://lucknow.nic.in/corrigendum-notice.pdf"
                    value={correctionEvidenceUrl}
                    onChange={(e) => setCorrectionEvidenceUrl(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid var(--border-main)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setCorrectionEvent(null)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.4rem',
                    border: '1px solid var(--border-main)',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.4rem',
                    border: 'none',
                    backgroundColor: 'var(--accent-main)',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Submit Correction
                </button>
              </div>
            </form>
          </div>
        )}

        {/* MODAL: Printable Pack Preview */}
        {printModalOpen && compiledPack && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              zIndex: 1000,
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-main)',
                borderRadius: '0.75rem',
                maxWidth: '700px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: '1.5rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-main)' }}>
                  Printable Preparation Pack
                </h3>
                <button
                  onClick={() => setPrintModalOpen(false)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.85rem',
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={includePrivateInPrint}
                    onChange={(e) => setIncludePrivateInPrint(e.target.checked)}
                  />
                  Include private follow-up details &amp; notes in this export
                </label>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border-main)',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  fontSize: '0.85rem',
                  fontFamily: 'monospace',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  color: 'var(--text-main)',
                  marginBottom: '1rem',
                }}
              >
                {packText}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  onClick={handleCopyPackText}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.4rem',
                    border: '1px solid var(--border-main)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.85rem',
                  }}
                >
                  {copiedText ? <Check size={16} /> : <Copy size={16} />}
                  {copiedText ? 'Copied' : 'Copy Plain Text'}
                </button>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setPrintModalOpen(false)}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '0.4rem',
                      border: '1px solid var(--border-main)',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    Close
                  </button>
                  <button
                    onClick={handlePrintPack}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '0.4rem',
                      border: 'none',
                      backgroundColor: 'var(--accent-main)',
                      color: '#fff',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <Printer size={16} />
                    Open Print Window
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
