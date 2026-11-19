import { useState, useMemo } from 'react';
import {
  RefreshCw,
  Table as TableIcon,
  LayoutGrid,
  Building2,
} from 'lucide-react';
import StandardPageHeader from '../components/common/StandardPageHeader';
import ToiletCard from '../components/toilets/ToiletCard';
import ToiletFilters from '../components/toilets/ToiletFilters';
import ToiletDetailModal from '../components/toilets/ToiletDetailModal';
import ToiletIssueReportModal from '../components/toilets/ToiletIssueReportModal';
import ToiletCleaningLogModal from '../components/toilets/ToiletCleaningLogModal';
import ToiletMaintenanceModal from '../components/toilets/ToiletMaintenanceModal';
import ToiletRecommendationsCard from '../components/toilets/ToiletRecommendationsCard';
import {
  ToiletSkeleton,
  ToiletEmptyState,
  ToiletErrorState,
  ToiletStaleDataNotice,
  ToiletOfflineNotice,
} from '../components/toilets/ToiletStates';
import { listToilets } from '../services/publicToiletService';
import { generateToiletRecommendations } from '../services/toiletDiagnosticsService';
import { calculateOperatingStatus, CATEGORY_LABELS } from '../data/publicToiletContract';
import { useNetwork } from '../context/NetworkContext';

const INITIAL_FILTERS = {
  state: '',
  district: '',
  ward: '',
  status: 'all',
  category: 'all',
  feeType: 'all',
  wheelchairOnly: false,
  genderNeutralOnly: false,
  babyCareOnly: false,
  sanitaryNapkinOnly: false,
  runningWaterOnly: false,
  openNowOnly: false,
  searchQuery: '',
};

export default function PublicToiletDirectory() {
  const { isOnline } = useNetwork?.() || { isOnline: true };
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'table'
  const [operatorMode, setOperatorMode] = useState(false);
  const [selectedFacilityForDetails, setSelectedFacilityForDetails] = useState(null);
  const [selectedFacilityForReport, setSelectedFacilityForReport] = useState(null);
  const [selectedFacilityForCleaning, setSelectedFacilityForCleaning] = useState(null);
  const [selectedFacilityForMaintenance, setSelectedFacilityForMaintenance] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [lastSynced, setLastSynced] = useState(() => new Date().toISOString());
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Load facilities with active filters
  const { facilities, loadError } = useMemo(() => {
    void refreshTrigger;
    try {
      const res = listToilets({
        ...filters,
        userRole: operatorMode ? 'operator' : 'citizen',
      });
      return { facilities: res.facilities, loadError: null };
    } catch (err) {
      return {
        facilities: [],
        loadError: err.message || 'Failed to load public facilities.',
      };
    }
  }, [filters, operatorMode, refreshTrigger]);

  // Load recommendations for operator mode
  const recommendations = useMemo(() => {
    void refreshTrigger;
    if (!operatorMode || facilities.length === 0) return [];
    const allRecs = [];
    facilities.forEach((f) => {
      const recs = generateToiletRecommendations(f.id);
      allRecs.push(...recs);
    });
    return allRecs;
  }, [operatorMode, facilities, refreshTrigger]);

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      setRefreshTrigger((prev) => prev + 1);
      setLastSynced(new Date().toISOString());
      setIsLoading(false);
    }, 150);
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  return (
    <div className="section" style={{ padding: '2rem 1rem' }}>
      <div className="container" style={{ maxWidth: '1150px', margin: '0 auto' }}>
        {/* Offline Notice */}
        {!isOnline && <ToiletOfflineNotice />}

        {/* Page Header */}
        <StandardPageHeader
          eyebrow="Municipal Public Sanitation Service"
          eyebrowIcon={<Building2 size={16} style={{ color: 'var(--accent-main)' }} />}
          title="Public Toilet Availability & Maintenance Directory"
          subtitle="Real-time verified public sanitation directory: operating hours, accessibility features, sanitary amenities, cleaning logs, and audited maintenance status."
          badgeText="Verified Municipal Service"
          badgeType="accent"
        />

        {/* Mode & View Controls */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            margin: '1.25rem 0',
            padding: '0.85rem 1.25rem',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-main)',
            borderRadius: '0.75rem',
          }}
        >
          {/* Operator Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Mode:
            </span>
            <button
              type="button"
              onClick={() => setOperatorMode(false)}
              className={`btn ${!operatorMode ? 'btn-primary' : 'btn-outline'}`}
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
            >
              Public Resident View
            </button>
            <button
              type="button"
              onClick={() => setOperatorMode(true)}
              className={`btn ${operatorMode ? 'btn-primary' : 'btn-outline'}`}
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
            >
              Operator & Staff Workspace
            </button>
          </div>

          {/* View Mode & Refresh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ display: 'inline-flex', border: '1px solid var(--border-main)', borderRadius: '0.5rem', overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                aria-label="Grid view"
                style={{
                  padding: '0.4rem 0.65rem',
                  backgroundColor: viewMode === 'grid' ? 'var(--primary-main)' : 'var(--bg-surface)',
                  color: viewMode === 'grid' ? '#fff' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontSize: '0.8rem',
                }}
              >
                <LayoutGrid size={14} /> Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                aria-label="Accessible table view"
                style={{
                  padding: '0.4rem 0.65rem',
                  backgroundColor: viewMode === 'table' ? 'var(--primary-main)' : 'var(--bg-surface)',
                  color: viewMode === 'table' ? '#fff' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontSize: '0.8rem',
                }}
              >
                <TableIcon size={14} /> Table (Accessible)
              </button>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              aria-label="Refresh sanitation records"
              className="btn btn-outline"
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* Stale Sync Notice */}
        <ToiletStaleDataNotice lastSynced={lastSynced} />

        {/* Explainable AI / Intelligence Recommendations Card */}
        {operatorMode && recommendations.length > 0 && (
          <ToiletRecommendationsCard
            recommendations={recommendations}
            onDecisionRecorded={() => setRefreshTrigger((prev) => prev + 1)}
          />
        )}

        {/* Filters */}
        <ToiletFilters
          filters={filters}
          onChange={setFilters}
          onReset={handleResetFilters}
        />

        {/* Error State */}
        {loadError && <ToiletErrorState error={loadError} onRetry={handleRefresh} />}

        {/* Content Area */}
        {isLoading ? (
          <ToiletSkeleton />
        ) : facilities.length === 0 ? (
          <ToiletEmptyState onReset={handleResetFilters} />
        ) : viewMode === 'grid' ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {facilities.map((facility) => (
              <ToiletCard
                key={facility.id}
                facility={facility}
                isOperator={operatorMode}
                onOpenDetails={setSelectedFacilityForDetails}
                onReportIssue={setSelectedFacilityForReport}
                onLogCleaning={setSelectedFacilityForCleaning}
                onOpenMaintenance={setSelectedFacilityForMaintenance}
              />
            ))}
          </div>
        ) : (
          /* Accessible Table Alternative */
          <div
            tabIndex="0"
            role="region"
            aria-label="Public sanitation facilities directory table"
            style={{
              overflowX: 'auto',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-main)',
              borderRadius: '1rem',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-main)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Facility Name</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Category</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Ward & Location</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Accessibility</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Fee</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {facilities.map((facility) => {
                  const opStatus = calculateOperatingStatus(facility.operatingWindows, facility.temporaryClosure);
                  return (
                    <tr key={facility.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                        {facility.name}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {CATEGORY_LABELS[facility.category] || facility.category}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {facility.jurisdiction?.ward} ({facility.jurisdiction?.district})
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ fontWeight: 600, color: opStatus.isOpen ? 'var(--success-main)' : 'var(--warning-main)' }}>
                          {opStatus.label}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {facility.features?.wheelchairAccessible ? 'Wheelchair Ramp' : 'Standard'}
                        {facility.features?.genderNeutral && ', Gender-Neutral'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {facility.feeStructure?.feeType === 'free' ? 'Free' : `₹${facility.feeStructure?.amountInr}`}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedFacilityForDetails(facility)}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', marginRight: '0.4rem' }}
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedFacilityForReport(facility)}
                          className="btn btn-outline"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                        >
                          Report
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Modals */}
        {selectedFacilityForDetails && (
          <ToiletDetailModal
            facility={selectedFacilityForDetails}
            onClose={() => setSelectedFacilityForDetails(null)}
            onReportIssue={(f) => {
              setSelectedFacilityForDetails(null);
              setSelectedFacilityForReport(f);
            }}
          />
        )}

        {selectedFacilityForReport && (
          <ToiletIssueReportModal
            facility={selectedFacilityForReport}
            onClose={() => setSelectedFacilityForReport(null)}
            onSuccess={() => setRefreshTrigger((prev) => prev + 1)}
          />
        )}

        {selectedFacilityForCleaning && (
          <ToiletCleaningLogModal
            facility={selectedFacilityForCleaning}
            onClose={() => setSelectedFacilityForCleaning(null)}
            onSuccess={() => setRefreshTrigger((prev) => prev + 1)}
          />
        )}

        {selectedFacilityForMaintenance && (
          <ToiletMaintenanceModal
            facility={selectedFacilityForMaintenance}
            onClose={() => setSelectedFacilityForMaintenance(null)}
            onSuccess={() => setRefreshTrigger((prev) => prev + 1)}
          />
        )}
      </div>
    </div>
  );
}

