import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BadgeIndianRupee,
  CheckCircle2,
  ExternalLink,
  FileSearch,
  FileText,
  History,
  Landmark,
  MessageSquare,
  Plus,
  ReceiptText,
  ScanLine,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  COMMUNITY_OBSERVATION_STATUS,
  FEE_COMPONENT_TYPES,
  INDIAN_STATES_AND_UTS,
  JURISDICTION_LEVELS,
  JURISDICTION_LEVEL_LABELS,
  createCommunityFeeObservation,
  createReceiptEvidence,
  generateDiscrepancyReport,
  getFeeHistory,
  getGrievanceRoute,
  getModeratedObservations,
  getPendingCommunityObservations,
  listVerifiedServices,
  moderateCommunityObservation,
  parseReceiptText,
} from '../services/nationalPublicServiceCentreService';
import {
  formatCurrency,
  getServiceFeeBreakdown,
} from '../services/feeTransparencyService';
import { safeHttpUrl } from '../utils/safeContent';

const REPORT_STATUS = {
  match: {
    label: 'Matches published schedule',
    color: '#22c55e',
    background: 'rgba(34, 197, 94, 0.12)',
  },
  'partial-match': {
    label: 'Partially verified',
    color: '#38bdf8',
    background: 'rgba(56, 189, 248, 0.12)',
  },
  overcharged: {
    label: 'Above published fee',
    color: '#ef4444',
    background: 'rgba(239, 68, 68, 0.12)',
  },
  'partial-overcharge': {
    label: 'Some charges above published fee',
    color: '#f59e0b',
    background: 'rgba(245, 158, 11, 0.12)',
  },
  undercharged: {
    label: 'Below published fee',
    color: '#f59e0b',
    background: 'rgba(245, 158, 11, 0.12)',
  },
  unverified: {
    label: 'Unverified — no applicable schedule',
    color: '#94a3b8',
    background: 'rgba(148, 163, 184, 0.12)',
  },
  'no-components': {
    label: 'No charge lines entered',
    color: '#94a3b8',
    background: 'rgba(148, 163, 184, 0.12)',
  },
};

const COMPONENT_STATUS = {
  matched: { label: 'Matches', color: '#22c55e' },
  overcharged: { label: 'Above official', color: '#ef4444' },
  undercharged: { label: 'Below official', color: '#f59e0b' },
  unverified: { label: 'Unverified', color: '#94a3b8' },
};

const GRIEVANCE_STATUS = {
  available: {
    label: 'Published route',
    color: '#22c55e',
    background: 'rgba(34, 197, 94, 0.12)',
  },
  'review-required': {
    label: 'Schedule review needed',
    color: '#f59e0b',
    background: 'rgba(245, 158, 11, 0.12)',
  },
  unverified: {
    label: 'No route published',
    color: '#94a3b8',
    background: 'rgba(148, 163, 184, 0.12)',
  },
};

const COMPONENT_TYPE_OPTIONS = [
  {
    value: FEE_COMPONENT_TYPES.GOVERNMENT_FEE,
    label: 'Government / statutory fee',
  },
  { value: FEE_COMPONENT_TYPES.PORTAL_CHARGE, label: 'Portal charge' },
  {
    value: FEE_COMPONENT_TYPES.AUTHORISED_CENTRE_CHARGE,
    label: 'Authorised centre charge',
  },
  {
    value: FEE_COMPONENT_TYPES.OPTIONAL_SERVICE_CHARGE,
    label: 'Optional service charge',
  },
  { value: 'unknown', label: 'Not sure / unverified' },
];

const inputStyle = {
  width: '100%',
  padding: '0.7rem 0.8rem',
  borderRadius: '0.6rem',
  border: '1px solid var(--border-main, rgba(148, 163, 184, 0.35))',
  background: 'var(--bg-main, rgba(255, 255, 255, 0.03))',
  color: 'var(--text-primary, inherit)',
  fontSize: '0.9rem',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.85rem',
  fontWeight: 700,
  marginBottom: '0.35rem',
  color: 'var(--text-primary, inherit)',
};

const helperStyle = {
  margin: '0.35rem 0 0',
  fontSize: '0.78rem',
  lineHeight: 1.5,
  color: 'var(--text-secondary, #94a3b8)',
};

const helperTextWithMargin = {
  margin: '0.4rem 0 0',
  fontSize: '0.84rem',
  lineHeight: 1.6,
  color: 'var(--text-secondary, #94a3b8)',
};

const sectionStyle = {
  padding: '1.25rem',
  borderRadius: '1rem',
  background: 'var(--bg-card, rgba(255, 255, 255, 0.03))',
  border: '1px solid var(--border-light, rgba(148, 163, 184, 0.2))',
};

const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(now.getDate()).padStart(2, '0')}`;
};

const formatDifference = (value) =>
  value === 0 ? '₹0' : formatCurrency(value);

function SectionCard({ icon: Icon, title, description, children, id }) {
  return (
    <section style={sectionStyle} aria-labelledby={id}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.65rem',
          marginBottom: '1rem',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            padding: '0.45rem',
            borderRadius: '0.65rem',
            background: 'rgba(56, 189, 248, 0.12)',
            color: 'var(--accent-main, #38bdf8)',
          }}
        >
          <Icon size={18} />
        </span>
        <div>
          <h2
            id={id}
            style={{
              margin: 0,
              fontSize: '1.08rem',
              fontWeight: 800,
              color: 'var(--text-primary, inherit)',
            }}
          >
            {title}
          </h2>
          {description && (
            <p style={{ ...helperStyle, marginTop: '0.2rem' }}>{description}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function StatusBadge({ status, map = REPORT_STATUS }) {
  const config = map[status] || {
    label: status || 'Unknown',
    color: '#94a3b8',
    background: 'rgba(148, 163, 184, 0.12)',
  };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.22rem 0.65rem',
        borderRadius: '999px',
        background: config.background || 'rgba(148, 163, 184, 0.12)',
        color: config.color,
        border: `1px solid ${config.color}55`,
        fontSize: '0.76rem',
        fontWeight: 700,
      }}
    >
      {config.label}
    </span>
  );
}

function ExternalSourceLink({ url, children }) {
  const safeHref = safeHttpUrl(url);
  if (!safeHref) return <span>{children}</span>;
  return (
    <a
      href={safeHref}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: 'var(--accent-main, #38bdf8)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.2rem',
      }}
    >
      {children}
      <ExternalLink size={12} aria-hidden="true" />
    </a>
  );
}

export default function FeeEvidenceAssistant() {
  const { user } = useAuth();

  const services = useMemo(() => listVerifiedServices(), []);
  const [serviceId, setServiceId] = useState(() => {
    const ids = services.map((service) => service.serviceId);
    return ids.includes('passport') ? 'passport' : services[0]?.serviceId || 'passport';
  });
  const [jurisdiction, setJurisdiction] = useState('national');
  const [stateName, setStateName] = useState('');
  const [districtName, setDistrictName] = useState('');
  const [localBodyName, setLocalBodyName] = useState('');
  const [checkDate, setCheckDate] = useState(today);
  const [receiptId, setReceiptId] = useState('');
  const [keepReceiptId, setKeepReceiptId] = useState(false);
  const [rawReceiptText, setRawReceiptText] = useState('');
  const [ocrCorrections, setOcrCorrections] = useState([]);
  const [parseWarnings, setParseWarnings] = useState([]);
  const [report, setReport] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const rowCounter = useRef(2);
  const [charges, setCharges] = useState([
    {
      id: 'charge-1',
      label: '',
      amount: '',
      componentType: FEE_COMPONENT_TYPES.GOVERNMENT_FEE,
    },
  ]);

  const [observationAmount, setObservationAmount] = useState('');
  const [observationOfficialAmount, setObservationOfficialAmount] = useState('');
  const [observationType, setObservationType] = useState(
    FEE_COMPONENT_TYPES.OPTIONAL_SERVICE_CHARGE,
  );
  const [observationLocation, setObservationLocation] = useState('');
  const [observationDescription, setObservationDescription] = useState('');
  const [observations, setObservations] = useState(() =>
    getModeratedObservations(serviceId),
  );
  const [pendingObservations, setPendingObservations] = useState([]);

  const feeBreakdown = useMemo(
    () => getServiceFeeBreakdown(serviceId, { referenceDate: checkDate }),
    [serviceId, checkDate],
  );
  const scheduleNotYetEffective = Boolean(
    feeBreakdown.effectiveDate &&
      checkDate &&
      feeBreakdown.effectiveDate > checkDate,
  );
  const feeHistory = useMemo(() => getFeeHistory(serviceId), [serviceId]);
  const grievanceRoute = useMemo(
    () => getGrievanceRoute(serviceId),
    [serviceId],
  );

  const canModerate = Boolean(
    user &&
      (['admin', 'reviewer', 'moderator'].includes(user.role) ||
        user.email?.includes('admin')),
  );

  const refreshObservations = () => {
    setObservations(getModeratedObservations(serviceId));
    setPendingObservations(
      canModerate ? getPendingCommunityObservations(serviceId) : [],
    );
  };

  const handleServiceChange = (event) => {
    setServiceId(event.target.value);
    setReport(null);
    setFeedback('');
    setError('');
    setOcrCorrections([]);
    setParseWarnings([]);
    setObservations(getModeratedObservations(event.target.value));
    setPendingObservations(
      canModerate ? getPendingCommunityObservations(event.target.value) : [],
    );
  };

  const updateCharge = (id, field, value) => {
    setCharges((previous) =>
      previous.map((charge) =>
        charge.id === id ? { ...charge, [field]: value } : charge,
      ),
    );
    setReport(null);
  };

  const addCharge = () => {
    const id = `charge-${rowCounter.current}`;
    rowCounter.current += 1;
    setCharges((previous) => [
      ...previous,
      {
        id,
        label: '',
        amount: '',
        componentType: FEE_COMPONENT_TYPES.GOVERNMENT_FEE,
      },
    ]);
    setReport(null);
  };

  const removeCharge = (id) => {
    setCharges((previous) => previous.filter((charge) => charge.id !== id));
    setReport(null);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const isText =
      file.type.startsWith('text/') || /\.(txt|text)$/i.test(file.name);
    if (!isText) {
      setFeedback(
        'This browser tool reads text files locally. For an image or PDF, paste the OCR text or type the charge amounts below.',
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setRawReceiptText(String(reader.result || '').slice(0, 20000));
      setReport(null);
      setFeedback('Receipt text loaded locally. Nothing was uploaded.');
    };
    reader.onerror = () => {
      setError('The selected file could not be read. You can paste the text instead.');
    };
    reader.readAsText(file);
  };

  const handleExtract = () => {
    setError('');
    setFeedback('');
    setReport(null);
    const parsed = parseReceiptText(rawReceiptText);
    setOcrCorrections(parsed.corrections);
    setParseWarnings(parsed.warnings);

    if (parsed.components.length === 0) {
      setError(
        'No charge lines were found. Type each charge and amount, or paste one charge per line.',
      );
      return;
    }

    const nextCharges = parsed.components.map((component) => {
      const id = `charge-${rowCounter.current}`;
      rowCounter.current += 1;
      return {
        id,
        label: component.label,
        amount: String(component.amount),
        componentType: component.componentType || 'unknown',
      };
    });
    setCharges(nextCharges);
    setRawReceiptText(parsed.correctedText);
    setFeedback(
      `${parsed.components.length} charge line${
        parsed.components.length === 1 ? '' : 's'
      } extracted. ${
        parsed.corrections.length
      } OCR correction${
        parsed.corrections.length === 1 ? '' : 's'
      } applied for your review.`,
    );
  };

  const handleGenerateReport = () => {
    setError('');
    setFeedback('');

    const usableCharges = charges.filter(
      (charge) => charge.label.trim() || String(charge.amount).trim(),
    );

    if (usableCharges.length === 0) {
      setError('Add at least one charge line before generating a report.');
      return;
    }

    const invalidCharge = usableCharges.find((charge) => {
      const amount = Number(charge.amount);
      return (
        !charge.label.trim() ||
        !Number.isFinite(amount) ||
        amount < 0
      );
    });
    if (invalidCharge) {
      setError(
        'Every charge line needs a label and a non-negative amount. Leave out charges you do not want to compare.',
      );
      return;
    }

    const receipt = createReceiptEvidence({
      serviceId,
      rawText: rawReceiptText,
      receiptId,
      jurisdiction,
      state: stateName || null,
      district: districtName || null,
      localBody: localBodyName || null,
      captureDate: checkDate,
      feeComponents: usableCharges.map((charge) => ({
        label: charge.label,
        amount: Number(charge.amount),
        componentType: charge.componentType,
      })),
      redactIdentifiers: !keepReceiptId,
      metadata: {
        ocrQuality: ocrCorrections.length > 0 ? 'corrected' : 'entered',
      },
    });

    const nextReport = generateDiscrepancyReport(receipt, serviceId, {
      jurisdiction,
      state: stateName || null,
      district: districtName || null,
      localBody: localBodyName || null,
      checkDate,
    });

    setReport(nextReport);
    setFeedback(
      keepReceiptId
        ? 'Report generated. The receipt identifier is visible because you explicitly enabled it for this report.'
        : 'Report generated. Receipt identifiers were redacted by default.',
    );
    refreshObservations();
  };

  const handleSubmitObservation = (event) => {
    event.preventDefault();
    setError('');
    setFeedback('');

    const result = createCommunityFeeObservation({
      serviceId,
      userId: user?.id || 'anonymous',
      observedAmount: observationAmount === '' ? NaN : Number(observationAmount),
      officialAmount:
        observationOfficialAmount === ''
          ? null
          : Number(observationOfficialAmount),
      componentType: observationType,
      location: observationLocation,
      jurisdiction,
      state: stateName || null,
      description: observationDescription,
      evidence: report?.receiptEvidenceId
        ? { receiptEvidenceId: report.receiptEvidenceId }
        : {},
    });

    if (!result.valid) {
      setError(result.errors?.join(' ') || 'The observation could not be submitted.');
      return;
    }

    setObservationAmount('');
    setObservationOfficialAmount('');
    setObservationLocation('');
    setObservationDescription('');
    refreshObservations();
    setFeedback(
      'Observation submitted locally and queued for moderation. It will not be displayed publicly until a moderator approves it.',
    );
  };

  const handleModerate = (observationId, decision) => {
    const result = moderateCommunityObservation(
      observationId,
      decision,
      decision === COMMUNITY_OBSERVATION_STATUS.APPROVED
        ? 'Approved after moderator review of the described charge.'
        : 'Rejected after moderator review.',
      { moderatorId: user?.id || 'moderator' },
    );
    if (!result.valid) {
      setError(result.error || 'The observation could not be moderated.');
      return;
    }
    refreshObservations();
    setFeedback(
      decision === COMMUNITY_OBSERVATION_STATUS.APPROVED
        ? 'Observation approved and now visible in the moderated community list.'
        : 'Observation rejected. It remains hidden from public display.',
    );
  };

  const differenceFromPublished = report?.summary?.totalDiscrepancy || 0;
  const overchargeAmount = report?.summary?.totalOvercharge || 0;

  return (
    <div className="section">
      <div
        className="container"
        style={{ maxWidth: '1180px', margin: '0 auto', width: '100%' }}
      >
        <header style={{ marginBottom: '1.5rem' }}>
          <span
            className="page-header-badge"
            style={{ display: 'inline-block', marginBottom: '0.5rem' }}
          >
            Fee evidence · no payments
          </span>
          <h1
            style={{
              margin: '0 0 0.5rem',
              fontSize: 'clamp(1.6rem, 4vw, 2.2rem)',
              lineHeight: 1.15,
            }}
          >
            Public Service Centre Fee Evidence Assistant
          </h1>
          <p
            style={{
              margin: 0,
              maxWidth: '820px',
              color: 'var(--text-secondary, #94a3b8)',
              lineHeight: 1.6,
            }}
          >
            Compare charges on a service-centre receipt with verified fee
            schedules, separately showing government, portal, authorised-centre,
            and optional service charges. Unknown components are labelled
            unverified, and receipt identifiers are redacted by default.
          </p>
        </header>

        <div
          role="note"
          aria-label="Safety and privacy safeguards"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            padding: '0.9rem 1rem',
            borderRadius: '0.85rem',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            background: 'rgba(56, 189, 248, 0.07)',
            marginBottom: '1.5rem',
          }}
        >
          <ShieldCheck
            size={20}
            aria-hidden="true"
            style={{ flexShrink: 0, marginTop: 2, color: '#38bdf8' }}
          />
          <div style={{ fontSize: '0.86rem', lineHeight: 1.55 }}>
            <strong>We never collect payment credentials or initiate payments.</strong>{' '}
            Do not enter card numbers, CVV/PIN/OTP values, bank account numbers,
            or UPI IDs. This assistant only compares the amounts you type with
            published schedules. It does not decide whether a charge is lawful.
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
            gap: '1.25rem',
            alignItems: 'start',
            marginBottom: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <SectionCard
              icon={Landmark}
              title="1. Service and jurisdiction"
              description="Choose the service on the receipt and where it was availed. The schedule is only used when it is verified and within its review window."
              id="fee-evidence-service-heading"
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '0.85rem',
                }}
              >
                <div>
                  <label htmlFor="fee-service" style={labelStyle}>
                    Service
                  </label>
                  <select
                    id="fee-service"
                    value={serviceId}
                    onChange={handleServiceChange}
                    style={inputStyle}
                  >
                    {services.map((service) => (
                      <option key={service.serviceId} value={service.serviceId}>
                        {service.serviceName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="fee-jurisdiction" style={labelStyle}>
                    Jurisdiction level
                  </label>
                  <select
                    id="fee-jurisdiction"
                    value={jurisdiction}
                    onChange={(event) => {
                      setJurisdiction(event.target.value);
                      setReport(null);
                      setError('');
                      setFeedback('');
                    }}
                    style={inputStyle}
                  >
                    {JURISDICTION_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {JURISDICTION_LEVEL_LABELS[level]}
                      </option>
                    ))}
                  </select>
                </div>
                {jurisdiction !== 'national' && (
                  <div>
                    <label htmlFor="fee-state" style={labelStyle}>
                      State / UT
                    </label>
                    <select
                      id="fee-state"
                      value={stateName}
                      onChange={(event) => {
                        setStateName(event.target.value);
                        setReport(null);
                        setError('');
                        setFeedback('');
                      }}
                      style={inputStyle}
                    >
                      <option value="">Select a State / UT (optional)</option>
                      {INDIAN_STATES_AND_UTS.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </select>
                    <p style={helperStyle}>
                      Narrower fee versions only apply when the matching place is
                      selected. Leave blank to use a broader schedule.
                    </p>
                  </div>
                )}
                {(jurisdiction === 'district' || jurisdiction === 'local') && (
                  <div>
                    <label htmlFor="fee-district" style={labelStyle}>
                      District
                    </label>
                    <input
                      id="fee-district"
                      type="text"
                      value={districtName}
                      onChange={(event) => {
                        setDistrictName(event.target.value);
                        setReport(null);
                        setError('');
                        setFeedback('');
                      }}
                      placeholder="e.g. New Delhi"
                      style={inputStyle}
                    />
                    <p style={helperStyle}>
                      District fee versions only apply when the district matches.
                    </p>
                  </div>
                )}
                {jurisdiction === 'local' && (
                  <div>
                    <label htmlFor="fee-local-body" style={labelStyle}>
                      Local body
                    </label>
                    <input
                      id="fee-local-body"
                      type="text"
                      value={localBodyName}
                      onChange={(event) => {
                        setLocalBodyName(event.target.value);
                        setReport(null);
                        setError('');
                        setFeedback('');
                      }}
                      placeholder="e.g. Municipal ward office"
                      style={inputStyle}
                    />
                    <p style={helperStyle}>
                      Local fee versions only apply when the local body matches.
                    </p>
                  </div>
                )}
                <div>
                  <label htmlFor="fee-check-date" style={labelStyle}>
                    Check date
                  </label>
                  <input
                    id="fee-check-date"
                    type="date"
                    value={checkDate}
                    onChange={(event) => {
                      setCheckDate(event.target.value);
                      setReport(null);
                      setError('');
                      setFeedback('');
                    }}
                    style={inputStyle}
                  />
                </div>
              </div>

              {feeBreakdown.isVerified ? (
                <div
                  style={{
                    marginTop: '0.9rem',
                    padding: '0.75rem 0.85rem',
                    borderRadius: '0.7rem',
                    background:
                      feeBreakdown.isExpired || scheduleNotYetEffective
                        ? 'rgba(245, 158, 11, 0.08)'
                        : 'rgba(34, 197, 94, 0.07)',
                    border:
                      feeBreakdown.isExpired || scheduleNotYetEffective
                        ? '1px solid rgba(245, 158, 11, 0.35)'
                        : '1px solid rgba(34, 197, 94, 0.28)',
                    fontSize: '0.8rem',
                    lineHeight: 1.5,
                  }}
                >
                  {feeBreakdown.isExpired || scheduleNotYetEffective ? (
                    <AlertTriangle size={15} aria-hidden="true" />
                  ) : (
                    <CheckCircle2 size={15} aria-hidden="true" />
                  )}{' '}
                  <strong>{feeBreakdown.serviceName}</strong> — published by{' '}
                  {feeBreakdown.officialSource?.department ||
                    feeBreakdown.officialSource?.name}
                  {feeBreakdown.lastReviewedDate
                    ? `, verified ${feeBreakdown.lastReviewedDate}`
                    : ''}
                  .{' '}
                  {feeBreakdown.isExpired
                    ? feeBreakdown.reviewWarning
                    : scheduleNotYetEffective
                      ? `This schedule took effect on ${feeBreakdown.effectiveDate}; it does not apply to the selected check date.`
                      : 'Within its review window.'}
                </div>
              ) : (
                <div
                  role="alert"
                  style={{
                    marginTop: '0.9rem',
                    padding: '0.75rem 0.85rem',
                    borderRadius: '0.7rem',
                    background: 'rgba(148, 163, 184, 0.08)',
                    border: '1px solid rgba(148, 163, 184, 0.3)',
                    fontSize: '0.8rem',
                    lineHeight: 1.5,
                  }}
                >
                  <AlertTriangle size={15} aria-hidden="true" /> No verified
                  official fee schedule is on record for this service. Every
                  entered component will be labelled unverified; no overcharge
                  conclusion will be drawn.
                </div>
              )}
            </SectionCard>

            <SectionCard
              icon={ReceiptText}
              title="2. Receipt evidence"
              description="Upload a text file or paste OCR output. Everything stays in this browser; files and receipt text are not sent anywhere."
              id="fee-evidence-receipt-heading"
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                  gap: '0.85rem',
                  marginBottom: '0.85rem',
                }}
              >
                <div>
                  <label htmlFor="receipt-id" style={labelStyle}>
                    Receipt identifier (optional)
                  </label>
                  <input
                    id="receipt-id"
                    type="text"
                    value={receiptId}
                    onChange={(event) => setReceiptId(event.target.value)}
                    placeholder="e.g. ARN or receipt number"
                    autoComplete="off"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label htmlFor="receipt-file" style={labelStyle}>
                    Upload a text receipt (optional)
                  </label>
                  <label
                    htmlFor="receipt-file"
                    style={{
                      ...inputStyle,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                    }}
                  >
                    <Upload size={15} aria-hidden="true" />
                    Choose a .txt file
                  </label>
                  <input
                    id="receipt-file"
                    type="file"
                    accept=".txt,text/plain"
                    onChange={handleFileUpload}
                    className="sr-only"
                  />
                  <p style={helperStyle}>
                    Images and PDFs are not OCR&apos;d here. Paste their OCR text
                    below if you have it.
                  </p>
                </div>
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  padding: '0.55rem 0.7rem',
                  borderRadius: '0.65rem',
                  border: keepReceiptId
                    ? '1px solid rgba(245, 158, 11, 0.45)'
                    : '1px solid rgba(34, 197, 94, 0.35)',
                  background: keepReceiptId
                    ? 'rgba(245, 158, 11, 0.07)'
                    : 'rgba(34, 197, 94, 0.06)',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  marginBottom: '0.85rem',
                }}
              >
                <input
                  id="keep-receipt-id"
                  name="keep-receipt-identifier"
                  type="checkbox"
                  checked={keepReceiptId}
                  onChange={(event) => setKeepReceiptId(event.target.checked)}
                  style={{ marginTop: 2 }}
                />
                <span>
                  <strong>Keep the receipt identifier in this report</strong>
                  <span
                    style={{
                      display: 'block',
                      color: 'var(--text-secondary, #94a3b8)',
                      marginTop: '0.15rem',
                    }}
                  >
                    Off by default. When off, the identifier is replaced with
                    REDACTED and identifiers in pasted text are redacted. When
                    on, the identifier is shown in the generated report instead
                    of REDACTED.
                  </span>
                </span>
              </label>

              <div>
                <label htmlFor="receipt-text" style={labelStyle}>
                  Paste receipt text or OCR output (optional)
                </label>
                <textarea
                  id="receipt-text"
                  value={rawReceiptText}
                  onChange={(event) => setRawReceiptText(event.target.value)}
                  rows={5}
                  placeholder={'Passport Fee  Rs. 1,5O0\\nSMS Updates  Rs. 50'}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace' }}
                />
                <div
                  style={{
                    display: 'flex',
                    gap: '0.6rem',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    marginTop: '0.55rem',
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleExtract}
                    disabled={!rawReceiptText.trim()}
                  >
                    <ScanLine size={15} aria-hidden="true" /> Correct OCR and
                    extract charges
                  </button>
                  <span style={helperStyle}>
                    Reads the last amount on each line. Review every extracted
                    label before generating the report.
                  </span>
                </div>
              </div>

              {ocrCorrections.length > 0 && (
                <div
                  role="status"
                  style={{
                    marginTop: '0.8rem',
                    padding: '0.7rem 0.85rem',
                    borderRadius: '0.65rem',
                    background: 'rgba(56, 189, 248, 0.07)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    fontSize: '0.8rem',
                  }}
                >
                  <strong>OCR corrections applied:</strong>{' '}
                  {ocrCorrections.map((correction, index) => (
                    <span key={`${correction.original}-${index}`}>
                      {index > 0 ? ', ' : ''}
                      <code>{correction.original}</code> →{' '}
                      <code>{correction.corrected}</code>
                    </span>
                  ))}
                </div>
              )}

              {parseWarnings.length > 0 && (
                <div
                  role="status"
                  style={{
                    marginTop: '0.8rem',
                    padding: '0.7rem 0.85rem',
                    borderRadius: '0.65rem',
                    background: 'rgba(245, 158, 11, 0.07)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    fontSize: '0.8rem',
                    lineHeight: 1.5,
                  }}
                >
                  <strong>Parser notes:</strong>{' '}
                  {parseWarnings.slice(0, 3).join(' ')}
                </div>
              )}
            </SectionCard>

            <SectionCard
              icon={BadgeIndianRupee}
              title="3. Charges on the receipt"
              description="Enter each amount exactly as charged. Choose a component type when you can; unknown components stay unverified."
              id="fee-evidence-charges-heading"
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                {charges.map((charge, index) => (
                  <fieldset
                    key={charge.id}
                    style={{
                      margin: 0,
                      padding: '0.8rem',
                      borderRadius: '0.75rem',
                      border: '1px solid var(--border-light, rgba(148, 163, 184, 0.2))',
                    }}
                  >
                    <legend
                      style={{
                        padding: '0 0.3rem',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: 'var(--text-secondary, #94a3b8)',
                      }}
                    >
                      Charge {index + 1}
                    </legend>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          'repeat(auto-fit, minmax(min(100%, 170px), 1fr))',
                        gap: '0.55rem',
                        alignItems: 'end',
                      }}
                    >
                      <div>
                        <label
                          htmlFor={`charge-label-${charge.id}`}
                          style={labelStyle}
                        >
                          Charge label
                        </label>
                        <input
                          id={`charge-label-${charge.id}`}
                          type="text"
                          value={charge.label}
                          onChange={(event) =>
                            updateCharge(charge.id, 'label', event.target.value)
                          }
                          placeholder="As printed on the receipt"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`charge-amount-${charge.id}`}
                          style={labelStyle}
                        >
                          Amount (₹)
                        </label>
                        <input
                          id={`charge-amount-${charge.id}`}
                          type="number"
                          min="0"
                          step="1"
                          inputMode="decimal"
                          value={charge.amount}
                          onChange={(event) =>
                            updateCharge(charge.id, 'amount', event.target.value)
                          }
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`charge-type-${charge.id}`}
                          style={labelStyle}
                        >
                          Charge type
                        </label>
                        <select
                          id={`charge-type-${charge.id}`}
                          value={charge.componentType}
                          onChange={(event) =>
                            updateCharge(
                              charge.id,
                              'componentType',
                              event.target.value,
                            )
                          }
                          style={inputStyle}
                        >
                          {COMPONENT_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => removeCharge(charge.id)}
                        disabled={charges.length === 1}
                        aria-label={`Remove charge ${index + 1}`}
                        style={{ padding: '0.7rem' }}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </fieldset>
                ))}
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.65rem',
                  marginTop: '0.85rem',
                }}
              >
                <button type="button" className="btn btn-secondary" onClick={addCharge}>
                  <Plus size={15} aria-hidden="true" /> Add charge
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleGenerateReport}
                >
                  <FileSearch size={15} aria-hidden="true" /> Generate redacted
                  discrepancy report
                </button>
              </div>

              {error && (
                <p
                  role="alert"
                  style={{
                    margin: '0.8rem 0 0',
                    padding: '0.65rem 0.8rem',
                    borderRadius: '0.6rem',
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#fca5a5',
                    fontSize: '0.82rem',
                  }}
                >
                  {error}
                </p>
              )}
              {feedback && (
                <p
                  role="status"
                  style={{
                    margin: '0.8rem 0 0',
                    padding: '0.65rem 0.8rem',
                    borderRadius: '0.6rem',
                    background: 'rgba(34, 197, 94, 0.07)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    color: 'var(--text-primary, inherit)',
                    fontSize: '0.82rem',
                  }}
                >
                  {feedback}
                </p>
              )}
            </SectionCard>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <SectionCard
              icon={FileText}
              title="Redacted discrepancy report"
              description="Only components matched to an applicable published fee can be shown as above or below the official amount."
              id="fee-evidence-report-heading"
            >
              {!report && (
                <div
                  style={{
                    padding: '1.1rem',
                    borderRadius: '0.75rem',
                    border: '1px dashed var(--border-main, rgba(148, 163, 184, 0.35))',
                    textAlign: 'center',
                    color: 'var(--text-secondary, #94a3b8)',
                    fontSize: '0.86rem',
                    lineHeight: 1.6,
                  }}
                >
                  <ReceiptText
                    size={28}
                    aria-hidden="true"
                    style={{ opacity: 0.7, marginBottom: '0.35rem' }}
                  />
                  <p style={{ margin: 0 }}>
                    Add the receipt charges and generate the report. Receipt
                    identifiers are redacted by default.
                  </p>
                </div>
              )}

              {report && (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.9rem',
                    }}
                  >
                    <StatusBadge status={report.overallMatch} />
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary, #94a3b8)' }}>
                      Checked {report.checkDate} · {report.jurisdiction}
                      {report.state ? ` · ${report.state}` : ''}
                      {report.district ? ` · ${report.district}` : ''}
                      {report.localBody ? ` · ${report.localBody}` : ''}
                    </span>
                  </div>

                  {report.receiptIdentifier && (
                    <div
                      style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-secondary, #94a3b8)',
                        marginBottom: '0.75rem',
                      }}
                    >
                      <strong style={{ color: 'var(--text-primary, inherit)' }}>
                        Receipt identifier:
                      </strong>{' '}
                      {report.receiptIdentifier}
                    </div>
                  )}

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                      gap: '0.55rem',
                      marginBottom: '0.9rem',
                    }}
                  >
                    <div style={{ padding: '0.65rem', borderRadius: '0.65rem', background: 'rgba(148, 163, 184, 0.08)' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #94a3b8)' }}>
                        Total charged
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>
                        {formatCurrency(report.summary.totalCharged)}
                      </div>
                    </div>
                    <div style={{ padding: '0.65rem', borderRadius: '0.65rem', background: 'rgba(148, 163, 184, 0.08)' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #94a3b8)' }}>
                        Official total (matched)
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>
                        {report.isOfficialScheduleApplicable
                          ? formatCurrency(report.summary.totalOfficial)
                          : 'Unverified'}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: '0.65rem',
                        borderRadius: '0.65rem',
                        background:
                          overchargeAmount > 0
                            ? 'rgba(239, 68, 68, 0.1)'
                            : differenceFromPublished > 0
                              ? 'rgba(245, 158, 11, 0.1)'
                              : 'rgba(34, 197, 94, 0.08)',
                      }}
                    >
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #94a3b8)' }}>
                        Difference from published fee
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>
                        {formatDifference(differenceFromPublished)}
                      </div>
                    </div>
                  </div>

                  {report.officialSchedule && (
                    <div
                      style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-secondary, #94a3b8)',
                        lineHeight: 1.5,
                        marginBottom: '0.75rem',
                      }}
                    >
                      <strong style={{ color: 'var(--text-primary, inherit)' }}>
                        Source used:
                      </strong>{' '}
                      {report.officialSchedule.name}
                      {report.officialSchedule.verificationDate
                        ? ` · verified ${report.officialSchedule.verificationDate}`
                        : ''}{' '}
                      ·{' '}
                      <ExternalSourceLink
                        url={report.officialSchedule.url}
                      >
                        official schedule
                      </ExternalSourceLink>
                    </div>
                  )}

                  <div style={{ overflowX: 'auto' }}>
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '0.8rem',
                      }}
                    >
                      <caption className="sr-only">
                        Charge comparison with the published fee schedule
                      </caption>
                      <thead>
                        <tr style={{ textAlign: 'left' }}>
                          <th scope="col" style={{ padding: '0.45rem 0.4rem' }}>
                            Charge
                          </th>
                          <th scope="col" style={{ padding: '0.45rem 0.4rem' }}>
                            Type
                          </th>
                          <th scope="col" style={{ padding: '0.45rem 0.4rem' }}>
                            You paid
                          </th>
                          <th scope="col" style={{ padding: '0.45rem 0.4rem' }}>
                            Official
                          </th>
                          <th scope="col" style={{ padding: '0.45rem 0.4rem' }}>
                            Result
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.componentComparisons.map((comparison, index) => {
                          const status =
                            COMPONENT_STATUS[comparison.status] ||
                            COMPONENT_STATUS.unverified;
                          return (
                            <tr
                              key={`${comparison.label}-${index}`}
                              style={{
                                borderTop:
                                  '1px solid var(--border-light, rgba(148, 163, 184, 0.16))',
                                verticalAlign: 'top',
                              }}
                            >
                              <td style={{ padding: '0.55rem 0.4rem' }}>
                                <div style={{ fontWeight: 600 }}>
                                  {comparison.label}
                                </div>
                                <div
                                  style={{
                                    color: 'var(--text-secondary, #94a3b8)',
                                    fontSize: '0.72rem',
                                    marginTop: '0.2rem',
                                  }}
                                >
                                  {comparison.discrepancy}
                                </div>
                                {comparison.officialSourceUrl && (
                                  <div style={{ marginTop: '0.2rem' }}>
                                    <ExternalSourceLink
                                      url={comparison.officialSourceUrl}
                                    >
                                      source
                                    </ExternalSourceLink>
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '0.55rem 0.4rem' }}>
                                {comparison.componentTypeLabel ||
                                  comparison.componentType}
                              </td>
                              <td style={{ padding: '0.55rem 0.4rem', whiteSpace: 'nowrap' }}>
                                {formatCurrency(comparison.chargedAmount)}
                              </td>
                              <td style={{ padding: '0.55rem 0.4rem', whiteSpace: 'nowrap' }}>
                                {comparison.officialAmount === null
                                  ? '—'
                                  : formatCurrency(comparison.officialAmount)}
                              </td>
                              <td style={{ padding: '0.55rem 0.4rem' }}>
                                <span style={{ color: status.color, fontWeight: 700 }}>
                                  {status.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {report.warnings.length > 0 && (
                    <div
                      role="status"
                      style={{
                        marginTop: '0.8rem',
                        padding: '0.65rem 0.8rem',
                        borderRadius: '0.6rem',
                        background: 'rgba(245, 158, 11, 0.07)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        fontSize: '0.78rem',
                        lineHeight: 1.5,
                      }}
                    >
                      {report.warnings.map((warning) => (
                        <p key={warning} style={{ margin: '0 0 0.3rem' }}>
                          {warning}
                        </p>
                      ))}
                    </div>
                  )}

                  <p style={{ ...helperStyle, marginTop: '0.8rem' }}>
                    {report.disclaimer}
                  </p>
                </div>
              )}
            </SectionCard>

            <SectionCard
              icon={ShieldCheck}
              title="Official grievance route"
              description="Only published routes are linked. When none is published, the generic CPGRAMS portal is shown with a clear unverified label."
              id="fee-evidence-grievance-heading"
            >
              <div
                style={{
                  padding: '0.85rem',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--border-light, rgba(148, 163, 184, 0.25))',
                  background: 'rgba(148, 163, 184, 0.05)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.4rem',
                  }}
                >
                  <strong style={{ fontSize: '0.92rem' }}>
                    {grievanceRoute.title}
                  </strong>
                  <StatusBadge
                    status={grievanceRoute.status}
                    map={GRIEVANCE_STATUS}
                  />
                </div>
                <p style={{ ...helperStyle, marginTop: 0 }}>
                  {grievanceRoute.message}
                </p>
                <dl
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    gap: '0.25rem 0.6rem',
                    margin: '0.6rem 0',
                    fontSize: '0.8rem',
                  }}
                >
                  <dt style={{ color: 'var(--text-secondary, #94a3b8)' }}>
                    Department
                  </dt>
                  <dd style={{ margin: 0 }}>{grievanceRoute.department}</dd>
                  <dt style={{ color: 'var(--text-secondary, #94a3b8)' }}>
                    Categories
                  </dt>
                  <dd style={{ margin: 0 }}>
                    {grievanceRoute.complaintCategories.join(', ')}
                  </dd>
                </dl>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', fontSize: '0.8rem' }}>
                  {grievanceRoute.portalUrl && (
                    <ExternalSourceLink url={grievanceRoute.portalUrl}>
                      Official service portal
                    </ExternalSourceLink>
                  )}
                  <ExternalSourceLink url={grievanceRoute.cpgrsLink}>
                    CPGRAMS complaint portal
                  </ExternalSourceLink>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <SectionCard
            icon={History}
            title="Versioned fee history"
            description="Every component keeps its authority, jurisdiction, effective date, source, verification date, and change history. Baseline rows come from the published schedule; recorded versions are appended, never overwritten."
            id="fee-evidence-history-heading"
          >
            {feeHistory.length === 0 ? (
              <p style={helperTextWithMargin}>
                No verified fee history is available for this service.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '0.78rem',
                    minWidth: '720px',
                  }}
                >
                  <caption className="sr-only">
                    Versioned fee history for {feeBreakdown.serviceName}
                  </caption>
                  <thead>
                    <tr style={{ textAlign: 'left' }}>
                      {[
                        'Version',
                        'Component',
                        'Amount',
                        'Jurisdiction',
                        'Authority',
                        'Effective',
                        'Verified',
                        'Source',
                      ].map((heading) => (
                        <th
                          key={heading}
                          scope="col"
                          style={{ padding: '0.45rem 0.4rem' }}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {feeHistory.slice(0, 12).map((version) => (
                      <tr
                        key={version.id}
                        style={{
                          borderTop:
                            '1px solid var(--border-light, rgba(148, 163, 184, 0.16))',
                          verticalAlign: 'top',
                        }}
                      >
                        <td style={{ padding: '0.45rem 0.4rem', whiteSpace: 'nowrap' }}>
                          {version.version === 0
                            ? 'Baseline'
                            : `v${version.version}`}
                        </td>
                        <td style={{ padding: '0.45rem 0.4rem' }}>
                          <div style={{ fontWeight: 600 }}>{version.label}</div>
                          <div style={{ color: 'var(--text-secondary, #94a3b8)' }}>
                            {version.componentType}
                          </div>
                        </td>
                        <td style={{ padding: '0.45rem 0.4rem', whiteSpace: 'nowrap' }}>
                          {formatCurrency(version.amount, version.currency)}
                        </td>
                        <td style={{ padding: '0.45rem 0.4rem' }}>
                          {version.jurisdiction}
                          {version.state ? ` · ${version.state}` : ''}
                        </td>
                        <td style={{ padding: '0.45rem 0.4rem' }}>
                          {version.authority}
                        </td>
                        <td style={{ padding: '0.45rem 0.4rem', whiteSpace: 'nowrap' }}>
                          {version.effectiveDate}
                        </td>
                        <td style={{ padding: '0.45rem 0.4rem', whiteSpace: 'nowrap' }}>
                          {version.verificationDate}
                        </td>
                        <td style={{ padding: '0.45rem 0.4rem' }}>
                          <ExternalSourceLink url={version.source}>
                            {version.sourceName || 'official source'}
                          </ExternalSourceLink>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {feeHistory.length > 12 && (
                  <p style={helperStyle}>
                    Showing 12 of {feeHistory.length} component versions.
                  </p>
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard
            icon={MessageSquare}
            title="Community fee observations"
            description="Observations are stored locally in PENDING state and are never shown publicly until a moderator approves them. User IDs and evidence payloads are omitted from the public list."
            id="fee-evidence-community-heading"
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))',
                gap: '1rem',
                alignItems: 'start',
              }}
            >
              <form onSubmit={handleSubmitObservation}>
                <h3 style={{ fontSize: '0.9rem', margin: '0 0 0.6rem' }}>
                  Submit for moderation
                </h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '0.6rem',
                  }}
                >
                  <div>
                    <label htmlFor="observation-amount" style={labelStyle}>
                      Amount you were charged (₹)
                    </label>
                    <input
                      id="observation-amount"
                      type="number"
                      min="0"
                      value={observationAmount}
                      onChange={(event) => setObservationAmount(event.target.value)}
                      style={inputStyle}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="observation-official" style={labelStyle}>
                      Official amount (optional)
                    </label>
                    <input
                      id="observation-official"
                      type="number"
                      min="0"
                      value={observationOfficialAmount}
                      onChange={(event) =>
                        setObservationOfficialAmount(event.target.value)
                      }
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label htmlFor="observation-type" style={labelStyle}>
                      Charge type
                    </label>
                    <select
                      id="observation-type"
                      value={observationType}
                      onChange={(event) => setObservationType(event.target.value)}
                      style={inputStyle}
                    >
                      {COMPONENT_TYPE_OPTIONS.filter(
                        (option) => option.value !== 'unknown',
                      ).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="observation-location" style={labelStyle}>
                      Centre or counter (optional)
                    </label>
                    <input
                      id="observation-location"
                      type="text"
                      value={observationLocation}
                      onChange={(event) =>
                        setObservationLocation(event.target.value)
                      }
                      style={inputStyle}
                      placeholder="e.g. PSK counter 3"
                    />
                  </div>
                </div>
                <div style={{ marginTop: '0.6rem' }}>
                  <label htmlFor="observation-description" style={labelStyle}>
                    What happened?
                  </label>
                  <textarea
                    id="observation-description"
                    rows={3}
                    value={observationDescription}
                    onChange={(event) =>
                      setObservationDescription(event.target.value)
                    }
                    style={{ ...inputStyle, resize: 'vertical' }}
                    placeholder="Describe the charge without including card numbers, OTPs, PINs, or bank details."
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ marginTop: '0.65rem' }}
                >
                  Submit observation for moderation
                </button>
                <p style={helperStyle}>
                  Pending moderation — this is not published automatically.
                  Card numbers, CVV/PIN/OTP values, bank accounts, and UPI IDs
                  are rejected.
                </p>
              </form>

              <div>
                <h3 style={{ fontSize: '0.9rem', margin: '0 0 0.6rem' }}>
                  Approved observations
                </h3>
                {observations.length === 0 ? (
                  <p style={helperTextWithMargin}>
                    No approved observations yet. Only approved entries appear
                    here; pending submissions are reviewed first.
                  </p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {observations.map((observation) => (
                      <li
                        key={observation.id}
                        style={{
                          padding: '0.7rem 0.8rem',
                          borderRadius: '0.7rem',
                          border: '1px solid var(--border-light, rgba(148, 163, 184, 0.22))',
                          background: 'rgba(148, 163, 184, 0.04)',
                          fontSize: '0.8rem',
                          lineHeight: 1.5,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <strong>
                            Charged {formatCurrency(observation.observedAmount)}
                            {observation.officialAmount !== null
                              ? ` · official ${formatCurrency(observation.officialAmount)}`
                              : ''}
                          </strong>
                          <span style={{ color: '#22c55e', fontWeight: 700 }}>
                            Approved
                          </span>
                        </div>
                        <div style={{ color: 'var(--text-secondary, #94a3b8)', marginTop: '0.2rem' }}>
                          {observation.componentType}
                          {observation.location ? ` · ${observation.location}` : ''}
                          {observation.createdAt
                            ? ` · ${String(observation.createdAt).slice(0, 10)}`
                            : ''}
                        </div>
                        <p style={{ margin: '0.35rem 0 0' }}>
                          {observation.description}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}

                {canModerate && (
                  <details style={{ marginTop: '0.9rem' }}>
                    <summary
                      style={{
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                      }}
                    >
                      Moderator queue ({pendingObservations.length} pending)
                    </summary>
                    {pendingObservations.length === 0 ? (
                      <p style={helperTextWithMargin}>
                        No pending observations for this service.
                      </p>
                    ) : (
                      <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                        {pendingObservations.map((observation) => (
                          <li
                            key={observation.id}
                            style={{
                              padding: '0.65rem 0.75rem',
                              borderRadius: '0.65rem',
                              border: '1px solid rgba(245, 158, 11, 0.35)',
                              background: 'rgba(245, 158, 11, 0.05)',
                              fontSize: '0.78rem',
                            }}
                          >
                            <strong>
                              {formatCurrency(observation.observedAmount)} ·{' '}
                              {observation.componentType}
                            </strong>
                            <p style={{ margin: '0.25rem 0' }}>
                              {observation.description}
                            </p>
                            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() =>
                                  handleModerate(
                                    observation.id,
                                    COMMUNITY_OBSERVATION_STATUS.APPROVED,
                                  )
                                }
                              >
                                <CheckCircle2 size={14} aria-hidden="true" />
                                Approve
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() =>
                                  handleModerate(
                                    observation.id,
                                    COMMUNITY_OBSERVATION_STATUS.REJECTED,
                                  )
                                }
                              >
                                <XCircle size={14} aria-hidden="true" />
                                Reject
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>
                )}
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
