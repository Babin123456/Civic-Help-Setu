import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAllServices } from '../services/serviceCatalog';
import ServiceCard from '../components/ServiceCard';
import FilterToolbar from '../components/services/FilterToolbar';
import QuickFilterPresets, { QUICK_PRESETS } from '../components/services/QuickFilterPresets';
import DirectoryEmptyState from '../components/services/DirectoryEmptyState';
import SearchAnalyticsBar from '../components/services/SearchAnalyticsBar';
import ServiceComparisonModal from '../components/services/ServiceComparisonModal';
import ComparisonFloatingTray from '../components/services/ComparisonFloatingTray';
import { comparisonService, MAX_COMPARE_LIMIT } from '../services/comparisonService';
import { getSearchSuggestions, rankAndFilterServices } from '../services/searchRankingEngine';
import StandardPageHeader from '../components/common/StandardPageHeader';
import { Layers, Scale, Building2, HelpCircle } from 'lucide-react';
import { parseServiceFilters, normalizeSearchQuery } from '../utils/searchParams';
import { parseJurisdictionFilters } from '../services/jurisdictionService';
import RtiBuilderModal from '../components/services/RtiBuilderModal';
import GrievanceClassificationRouterModal from '../components/grievance/GrievanceClassificationRouterModal';

const Services = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [comparedServices, setComparedServices] = useState(() => comparisonService.getComparedServices());
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [isRtiModalOpen, setIsRtiModalOpen] = useState(false);
  const [isGrievanceRouterOpen, setIsGrievanceRouterOpen] = useState(false);

  const [compareNotice, setCompareNotice] = useState('');
  const comparedIds = comparedServices.map((s) => s.id);
  const compareFull = comparedServices.length >= MAX_COMPARE_LIMIT;

  const handleToggleCompare = (id) => {
    if (comparisonService.isCompared(id)) {
      comparisonService.removeService(id);
      setCompareNotice('Removed from comparison.');
    } else {
      const res = comparisonService.addService(id);
      setCompareNotice(
        res.success ? 'Added to comparison.' : `You can compare up to ${MAX_COMPARE_LIMIT} services. Remove one first.`
      );
    }
    setComparedServices(comparisonService.getComparedServices());
  };

  const handleRemoveCompared = (id) => {
    comparisonService.removeService(id);
    setComparedServices(comparisonService.getComparedServices());
    setCompareNotice('Removed from comparison.');
  };

  const handleClearCompared = () => {
    comparisonService.clearAll();
    setComparedServices([]);
    setCompareNotice('Comparison cleared.');
  };

  // Built-in guides plus the ones the admin saved, read once when the page opens.
  const [allServices] = useState(getAllServices);

  const categories = useMemo(() => {
    return ['All', ...new Set(allServices.map((s) => s.category))];
  }, [allServices]);

  const departments = useMemo(() => {
    return [...new Set(allServices.map((s) => s.department).filter(Boolean))];
  }, [allServices]);

  // The address bar is untrusted: unknown filter or sort values fall back to the defaults and the
  // search text is cleaned and capped (see src/utils/searchParams.js).
  const {
    searchQuery,
    category: activeCategory,
    department: selectedDepartment,
    mode: selectedMode,
    difficulty: selectedDifficulty,
    fee: selectedFee,
    speed: selectedSpeed,
    sortBy,
  } = useMemo(
    () => parseServiceFilters(searchParams, { categories, departments }),
    [searchParams, categories, departments]
  );

  const {
    state: selectedState,
    district: selectedDistrict,
    districtOptions,
  } = useMemo(() => parseJurisdictionFilters(searchParams, allServices), [searchParams, allServices]);

  const searchSuggestions = useMemo(
    () => getSearchSuggestions(allServices, searchQuery),
    [allServices, searchQuery]
  );

  const updateParam = (key, value, defaultValue = 'All') => {
    const nextParams = new URLSearchParams(searchParams);
    if (!value || value === defaultValue || value === '') {
      nextParams.delete(key);
    } else {
      nextParams.set(key, value);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const handleCategoryChange = (cat) => updateParam('cat', cat, 'All');
  const handleSearchChange = (query) => updateParam('q', normalizeSearchQuery(query), '');
  const handleModeChange = (mode) => updateParam('mode', mode, 'All');
  const handleDifficultyChange = (diff) => updateParam('diff', diff, 'All');
  const handleDepartmentChange = (dept) => updateParam('dept', dept, 'All');
  const handleStateChange = (state) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('district');
    if (!state || state === 'All') nextParams.delete('state');
    else nextParams.set('state', state);
    setSearchParams(nextParams, { replace: true });
  };
  const handleDistrictChange = (district) => updateParam('district', district, 'All');
  const handleFeeChange = (fee) => updateParam('fee', fee, 'All');
  const handleSpeedChange = (speed) => updateParam('speed', speed, 'All');
  const handleSortChange = (sort) => updateParam('sort', sort, 'relevance');

  const handleSelectPreset = (preset) => {
    if (!preset) {
      handleResetFilters();
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    Object.entries(preset.filterParams).forEach(([k, v]) => {
      nextParams.set(k, v);
    });
    setSearchParams(nextParams, { replace: true });
  };

  const activePresetId = useMemo(() => {
    for (const preset of QUICK_PRESETS) {
      const match = Object.entries(preset.filterParams).every(([k, v]) => searchParams.get(k) === v);
      if (match) return preset.id;
    }
    return null;
  }, [searchParams]);

  const handleResetFilters = () => {
    setSearchParams({}, { replace: true });
  };

  const handleSelectChip = (chip) => {
    const nextParams = new URLSearchParams(searchParams);
    if (chip.query) nextParams.set('q', chip.query);
    if (chip.feeType) nextParams.set('fee', chip.feeType);
    if (chip.speed) nextParams.set('speed', chip.speed);
    setSearchParams(nextParams, { replace: true });
  };

  const hasFilterFacets = Boolean(
    activeCategory !== 'All' ||
    selectedMode !== 'All' ||
    selectedDifficulty !== 'All' ||
    selectedDepartment !== 'All' ||
    selectedFee !== 'All' ||
    selectedSpeed !== 'All' ||
    selectedState !== 'All' ||
    selectedDistrict !== 'All'
  );

  const hasActiveFilters = Boolean(
    hasFilterFacets ||
    searchQuery ||
    sortBy !== 'relevance'
  );

  const filteredServices = useMemo(() => {
    return rankAndFilterServices(allServices, {
      searchQuery,
      category: activeCategory,
      department: selectedDepartment,
      mode: selectedMode,
      difficulty: selectedDifficulty,
      feeType: selectedFee,
      speedFilter: selectedSpeed,
      state: selectedState,
      district: selectedDistrict,
      sortBy,
    });
  }, [
    allServices,
    searchQuery,
    activeCategory,
    selectedDepartment,
    selectedMode,
    selectedDifficulty,
    selectedFee,
    selectedSpeed,
    selectedState,
    selectedDistrict,
    sortBy,
  ]);

  return (
    <div
      className="section services-page-container animate-fade-in"
      style={{
        paddingTop: '2rem',
        paddingBottom: comparedServices.length > 0 ? '12rem' : '6rem',
      }}
    >
      <div className="container">
        {/* Polished Header Section */}
        {/* Standard Page Header */}
        <StandardPageHeader
          eyebrow="Verified Citizen Portals & Guides"
          eyebrowIcon={<Layers size={16} />}
          badgeText="Central & State"
          badgeType="accent"
          title="Public Services Directory"
          subtitle="Find step-by-step procedures, required documents, authority contacts, and fee breakdowns for central and state public services."
          maxWidth="700px"
        >
          {/* Quick Utility Action Buttons */}
          <div
            className="services-utility-actions"
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '0.85rem',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={() => setIsRtiModalOpen(true)}
              style={{
                padding: '0.55rem 1.25rem',
                borderRadius: '99px',
                border: '1px solid rgba(37, 99, 235, 0.4)',
                background: 'rgba(37, 99, 235, 0.08)',
                color: '#2563eb',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.08)',
                transition: 'all 0.2s ease',
              }}
            >
              <Scale size={15} />
              <span>Citizen RTI Request Builder (Section 6(1))</span>
            </button>

            <button
              type="button"
              onClick={() => setIsGrievanceRouterOpen(true)}
              style={{
                padding: '0.55rem 1.25rem',
                borderRadius: '99px',
                border: '1px solid rgba(234, 88, 12, 0.4)',
                background: 'rgba(234, 88, 12, 0.08)',
                color: '#ea580c',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(234, 88, 12, 0.08)',
                transition: 'all 0.2s ease',
              }}
            >
              <Building2 size={15} />
              <span>Civic Grievance & Department Router</span>
            </button>
          </div>
        </StandardPageHeader>

        {/* Category Pills Navigation with accessible label */}
        <nav
          aria-label="Filter services by category"
          style={{
            marginBottom: '1rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              overflowX: 'auto',
              paddingBottom: '0.5rem',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {categories.map((cat) => {
              const isActive = activeCategory.toLowerCase() === cat.toLowerCase();
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryChange(cat)}
                  aria-pressed={isActive}
                  style={{
                    padding: '0.5rem 1.15rem',
                    borderRadius: '99px',
                    fontWeight: '600',
                    fontSize: '0.88rem',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    border: isActive ? '1px solid var(--accent-main)' : '1px solid var(--border-light)',
                    background: isActive ? 'var(--accent-main)' : 'var(--glass-bg)',
                    color: isActive ? 'var(--bg-main)' : 'var(--text-secondary)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: isActive ? '0 4px 12px rgba(56, 189, 248, 0.25)' : 'none',
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Search Analytics Bar (Did you mean & Trending chips) */}
        <SearchAnalyticsBar
          searchQuery={searchQuery}
          onSelectSuggestion={(sugg) => handleSearchChange(sugg)}
          onSelectChip={handleSelectChip}
        />

        {/* Quick Filter Presets Chips */}
        <QuickFilterPresets activePresetId={activePresetId} onSelectPreset={handleSelectPreset} />

        {/* Multi-Faceted Filter & Search Toolbar */}
        <FilterToolbar
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          searchSuggestions={searchSuggestions}
          selectedMode={selectedMode}
          onModeChange={handleModeChange}
          selectedDifficulty={selectedDifficulty}
          onDifficultyChange={handleDifficultyChange}
          departments={departments}
          selectedDepartment={selectedDepartment}
          onDepartmentChange={handleDepartmentChange}
          selectedState={selectedState}
          selectedDistrict={selectedDistrict}
          districtOptions={districtOptions}
          onStateChange={handleStateChange}
          onDistrictChange={handleDistrictChange}
          feeType={selectedFee}
          onFeeTypeChange={handleFeeChange}
          speedFilter={selectedSpeed}
          onSpeedFilterChange={handleSpeedChange}
          sortBy={sortBy}
          onSortChange={handleSortChange}
          totalResults={filteredServices.length}
          onResetFilters={handleResetFilters}
          hasActiveFilters={hasActiveFilters}
        />

        {/* Services Grid or Empty State */}
        {filteredServices.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))',
              gap: '1.75rem',
            }}
          >
            {filteredServices.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                isCompared={comparedIds.includes(service.id)}
                compareDisabled={compareFull && !comparedIds.includes(service.id)}
                onToggleCompare={handleToggleCompare}
              />
            ))}
          </div>
        ) : (
          <DirectoryEmptyState
            searchQuery={searchQuery}
            activeCategory={activeCategory}
            hasActiveFilters={hasFilterFacets}
            totalServices={allServices.length}
            onReset={handleResetFilters}
            onClearSearch={() => handleSearchChange('')}
          />
        )}

        {/* Floating Comparison Tray */}
        <ComparisonFloatingTray
          comparedServices={comparedServices}
          onOpenModal={() => setIsCompareModalOpen(true)}
          onClear={handleClearCompared}
          onRemove={handleRemoveCompared}
        />
        <p className="sr-only" role="status" aria-live="polite">{compareNotice}</p>
        {compareFull && (
          <p className="compare-limit-note">
            Comparison is full ({MAX_COMPARE_LIMIT} services). Remove one to add another.
          </p>
        )}

        {/* Service Comparison Matrix Modal */}
        <ServiceComparisonModal
          isOpen={isCompareModalOpen}
          onClose={() => setIsCompareModalOpen(false)}
          comparedServices={comparedServices}
          onRemove={handleRemoveCompared}
          onClear={handleClearCompared}
        />

        {/* Citizen RTI Request Builder Modal */}
        <RtiBuilderModal
          isOpen={isRtiModalOpen}
          onClose={() => setIsRtiModalOpen(false)}
        />

        {/* Civic Grievance Classifier & Department Router Modal */}
        <GrievanceClassificationRouterModal
          isOpen={isGrievanceRouterOpen}
          onClose={() => setIsGrievanceRouterOpen(false)}
        />
      </div>
    </div>
  );
};

export default Services;
