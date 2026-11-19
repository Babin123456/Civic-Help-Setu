import React, { useState, useEffect } from 'react';
import { PlusCircle, RefreshCw, ClipboardList, Activity, ShieldCheck, Download } from 'lucide-react';
import { listSurveys, getSurvey } from '../services/surveyService.js';
import { loadResponses } from '../services/surveyStorage.js';
import SurveyCard from '../components/survey/SurveyCard.jsx';
import SurveyFilters from '../components/survey/SurveyFilters.jsx';
import SurveySkeleton from '../components/survey/SurveySkeleton.jsx';
import SurveyEmptyState from '../components/survey/SurveyEmptyState.jsx';
import SurveyErrorState from '../components/survey/SurveyErrorState.jsx';
import SurveyStaleDataNotice from '../components/survey/SurveyStaleDataNotice.jsx';
import SurveyResponseModal from '../components/survey/SurveyResponseModal.jsx';
import SurveyDiagnosticsPanel from '../components/survey/SurveyDiagnosticsPanel.jsx';
import SurveyCodebookExportModal from '../components/survey/SurveyCodebookExportModal.jsx';
import SurveyBuilderModal from '../components/survey/SurveyBuilderModal.jsx';

const CivicSurveyWorkspace = () => {
  const [surveys, setSurveys] = useState(() => {
    try {
      return listSurveys();
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(() => new Date().toISOString());

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Modals state
  const [activeTakingSurvey, setActiveTakingSurvey] = useState(null);
  const [activeDiagnosticsSurvey, setActiveDiagnosticsSurvey] = useState(null);
  const [activeCodebookSurvey, setActiveCodebookSurvey] = useState(null);
  const [activeBuilderSurvey, setActiveBuilderSurvey] = useState(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const fetchSurveys = () => {
    try {
      setLoading(true);
      setError(null);
      const data = listSurveys({
        status: statusFilter,
        category: categoryFilter,
        search: searchQuery,
      });
      setSurveys(data);
      setLastSyncTime(new Date().toISOString());
    } catch (err) {
      setError(err.message || 'Failed to load surveys.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSurveys();
  }, [statusFilter, categoryFilter, searchQuery]);

  const allCategories = Array.from(
    new Set(listSurveys().map((s) => s.category).filter(Boolean))
  );

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setCategoryFilter('all');
  };

  return (
    <div className="section animate-fade-in" style={{ paddingBottom: '5rem' }}>
      <div className="container" style={{ maxWidth: '1100px' }}>
        {/* Page Hero */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--accent-main)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Public Consultation &amp; Research Tool
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
                Civic Survey Builder &amp; Sampling Diagnostics
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '720px', margin: 0, lineHeight: '1.5' }}>
                Create structured public surveys with branching, anonymous response protection, sampling target quotas, and explainable response-bias diagnostics.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsCreatingNew(true)}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.65rem 1.15rem' }}
            >
              <PlusCircle size={17} /> Create Survey Project
            </button>
          </div>
        </div>

        {/* Stale Cache Notice */}
        {lastSyncTime && (
          <SurveyStaleDataNotice lastUpdated={lastSyncTime} onRefresh={fetchSurveys} />
        )}

        {/* Search & Filters */}
        <SurveyFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          categories={allCategories}
          onReset={handleResetFilters}
        />

        {/* Content Body */}
        {loading ? (
          <SurveySkeleton />
        ) : error ? (
          <SurveyErrorState message={error} onRetry={fetchSurveys} />
        ) : surveys.length === 0 ? (
          <SurveyEmptyState onResetFilters={handleResetFilters} onCreateNew={() => setIsCreatingNew(true)} />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {surveys.map((survey) => {
              const responses = loadResponses(survey.id);
              return (
                <SurveyCard
                  key={survey.id}
                  survey={survey}
                  responseCount={responses.length}
                  onTakeSurvey={(s) => setActiveTakingSurvey(s)}
                  onOpenDiagnostics={(s) => setActiveDiagnosticsSurvey(s)}
                  onOpenCodebook={(s) => setActiveCodebookSurvey(s)}
                  onEditSurvey={(s) => setActiveBuilderSurvey(s)}
                />
              );
            })}
          </div>
        )}

        {/* Active Modals */}
        {activeTakingSurvey && (
          <SurveyResponseModal
            survey={activeTakingSurvey}
            onClose={() => setActiveTakingSurvey(null)}
            onSuccess={() => {
              fetchSurveys();
            }}
          />
        )}

        {activeDiagnosticsSurvey && (
          <SurveyDiagnosticsPanel
            survey={activeDiagnosticsSurvey}
            onClose={() => setActiveDiagnosticsSurvey(null)}
          />
        )}

        {activeCodebookSurvey && (
          <SurveyCodebookExportModal
            survey={activeCodebookSurvey}
            onClose={() => setActiveCodebookSurvey(null)}
          />
        )}

        {(isCreatingNew || activeBuilderSurvey) && (
          <SurveyBuilderModal
            survey={activeBuilderSurvey}
            onClose={() => {
              setIsCreatingNew(false);
              setActiveBuilderSurvey(null);
            }}
            onSaveSuccess={() => {
              fetchSurveys();
            }}
          />
        )}
      </div>
    </div>
  );
};

export default CivicSurveyWorkspace;
