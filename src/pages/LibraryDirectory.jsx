import { useState, useMemo } from 'react';
import StandardPageHeader from '../components/common/StandardPageHeader';
import LibraryCard from '../components/library/LibraryCard';
import LibraryDetailModal from '../components/library/LibraryDetailModal';
import LibraryChecklistModal from '../components/library/LibraryChecklistModal';
import LibraryCorrectionModal from '../components/library/LibraryCorrectionModal';
import LibraryFilters from '../components/library/LibraryFilters';
import LibraryEmptyState from '../components/library/LibraryEmptyState';
import LibrarySkeleton from '../components/library/LibrarySkeleton';
import LibraryErrorState from '../components/library/LibraryErrorState';
import { VERIFIED_LIBRARY_FACILITIES } from '../data/libraryFacilities';
import { filterLibraries, formatLibraryInstructions } from '../services/libraryService';
import { BookOpen, AlertCircle, WifiOff } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const INITIAL_FILTERS = {
  state: '',
  district: '',
  libraryType: 'all',
  onlyWheelchair: false,
  onlyBraille: false,
  onlyScreenReaders: false,
  onlyDigitalResources: false,
  searchQuery: '',
};

export default function LibraryDirectory() {
  const { toast } = useToast();
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [selectedLibraryForDetails, setSelectedLibraryForDetails] = useState(null);
  const [selectedLibraryForChecklist, setSelectedLibraryForChecklist] = useState(null);
  const [selectedLibraryForCorrection, setSelectedLibraryForCorrection] = useState(null);
  const [isLowBandwidthMode, setIsLowBandwidthMode] = useState(false);
  const [isLoading] = useState(false);

  const { filteredLibraries, loadError } = useMemo(() => {
    try {
      return {
        filteredLibraries: filterLibraries(VERIFIED_LIBRARY_FACILITIES, filters),
        loadError: null,
      };
    } catch (err) {
      return {
        filteredLibraries: [],
        loadError: err,
      };
    }
  }, [filters]);

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  const handleCopyAllLowBandwidth = () => {
    if (filteredLibraries.length === 0) return;
    const allText = filteredLibraries.map(formatLibraryInstructions).join('\n\n==============================\n\n');
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(allText);
      toast?.success?.('All filtered library details copied for low-bandwidth reading.');
    }
  };

  return (
    <div className="section" style={{ padding: '2rem 1rem' }}>
      <div className="container" style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {/* Header */}
        <StandardPageHeader
          eyebrow="Civic Knowledge & Learning Directory"
          eyebrowIcon={<BookOpen size={15} style={{ color: 'var(--accent-main)' }} />}
          title="Public Library Membership & Digital Learning Directory"
          subtitle="Verified statutory directory of public libraries, membership categories, application requirements, fees, renewal rules, official OPAC catalogues, and national digital learning repositories."
          badgeText="Verified Government Data"
          badgeType="accent"
        />

        {/* Ethical Compass & Live Seating Disclaimer Banner */}
        <div
          role="note"
          aria-label="Important information regarding facility status"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-main)',
            borderRadius: '0.75rem',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.03)',
          }}
        >
          <AlertCircle size={20} style={{ color: 'var(--warning, #f59e0b)', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Notice for Citizens & Students:</strong>{' '}
            Civic Help Setu does not track live seat availability or real-time reading hall queues. All records are grounded strictly in published municipal circulars, library board acts, and institutional gazettes. For library cards and immediate desk clearance, visit during working hours or call the official numbers listed on each card.
          </div>
        </div>

        {/* Low-Bandwidth Mode Control Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
            marginBottom: '1rem',
          }}
        >
          <button
            type="button"
            onClick={() => setIsLowBandwidthMode((prev) => !prev)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.4rem 0.8rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              borderRadius: '0.4rem',
              backgroundColor: isLowBandwidthMode ? 'var(--accent-main)' : 'var(--bg-surface)',
              color: isLowBandwidthMode ? '#fff' : 'var(--text-primary)',
              border: '1px solid var(--border-main)',
              cursor: 'pointer',
            }}
            title="Toggle compact low-bandwidth plain-text view"
          >
            <WifiOff size={14} /> {isLowBandwidthMode ? 'Exit Low-Bandwidth Mode' : 'Low-Bandwidth Mode'}
          </button>

          {isLowBandwidthMode && (
            <button
              type="button"
              onClick={handleCopyAllLowBandwidth}
              style={{
                fontSize: '0.8rem',
                color: 'var(--accent-main)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Copy All ({filteredLibraries.length}) Records as Text
            </button>
          )}
        </div>

        {/* Filter Toolbar */}
        <LibraryFilters
          filters={filters}
          onChange={setFilters}
          onReset={handleResetFilters}
        />

        {/* Results Count & Heading */}
        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Verified Libraries & Resource Centres ({filteredLibraries.length})
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
            Showing verified public & government institutions
          </span>
        </div>

        {/* Content States */}
        {isLoading ? (
          <LibrarySkeleton />
        ) : loadError ? (
          <LibraryErrorState error={loadError} onRetry={handleResetFilters} />
        ) : filteredLibraries.length === 0 ? (
          <LibraryEmptyState onReset={handleResetFilters} />
        ) : isLowBandwidthMode ? (
          /* Low-Bandwidth Plain-Text Layout */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredLibraries.map((library) => (
              <pre
                key={library.id}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-main)',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                {formatLibraryInstructions(library)}
              </pre>
            ))}
          </div>
        ) : (
          /* Responsive Grid Layout */
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {filteredLibraries.map((library) => (
              <LibraryCard
                key={library.id}
                library={library}
                onOpenDetails={setSelectedLibraryForDetails}
                onOpenChecklist={setSelectedLibraryForChecklist}
                onOpenCorrection={setSelectedLibraryForCorrection}
              />
            ))}
          </div>
        )}

        {/* Modals */}
        <LibraryDetailModal
          isOpen={Boolean(selectedLibraryForDetails)}
          onClose={() => setSelectedLibraryForDetails(null)}
          library={selectedLibraryForDetails}
          onOpenChecklist={(lib) => {
            setSelectedLibraryForDetails(null);
            setSelectedLibraryForChecklist(lib);
          }}
        />

        <LibraryChecklistModal
          isOpen={Boolean(selectedLibraryForChecklist)}
          onClose={() => setSelectedLibraryForChecklist(null)}
          library={selectedLibraryForChecklist}
        />

        <LibraryCorrectionModal
          isOpen={Boolean(selectedLibraryForCorrection)}
          onClose={() => setSelectedLibraryForCorrection(null)}
          library={selectedLibraryForCorrection}
        />
      </div>
    </div>
  );
}

