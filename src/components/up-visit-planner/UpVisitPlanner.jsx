import { useState, useMemo, useEffect } from 'react';
import { generateVisitPack, exportVisitPackOffline, VISIT_PACKS, getPrintableVisitPack } from '../../data/upVisitPlans.js';
import { UP_SERVICES, UP_SERVICE_CATEGORIES } from '../../data/upServices.js';
import { UP_OFFICES } from '../../data/upOffices.js';
import { useTranslation } from 'react-i18next';
// Import lucide-react icons
import {
  X,
  CheckCircle2,
  Calendar,
  Truck,
  FileText,
  Printer,
  ShieldAlert,
  Info,
  Eye,
  EyeOff,
  Mail,
  MapPin,
  Repeat,
  Settings,
  Search,
  Clipboard,
  Folder,
  Download,
  Upload,
  Delete,
  AlertCircle,
  Handshake,
  Palette,
} from 'lucide-react';

const UP_VISIT_PLANNER = {
  name: 'UP Government Office Visit Readiness and Token/Counter Journey Planner',
  description: 'Planner for Tehsil and Municipal office visits in Uttar Pradesh. Provides verified office details, visit packs, and private visit note recording.',
};

const DEFAULT_OFFICE = 'lucknow-tehsil-sadar';

/**
 * UpVisitPlanner - Main component for the UP Government Office Visit Readiness and Token/Counter Journey Planner.
 *
 * Features:
 * - Select a civic task/service
 - Select a UP office (tehsil/municipal)
 - Generate a task-specific visit pack with document requirements, fees, forms, questions
 - Record private visit date, token number, counter visited, outcome, deficiency memo, next step
 - Export printable/offline visit packs in Hindi/English/Urdu
 - Report incorrect office information (requires moderator verification)
 - Distinguish published official instructions from citizen observations
 - Mark uncertain counter details clearly
 */
const UpVisitPlanner = ({ isOpen, onClose }) => {
  // State: selected service and office
  const [selectedServiceId, setSelectedServiceId] = useState('birth-certificate');
  const [selectedOfficeId, setSelectedOfficeId] = useState(DEFAULT_OFFICE);
  const [visitPack, setVisitPack] = useState(null);
  const [language, setLanguage] = useState('en'); // 'en' | 'hi' | 'ur'
  const [showPrivateNotes, setShowPrivateNotes] = useState(false);
  const [privateNotes, setPrivateNotesState] = useState({
    visitDate: '',
    tokenNumber: '',
    counterVisited: '',
    outcome: '',
    deficiencyMemo: '',
    nextStep: '',
  });
  const [reporting, setReporting] = useState({
    isReporting: false,
    success: false,
    error: null,
  });
  const [selectedCounter, setSelectedCounter] = useState(null);

  // Memoized visit pack generation
  useEffect(() => {
    try {
      const pack = generateVisitPack(selectedServiceId, selectedOfficeId);
      setVisitPack(pack);
      // Set language based on office language coverage
      const office = UP_OFFICES[selectedOfficeId];
      if (office) {
        const supported = office.languageCoverage.supportedLanguages;
        // Default to English if user language not supported; otherwise try to match
        setLanguage(supported.includes('Hindi') ? 'hi' : supported.includes('Urdu') ? 'ur' : 'en');
      }
    } catch (e) {
      console.error('Error generating visit pack:', e);
    }
  }, [selectedServiceId, selectedOfficeId, language]);

  // Office and service options for UI
  const officeOptions = useMemo(() => {
    return Object.keys(UP_OFFICES).map((key) => ({
      key,
      label: UP_OFFICES[key].name,
      category: UP_OFFICES[key].category,
    }));
  }, []);

  const serviceOptions = useMemo(() => {
    return UP_SERVICES.map((service) => ({
      id: service.id,
      name: service.name,
      category: service.category,
    }));
  }, []);

  // Handle language change
  const handleLanguageChange = (lang) => {
    setLanguage(lang);
  };

  // Handle service change
  const handleServiceChange = (serviceId) => {
    setSelectedServiceId(serviceId);
    // Reset visit pack and private notes when service changes
    setVisitPack(null);
    setPrivateNotesState({
      visitDate: '',
      tokenNumber: '',
      counterVisited: '',
      outcome: '',
      deficiencyMemo: '',
      nextStep: '',
    });
  };

  // Handle office change
  const handleOfficeChange = (officeId) => {
    setSelectedOfficeId(officeId);
    setVisitPack(null);
    setPrivateNotesState({
      visitDate: '',
      tokenNumber: '',
      counterVisited: '',
      outcome: '',
      deficiencyMemo: '',
      nextStep: '',
    });
  };

  // Handle private note field change
  const handlePrivateNoteChange = (e) => {
    const { name, value } = e.target;
    setPrivateNotesState({
      ...privateNotes,
      [name]: value,
    });
  };

  // Reset private notes
  const resetPrivateNotes = () => {
    setPrivateNotesState({
      visitDate: '',
      tokenNumber: '',
      counterVisited: '',
      outcome: '',
      deficiencyMemo: '',
      nextStep: '',
    });
  };

  // Save/record private visit
  const handleSaveVisit = () => {
    if (!visitPack) return;

    // Validate required fields
    if (!privateNotes.visitDate) {
      // Show error - but in this simple component, just alert
      alert('Please enter the visit date.');
      return;
    }

    // In a real implementation, this would be stored privately (localStorage or user auth)
    // For now, we'll just show a success and reset
    // The notes are private and not publicly indexed

    // Simulate saving - in production, this would involve a private API call
    // or localStorage persistence that is not accessible to the public system
    const visitRecord = {
      ...privateNotes,
      serviceId: visitPack.serviceId,
      serviceName: visitPack.serviceName,
      officeId: visitPack.officeId,
      officeName: visitPack.officeName,
      timestamp: new Date().toISOString(),
    };

    // In production: store privately (e.g., user's local storage or encrypted backend)
    // For this demo, we'll just alert and reset
    // We do NOT persist to any public state

    // Show success and reset
    setPrivateNotesState({
      visitDate: '',
      tokenNumber: '',
      counterVisited: '',
      outcome: '',
      deficiencyMemo: '',
      nextStep: '',
    });

    // Re-generate visit pack (it will retain the same structure)
    // The privacy fields are internal only
    alert('Visit recorded privately. Notes are not publicly indexed.');
  };

  // Export printable visit pack
  const handleExportPrint = () => {
    if (!visitPack) return;
    const printable = getPrintableVisitPack(visitPack, language);
    // In a real app, this would trigger a print dialog or download
    // For now, just show the content and offer to save
    const blob = new Blob([printable], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${visitPack.serviceName.replace(/[^a-z0-9]/gi, '_')}_visit_pack_${language}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Report incorrect office information
  const handleReportCorrection = async () => {
    if (!visitPack || !window.confirm('Are you sure you want to report incorrect office information? This will require moderator verification before any public update.')) {
      return;
    }

    setReporting(prev => ({ ...prev, isReporting: true }));

    // In a real implementation, this would call an API endpoint
    // For now, simulate the report flow
    const reportData = {
      officeId: visitPack.officeId,
      officeName: visitPack.officeName,
      reportedBy: 'citizen', // Would be user-identified in production
      proposedChange: '',
      officialSourceUrl: '',
      contributorRole: 'citizen',
    };

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock successful moderation
    setReporting(prev => ({
      ...prev,
      isReporting: false,
      success: true,
      error: null,
    }));

    // Reset form
    setReporting(prev => ({ ...prev, isReporting: false, success: false }));

    alert('Your report has been submitted. It requires moderator verification before any public update.');
  };

  // Render uncertainty markers for counters
  const renderUncertaintyMarkers = () => {
    if (!visitPack) return null;
    const office = UP_OFFICES[visitPack.officeId];
    if (!office || !office.counters) return null;

    return office.counters.map((counter) => ({
      counterId: counter.id,
      counterName: counter.name,
      uncertainty: !!counter.uncertaintyNote,
      markedUncertain: !!counter.uncertaintyNote,
    }));
  };

  // Render the visit pack display
  const renderVisitPackDisplay = () => {
    if (!visitPack) return null;

    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        {/* Service & Office Header */}
        <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>
            {visitPack.serviceName}
          </h3>
          <p style={{ margin: '0 0 0.25rem', fontSize: '0.9rem', color: '#64748b' }}>
            {visitPack.officeName}
          </p>
          <p style={{ margin: '0', fontSize: '0.8rem', color: '#64748b' }}>
            {visitPack.officeAddress}, {visitPack.officeCity} - {visitPack.officePincode}
          </p>
        </div>

        {/* Office Hours */}
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: '600' }}>
            Public Visiting Hours
          </h4>
          <dl style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', margin: 0 }}>
            <div>
              <dt style={{ margin: '0', fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>
                Days
              </dt>
              <dd style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>
                {visitPack.officeHours.days}
              </dd>
            </div>
            <div>
              <dt style={{ margin: '0', fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>
                Hours
              </dt>
              <dd style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>
                {visitPack.officeHours.hours}
              </dd>
            </div>
            {visitPack.officeHours.lunchBreak && (
              <div>
                <dt style={{ margin: '0', fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>
                  Lunch Break
                </dt>
                <dd style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>
                  {visitPack.officeHours.lunchBreak}
                </dd>
              </div>
            )}
            <div>
              <dt style={{ margin: '0', fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>
                Open Saturdays
              </dt>
              <dd style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>
                {visitPack.officeHours.openSaturdays ? 'Yes' : 'No'}
              </dd>
            </div>
          </dl>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.7rem', color: '#94a3b8' }}>
            Source: {visitPack.publicHoursSource} (verified {visitPack.publicHoursLastVerified})
          </p>
        </div>

        {/* Counters */}
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: '600' }}>
            Counters & Desks
          </h4>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
            Token distribution and counter assignment may vary; confirm at enquiry desk.
          </p>
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.5rem', fontSize: '0.8rem' }}>
            {visitPack.counters.map((counter) => (
              <li key={counter.id} style={{
                marginBottom: '0.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <span style={{ color: counter.uncertaintyNote ? '#dc2626' : '#1e293b' }}>
                  {counter.name}
                </span>
                {counter.uncertaintyNote && (
                  <span style={{ color: '#dc2626', fontSize: '0.65rem', fontStyle: 'italic' }}>
                    ⚠ {counter.uncertaintyNote}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Document Requirements */}
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: '600' }}>
            Document Requirements
          </h4>
          {visitPack.documentRequirements && Object.keys(visitPack.documentRequirements).length > 0 ? (
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.5rem', fontSize: '0.8rem' }}>
              {Object.entries(visitPack.documentRequirements).map(([req, details]) => (
                <li key={req} style={{ marginBottom: '0.25rem' }}>
                  <strong style={{ color: details.sourceType === 'official-instruction' ? '#1e293b' : '#dc2626' }}>
                    {req}
                  </strong>
                  {details.note && (
                    <div style={{ margin: '0.1rem 0 0', fontSize: '0.7rem', color: '#64748b' }}>
                      {details.note}
                    </div>
                  )}
                  {details.sourceType && (
                    <span style={{
                      display: 'inline-block',
                      marginLeft: '0.5rem',
                      padding: '0.1rem 0.3rem',
                      borderRadius: '3px',
                      fontSize: '0.65rem',
                      fontWeight: '600',
                      color: details.sourceType === 'official-instruction' ? '#059669' : '#dc2626',
                    }}>
                      {details.sourceType}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: '0', fontStyle: 'italic', color: '#64748b' }}>
              No specific requirements defined for this service.
            </p>
          )}
        </div>

        {/* Fee Information */}
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: '600' }}>
            Fee & Payment
          </h4>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>
            {visitPack.fees}
          </p>
          {visitPack.feePaymentMethod && (
            <p style={{ margin: '0.1rem 0 0', fontSize: '0.7rem', color: '#64748b' }}>
              Payment Method: {visitPack.feePaymentMethod}
            </p>
          )}
        </div>

        {/* Forms */}
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: '600' }}>
            Forms to Carry
          </h4>
          {visitPack.forms.length > 0 ? (
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.5rem', fontSize: '0.8rem' }}>
              {visitPack.forms.map((f) => (
                <li key={f.id} style={{ marginBottom: '0.25rem' }}>
                  {f.name} ({f.type})
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: '0', fontStyle: 'italic', color: '#64748b' }}>
              No forms defined.
            </p>
          )}
        </div>

        {/* Prior Acknowledgement */}
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: '600' }}>
            Prior Acknowledgement
          </h4>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
            {visitPack.priorAcknowledgement}
          </p>
        </div>

        {/* Questions to Ask */}
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: '600' }}>
            Questions to Ask at Counter
          </h4>
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.5rem', fontSize: '0.8rem' }}>
            {visitPack.questionsToAsk.map((q, idx) => (
              <li key={idx} style={{ marginBottom: '0.25rem' }}>
                {q}
              </li>
            ))}
          </ul>
        </div>

        {/* Official Sources */}
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: '600' }}>
            Official Sources
          </h4>
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.5rem', fontSize: '0.8rem', color: '#64748b' }}>
            {visitPack.officialSources.map((src) => (
              <li key={src.url} style={{ marginBottom: '0.25rem' }}>
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#3b82f6',
                    textDecoration: 'underline',
                    fontSize: '0.8rem',
                  }}
                >
                  {src.name}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Uncertainty Markers */}
        {visitPack.uncertaintyMarkers && visitPack.uncertaintyMarkers.some((m) => m.markedUncertain) && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#fef3c7', borderRadius: '0.5rem', border: '1px solid #f59e0b' }}>
            <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', fontWeight: '600', color: '#92400e' }}>
              ⚠️ Uncertain Counter Details
            </h4>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', color: '#64748b' }}>
              The following counter details are marked as uncertain and should be confirmed at the office:
            </p>
            <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.25rem', fontSize: '0.75rem' }}>
              {visitPack.uncertaintyMarkers.filter((m) => m.markedUncertain).map((m) => (
                <li key={m.counterId} style={{ marginBottom: '0.1rem' }}>
                  {m.counterName}: {m.uncertainty}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Privacy Notice */}
        <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f0f4f8', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
          <p style={{ margin: '0', fontSize: '0.7rem', color: '#64748b' }}>
            ⚠️ <strong>Privacy:</strong> Visit date, token number, counter visited, outcome, deficiency memo, and next step are recorded privately and are not publicly indexed. No sensitive documents are exposed.
          </p>
        </div>
      </div>
    );
  };

  // Render private visit notes form
  const renderPrivateNotesForm = () => {
    if (!visitPack) return null;

    return (
      <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem', marginTop: '1rem' }}>
        <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: '600' }}>
          Private Visit Recording
        </h4>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
          Record your visit details privately. These notes are not publicly indexed and no sensitive documents are exposed.
        </p>

        <form
          onSubmit={e => {
            e.preventDefault();
            handleSaveVisit();
          }}
        >
          <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div>
              <label htmlFor="visitDate" style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', marginBottom: '0.2rem' }}>
                Visit Date
              </label>
              <input
                id="visitDate"
                type="date"
                name="visitDate"
                value={privateNotes.visitDate}
                onChange={handlePrivateNoteChange}
                required
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.375rem',
                  fontSize: '0.8rem',
                }}
              />
            </div>

            <div>
              <label htmlFor="tokenNumber" style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', marginBottom: '0.2rem' }}>
                Token Number (optional)
              </label>
              <input
                id="tokenNumber"
                type="text"
                name="tokenNumber"
                value={privateNotes.tokenNumber}
                onChange={handlePrivateNoteChange}
                placeholder="e.g., TKT-12345"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.375rem',
                  fontSize: '0.8rem',
                }}
              />
            </div>

            <div>
              <label htmlFor="counterVisited" style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', marginBottom: '0.2rem' }}>
                Counter Visited
              </label>
              <input
                id="counterVisited"
                type="text"
                name="counterVisited"
                value={privateNotes.counterVisited}
                onChange={handlePrivateNoteChange}
                placeholder="e.g., Counter 1"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.375rem',
                  fontSize: '0.8rem',
                }}
              />
            </div>

            <div>
              <label htmlFor="outcome" style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', marginBottom: '0.2rem' }}>
                Outcome
              </label>
              <select
                id="outcome"
                name="outcome"
                value={privateNotes.outcome}
                onChange={handlePrivateNoteChange}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.375rem',
                  fontSize: '0.8rem',
                }}
              >
                <option value="">Select outcome</option>
                <option value="served">Served - received service</option>
                <option value="returned">Returned - come back another day</option>
                <option value="deficient">Deficient - missing documents/fees</option>
                <option value="rejected">Rejected - application not accepted</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="deficiencyMemo" style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', marginBottom: '0.2rem' }}>
                Deficiency Memo (optional)
              </label>
              <textarea
                id="deficiencyMemo"
                name="deficiencyMemo"
                rows={3}
                value={privateNotes.deficiencyMemo}
                onChange={handlePrivateNoteChange}
                placeholder="e.g., Missing original Aadhaar, fee payment issues"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.375rem',
                  fontSize: '0.8rem',
                  resize: 'vertical',
                }}
              ></textarea>
            </div>

            <div>
              <label htmlFor="nextStep" style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', marginBottom: '0.2rem' }}>
                Next Step
              </label>
              <select
                id="nextStep"
                name="nextStep"
                value={privateNotes.nextStep}
                onChange={handlePrivateNoteChange}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.375rem',
                  fontSize: '0.8rem',
                }}
              >
                <option value="">Select next step</option>
                <option value="revisit">Revisit with corrected documents</option>
                <option value="follow-up">Follow up by phone/email</option>
                <option value="escalate">Escalate to higher authority</option>
                <option value="none">No further action needed</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: '0.5rem 1rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                fontSize: '0.8rem',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              Record Visit
            </button>
            <button
              type="button"
              onClick={resetPrivateNotes}
              style={{
                flex: 1,
                padding: '0.5rem 1rem',
                background: 'transparent',
                color: '#64748b',
                border: '1px solid #cbd5e1',
                borderRadius: '0.375rem',
                fontSize: '0.8rem',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          </div>
        </form>
      </div>
    );
  };

  // Render report correction form
  const renderReportCorrection = () => {
    if (!visitPack) return null;

    return (
      <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem', marginTop: '1rem' }}>
        <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: '600' }}>
          Report Incorrect Office Information
        </h4>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
          Help us keep office information accurate. Your report will require moderator verification before any public update.
        </p>

        <form
          onSubmit={e => {
            e.preventDefault();
            handleReportCorrection();
          }}
        >
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', marginBottom: '0.2rem' }}>
                Office Name
              </label>
              <span style={{ fontWeight: '500', color: '#1e293b' }}>
                {visitPack.officeName}
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', marginBottom: '0.2rem' }}>
                Proposed Change
              </label>
              <textarea
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.375rem',
                  fontSize: '0.8rem',
                  resize: 'vertical',
                }}
                placeholder="Describe the incorrect information and the correct details"
              ></textarea>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', marginBottom: '0.2rem' }}>
                Official Source URL (optional)
              </label>
              <input
                type="url"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.375rem',
                  fontSize: '0.8rem',
                }}
                placeholder="https://example.gov.in"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', marginBottom: '0.2rem' }}>
                Your Role
              </label>
              <select style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #cbd5e1',
                borderRadius: '0.375rem',
                fontSize: '0.8rem',
              }}>
                <option value="citizen">Citizen</option>
                <option value="field-staff">Field Staff</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: '0.5rem 1rem',
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                fontSize: '0.8rem',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              Submit Report
            </button>
            <button
              type="button"
              onClick={() => setReporting({ isReporting: false, success: false, error: null })}
              style={{
                flex: 1,
                padding: '0.5rem 1rem',
                background: 'transparent',
                color: '#64748b',
                border: '1px solid #cbd5e1',
                borderRadius: '0.375rem',
                fontSize: '0.8rem',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>

          {reporting.isReporting && (
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.7rem', color: '#64748b' }}>
              Submitting report...
            </p>
          )}

          {reporting.success && (
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.7rem', color: '#059669' }}>
              Report submitted successfully. It requires moderator verification before any public update.
            </p>
          )}

          {reporting.error && (
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.7rem', color: '#dc2626' }}>
              Error submitting report. Please try again.
            </p>
          )}
        </form>
      </div>
    );
  };

  // Render the main content area
  const renderMainContent = () => {
    // If visit pack not yet generated, show loading state
    if (!visitPack) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
          <div style={{ width: '6rem', height: '6rem', margin: '0 auto auto auto', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Info size={32} />
          </div>
          <h3 style={{ margin: '1rem 0 0', fontSize: '1.25rem' }}>
            Select a Service and Office
          </h3>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem' }}>
            Choose a civic task and UP office to generate a visit pack with document requirements, fees, forms, and questions to ask.
          </p>
        </div>
      );
    }

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1.5rem', height: '100%' }}>
        {/* Main visit pack area (wider) */}
        <div>
          {renderVisitPackDisplay()}
          {renderPrivateNotesForm()}
        </div>

        {/* Sidebar (narrower) */}
        <div>
          {renderReportCorrection()}
          {/* Language switcher in sidebar */}
          <div style={{ marginTop: '1.5rem' }}>
            <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', fontWeight: '600' }}>
              Language
            </h4>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <button
                onClick={() => setLanguage('en')}
                style={{
                  padding: '0.4rem 0.8rem',
                  background: language === 'en' ? '#3b82f6' : 'transparent',
                  color: language === 'en' ? 'white' : '#64748b',
                  border: `1px solid ${language === 'en' ? '#3b82f6' : '#cbd5e1'}`,
                  borderRadius: '0.375rem',
                  fontSize: '0.7rem',
                  fontWeight: language === 'en' ? '600' : '400',
                  cursor: 'pointer',
                }}
                aria-pressed={language === 'en'}
              >
                English
              </button>
              {officeOptions.length > 0 && officeOptions[0].languageCoverage?.supportedLanguages?.includes('Hindi') && (
                <button
                  onClick={() => setLanguage('hi')}
                  style={{
                    padding: '0.4rem 0.8rem',
                    background: language === 'hi' ? '#3b82f6' : 'transparent',
                    color: language === 'hi' ? 'white' : '#64748b',
                    border: `1px solid ${language === 'hi' ? '#3b82f6' : '#cbd5e1'}`,
                    borderRadius: '0.375rem',
                    fontSize: '0.7rem',
                    fontWeight: language === 'hi' ? '600' : '400',
                    cursor: 'pointer',
                  }}
                  aria-pressed={language === 'hi'}
                >
                  हिन्दी (Hindi)
                </button>
              )}
              {officeOptions.length > 0 && officeOptions[0].languageCoverage?.supportedLanguages?.includes('Urdu') && (
                <button
                  onClick={() => setLanguage('ur')}
                  style={{
                    padding: '0.4rem 0.8rem',
                    background: language === 'ur' ? '#3b82f6' : 'transparent',
                    color: language === 'ur' ? 'white' : '#64748b',
                    border: `1px solid ${language === 'ur' ? '#3b82f6' : '#cbd5e1'}`,
                    borderRadius: '0.375rem',
                    fontSize: '0.7rem',
                    fontWeight: language === 'ur' ? '600' : '400',
                    cursor: 'pointer',
                  }}
                  aria-pressed={language === 'ur'}
                >
                  اردو (Urdu)
                </button>
              )}
            </div>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.65rem', color: '#94a3b8' }}>
              Printable packs available in selected language
            </p>
          </div>

          {/* Print button */}
          <div style={{ marginTop: '1rem' }}>
            <button
              onClick={handleExportPrint}
              style={{
                width: '100%',
                padding: '0.5rem 1rem',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                fontSize: '0.8rem',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              📄 Print/Export Offline Checklist
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: 'var(--bg-main, #0a0a0a)',
          color: 'var(--text-primary, #ffffff)',
          border: '1px solid var(--border-main, rgba(255, 255, 255, 0.15))',
          borderRadius: '1.25rem',
          maxWidth: '1200px',
          width: '100%',
          maxHeight: '95vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '0.6rem',
                background: 'var(--accent-light, rgba(56, 189, 248, 0.15))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-main, #38bdf8)',
              }}
            >
              <MapPin size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800' }}>
                UP Office Visit Planner
              </h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>
                {UP_VISIT_PLANNER.description}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Visit Planner"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary, #94a3b8)',
              cursor: 'pointer',
              padding: '0.25rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {renderMainContent()}
        </div>
      </div>
    </div>
  );
};

export default UpVisitPlanner;