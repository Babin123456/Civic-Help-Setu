/**
 * Service Appointment Availability Heatmap Page
 *
 * Citizens select a supported office and service.
 * The app fetches an authorized slot feed.
 * The calendar displays available, limited, full, or unavailable dates.
 * Citizens select a date to inspect the official booking destination.
 * If no live feed exists, the app shows only office-published appointment instructions.
 *
 * Features:
 * - Office and service selection
 * - Slot feed fetching with authorization
 * - Monthly heatmap calendar visualization
 * - Accessible list alternative
 * - Feed freshness and last checked time
 * - Loading, empty, error, stale-data, and permission-denied states
 * - Keyboard navigation and screen reader support
 * - Colour-independent text legend
 */

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { getAllServices } from '../services/serviceCatalog';
import { CIVIC_OFFICES } from '../data/locationOffices';
import SlotAvailabilityHeatmap from '../components/SlotAvailabilityHeatmap';
import StandardPageHeader from '../components/common/StandardPageHeader';
import { BookOpen, Info, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';

const ServiceAppointmentHeatmapPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  // State: selected office and service
  const [selectedOfficeId, setSelectedOfficeId] = useState<string | null>(
    null
  );
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    null
  );
  const [selectedOffice, setSelectedOffice] = useState<any>(null);
  const [selectedService, setSelectedService] = useState<any>(null);

  // Derive office and service from search params or defaults
  const officeIdFromParam = searchParams.get('office');
  const serviceIdFromParam = searchParams.get('service');

  useEffect(() => {
    if (officeIdFromParam && serviceIdFromParam) {
      const office = CIVIC_OFFICES.find((o) => o.id === officeIdFromParam);
      const service = MOCK_SERVICES.find((s) => s.id === serviceIdFromParam);
      if (office && service) {
        setSelectedOfficeId(officeIdFromParam);
        setSelectedServiceId(serviceIdFromParam);
        setSelectedOffice(office);
        setSelectedService(service);
      }
    }
  }, [officeIdFromParam, serviceIdFromParam]);

  // Available offices for the service (officeIds that have serviceIds matching)
  const officesForService = useMemo(() => {
    return CIVIC_OFFICES
      .filter((office) => office.serviceIds?.includes(selectedServiceId))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedServiceId]);

  // Services that have at least one office with slot feed support
  const servicesWithSlotFeeds = useMemo(() => {
    const supportedCombos = getSupportedOfficeServiceCombos();
    const uniqueServices = new Set(
      CIVIC_OFFICES
        .flatMap((office) =>
          office.serviceIds?.map((sid) => `${office.id}-${sid}`)
        ) || []
        .filter((combo) => supportedCombos.includes(combo))
        .map((combo) => combo.split('-').pop())
        .filter((sid): sid is string => Boolean(sid))
    );
    return [...uniqueServices].map((sid) => MOCK_SERVICES.find((s) => s.id === sid)).filter(
      (s): s is any => Boolean(s)
    );
  }, []);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [heatmapProps, setHeatmapProps] = useState<{
    officeId: string;
    serviceId: string;
    onDateSelect?: (date: string, detail: any) => void;
    onRefresh?: () => void;
  } | null>(null);

  // Fetch slot feed when office/service changes
  useEffect(() => {
    async function loadFeed() {
      if (!selectedOfficeId || !selectedServiceId) {
        setIsLoading(false);
        setError(null);
        setHeatmapProps(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const feed = await fetchSlotFeed(selectedOfficeId, selectedServiceId);
        setHeatmapProps({
          officeId: selectedOfficeId,
          serviceId: selectedServiceId,
          onDateSelect: handleDateSelect,
          onRefresh: refreshFeed,
        });
      } catch (err: any) {
        setError(
          err.message ||
            'Failed to load slot feed. Showing office-published appointment instructions.'
        );
        // Still create a no-feed state that shows guidance
        setHeatmapProps({
          officeId: selectedOfficeId,
          serviceId: selectedServiceId,
          onDateSelect: handleDateSelect,
          onRefresh: refreshFeed,
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadFeed();

    return () => {};
  }, [selectedOfficeId, selectedServiceId, fetchSlotFeed]);

  // Date select handler
  const handleDateSelect = useCallback(
    (date: string, detail: any) => {
      // Open the official booking destination
      const office = CIVIC_OFFICES.find((o) => o.id === selectedOfficeId);
      const service = MOCK_SERVICES.find((s) => s.id === selectedServiceId);
      const bookingUrl =
        service.officialSources?.[0]?.url || office?.contact?.portalUrl || '#';

      // Navigate to the official portal
      window.open(bookingUrl, '_blank')?.focus();

      // Optionally navigate to a detail page
      // navigate(`/appointment/${date}/${selectedOfficeId}/${selectedServiceId}`);
    },
    [selectedOfficeId, selectedServiceId]
  );

  // Refresh feed handler
  const refreshFeed = useCallback(() => {
    setIsLoading(true);
    setError(null);
    // Re-fetch with force refresh
    if (selectedOfficeId && selectedServiceId) {
      fetchSlotFeed(selectedOfficeId, selectedServiceId, true).then((feed) => {
        // Feed is already set in the heatmap component
      });
    }
  }, [selectedOfficeId, selectedServiceId]);

  // No office/service selected
  if (!selectedOfficeId || !selectedServiceId) {
    return renderSelectionState(
      officesForService,
      servicesWithSlotFeeds,
      setSelectedOfficeId,
      setSelectedServiceId
    );
  }

  // Render with heatmap data
  const { officeId, serviceId } = heatmapProps!;

  return (
    <div className="section service-appointment-heatmap-page">
      <div className="container">
        <StandardPageHeader
          eyebrow="Service Appointment Availability"
          eyebrowIcon={<BookOpen size={16} />}
          badgeText="Live Feed"
          badgeType="accent"
          title={selectedOffice?.name || 'Select Office & Service'}
          subtitle={
            selectedService?.shortDescription ||
            'View real-time appointment slot availability across dates'
          }
          maxWidth="700px"
        >
          {/* Feed status banner */}
          {isLoading ? (
            <div
              className="service-feed-banner"
              style={{
                background: 'var(--glass-bg-subtle)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
              }}
            >
              <span className="lucide-loading" aria-hidden="true" style={{ marginRight: '0.5rem' }} />
              Loading appointment slot availability...
            </div>
          ) : error ? (
            <div
              className="service-feed-banner"
              style={{
                background: 'rgba(220, 38, 38, 0.05)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                color: 'var(--text-error, #dc2626)',
              }}
            >
              <AlertCircle size={16} aria-hidden="true" style={{ marginRight: '0.5rem' }} />
              {error}
              <br />
              <button
                onClick={refreshFeed}
                style={{
                  marginLeft: '0.5rem',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  font: 'inherit',
                }}
                aria-label="Refresh slot feed"
              >
                ↻
              </button>
            </div>
          ) : null}

          {/* Heatmap component */}
          <SlotAvailabilityHeatmap
            officeId={officeId}
            serviceId={serviceId}
            onDateSelect={handleDateSelect}
            onRefresh={refreshFeed}
          />
        </StandardPageHeader>
      </div>
    </div>
  );
};

/**
 * Render the office/service selection state.
 */
function renderSelectionState(
  officesForService: any[],
  servicesWithSlotFeeds: any[],
  setSelectedOfficeId: React.Dispatch<React.SetStateAction<string | null>>,
  setSelectedServiceId: React.Dispatch<React.SetStateAction<string | null>>
) {
  return (
    <div className="section service-appointment-select">
      <div className="container">
        <StandardPageHeader
          eyebrow="Service Appointment Availability"
          eyebrowIcon={<BookOpen size={16} />}
          badgeText="Select Service"
          badgeType="accent"
          title="Check Slot Availability"
          subtitle="Select an office and supported service to see real-time appointment slot availability across dates"
          maxWidth="700px"
        >
          {/* Office selection */}
          <div
            style={{
              marginBottom: '2rem',
              padding: '1.5rem',
              background: 'var(--glass-bg-subtle)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <h3
              style={{
                margin: '0 0 1rem',
                fontSize: '1.25rem',
                fontWeight: '600',
                color: 'var(--text-primary)',
              }}
            >
              Select Office
            </h3>
            {officesForService.length === 0 ? (
              <p
                style={{
                  margin: '0.5rem 0',
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                }}
              >
                No offices found for this service. Please select a different service.
              </p>
            ) : (
              <select
                onChange={(e) => {
                  const officeId = e.target.value;
                  setSelectedOfficeId(officeId);
                  setSelectedServiceId(null);
                  setSelectedOffice(
                    CIVIC_OFFICES.find((o) => o.id === officeId) || null
                  );
                  setSelectedService(null);
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '1rem',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                }}
                aria-label="Select office"
              >
                <option value="">-- Select Office --</option>
                {officesForService.map((office) => (
                  <option
                    key={office.id}
                    value={office.id}
                  >
                    {office.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Service selection */}
          <div
            style={{
              marginBottom: '2rem',
              padding: '1.5rem',
              background: 'var(--glass-bg-subtle)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <h3
              style={{
                margin: '0 0 1rem',
                fontSize: '1.25rem',
                fontWeight: '600',
                color: 'var(--text-primary)',
              }}
            >
              Select Service
            </h3>
            {servicesWithSlotFeeds.length === 0 ? (
              <p
                style={{
                  margin: '0.5rem 0',
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                }}
              >
                No services with live slot feeds are currently available. Slot feeds are available for selected services at specific offices.
              </p>
            ) : (
              <select
                onChange={(e) => {
                  const serviceId = e.target.value;
                  setSelectedServiceId(serviceId);
                  setSelectedService(
                    MOCK_SERVICES.find((s) => s.id === serviceId) || null
                  );
                  setSelectedOfficeId(null);
                  setSelectedOffice(null);
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '1rem',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                }}
                aria-label="Select service"
              >
                <option value="">-- Select Service --</option>
                {servicesWithSlotFeeds.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Call-to-action */}
          <div
            style={{
              textAlign: 'center',
              marginTop: '1.5rem',
            }}
          >
            <button
              onClick={() => {
                // Force selection if both are already chosen
                if (!selectedOfficeId || !selectedServiceId) {
                  // Just show the selection UI; no-op
                }
              }}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                fontWeight: '600',
                color: 'var(--bg-main)',
                background: selectedOfficeId && selectedServiceId ? 'var(--accent-main)' : 'var(--border-light)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor:
                  (selectedOfficeId && selectedServiceId) === false
                    ? 'not-allowed'
                    : 'pointer',
              }}
              aria-disabled={!(selectedOfficeId && selectedServiceId)}
              aria-label="View appointment availability"
            >
              {selectedOfficeId && selectedServiceId
                ? 'View Availability Heatmap'
                : 'Select Office and Service to View Availability'}
            </button>
          </div>
        </StandardPageHeader>
      </div>
    </div>
  );
}

export default ServiceAppointmentHeatmapPage;