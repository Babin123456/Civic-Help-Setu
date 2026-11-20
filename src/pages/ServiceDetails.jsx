import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertOctagon, ArrowLeft, Bookmark, Calculator, Check, Link2, Printer, Share2, Zap, Users, Eye, CheckSquare, FileText, Sparkles, RotateCcw, Edit2, ShieldCheck, Mail, Leaf, Navigation, GitFork, ShieldAlert, Layers } from 'lucide-react';
import { getServiceById } from '../services/serviceCatalog';
import RetiredServiceNotice from '../components/common/RetiredServiceNotice';
import ServiceQrHandout from '../components/services/ServiceQrHandout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import UntranslatedBadge from '../components/common/UntranslatedBadge';
import { useFocusMode } from '../hooks/useFocusMode';
import ServiceGuide from '../components/services/ServiceGuide';
import { buildGuideSections } from '../components/services/ServiceGuide';
import ServiceSectionNav from '../components/services/ServiceSectionNav';
import Checklist from '../components/Checklist';
import MakeChecklistModal from '../components/services/MakeChecklistModal';
import { readServiceChecklist, clearServiceChecklist } from '../services/makeChecklistService';
import DataFreshnessTrustBadge from '../components/services/DataFreshnessTrustBadge';
import JourneyHandoffModal from '../components/journey/JourneyHandoffModal';
import NoticeBadge from '../components/notices/NoticeBadge';
import ServiceAvailabilityNotice from '../components/services/ServiceAvailabilityNotice';
import DeadlineCalendar from '../components/notices/DeadlineCalendar';
import LowBandwidthShareModal from '../components/services/LowBandwidthShareModal';
import SourceConflictCautionBanner from '../components/services/SourceConflictCautionBanner';
import FeeTransparencyCard from '../components/services/FeeTransparencyCard';
import PaymentReceipt from '../components/payment-receipt/PaymentReceipt';
import ApplicationReadinessScorecard from '../components/services/ApplicationReadinessScorecard';
import ApplicabilityPanel from '../components/services/ApplicabilityPanel';
import BenefitEntitlementCalculator from '../components/services/BenefitEntitlementCalculator';
import DocumentPreflightInspectionCard from '../components/services/DocumentPreflightInspectionCard';
import OfflineCacheActionCard from '../components/services/OfflineCacheActionCard';
import IntakeWindowPanel from '../components/services/IntakeWindowPanel';
import AppointmentVisitPackModal from '../components/location/AppointmentVisitPackModal';
import BarrierReportModal from '../components/barriers/BarrierReportModal';
import AccessibleReaderPreferencesModal from '../components/services/AccessibleReaderPreferencesModal';
import { getReaderPreferences, computeReaderStyle } from '../services/accessibleReaderService';
import InteractiveFeeEstimatorModal from '../components/services/InteractiveFeeEstimatorModal';
import ApplicationPreparationPlanModal from '../components/services/ApplicationPreparationPlanModal';
import { findJargonTerms } from '../data/civicGlossary';
import TermExplainer from '../components/TermExplainer';
import ServiceSimplifier from '../components/services/ServiceSimplifier';
import InlineStatusLegend from '../components/common/InlineStatusLegend';
import DocumentTypeGuidanceModal from '../components/services/DocumentTypeGuidanceModal';
import ApplicationReadinessCheckerModal from '../components/services/ApplicationReadinessCheckerModal';
import FeeWaiverEligibilityCard from '../components/services/FeeWaiverEligibilityCard';
import ServiceSlaReliabilityCard from '../components/services/ServiceSlaReliabilityCard';
import AadhaarGuide from '../components/services/AadhaarGuide';
import PropertyTaxNoDuesGuide from '../components/services/PropertyTaxNoDuesGuide';
import SmallBusinessLicenceCentre from '../components/services/SmallBusinessLicenceCentre';
import FireSafetyComplianceGuide from '../components/services/FireSafetyComplianceGuide';
import TreePermissionGuide from '../components/services/TreePermissionGuide';

import ServicePrintPacketModal from '../components/services/ServicePrintPacketModal';
import ShareByEmailModal from '../components/services/ShareByEmailModal';
import CivicAcronymTooltip from '../components/acronyms/CivicAcronymTooltip.jsx';
import { CIVIC_ACRONYMS } from '../data/civicAcronyms.js';

const getSavedServices = () => {
  try {
    const saved = JSON.parse(localStorage.getItem('civicbridge_saved') || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
};

const copyServiceLink = async (url) => {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

const getServiceUrl = (serviceId) => {
  if (typeof window === 'undefined') {
    return `/services/${encodeURIComponent(serviceId)}`;
  }
  return `${window.location.origin}/services/${encodeURIComponent(serviceId)}`;
};

// `previewService` renders a record that is not published yet (the admin draft preview) with this same
// page. In that mode links and buttons do nothing, so a preview never saves, shares or applies for anything.
const ServiceDetails = ({ previewService = null }) => {
  const { id: routeId } = useParams();
  const isPreview = Boolean(previewService);
  const id = previewService?.id ?? routeId;
  const navigate = useNavigate();

  const { user } = useAuth();
  const { toast } = useToast();
  const { focusMode, toggleFocusMode } = useFocusMode();

  const [linkCopied, setLinkCopied] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [handoffModalOpen, setHandoffModalOpen] = useState(false);
  const [showPrintPacketModal, setShowPrintPacketModal] = useState(false);
  const [showLowBandwidthModal, setShowLowBandwidthModal] = useState(false);
  const [showBarrierModal, setShowBarrierModal] = useState(false);
  const [showVisitPackModal, setShowVisitPackModal] = useState(false);
  const [showReaderModal, setShowReaderModal] = useState(false);
  const [readerStyle, setReaderStyle] = useState(() => computeReaderStyle(getReaderPreferences()));
  const [showFeeEstimatorModal, setShowFeeEstimatorModal] = useState(false);
  const [showDocGuidanceModal, setShowDocGuidanceModal] = useState(false);
  const [showPrepPlanModal, setShowPrepPlanModal] = useState(false);
  const [showMakeChecklistModal, setShowMakeChecklistModal] = useState(false);
  const [showReadinessCheckerModal, setShowReadinessCheckerModal] = useState(false);
  const [showShareByEmailModal, setShowShareByEmailModal] = useState(false);
  const [showDedicatedAadhaarGuide, setShowDedicatedAadhaarGuide] = useState(false);
  const [showDedicatedPropertyTaxGuide, setShowDedicatedPropertyTaxGuide] = useState(false);
  const [showDedicatedBusinessLicenceCentre, setShowDedicatedBusinessLicenceCentre] = useState(false);
  const [showDedicatedFireGuide, setShowDedicatedFireGuide] = useState(false);
  const [showDedicatedTreeGuide, setShowDedicatedTreeGuide] = useState(false);
  const service = previewService ?? getServiceById(id);
  const [, setSavedTick] = useState(0);
  const [customChecklistState, setCustomChecklistState] = useState(null);
  const customChecklist = customChecklistState === false
    ? null
    : (customChecklistState ?? readServiceChecklist(id));

  const isSaved = Boolean(service && getSavedServices().some((s) => s.id === service.id));

  useEffect(() => {
    if (!linkCopied) return undefined;

    const timeoutId = setTimeout(() => {
      setLinkCopied(false);
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [linkCopied]);

  const handleCopyLink = async () => {
    const success = await copyServiceLink(getServiceUrl(id));

    if (success) {
      setLinkCopied(true);
      toast.success('Service link copied to clipboard.');
    } else {
      toast.error(
        'Could not copy the link. Please copy it from the address bar.'
      );
    }
  };

  const toggleSave = () => {
    if (!service) return;

    const savedServices = getSavedServices();

    const alreadySaved = savedServices.some(
      (savedService) => savedService.id === service.id
    );

    const updatedServices = alreadySaved
      ? savedServices.filter(
          (savedService) => savedService.id !== service.id
        )
      : [
          ...savedServices,
          {
            id: service.id,
            name: service.name,
            category: service.category,
          },
        ];

    try {
      localStorage.setItem(
        'civicbridge_saved',
        JSON.stringify(updatedServices)
      );

      setSavedTick((t) => t + 1);

      toast.success(
        alreadySaved
          ? 'Service removed from saved services.'
          : 'Service saved successfully.'
      );
    } catch {
      toast.error(
        'Unable to save this service. Please check your browser storage settings.'
      );
    }
  };

  const handleApply = () => {
    if (!user) {
      navigate('/login');
      return;
    }

    // Replace this placeholder with the actual application workflow.
    toast.error('The application workflow is not available yet.');
  };

  if (!service) {
    return (
      <div
        className="section container"
        style={{ textAlign: 'center' }}
      >
        <h2
          style={{
            fontSize: '2rem',
            marginBottom: '1rem',
          }}
        >
          Service not found
        </h2>

        <p
          style={{
            color: 'var(--text-secondary)',
            marginBottom: '1.5rem',
          }}
        >
          The requested service may have been removed or the link may be
          incorrect.
        </p>

        <Link to="/services" className="btn btn-secondary">
          Return to directory
        </Link>
      </div>
    );
  }

  const blockPreviewActions = (event) => {
    if (event.target.closest?.('a, button, input, select, textarea, summary')) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <div
      className={`section animate-fade-in${
        focusMode ? ' service-details--focus' : ''
      }`}
      style={{ paddingBottom: isPreview ? '1rem' : '6rem' }}
      onClickCapture={isPreview ? blockPreviewActions : undefined}
      data-preview={isPreview ? 'true' : undefined}
    >
      <div
        className="container"
        style={{ maxWidth: '900px' }}
      >
        <div style={{ marginBottom: '2rem' }}>
          <Link
            to="/services"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--text-secondary)',
              fontWeight: '500',
              transition: 'color 0.3s',
            }}
          >
            <ArrowLeft size={18} />
            Back to Services
          </Link>
        </div>

        <RetiredServiceNotice service={service} />
        <ServiceQrHandout service={service} preview={isPreview} />

        <div
          className="glass-panel service-details__panel"
          style={{ borderRadius: '1.5rem' }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '2rem',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: '1 1 400px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  marginBottom: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    padding: '0.25rem 0.75rem',
                    background: 'var(--accent-light)',
                    color: 'var(--accent-main)',
                    borderRadius: '99px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                  }}
                >
                  {service.category}
                </span>

                <span
                  style={{
                    fontSize: '0.875rem',
                    color: 'var(--text-tertiary)',
                    fontWeight: '500',
                  }}
                >
                  {service.type}
                </span>
              </div>

              <h1
                style={{
                  fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                  fontWeight: '800',
                  lineHeight: '1.2',
                  marginBottom: '1rem',
                }}
              >
                {service.name}
              </h1>

              <p
                style={{
                  fontSize: '1.125rem',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.6',
                  maxWidth: '600px',
                }}
              >
                {service.shortDescription}
              </p>
              <ServiceSimplifier key={service.id} service={service} />
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <UntranslatedBadge />
                <DataFreshnessTrustBadge service={service} />
                <NoticeBadge serviceId={service.id} serviceName={service.name} />
              </div>
              <ServiceAvailabilityNotice serviceId={service.id} serviceName={service.name} />

              <DeadlineCalendar serviceId={service.id} />
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <button
                type="button"
                onClick={handleApply}
                className="btn btn-primary"
                style={{
                  padding: '0.85rem 1.75rem',
                  fontSize: '1.05rem',
                  background: 'var(--accent-main)',
                  color: 'var(--bg-main)',
                }}
              >
                <Zap size={18} fill="currentColor" />
                Fast-Track Apply
              </button>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.5rem',
                }}
              >
                <button
                  type="button"
                  onClick={toggleSave}
                  className="btn btn-secondary"
                  style={{
                    padding: '0.65rem',
                    fontSize: '0.875rem',
                    background: isSaved
                      ? 'rgba(56, 189, 248, 0.1)'
                      : 'var(--glass-bg)',
                    borderColor: isSaved
                      ? 'var(--accent-main)'
                      : 'var(--border-main)',
                    color: isSaved
                      ? 'var(--accent-main)'
                      : 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                  }}
                  aria-pressed={isSaved}
                >
                  <Bookmark
                    size={16}
                    fill={isSaved ? 'currentColor' : 'none'}
                  />
                  {isSaved ? 'Saved' : 'Save'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowReportModal(true)}
                  className="btn btn-secondary"
                  style={{
                    padding: '0.65rem',
                    fontSize: '0.875rem',
                    background: 'var(--glass-bg)',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <Share2
                    size={16}
                    color="var(--accent-main)"
                  />
                  Report
                </button>

                <button
                  type="button"
                  onClick={() => setShowBarrierModal(true)}
                  className="btn btn-secondary"
                  style={{
                    gridColumn: '1 / -1',
                    padding: '0.65rem',
                    fontSize: '0.875rem',
                    background: 'rgba(245, 158, 11, 0.08)',
                    borderColor: 'rgba(245, 158, 11, 0.3)',
                    color: '#f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <AlertOctagon
                    size={16}
                    color="#f59e0b"
                  />
                  Report Access Barrier
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="btn btn-secondary"
                  aria-label="Copy link to this service page"
                  style={{
                    gridColumn: '1 / -1',
                    padding: '0.65rem',
                    fontSize: '0.875rem',
                    background: 'var(--glass-bg)',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                  }}
                >
                  {linkCopied ? (
                    <Check
                      size={16}
                      color="var(--accent-main)"
                    />
                  ) : (
                    <Link2
                      size={16}
                      color="var(--accent-main)"
                    />
                  )}

                  {linkCopied ? 'Copied' : 'Copy link'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowLowBandwidthModal(true)}
                  className="btn btn-secondary"
                  aria-label="Low-bandwidth plain text and SMS instructions"
                  style={{
                    gridColumn: '1 / -1',
                    padding: '0.65rem',
                    fontSize: '0.875rem',
                    background: 'var(--glass-bg)',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <Share2
                    size={16}
                    color="var(--accent-main)"
                  />
                  Low-Bandwidth & SMS Copy
                </button>

                <button
                  type="button"
                  onClick={() => setShowShareByEmailModal(true)}
                  className="btn btn-secondary"
                  aria-label="Share this service by email"
                  style={{
                    gridColumn: '1 / -1',
                    padding: '0.65rem',
                    fontSize: '0.875rem',
                    background: 'var(--glass-bg)',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <Mail
                    size={16}
                    color="var(--accent-main)"
                  />
                  Share by email
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowPrintPacketModal(true)}
                className="btn btn-outline"
                style={{
                  padding: '0.6rem 1rem',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                }}
              >
                <Printer size={16} />
                <span>Print CSC Checklist</span>
              </button>

              <button
                type="button"
                onClick={() => setShowVisitPackModal(true)}
                className="btn btn-outline"
                style={{
                  padding: '0.6rem 1rem',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                }}
              >
                <Printer size={16} />
                <span>Print Visit Dossier</span>
              </button>

              <button
                type="button"
                onClick={() => (user ? setHandoffModalOpen(true) : navigate('/login'))}
                className="btn btn-secondary"
                style={{
                  padding: '0.6rem 1rem',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem'
                }}
              >
                <Users size={16} />
                <span>Handoff to Helper</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDocGuidanceModal(true)}
                className="btn btn-secondary"
                style={{
                  padding: '0.6rem 1rem',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem'
                }}
              >
                <FileText size={16} />
                <span>Document Guidance</span>
              </button>

              <button
                type="button"
                onClick={() => setShowMakeChecklistModal(true)}
                className="btn btn-secondary"
                style={{
                  padding: '0.6rem 1rem',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  backgroundColor: 'rgba(56, 189, 248, 0.08)',
                  borderColor: 'rgba(56, 189, 248, 0.3)',
                  color: 'var(--accent-main)',
                }}
              >
                <Sparkles size={16} />
                <span>Make checklist</span>
              </button>

              <Link
                to={`/provenance?service=${encodeURIComponent(service.id)}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/provenance?service=${encodeURIComponent(service.id)}`);
                }}
                className="btn btn-secondary"
                style={{
                  padding: '0.6rem 1rem',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  backgroundColor: 'rgba(99, 102, 241, 0.08)',
                  borderColor: 'rgba(99, 102, 241, 0.3)',
                  color: 'var(--accent-main)',
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
                aria-label={`Trace data lineage and authoritative provenance for ${service.name}`}
              >
                <GitFork size={16} />
                <span>Trace Data Lineage</span>
              </Link>

              <button
                type="button"
                onClick={() => setShowPrepPlanModal(true)}
                className="btn btn-secondary"
                style={{
                  padding: '0.6rem 1rem',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                }}
              >
                <CheckSquare size={16} />
                <span>Preparation Plan</span>
              </button>

              <button
                type="button"
                onClick={() => setShowReadinessCheckerModal(true)}
                className="btn btn-secondary"
                style={{
                  padding: '0.6rem 1rem',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  backgroundColor: 'rgba(14, 165, 233, 0.08)',
                  borderColor: 'rgba(14, 165, 233, 0.3)',
                  color: '#0284c7',
                }}
              >
                <ShieldCheck size={16} />
                <span>AI Readiness Checker</span>
              </button>
            </div>
          </div>

          <div
            style={{
              marginTop: '2rem',
              paddingTop: '1.5rem',
              borderTop: '1px solid var(--border-light)',
            }}
          >
            <h2
              style={{
                fontSize: '1.25rem',
                marginBottom: '0.75rem',
              }}
            >
              Overview
            </h2>

            <p
              style={{
                color: 'var(--text-secondary)',
                lineHeight: '1.7',
              }}
            >
              {service.description ||
                service.shortDescription ||
                'Details for this service are available in the programme information.'}
            </p>

            {/* Explainable terms used in the service description */}
            {(() => {
              const desc = service.description || service.shortDescription || '';
              const terms = findJargonTerms(desc);
              if (terms.length === 0) return null;
              return (
                <div
                  style={{
                    marginTop: '1rem',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      color: 'var(--text-tertiary)',
                      textTransform: 'uppercase',
                      marginRight: '0.5rem',
                    }}
                  >
                    Explain terms:
                  </span>
                  {terms.slice(0, 4).map((t) => (
                    <TermExplainer
                      key={t.id}
                      term={t.term}
                      label="Explain this term"
                      variant="inline"
                      serviceContext={{
                        serviceName: service.name,
                        serviceDescription: desc,
                        section: 'Overview',
                      }}
                    />
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Related Acronyms & Terms */}
          {(() => {
            const relatedAcronyms = CIVIC_ACRONYMS.filter((a) =>
              a.relatedServiceIds.includes(service.id)
            );
            if (relatedAcronyms.length === 0) return null;
            return (
              <div
                style={{
                  marginTop: '2rem',
                  paddingTop: '1.5rem',
                  borderTop: '1px solid var(--border-light)',
                }}
              >
                <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>
                  Related Acronyms &amp; Terms
                </h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {relatedAcronyms.map((entry) => (
                    <CivicAcronymTooltip key={entry.id} acronym={entry.acronym} />
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Official Source Conflict Caution Banner */}
          <SourceConflictCautionBanner
            serviceId={service.id}
          />

          <ApplicabilityPanel service={service} />

          {/* Offline In-Office Visit Staging */}
          <OfflineCacheActionCard service={service} />
          <IntakeWindowPanel service={service} />
          <div style={{ margin: '0.5rem 0', textAlign: 'right' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowFeeEstimatorModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
            >
              <Calculator size={15} color="var(--accent-main)" />
              Calculate Total Costs & Concessions
            </button>
          </div>

          {/* Fee Transparency */}
          <FeeTransparencyCard
            serviceId={service.id}
            serviceName={service.name}
          />

          {/* Civic Payment-Receipt Organizer (#647) */}
          <PaymentReceipt
            serviceId={service.id}
            journeyId={`journey-${service.id}`}
          />

          {/* Statutory Fee Waiver & Concession Eligibility Checker */}
          <FeeWaiverEligibilityCard service={service} />

          {/* Statutory Welfare & Subsidy Benefit Estimator */}
          <BenefitEntitlementCalculator serviceId={service.id} serviceName={service.name} />

          {/* Service Turnaround (SLA) & Delivery Reliability Forecaster */}
          <ServiceSlaReliabilityCard service={service} />

          {/* Service Guide */}
          {service.id === 'aadhaar-card' && (
            <div
              className="card"
              style={{
                padding: '1.25rem',
                marginBottom: '1.25rem',
                border: '1px solid var(--accent-main, #3b82f6)',
                background: 'var(--bg-card)',
                borderRadius: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ maxWidth: '650px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <ShieldCheck size={18} color="var(--accent-main, #3b82f6)" />
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                      Dedicated Aadhaar Enrolment &amp; Demographic Update Guide
                    </h3>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Detailed 28-digit EID and 14-digit URN tracking guide, authorised ASK centre locator, statutory fee ceiling caps, and client-side milestone simulator.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setShowDedicatedAadhaarGuide((v) => !v)}
                    style={{ fontSize: '0.85rem' }}
                  >
                    {showDedicatedAadhaarGuide ? 'Switch to Standard Guide' : 'Open Interactive Aadhaar Guide'}
                  </button>
                  <Link
                    to="/services/aadhaar-guide"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.85rem', textDecoration: 'none' }}
                  >
                    Dedicated Page
                  </Link>
                </div>
              </div>
            </div>
          )}

          {service.id === 'property-tax-no-dues' && (
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(5, 150, 105, 0.12))',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 'var(--radius-lg, 12px)',
                padding: '1.25rem 1.5rem',
                marginBottom: '1.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ maxWidth: '650px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <ShieldCheck size={18} color="var(--accent-main, #10b981)" />
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                      Dedicated Property Tax No-Dues Certificate &amp; Payment Receipt Guide
                    </h3>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Jurisdiction-aware guide across major Indian ULBs (MCD, BBMP, BMC, GCC, KMC, GHMC, AMC, PMC) with payment receipt vs No-Dues distinction, document checklists, and offline/online journeys.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setShowDedicatedPropertyTaxGuide((v) => !v)}
                    style={{ fontSize: '0.85rem' }}
                  >
                    {showDedicatedPropertyTaxGuide ? 'Switch to Standard Guide' : 'Open Interactive Property Tax Guide'}
                  </button>
                  <Link
                    to="/services/property-tax-no-dues"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.85rem', textDecoration: 'none' }}
                  >
                    Dedicated Page
                  </Link>
                </div>
              </div>
            </div>
          )}

          {service.id === 'business-licence-checklist' && (
            <div
              style={{
                padding: '1.25rem',
                marginBottom: '1.25rem',
                border: '1px solid var(--accent-main, #3b82f6)',
                background: 'var(--bg-card)',
                borderRadius: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ maxWidth: '650px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <ShieldCheck size={18} color="var(--accent-main, #3b82f6)" />
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                      Interactive Small-Business Licence Renewal &amp; Closure Checklist Centre
                    </h3>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Multi-establishment compliance tracker across municipal trade licences, Shops &amp; Establishments registrations, amendment evidence, and formal surrender acknowledgement archiving (#721).
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setShowDedicatedBusinessLicenceCentre((v) => !v)}
                    style={{ fontSize: '0.85rem' }}
                  >
                    {showDedicatedBusinessLicenceCentre ? 'Switch to Standard Guide' : 'Open Interactive Centre'}
                  </button>
                  <Link
                    to="/services/business-licence-checklist"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.85rem', textDecoration: 'none' }}
                  >
                    Dedicated Page
                  </Link>
                </div>
              </div>
            </div>
          )}

          {service.id === 'fire-noc' && (
            <div
              className="card"
              style={{
                marginBottom: '1.5rem',
                border: '1.5px solid var(--accent-main, #ef4444)',
                background: 'var(--bg-card)',
                borderRadius: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ maxWidth: '650px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <ShieldCheck size={18} color="var(--accent-main, #ef4444)" />
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                      Dedicated Fire NOC &amp; Fire-Safety Compliance Preparation Guide
                    </h3>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Jurisdiction-aware preparation guide grounded in NBC 2016 Part 4. Covers provisional, final, and renewal stages, required building plans, and active fire-suppression equipment proofs.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setShowDedicatedFireGuide((v) => !v)}
                    style={{ fontSize: '0.85rem' }}
                  >
                    {showDedicatedFireGuide ? 'Switch to Standard Guide' : 'Open Interactive Fire Guide'}
                  </button>
                  <Link
                    to="/services/fire-noc-guide"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.85rem', textDecoration: 'none' }}
                  >
                    Dedicated Page
                  </Link>
                </div>
              </div>
            </div>
          )}

          {service.id === 'tree-pruning-permission' && (
            <div
              style={{
                padding: '1.25rem',
                marginBottom: '1.25rem',
                border: '1px solid var(--accent-main, #16a34a)',
                background: 'var(--bg-card)',
                borderRadius: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ maxWidth: '650px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <Leaf size={18} color="#16a34a" />
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                      Dedicated Tree-Pruning Permission &amp; Urban Tree Protection Guide
                    </h3>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Statutory guidelines across municipal Tree Officers, 24/7 hazardous emergency routes, confidential whistleblower illegal felling reporting, and private evidence checklist.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setShowDedicatedTreeGuide((v) => !v)}
                    style={{ fontSize: '0.85rem' }}
                  >
                    {showDedicatedTreeGuide ? 'Switch to Standard Guide' : 'Open Interactive Tree Guide'}
                  </button>
                  <Link
                    to="/services/tree-permission-guide"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.85rem', textDecoration: 'none' }}
                  >
                    Dedicated Page
                  </Link>
                </div>
              </div>
            </div>
          )}

          {service.id === 'counter-demand-forecasting' && (
            <div
              className="card"
              style={{
                marginBottom: '1.5rem',
                border: '1.5px solid var(--accent-main, #2563eb)',
                background: 'var(--bg-card)',
                borderRadius: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ maxWidth: '650px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <ShieldCheck size={18} color="var(--accent-main, #2563eb)" />
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                      Dedicated Counter Demand Forecasting &amp; Queue Staffing Workspace
                    </h3>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Internal operational capacity planning model using Erlang-C queue theory, historical aggregate arrivals, walk-forward backtesting, and auditable shift staffing.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Link
                    to="/counter-demand"
                    className="btn btn-primary"
                    style={{ fontSize: '0.85rem', textDecoration: 'none' }}
                  >
                    Open Forecasting Workspace
                  </Link>
                </div>
              </div>
            </div>
          )}

          {service.id === 'ward-budget-proposal' && (
            <div
              style={{
                padding: '1.25rem',
                marginBottom: '1.25rem',
                border: '1px solid var(--accent-main, #3b82f6)',
                background: 'var(--bg-card)',
                borderRadius: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ maxWidth: '650px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <Users size={18} color="#3b82f6" />
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                      Participatory Ward Budget Proposal &amp; Public Deliberation Platform
                    </h3>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Submit local infrastructure proposals, deliberate with neighbors, participate in advisory ward ballots, and track ground implementation.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Link
                    to="/services/ward-budget-proposal"
                    className="btn btn-primary"
                    style={{ fontSize: '0.85rem', textDecoration: 'none' }}
                  >
                    Open Ward Budget Platform
                  </Link>
                  <Link
                    to="/ward-budget"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.85rem', textDecoration: 'none' }}
                  >
                    Deliberation Board
                  </Link>
                </div>
              </div>
            </div>
          )}

          {service.id === 'civic-survey-builder' && (
            <div
              style={{
                padding: '1.25rem',
                marginBottom: '1.25rem',
                border: '1px solid var(--accent-main, #3b82f6)',
                background: 'var(--bg-card)',
                borderRadius: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ maxWidth: '650px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <ShieldCheck size={18} color="var(--accent-main, #3b82f6)" />
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                      Dedicated Civic Survey Builder &amp; Sampling Diagnostics Hub
                    </h3>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    End-to-end civic survey creator with branching logic, voluntary demographic quotas, item missingness analysis, and explainable response-bias diagnostics.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Link
                    to="/surveys"
                    className="btn btn-primary"
                    style={{ fontSize: '0.85rem', textDecoration: 'none' }}
                  >
                    Launch Survey Workspace
                  </Link>
                </div>
              </div>
            </div>
          )}

          {service.id === 'public-toilet-directory' && (
            <div
              style={{
                padding: '1.25rem',
                marginBottom: '1.25rem',
                border: '1px solid var(--accent-main, #3b82f6)',
                background: 'var(--bg-card)',
                borderRadius: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ maxWidth: '650px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <ShieldCheck size={18} color="var(--accent-main, #3b82f6)" />
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                      Dedicated Public Toilet Availability &amp; Maintenance Directory
                    </h3>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Search verified sanitation facilities with real-time open/closed calculations, wheelchair accessibility fixtures, supervisor cleaning logs, and issue reporting.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Link
                    to="/public-toilets"
                    className="btn btn-primary"
                    style={{ fontSize: '0.85rem', textDecoration: 'none' }}
                  >
                    Launch Sanitation Directory
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Accessible Pedestrian Route & Barrier Map */}
          {service.id === 'pedestrian-barrier-map' && (
            <div
              style={{
                padding: '1.25rem',
                marginBottom: '1.25rem',
                border: '1px solid var(--accent-main, #3b82f6)',
                background: 'var(--bg-card)',
                borderRadius: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ maxWidth: '650px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <Navigation size={18} color="#3b82f6" />
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                      Accessible Pedestrian Route &amp; Barrier Map
                    </h3>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Calculate accessible walking routes, configure mobility constraints without medical diagnosis, report street obstacles, and view official inspection records.
                  </p>
                </div>
                <Link
                  to="/pedestrian-barrier-map"
                  className="btn btn-primary"
                  style={{ fontSize: '0.85rem', textDecoration: 'none' }}
                >
                  Open Route &amp; Barrier Map
                </Link>
              </div>
            </div>
          )}

          {/* Open Contracting Red-Flag Analytics */}
          {service.id === 'open-contracting-red-flags' && (
            <div
              style={{
                padding: '1.25rem',
                marginBottom: '1.25rem',
                border: '1px solid var(--accent-main, #38bdf8)',
                background: 'var(--bg-card)',
                borderRadius: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ maxWidth: '650px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <ShieldAlert size={18} color="#38bdf8" />
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                      Open Contracting Red-Flag Analytics &amp; Audit Workspace
                    </h3>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Audit public procurement records across tender notice, bid, award, and amendment stages using explainable anomaly detection and OCDS red-flag benchmarks without declaring wrongdoing.
                  </p>
                </div>
                <Link
                  to="/open-contracting"
                  className="btn btn-primary"
                  style={{ fontSize: '0.85rem', textDecoration: 'none' }}
                >
                  Open Contracting Workspace
                </Link>
              </div>
            </div>
          )}

          {/* Multi-Authority Jurisdiction Hand-off Map (#815) */}
          <div
            style={{
              padding: '1.25rem',
              marginBottom: '1.25rem',
              border: '1px solid var(--accent-main, #38bdf8)',
              background: 'var(--bg-card)',
              borderRadius: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ maxWidth: '650px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <Layers size={18} color="var(--accent-main, #38bdf8)" />
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                    Multi-Authority Jurisdiction Hand-off Map
                  </h3>
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  View which Ward, Municipal, District, State, or Central authority handles each stage of this service in your locality.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Link
                  to={`/services/${service.id}/jurisdiction-map`}
                  className="btn btn-primary"
                  style={{ fontSize: '0.85rem', textDecoration: 'none' }}
                >
                  Open Hand-off Map
                </Link>
                <Link
                  to={`/jurisdiction-handoff?service=${service.id}`}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.85rem', textDecoration: 'none' }}
                >
                  Authority Navigator
                </Link>
              </div>
            </div>
          </div>

          {/* Anonymized Ward-Level Civic Issue Heatmap */}
          {service.id === 'ward-issue-heatmap' && (
            <div
              style={{
                padding: '1.25rem',
                marginBottom: '1.25rem',
                border: '1px solid var(--accent-main, #38bdf8)',
                background: 'var(--bg-card)',
                borderRadius: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ maxWidth: '650px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <ShieldCheck size={18} color="var(--accent-main, #38bdf8)" />
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                      Anonymized Ward-Level Civic Issue Heatmap &amp; Trend Explorer
                    </h3>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Explore recurring civic issues across municipal wards with k-anonymity privacy safeguards, trend velocity comparisons, and explainable intervention recommendations.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Link
                    to="/ward-issue-heatmap"
                    className="btn btn-primary"
                    style={{ fontSize: '0.85rem', textDecoration: 'none' }}
                  >
                    Open Heatmap &amp; Explorer
                  </Link>
                  <Link
                    to="/services/ward-issue-heatmap"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.85rem', textDecoration: 'none' }}
                  >
                    Dedicated Workspace
                  </Link>
                </div>
              </div>
            </div>
          )}

          {service.id === 'business-licence-checklist' && showDedicatedBusinessLicenceCentre ? (
            <SmallBusinessLicenceCentre />
          ) : service.id === 'aadhaar-card' && showDedicatedAadhaarGuide ? (
            <AadhaarGuide
              initialState={service.jurisdiction?.states?.[0] || 'Delhi'}
              onBack={() => setShowDedicatedAadhaarGuide(false)}
            />
          ) : service.id === 'property-tax-no-dues' && showDedicatedPropertyTaxGuide ? (
            <PropertyTaxNoDuesGuide
              onBack={() => setShowDedicatedPropertyTaxGuide(false)}
            />
          ) : service.id === 'fire-noc' && showDedicatedFireGuide ? (
            <FireSafetyComplianceGuide
              initialJurisdictionId="delhi"
              onBack={() => setShowDedicatedFireGuide(false)}
            />
          ) : service.id === 'tree-pruning-permission' && showDedicatedTreeGuide ? (
            <TreePermissionGuide
              initialJurisdiction="DELHI_NCT"
              onBack={() => setShowDedicatedTreeGuide(false)}
            />
          ) : (
            <>
              <ServiceSectionNav sections={buildGuideSections(service)} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowReaderModal(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
                >
                  <Eye size={15} color="var(--accent-main)" />
                  Accessible Reader Preferences
                </button>
              </div>
              <div style={readerStyle}>
                <ServiceGuide
                  service={service}
                  focusMode={focusMode}
                  onToggleFocusMode={toggleFocusMode}
                  onMakeChecklist={() => setShowMakeChecklistModal(true)}
                />
              </div>
            </>
          )}

          {/* Structured Application Checklist (#existing Checklist UI) */}
          {customChecklist && (
            <section
              className="card"
              style={{ padding: '1.25rem', marginTop: '1.5rem' }}
              aria-labelledby="service-checklist-title"
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  marginBottom: '1rem',
                }}
              >
                <div>
                  <h3 id="service-checklist-title" style={{ margin: 0, fontSize: '1.1rem' }}>
                    Application Document Checklist
                  </h3>
                  <small style={{ color: 'var(--text-secondary)' }}>
                    Structured from service catalogue requirements
                  </small>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowMakeChecklistModal(true)}
                    style={{
                      fontSize: '0.82rem',
                      padding: '0.35rem 0.75rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    <Edit2 size={14} /> Edit checklist
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      clearServiceChecklist(service.id);
                      setCustomChecklistState(false);
                    }}
                    style={{
                      fontSize: '0.82rem',
                      padding: '0.35rem 0.75rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    <RotateCcw size={14} /> Reset
                  </button>
                </div>
              </div>

              <Checklist
                key={service.id}
                checklistId={`service_${service.id}`}
                items={customChecklist.items}
                requirements={customChecklist.requirements}
                label={`Application checklist for ${service.name}`}
              />
            </section>
          )}

          <div style={{ margin: '1rem 0 0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowDocGuidanceModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem' }}
            >
              <FileText size={15} color="var(--accent-main)" />
              Document-Type Requirements Guidance
            </button>
          </div>

          <InlineStatusLegend
            categories={[
              'requirement',
              'intakeWindow',
              'fee',
              'eligibility',
            ]}
            title="Status Legend for This Service"
            fullLegendLabel="View full legend"
          />

          <DocumentPreflightInspectionCard service={service} />

          {/* Civic Application Readiness Scorecard */}
          <ApplicationReadinessScorecard
            service={service}
          />
        </div>
      </div>

      {/* Report Issue Modal */}
      {showReportModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={() => setShowReportModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-issue-title"
            style={{
              width: 'min(90vw, 520px)',
              background: 'var(--bg-card)',
              borderRadius: '1rem',
              padding: '1.5rem',
              border: '1px solid var(--border-light)',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <h3
              id="report-issue-title"
              style={{ marginBottom: '0.75rem' }}
            >
              Report issue
            </h3>

            <p
              style={{
                color: 'var(--text-secondary)',
                marginBottom: '1rem',
              }}
            >
              Please contact the civic support desk to report
              incorrect information for this service.
            </p>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowReportModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <JourneyHandoffModal
        isOpen={handoffModalOpen}
        onClose={() => setHandoffModalOpen(false)}
        serviceId={service.id}
        serviceName={service.name}
        availableTasks={service.steps || []}
        currentUser={user}
      />

      <ServicePrintPacketModal
        isOpen={showPrintPacketModal}
        onClose={() => setShowPrintPacketModal(false)}
        service={service}
      />

      <LowBandwidthShareModal
        isOpen={showLowBandwidthModal}
        onClose={() => setShowLowBandwidthModal(false)}
        service={service}
      />

      <AppointmentVisitPackModal
        isOpen={showVisitPackModal}
        onClose={() => setShowVisitPackModal(false)}
        service={service}
      />

      <InteractiveFeeEstimatorModal
        isOpen={showFeeEstimatorModal}
        onClose={() => setShowFeeEstimatorModal(false)}
        service={service}
      />

      <BarrierReportModal
        isOpen={showBarrierModal}
        onClose={() => setShowBarrierModal(false)}
        service={service}
      />

      <AccessibleReaderPreferencesModal
        isOpen={showReaderModal}
        onClose={() => setShowReaderModal(false)}
        onPreferencesChange={(updated) => setReaderStyle(computeReaderStyle(updated))}
      />

      <DocumentTypeGuidanceModal
        isOpen={showDocGuidanceModal}
        onClose={() => setShowDocGuidanceModal(false)}
        service={service}
      />

      <MakeChecklistModal
        isOpen={showMakeChecklistModal}
        onClose={() => setShowMakeChecklistModal(false)}
        service={service}
        onSaveChecklist={(saved) => setCustomChecklistState(saved)}
      />

      <ApplicationPreparationPlanModal
        isOpen={showPrepPlanModal}
        onClose={() => setShowPrepPlanModal(false)}
        service={service}
      />

      <ApplicationReadinessCheckerModal
        isOpen={showReadinessCheckerModal}
        onClose={() => setShowReadinessCheckerModal(false)}
        service={service}
      />

      <ShareByEmailModal
        isOpen={showShareByEmailModal}
        services={[service]}
        preSelectedIds={[service.id]}
        onClose={() => setShowShareByEmailModal(false)}
        onSent={() => setShowShareByEmailModal(false)}
      />
    </div>
  );
};

export default ServiceDetails;
