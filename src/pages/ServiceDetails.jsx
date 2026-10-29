
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bookmark, Check, Link2, Printer, Share2, Zap, Users } from 'lucide-react';
import { getServiceById } from '../services/serviceCatalog';
import RetiredServiceNotice from '../components/common/RetiredServiceNotice';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import UntranslatedBadge from '../components/common/UntranslatedBadge';
import { useFocusMode } from '../hooks/useFocusMode';
import ServiceGuide from '../components/services/ServiceGuide';
import DataFreshnessTrustBadge from '../components/services/DataFreshnessTrustBadge';
import JourneyHandoffModal from '../components/journey/JourneyHandoffModal';
import NoticeBadge from '../components/notices/NoticeBadge';
import ServiceAvailabilityNotice from '../components/services/ServiceAvailabilityNotice';
import LowBandwidthShareModal from '../components/services/LowBandwidthShareModal';
import SourceConflictCautionBanner from '../components/services/SourceConflictCautionBanner';
import FeeTransparencyCard from '../components/services/FeeTransparencyCard';
import ApplicationReadinessScorecard from '../components/services/ApplicationReadinessScorecard';
import ApplicabilityPanel from '../components/services/ApplicabilityPanel';
import BenefitEntitlementCalculator from '../components/services/BenefitEntitlementCalculator';
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

const ServiceDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { user } = useAuth();
  const { toast } = useToast();
  const { focusMode, toggleFocusMode } = useFocusMode();

  const [linkCopied, setLinkCopied] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [handoffModalOpen, setHandoffModalOpen] = useState(false);
  const [showLowBandwidthModal, setShowLowBandwidthModal] = useState(false);
  const [service, setService] = useState(() => getServiceById(id));

  const [isSaved, setIsSaved] = useState(() =>
    getSavedServices().some((savedService) => savedService.id === id)
  );

  useEffect(() => {
    setService(getServiceById(id));

    const savedServices = getSavedServices();

    setIsSaved(
      savedServices.some((savedService) => savedService.id === id)
    );
  }, [id]);

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

      setIsSaved(!alreadySaved);

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

  return (
    <div
      className={`section animate-fade-in${
        focusMode ? ' service-details--focus' : ''
      }`}
      style={{ paddingBottom: '6rem' }}
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
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <UntranslatedBadge />
                <DataFreshnessTrustBadge service={service} />
                <NoticeBadge serviceId={service.id} serviceName={service.name} />
              </div>
              <ServiceAvailabilityNotice serviceId={service.id} serviceName={service.name} />
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
              </div>

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
          </div>

          {/* Official Source Conflict Caution Banner */}
          <SourceConflictCautionBanner
            serviceId={service.id}
          />

<ApplicabilityPanel service={service} />

          {/* Offline In-Office Visit Staging */}
          <OfflineCacheActionCard service={service} />
          <IntakeWindowPanel service={service} />

          {/* Fee Transparency */}
          <FeeTransparencyCard
            serviceId={service.id}
            serviceName={service.name}
          />

          {/* Statutory Welfare & Subsidy Benefit Estimator */}
          <BenefitEntitlementCalculator serviceId={service.id} serviceName={service.name} />

          {/* Service Guide */}
          <ServiceGuide
            service={service}
            focusMode={focusMode}
            onToggleFocusMode={toggleFocusMode}
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

      <LowBandwidthShareModal
        isOpen={showLowBandwidthModal}
        onClose={() => setShowLowBandwidthModal(false)}
        service={service}
      />
    </div>
  );
};

export default ServiceDetails;
