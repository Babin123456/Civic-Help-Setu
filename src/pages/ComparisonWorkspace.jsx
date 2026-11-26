import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckSquare,
  Compass,
  Layers,
  List,
  Map as MapIcon,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react';
import StandardPageHeader from '../components/common/StandardPageHeader';
import ComparisonStatePanel from '../components/location/ComparisonStatePanel';
import ComparisonTable from '../components/location/ComparisonTable';
import OfficeComparisonCard from '../components/location/OfficeComparisonCard';
import InteractiveOfficeMap from '../components/location/InteractiveOfficeMap';
import StaleDataNotice from '../components/common/StaleDataNotice';
import { useToast } from '../context/ToastContext';
import { getAllServices } from '../services/serviceCatalog';
import {
  DEFAULT_PAGE_SIZE,
  MAX_COMPARE_OFFICES,
  MIN_COMPARE_OFFICES,
  OFFICE_COMPARISON_DATA_VERSION,
  rankOfficeComparisonRecords,
} from '../services/officeComparisonService';
import {
  getAvailableStates,
  getCachedUserCoordinates,
  getDistrictsByState,
  requestUserCoordinates,
} from '../services/locationService';
import {
  LOCATION_STATUS,
  canRequestLocation,
  getLocationFailureCopy,
  queryGeolocationPermission,
  statusFromErrorKind,
} from '../utils/locationPermission';
import {
  clearComparisonDraft,
  hasMeaningfulComparisonDraft,
  readComparisonDraft,
  writeComparisonDraft,
} from '../services/officeComparisonDraft';
import './ComparisonWorkspace.css';

const STALE_DISMISSED_KEY = 'civicbridge_comparison_stale_dismissed';

const emptyFilters = {
  serviceId: '',
  state: '',
  district: '',
  locality: '',
  channel: 'all',
  onlyWheelchairAccessible: false,
  radiusKm: 100,
  page: 1,
};

const readStaleDismissed = () => {
  try {
    return globalThis.sessionStorage?.getItem(STALE_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
};

const writeStaleDismissed = () => {
  try {
    globalThis.sessionStorage?.setItem(STALE_DISMISSED_KEY, 'true');
  } catch {
    // The warning simply appears again if storage is blocked.
  }
};

const buildInitialState = (search) => {
  const params = new URLSearchParams(search || '');
  const draft = readComparisonDraft();
  const serviceId = params.get('service') || draft?.serviceId || '';
  const viewMode = params.get('view') || draft?.viewMode || 'cards';
  return {
    filters: {
      ...emptyFilters,
      serviceId,
      state: params.get('state') || draft?.state || '',
      district: params.get('district') || draft?.district || '',
      locality: params.get('locality') || draft?.locality || '',
      channel: params.get('channel') || draft?.channel || 'all',
      onlyWheelchairAccessible: params.has('wheelchair')
        ? params.get('wheelchair') === 'true'
        : draft?.onlyWheelchairAccessible === true,
      radiusKm: Number(params.get('radius')) > 0 ? Number(params.get('radius')) : draft?.radiusKm || 100,
    },
    selectedOfficeIds: Array.isArray(draft?.selectedOfficeIds) ? draft.selectedOfficeIds : [],
    viewMode: ['cards', 'table', 'map'].includes(viewMode) ? viewMode : 'cards',
  };
};

export const ComparisonWorkspace = () => {
  const routerLocation = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [initialState] = useState(() => buildInitialState(routerLocation.search));
  const [filters, setFilters] = useState(initialState.filters);
  const [selection, setSelection] = useState({
    ids: initialState.selectedOfficeIds,
    resultKey: null,
  });
  const [viewMode, setViewMode] = useState(initialState.viewMode);
  const [userCoords, setUserCoords] = useState(() => getCachedUserCoordinates());
  const [locationStatus, setLocationStatus] = useState(LOCATION_STATUS.IDLE);
  const [permissionState, setPermissionState] = useState('unknown');
  const [staleDismissed, setStaleDismissed] = useState(readStaleDismissed);
  const [now, setNow] = useState(() => Date.now());
  const [isPending, startTransition] = useTransition();
  const resultsRef = useRef(null);

  const services = useMemo(() => getAllServices(), []);
  const selectedService = useMemo(
    () => services.find((service) => service.id === filters.serviceId) || null,
    [services, filters.serviceId]
  );

  const states = useMemo(() => getAvailableStates(), []);
  const districts = useMemo(() => getDistrictsByState(filters.state), [filters.state]);

  // Read the browser permission state without prompting. GPS is only requested
  // from the explicit button below.
  useEffect(() => {
    let cancelled = false;
    let permissionStatus = null;
    let onChange = null;

    const applyState = (state) => {
      if (cancelled) return;
      setPermissionState(state);
      if (state === 'denied') setLocationStatus(LOCATION_STATUS.DENIED);
      else setLocationStatus((previous) => (previous === LOCATION_STATUS.DENIED ? LOCATION_STATUS.IDLE : previous));
    };

    queryGeolocationPermission().then(({ state, status }) => {
      if (cancelled) return;
      permissionStatus = status;
      applyState(state);
      onChange = () => applyState(permissionStatus.state);
      permissionStatus?.addEventListener?.('change', onChange);
    });

    return () => {
      cancelled = true;
      if (onChange) permissionStatus?.removeEventListener?.('change', onChange);
    };
  }, []);

  const query = useMemo(() => {
    if (!filters.serviceId || !selectedService) {
      return {
        state: 'idle',
        results: [],
        allResults: [],
        total: 0,
        totalPages: 1,
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        aggregation: null,
        service: null,
        dataVersion: OFFICE_COMPARISON_DATA_VERSION,
        generatedAt: null,
        error: null,
      };
    }

    try {
      const ranked = rankOfficeComparisonRecords({
        service: selectedService,
        state: filters.state,
        district: filters.district,
        locality: filters.locality,
        channel: filters.channel,
        page: filters.page,
        pageSize: DEFAULT_PAGE_SIZE,
        onlyWheelchairAccessible: filters.onlyWheelchairAccessible,
        userCoords,
        maxRadiusKm: filters.radiusKm,
        now,
      });
      return {
        state: ranked.total > 0 ? 'ready' : 'empty',
        ...ranked,
        error: null,
      };
    } catch (error) {
      return {
        state: 'error',
        results: [],
        allResults: [],
        total: 0,
        totalPages: 1,
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        aggregation: null,
        service: null,
        dataVersion: OFFICE_COMPARISON_DATA_VERSION,
        generatedAt: null,
        error,
      };
    }
  }, [filters, selectedService, userCoords, now]);

  const resultIds = useMemo(
    () => query.allResults.map((record) => record.id),
    [query.allResults]
  );
  const resultKey = resultIds.join('|');

  // Derive the starting selection instead of mutating state from an effect.
  // A citizen's explicit choice is kept while the result set is unchanged;
  // when the filters produce a different set, still-visible choices are kept
  // and the top offices fill up to the minimum.
  const selectedOfficeIds = useMemo(() => {
    const kept = selection.ids.filter((id) => resultIds.includes(id));
    if (selection.resultKey === resultKey) {
      return kept.slice(0, MAX_COMPARE_OFFICES);
    }

    const next = [...kept];
    for (const id of resultIds) {
      if (next.length >= MIN_COMPARE_OFFICES) break;
      if (!next.includes(id)) next.push(id);
    }
    return next.slice(0, MAX_COMPARE_OFFICES);
  }, [selection, resultKey, resultIds]);

  const selectedRecords = useMemo(
    () =>
      selectedOfficeIds
        .map((id) => query.allResults.find((record) => record.id === id))
        .filter(Boolean),
    [selectedOfficeIds, query.allResults]
  );

  // Save only non-sensitive filters and selected office IDs for resuming. An empty
  // draft is removed instead of stored, so "Clear saved comparison" really clears it.
  useEffect(() => {
    const draft = { ...filters, selectedOfficeIds, viewMode };
    if (hasMeaningfulComparisonDraft(draft)) {
      writeComparisonDraft(draft);
    } else {
      clearComparisonDraft();
    }
  }, [filters, selectedOfficeIds, viewMode]);

  const verifiedCoordinateRecords = useMemo(
    () => query.allResults.filter((record) => record.coordinates.verified),
    [query.allResults]
  );

  const updateFilters = (patch, { resetPage = true } = {}) => {
    startTransition(() => {
      setFilters((previous) => ({
        ...previous,
        ...patch,
        page: patch.page ?? (resetPage ? 1 : previous.page),
      }));
    });
  };

  const handleServiceChange = (serviceId) => {
    setSelection({ ids: [], resultKey: null });
    updateFilters({ serviceId, state: '', district: '', locality: '', page: 1 });
    if (serviceId) {
      const service = services.find((candidate) => candidate.id === serviceId);
      toast?.info?.(`Comparing offices for ${service?.name || serviceId.replace(/-/g, ' ')}.`);
    }
  };

  const resetLocationFilters = () => {
    updateFilters({ state: '', district: '', locality: '', channel: 'all', onlyWheelchairAccessible: false });
    toast?.info?.('Location filters cleared. The service selection was kept.');
  };

  const clearEverything = () => {
    clearComparisonDraft();
    setSelection({ ids: [], resultKey: null });
    setStaleDismissed(false);
    try {
      globalThis.sessionStorage?.removeItem(STALE_DISMISSED_KEY);
    } catch {
      // ignore
    }
    startTransition(() => setFilters({ ...emptyFilters }));
    toast?.info?.('Saved comparison cleared.');
  };

  const handleRequestLocation = async () => {
    if (!canRequestLocation({ status: locationStatus, permissionState })) return;
    setLocationStatus(LOCATION_STATUS.REQUESTING);
    try {
      const coordinates = await requestUserCoordinates();
      setUserCoords(coordinates);
      setLocationStatus(LOCATION_STATUS.IDLE);
      updateFilters({ page: 1 });
      toast?.success?.('Location acquired. Distances and radius filters are now active.', 'Location acquired');
    } catch (error) {
      const status = statusFromErrorKind(error.kind);
      setLocationStatus(status);
      const copy = getLocationFailureCopy(status);
      toast?.warning?.(copy?.message || 'Location could not be acquired. Use the manual filters instead.');
    }
  };

  const toggleCompare = (officeId) => {
    if (selectedOfficeIds.includes(officeId)) {
      setSelection({
        ids: selectedOfficeIds.filter((id) => id !== officeId),
        resultKey,
      });
      return;
    }
    if (selectedOfficeIds.length >= MAX_COMPARE_OFFICES) {
      toast?.warning?.(`You can compare up to ${MAX_COMPARE_OFFICES} offices at a time.`);
      return;
    }
    setSelection({ ids: [...selectedOfficeIds, officeId], resultKey });
  };

  const goToPage = (page) => {
    updateFilters({ page }, { resetPage: false });
    globalThis.requestAnimationFrame?.(() => {
      resultsRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    });
  };

  const openReport = (officeId) => {
    const search = filters.serviceId ? `?report=1&service=${encodeURIComponent(filters.serviceId)}` : '?report=1';
    navigate(`/office/${encodeURIComponent(officeId)}${search}`);
  };

  const renderResults = () => {
    if (isPending && query.allResults.length === 0) {
      return <ComparisonStatePanel status="loading" />;
    }

    if (query.state === 'error') {
      return (
        <ComparisonStatePanel
          status="error"
          message="The local office registry could not be evaluated. No data left your browser."
          onRetry={() => setNow((previous) => Math.max(Date.now(), previous + 1))}
        />
      );
    }

    if (query.state === 'empty') {
      return (
        <ComparisonStatePanel
          status="empty"
          message="No office matches this service and location. The service guide may use a different jurisdiction, or the district may not have a listed office."
          onReset={resetLocationFilters}
        />
      );
    }

    if (query.state !== 'ready') return null;

    const firstShown = query.total === 0 ? 0 : (query.page - 1) * query.pageSize + 1;
    const lastShown = Math.min(query.page * query.pageSize, query.total);

    return (
      <>
        {!staleDismissed && (
          <StaleDataNotice
            records={query.allResults}
            dataVersion={query.dataVersion}
            onDismiss={() => {
              setStaleDismissed(true);
              writeStaleDismissed();
            }}
          />
        )}

        <div className="comparison-results__toolbar" ref={resultsRef}>
          <div>
            <h2 id="comparison-results-heading">
              {query.total} office{query.total === 1 ? '' : 's'} for {query.service?.name || selectedService?.name}
            </h2>
            <p>
              Showing {firstShown}–{lastShown} of {query.total}. Ranked by recorded service capability, jurisdiction,
              then source freshness.
            </p>
          </div>

          <div className="comparison-view-switcher" role="group" aria-label="Choose a results view">
            <button
              type="button"
              className={viewMode === 'cards' ? 'is-active' : ''}
              aria-pressed={viewMode === 'cards'}
              onClick={() => setViewMode('cards')}
            >
              <Layers size={15} aria-hidden="true" /> Cards
            </button>
            <button
              type="button"
              className={viewMode === 'table' ? 'is-active' : ''}
              aria-pressed={viewMode === 'table'}
              onClick={() => setViewMode('table')}
            >
              <List size={15} aria-hidden="true" /> Table
            </button>
            <button
              type="button"
              className={viewMode === 'map' ? 'is-active' : ''}
              aria-pressed={viewMode === 'map'}
              onClick={() => setViewMode('map')}
            >
              <MapIcon size={15} aria-hidden="true" /> Map
            </button>
          </div>
        </div>

        <div className="comparison-summary-strip" aria-label="Result summary">
          <span><ShieldCheck size={15} aria-hidden="true" /> {query.aggregation.capabilityMatches} list this service</span>
          <span>{query.aggregation.verifiedRecords} have dated verification</span>
          <span>{query.aggregation.reviewRequired} need review</span>
          <span>{query.aggregation.verifiedCoordinates} have verified map pins</span>
        </div>

        {viewMode === 'cards' && (
          <>
            <div className="comparison-grid">
              {query.results.map((office) => {
                const detailHref = `/office/${encodeURIComponent(office.id)}${
                  filters.serviceId ? `?service=${encodeURIComponent(filters.serviceId)}` : ''
                }`;
                const reportHref = `${detailHref}${filters.serviceId ? '&' : '?'}report=1`;
                return (
                  <OfficeComparisonCard
                    key={office.id}
                    office={office}
                    isSelected={selectedOfficeIds.includes(office.id)}
                    compareDisabled={selectedOfficeIds.length >= MAX_COMPARE_OFFICES}
                    onToggleCompare={toggleCompare}
                    detailHref={detailHref}
                    reportHref={reportHref}
                  />
                );
              })}
            </div>

            <section className="comparison-selected" aria-labelledby="selected-comparison-heading">
              <div className="comparison-section-heading">
                <div>
                  <h2 id="selected-comparison-heading">Selected comparison</h2>
                  <p>
                    {selectedRecords.length} of {MAX_COMPARE_OFFICES} selected.{' '}
                    {selectedRecords.length < MIN_COMPARE_OFFICES
                      ? 'Select at least two offices to compare.'
                      : 'Your selection is saved in this browser session.'}
                  </p>
                </div>
              </div>
              <ComparisonTable
                records={selectedRecords}
                service={selectedService}
                onReportOutdated={openReport}
              />
            </section>
          </>
        )}

        {viewMode === 'table' && (
          <ComparisonTable
            records={selectedRecords}
            service={selectedService}
            onReportOutdated={openReport}
          />
        )}

        {viewMode === 'map' && (
          <section className="comparison-map-section" aria-labelledby="comparison-map-heading">
            <h2 id="comparison-map-heading">Map with verified coordinates only</h2>
            {verifiedCoordinateRecords.length > 0 ? (
              <InteractiveOfficeMap offices={verifiedCoordinateRecords} userCoords={userCoords} />
            ) : (
              <div className="comparison-map-fallback" role="status">
                <MapPin size={24} aria-hidden="true" />
                <div>
                  <h3>No verified coordinates in these results</h3>
                  <p>
                    Pins are shown only when an office record has an explicit, sourced coordinate verification. No office
                    in these results has one, so no pins are rendered.
                  </p>
                </div>
              </div>
            )}

            <h3>Text alternative for all results</h3>
            <ul className="comparison-text-list">
              {query.allResults.map((office) => (
                <li key={office.id}>
                  <Link to={`/office/${encodeURIComponent(office.id)}`}>{office.name}</Link>
                  <span>{office.address}</span>
                  <span>
                    {office.contact.channels[0]?.value || 'Contact unknown'} · Last verified:{' '}
                    {office.verification.reviewDate || 'Unknown'} · {office.match.label}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <nav className="comparison-pagination" aria-label="Comparison result pages">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => goToPage(query.page - 1)}
            disabled={query.page <= 1}
          >
            <ArrowLeft size={15} aria-hidden="true" /> Previous
          </button>
          <span>
            Page {query.page} of {query.totalPages}
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => goToPage(query.page + 1)}
            disabled={query.page >= query.totalPages}
          >
            Next <ArrowRight size={15} aria-hidden="true" />
          </button>
        </nav>
      </>
    );
  };

  const locationDenied = locationStatus === LOCATION_STATUS.DENIED;

  return (
    <div className="section comparison-page animate-fade-in">
      <div className="container comparison-page__container">
        <StandardPageHeader
          eyebrow="Compare before you travel"
          eyebrowIcon={<Compass size={18} />}
          badgeText="Deterministic ranking"
          badgeType="accent"
          title="Local Civic Office Comparison Workspace"
          subtitle="Choose a service, then compare the offices that record a capability for it. See jurisdiction, verification dates, official contacts and accessibility evidence side by side. Ranking is rule-based; explanations are suggestions, not official decisions."
          align="left"
          maxWidth="860px"
        >
          <Link className="btn btn-secondary" to="/nearby">
            <ArrowLeft size={15} aria-hidden="true" /> Nearby offices
          </Link>
          <button type="button" className="btn btn-secondary" onClick={clearEverything}>
            <Trash2 size={15} aria-hidden="true" /> Clear saved comparison
          </button>
        </StandardPageHeader>

        <p className="comparison-draft-note">
          <CheckSquare size={15} aria-hidden="true" />
          Your filters and selected offices are saved only in this browser session. This workspace is not a government
          application status, receipt or approval. Nothing you type here is sent unless you submit a report.
        </p>

        <section className="comparison-filter-panel glass-panel" aria-labelledby="comparison-filter-heading">
          <div className="comparison-filter-panel__heading">
            <div>
              <h2 id="comparison-filter-heading">
                <SlidersHorizontal size={18} aria-hidden="true" /> Choose a service and locality
              </h2>
              <p>Only one service is needed. State, district and locality are optional.</p>
            </div>
            <span className="comparison-data-version">Data version {OFFICE_COMPARISON_DATA_VERSION}</span>
          </div>

          <div className="comparison-filter-grid">
            <div className="comparison-field">
              <label htmlFor="comparison-service">Service</label>
              <select
                id="comparison-service"
                value={filters.serviceId}
                onChange={(event) => handleServiceChange(event.target.value)}
              >
                <option value="">— Select a service —</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="comparison-field">
              <label htmlFor="comparison-state">State (optional)</label>
              <select
                id="comparison-state"
                value={filters.state}
                onChange={(event) => {
                  const state = event.target.value;
                  updateFilters({ state, district: '' });
                }}
              >
                <option value="">All states in the registry</option>
                {states.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </div>

            <div className="comparison-field">
              <label htmlFor="comparison-district">District (optional)</label>
              <select
                id="comparison-district"
                value={filters.district}
                disabled={!filters.state}
                onChange={(event) => updateFilters({ district: event.target.value })}
              >
                <option value="">All districts{filters.state ? ` in ${filters.state}` : ''}</option>
                {districts.map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))}
              </select>
            </div>

            <div className="comparison-field">
              <label htmlFor="comparison-locality">Locality, city or pincode (optional)</label>
              <div className="comparison-input-with-icon">
                <Search size={15} aria-hidden="true" />
                <input
                  id="comparison-locality"
                  type="search"
                  value={filters.locality}
                  placeholder="e.g. Saket, Bengaluru Urban, 110030"
                  onChange={(event) => updateFilters({ locality: event.target.value })}
                />
              </div>
            </div>

            <div className="comparison-field">
              <label htmlFor="comparison-channel">Contact channel</label>
              <select
                id="comparison-channel"
                value={filters.channel}
                onChange={(event) => updateFilters({ channel: event.target.value })}
              >
                <option value="all">Any channel</option>
                <option value="in-person">In person</option>
                <option value="online">Online</option>
                <option value="phone">Phone</option>
              </select>
            </div>

            <div className="comparison-field">
              <label htmlFor="comparison-radius">Distance radius (GPS only)</label>
              <select
                id="comparison-radius"
                value={filters.radiusKm}
                onChange={(event) => updateFilters({ radiusKm: Number(event.target.value) })}
              >
                <option value={25}>Within 25 km</option>
                <option value={50}>Within 50 km</option>
                <option value={100}>Within 100 km</option>
                <option value={250}>Within 250 km</option>
              </select>
            </div>
          </div>

          <div className="comparison-filter-actions">
            <label className="comparison-checkbox">
              <input
                type="checkbox"
                checked={filters.onlyWheelchairAccessible}
                onChange={(event) => updateFilters({ onlyWheelchairAccessible: event.target.checked })}
              />
              <span>Only offices with verified wheelchair access</span>
            </label>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleRequestLocation}
              disabled={!canRequestLocation({ status: locationStatus, permissionState })}
            >
              <MapPin size={15} aria-hidden="true" />
              {locationStatus === LOCATION_STATUS.REQUESTING ? 'Finding location…' : 'Use my location'}
            </button>

            <button type="button" className="btn btn-secondary" onClick={resetLocationFilters}>
              Reset location filters
            </button>
          </div>

          {userCoords && (
            <p className="comparison-location-note" role="status">
              GPS location active. Distances are straight-line estimates and are not used to verify an office.
            </p>
          )}

          {locationDenied && (
            <ComparisonStatePanel
              status="permission-denied"
              onRequestLocation={handleRequestLocation}
              requestLocationDisabled={!canRequestLocation({ status: locationStatus, permissionState })}
            />
          )}
        </section>

        {isPending && query.allResults.length > 0 && (
          <p className="comparison-updating" role="status" aria-live="polite">
            Updating comparison results…
          </p>
        )}

        {!filters.serviceId && (
          <section className="comparison-intro glass-panel" aria-labelledby="comparison-intro-heading">
            <h2 id="comparison-intro-heading">Start with a service</h2>
            <ol>
              <li>Select a service above. The workspace reads the local office registry only.</li>
              <li>Narrow by state, district or locality if you already know where you can travel.</li>
              <li>Compare at least two offices. Select two or three cards, then read the table or map alternative.</li>
            </ol>
            <p>
              Every capability chip links to the office-record source (or says the source is not recorded). Unknown
              contact, accessibility and verification fields stay marked as unknown.
            </p>
          </section>
        )}

        {filters.serviceId && !selectedService && (
          <ComparisonStatePanel
            status="empty"
            title="This service is not in the built-in catalogue"
            message="Choose a built-in service from the list. Custom services may not have office capability mappings yet."
            onReset={() => handleServiceChange('')}
          />
        )}

        {selectedService && (
          <section aria-labelledby="comparison-results-heading" aria-busy={isPending}>
            {renderResults()}
          </section>
        )}

        <section className="comparison-method glass-panel" aria-labelledby="comparison-method-heading">
          <h2 id="comparison-method-heading">
            <Sparkles size={18} aria-hidden="true" /> How ranking and explanations work
          </h2>
          <p>
            The order is deterministic: explicit service capability (50%), jurisdiction coverage (30%), then
            verification freshness (20%). Names and IDs break ties. No AI model chooses the order and no opening-hours
            claim is invented.
          </p>
          <p>
            Match explanations are suggestions for a citizen to check, not an official decision. Conflicting evidence
            or missing jurisdiction is marked “review required” instead of guessed. Source links and data version{' '}
            {OFFICE_COMPARISON_DATA_VERSION} appear with the claims they support.
          </p>
          <p>
            <Link to="/nearby">Open the full nearby-office directory</Link> for hours, directions and appointment
            tokens that are outside this comparison workspace.
          </p>
        </section>
      </div>
    </div>
  );
};

export default ComparisonWorkspace;
