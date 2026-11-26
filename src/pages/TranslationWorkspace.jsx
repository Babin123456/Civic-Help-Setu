/**
 * Community-Reviewed Translation and Terminology Governance Workspace
 * 
 * End-to-end workflow: contributors submit suggestions, reviewers compare alternatives,
 * editors publish versioned approved terms.
 * 
 * Acceptance Criteria:
 * - Reachable through clearly named route and navigation entry
 * - Complete primary workflow works with persistent data and survives page reload
 * - All domain states and invalid transitions handled with actionable messages
 * - Data access scoped by authenticated user's role and jurisdiction
 * - Automated suggestions are explainable, versioned and subject to human control
 * - Public views reveal only explicitly approved fields and aggregate data
 * - Empty, loading, error, stale-data and offline states implemented
 */

import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNetwork } from '../context/NetworkContext';
import { 
  createTermService, getTermsService, getTermByIdService,
  createLanguageVariantService, getLanguageVariantsService,
  createTranslationSuggestionService, getPendingSuggestionsService,
  getSuggestionsByTermService, approveTranslationSuggestionService,
  rejectTranslationSuggestionService,
  createReviewAssignmentService, getReviewAssignmentsBySuggestionService,
  updateReviewAssignmentService, createTerminologyVersionService,
  getTerminologyVersionsService, createSourceReferenceService,
  getSourceReferencesService, searchTermsService,
  hasPermission, TRANSLATION_PERMISSIONS, TRANSLATION_ROLES
 } from '../services/translationService.js';

const DEFAULT_LANGUAGE_CODE = 'en';

export default function TranslationWorkspace() {
  const navigate = useNavigate();
  const { user, loading: authLoading, role } = useAuth();
  const { t, lang } = useLanguage();
  const { online, offline, isConnected } = useNetwork();
  const { toast } = useToast();
  const [mode, setMode] = useState('browse'); // browse, submit, review, edit
  const [currentTerm, setCurrentTerm] = useState(null);
  const [terms, setTerms] = useState([]);
  const [selectedTermId, setSelectedTermId] = useState(null);
  const [languageVariants, setLanguageVariants] = useState([]);
  const [pendingSuggestions, setPendingSuggestions] = useState([]);
  const [suggestionsByTerm, setSuggestionsByTerm] = useState([]);
  const [reviewAssignments, setReviewAssignments] = useState([]);
  const [terminologyVersions, setTerminologyVersions] = useState([]);
  const [sourceReferences, setSourceReferences] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const formRef = useRef(null);

  // Fix: useEffect dependencies - include user, role, lang
  useEffect(() => {
    loadWorkspace();
  }, [user, role, lang, online]);

  async function loadWorkspace() {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Load all terms
      const termsResult = await getTermsService({ query: searchQuery }, role || TRANSLATION_ROLES.CITIZEN);
      if (!termsResult.success) throw new Error(termsResult.error);
      setTerms(termsResult.terms);

      // 2. If a term is selected, load its details
      if (selectedTermId) {
        const termResult = await getTermByIdService(selectedTermId, role || TRANSLATION_ROLES.CITIZEN);
        if (!termResult.success) throw new Error(termResult.error);
        setCurrentTerm(termResult.term);

        // Load language variants
        const variantsResult = await getLanguageVariantsService(selectedTermId, role || TRANSLATION_ROLES.CITIZEN);
        if (!variantsResult.success) throw new Error(variantsResult.error);
        setLanguageVariants(variantsResult.variants);

        // Load translation suggestions
        const suggestionsResult = await getSuggestionsByTermService(selectedTermId, role || TRANSLATION_ROLES.CITIZEN);
        if (!suggestionsResult.success) throw new Error(suggestionsResult.error);
        setSuggestionsByTerm(suggestionsResult.suggestions);

        // Load review assignments
        const assignmentsResult = await getReviewAssignmentsBySuggestionService(
          // We need a suggestion ID first - get first pending suggestion
          suggestionsResult.suggestions.length > 0 ? suggestionsResult.suggestions[0].id : null,
          role || TRANSLATION_ROLES.CITIZEN
        );
        if (!assignmentsResult.success) throw new Error(assignmentsResult.error);
        setReviewAssignments(assignmentsResult.assignments);

        // Load terminology versions
        const versionsResult = await getTerminologyVersionsService(selectedTermId, role || TRANSLATION_ROLES.CITIZEN);
        if (!versionsResult.success) throw new Error(versionsResult.error);
        setTerminologyVersions(versionsResult.versions);

        // Load source references
        const referencesResult = await getSourceReferencesService(selectedTermId, role || TRANSLATION_ROLES.CITIZEN);
        if (!referencesResult.success) throw new Error(referencesResult.error);
        setSourceReferences(referencesResult.references);
      } else {
        setCurrentTerm(null);
        setLanguageVariants([]);
        setSuggestionsByTerm([]);
        setReviewAssignments([]);
        setTerminologyVersions([]);
        setSourceReferences([]);
      }
    } catch (err) {
      console.error('Workspace load error:', err);
      setError(err.message || 'Failed to load workspace data');
      toast({
      type: 'error',
      message: t('common.errorLoadingData') || 'Failed to load workspace data. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Form submission handlers
  const handleSubmitTerm = async (payload) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await createTermService(payload, role || TRANSLATION_ROLES.CITIZEN);
      if (!result.success) throw new Error(result.error);
      toast({
        type: 'success',
        message: t('translation.workspaceTermCreated') || 'Term created successfully.',
      });
      setSelectedTermId(result.term.id);
      await loadWorkspace();
    } catch (err) {
      console.error('Create term error:', err);
      setError(err.message || 'Failed to create term');
      toast({
        type: 'error',
        message: err.message || 'Failed to create term. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitVariant = async (payload) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await createLanguageVariantService(payload, role || TRANSLATION_ROLES.CITIZEN);
      if (!result.success) throw new Error(result.error);
      toast({
        type: 'success',
        message: t('translation.variantCreated') || 'Language variant created successfully.',
      });
      await loadWorkspace();
    } catch (err) {
      console.error('Create variant error:', err);
      setError(err.message || 'Failed to create language variant');
      toast({
        type: 'error',
        message: err.message || 'Failed to create language variant. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitSuggestion = async (payload) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await createTranslationSuggestionService(payload, role || TRANSLATION_ROLES.CITIZEN);
      if (!result.success) throw new Error(result.error);
      toast({
        type: 'success',
        message: t('translation.suggestionSubmitted') || 'Translation suggestion submitted for review.',
      });
      await loadWorkspace();
    } catch (err) {
      console.error('Create suggestion error:', err);
      setError(err.message || 'Failed to submit suggestion');
      toast({
        type: 'error',
        message: err.message || 'Failed to submit suggestion. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveSuggestion = async (suggestionId) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await approveTranslationSuggestionService(suggestionId, role || TRANSLATION_ROLES.REVIEWER);
      if (!result.success) throw new Error(result.error);
      toast({
        type: 'success',
        message: t('translation.suggestionApproved') || 'Suggestion approved and published.',
      });
      await loadWorkspace();
    } catch (err) {
      console.error('Approve suggestion error:', err);
      setError(err.message || 'Failed to approve suggestion');
      toast({
        type: 'error',
        message: err.message || 'Failed to approve suggestion. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRejectSuggestion = async (suggestionId) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await rejectTranslationSuggestionService(suggestionId, role || TRANSLATION_ROLES.REVIEWER);
      if (!result.success) throw new Error(result.error);
      toast({
        type: 'info',
        message: t('translation.suggestionRejected') || 'Suggestion rejected.',
      });
      await loadWorkspace();
    } catch (err) {
      console.error('Reject suggestion error:', err);
      setError(err.message || 'Failed to reject suggestion');
      toast({
        type: 'error',
        message: err.message || 'Failed to reject suggestion. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAssignment = async (payload) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await createReviewAssignmentService(payload, role || TRANSLATION_ROLES.REVIEWER);
      if (!result.success) throw new Error(result.error);
      toast({
        type: 'success',
        message: t('translation.reviewAssignmentCreated') || 'Review assignment created.',
      });
      await loadWorkspace();
    } catch (err) {
      console.error('Create assignment error:', err);
      setError(err.message || 'Failed to create review assignment');
      toast({
        type: 'error',
        message: err.message || 'Failed to create review assignment. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateVersion = async (payload) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await createTerminologyVersionService(payload, role || TRANSLATION_ROLES.OPERATOR);
      if (!result.success) throw new Error(result.error);
      toast({
        type: 'success',
        message: t('translation.versionCreated') || 'Terminology version created.',
      });
      await loadWorkspace();
    } catch (err) {
      console.error('Create version error:', err);
      setError(err.message || 'Failed to create terminology version');
      toast({
        type: 'error',
        message: err.message || 'Failed to create terminology version. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    // Reload with new query - we could optimize this but for now just set state
    // The loadWorkspace will pick up the query on next render
  };

  // Permission checks
  const canCreateTerm = hasPermission(TRANSLATION_PERMISSIONS.TERM_CREATE, role);
  const canCreateVariant = hasPermission(TRANSLATION_PERMISSIONS.TERM_CREATE, role);
  const canCreateSuggestion = hasPermission(TRANSLATION_PERMISSIONS.SUGGESTION_CREATE, role);
  const canApproveSuggest = hasPermission(TRANSLATION_PERMISSIONS.SUGGESTION_APPROVE, role);
  const canRejectSuggest = hasPermission(TRANSLATION_PERMISSIONS.SUGGESTION_REJECT, role);
  const canCreateAssignment = hasPermission(TRANSLATION_PERMISSIONS.REVIEW_ASSIGN_CREATE, role);
  const canCreateVersion = hasPermission(TRANSLATION_PERMISSIONS.VERSION_CREATE, role);
  const canSearch = hasPermission(TRANSLATION_PERMISSIONS.TERM_READ, role);

  if (authLoading) {
    return (
      <div className="section">
        <div className="container">
          <p>{t('common.loading') || 'Loading...'}</p>
        </div>
      </div>
    );
  }

  if (!user && role === TRANSLATION_ROLES.CITIZEN) {
    return (
      <div className="section">
        <div className="container">
          <h2>{t('translation.workspaceTitle') || 'Community Translation & Terminology Governance'}</h2>
          <p>{t('translation.workspaceSubtitle') || 'Contribute to civic terminology across Indian languages'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="section" style={{ minHeight: '100vh' }}>
      <div className="container">
        <header className="page-header">
          <h1>{t('translation.workspaceTitle') || 'Community Translation & Terminology Governance'}</h1>
          <p>{t('translation.workspaceSubtitle') || 'Contribute to civic terminology across Indian languages'}</p>
        </header>

        {/* Status bars */}
        <div className="status-bars">
          {online ? (
            <span className="status-online">{t('common.online') || 'Online'}</span>
          ) : (
            <span className="status-offline">{t('common.offline') || 'Offline'}</span>
          )}
          {role && (
            <span className="status-role">
              {t(`role.${role}` || role)}
            </span>
          )}
        </div>

        {/* Search and Actions */}
        <div className="workspace-controls">
          <div className="search-box">
            <input
              type="text"
              placeholder={t('translation.searchTerms') || 'Search terms...'}
              value={searchQuery}
              onChange={handleSearchChange}
              disabled={!canSearch}
              className="search-input"
              aria-label={t('translation.searchAria') || 'Search terms'}
            />
            <button
              type="button"
              disabled={!canSearch}
              className="search-button"
              onClick={() => {
                // Search handled via query state
              }}
              aria-label={t('translation.searchButtonAria') || 'Search'}
            >
              {t('common.search') || 'Search'}
            </button>
          </div>

          {/* Action buttons based on role */}
          <div className="action-buttons">
            {canCreateTerm && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => setMode('submit-term')}
                aria-label={t('translation.addTermAria') || 'Add new term'}
              >
                {t('common.addTerm') || 'Add Term'}
              </button>
            )}

            {canCreateVariant && currentTerm && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setMode('submit-variant')}
                aria-label={t('translation.addVariantAria') || 'Add language variant'}
              >
                {t('translation.addVariant') || 'Add Variant'}
              </button>
            )}

            {canCreateSuggestion && currentTerm && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setMode('submit-suggestion')}
                aria-label={t('translation.addSuggestionAria') || 'Submit translation suggestion'}
              >
                {t('translation.addSuggestion') || 'Suggest Translation'}
              </button>
            )}

            {canApproveSuggest && pendingSuggestions.length > 0 && (
              <button
                type="button"
                className="btn-outline"
                onClick={() => setMode('review')}
                aria-label={t('translation.reviewSuggestionsAria') || 'Review pending suggestions'}
              >
                {t('translation.reviewSuggestions') || 'Review Suggestions'}
              </button>
            )}

            {canCreateAssignment && suggestionsByTerm.length > 0 && (
              <button
                type="button"
                className="btn-outline"
                onClick={() => setMode('assign-review')}
                aria-label={t('translation.assignReviewAria') || 'Assign review'}
              >
                {t('translation.assignReview') || 'Assign Review'}
              </button>
            )}
          </div>
        </div>

        {/* Mode-specific forms */}
        {mode === 'submit-term' && (
          <div className="form-card">
            <h3>{t('translation.createTerm') || 'Create New Term'}</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const payload = {
                sourceText: formRef.current.sourceText.value,
                sourceLanguage: formRef.current.sourceLanguage.value,
                category: formRef.current.category.value,
                legalContext: formRef.current.legalContext.value,
                sourceReference: formRef.current.sourceReference 
                  ? { sourceName: formRef.current.sourceReference.name, sourceUrl: formRef.current.sourceReference.url }
                  : undefined,
                createdBy: user?.id || 'citizen-contributor',
              };
              handleSubmitTerm(payload);
            }}>
              <div className="form-group">
                <label htmlFor="sourceText">{t('translation.sourceTextLabel') || 'Source Text (English):'}</label>
                <input
                  type="text"
                  id="sourceText"
                  name="sourceText"
                  required
                  placeholder="e.g., Affidavit"
                  ref={formRef}
                  defaultValue=""
                />
              </div>
              <div className="form-group">
                <label htmlFor="sourceLanguage">{t('translation.sourceLanguageLabel') || 'Source Language:'}</label>
                <select
                  id="sourceLanguage"
                  name="sourceLanguage"
                  defaultValue={DEFAULT_LANGUAGE_CODE}
                >
                  <option value="en">{t('language.english') || 'English'}</option>
                  <option value="hi">{t('language.hindi') || 'Hindi'}</option>
                  <option value="bn">{t('language.bengali') || 'Bengali'}</option>
                  <option value="ta">{t('language.tamil') || 'Tamil'}</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="category">{t('translation.categoryLabel') || 'Category:'}</label>
                <select id="category" name="category">
                  <option value="legal">{t('category.legal') || 'Legal'}</option>
                  <option value="administrative">{t('category.administrative') || 'Administrative'}</option>
                  <option value="procedural">{t('category.procedural') || 'Procedural'}</option>
                  <option value="technical">{t('category.technical') || 'Technical'}</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="legalContext">{t('translation.legalContextLabel') || 'Legal Context:'}</label>
                <textarea
                  id="legalContext"
                  name="legalContext"
                  rows={3}
                  placeholder="e.g., Required for name changes, birth registrations..."
                ></textarea>
              </div>
              <div className="form-group">
                <label htmlFor="sourceReference">{t('translation.sourceReferenceLabel') || 'Source Reference:'}</label>
                <input
                  type="text"
                  id="sourceReference"
                  name="sourceReference"
                  placeholder="e.g., Department of Legal Affairs"
                />
                <small>{t('translation.sourceReferenceHelp') || '(HTTPS URL optional)'}</small>
              </div>
              <button type="submit" disabled={!canCreateTerm}>
                {t('common.create') || 'Create'}
              </button>
              <button
                type="button"
                onClick={() => setMode('browse')}
                disabled={!canCreateTerm}
              >
                {t('common.cancel') || 'Cancel'}
              </button>
            </form>
          </div>
        )}

        {mode === 'submit-variant' && currentTerm && (
          <div className="form-card">
            <h3>{t('translation.createVariant') || 'Create Language Variant'}</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const payload = {
                termId: selectedTermId,
                languageCode: formRef.current.languageCode.value,
                languageName: formRef.current.languageName.value.trim(),
                transliteration: formRef.current.transliteration.value.trim(),
                plainLanguageDefinition: formRef.current.plainLanguageDefinition.value.trim(),
                machineDraft: false,
                reviewStatus: 'pending',
                createdBy: user?.id || 'citizen-contributor',
              };
              handleSubmitVariant(payload);
            }}>
              <div className="form-group">
                <label htmlFor="languageCode">{t('translation.languageCodeLabel') || 'Language Code:'}</label>
                <select
                  id="languageCode"
                  name="languageCode"
                  required
                >
                  <option value="en">{t('language.english') || 'English'}</option>
                  <option value="hi">{t('language.hindi') || 'Hindi'}</option>
                  <option value="bn">{t('language.bengali') || 'Bengali'}</option>
                  <option value="ta">{t('language.tamil') || 'Tamil'}</option>
                </select>
                <small>{t('translation.languageCodeHelp') || 'ISO 639-1 code'</small>
              </div>
              <div className="form-group">
                <label htmlFor="languageName">{t('translation.languageNameLabel') || 'Language (Native Name):'</label>
                <input
                  type="text"
                  id="languageName"
                  name="languageName"
                  required
                  placeholder="e.g., हिन्दी, বাংলা, தமிழ்"
                  defaultValue=""
                />
              </div>
              <div className="form-group">
                <label htmlFor="transliteration">{t('translation.transliterationLabel') || 'Transliteration (optional):'</label>
                <input
                  type="text"
                  id="transliteration"
                  name="transliteration"
                  placeholder="Romanized version of the term"
                />
              </div>
              <div className="form-group">
                <label htmlFor="plainLanguageDefinition">{t('translation.plainLanguageDefinitionLabel') || 'Plain-Language Definition (optional):'</label>
                <textarea
                  id="plainLanguageDefinition"
                  name="plainLanguageDefinition"
                  rows={3}
                  placeholder="A plain-language explanation citizens can easily understand"
                ></textarea>
              </div>
              <button type="submit" disabled={!canCreateVariant}>
                {t('common.create') || 'Create'}
              </button>
              <button
                type="button"
                onClick={() => setMode('browse')}
                disabled={!canCreateVariant}
              >
                {t('common.cancel') || 'Cancel'}
              </button>
            </form>
          </div>
        )}

        {mode === 'submit-suggestion' && currentTerm && (
          <div className="form-card">
            <h3>{t('translation.suggestTranslation') || 'Suggest Translation'}</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const payload = {
                termId: selectedTermId,
                contributorId: user?.id || 'citizen-contributor',
                languageCode: formRef.current.languageCode.value,
                transliteration: formRef.current.transliteration.value.trim(),
                plainLanguageDefinition: formRef.current.plainLanguageDefinition.value.trim(),
                usageExample: formRef.current.usageExample.value.trim(),
                rationale: formRef.current.rationale.value.trim(),
                createdBy: user?.id || 'citizen-contributor',
              };
              handleSubmitSuggestion(payload);
            }}>
              <div className="form-group">
                <label htmlFor="languageCode">{t('translation.languageCodeLabel') || 'Target Language:'}</label>
                <select
                  id="languageCode"
                  name="languageCode"
                  required
                >
                  <option value="en">{t('language.english') || 'English'}</option>
                  <option value="hi">{t('language.hindi') || 'Hindi'}</option>
                  <option value="bn">{t('language.bengali') || 'Bengali'}</option>
                  <option value="ta">{t('language.tamil') || 'Tamil'}</option>
                </select>
                <small>{t('translation.languageCodeHelp') || 'ISO 639-1 code'</small>
              </div>
              <div className="form-group">
                <label htmlFor="transliteration">{t('translation.transliterationLabel') || 'Transliteration (optional):'</label>
                <input
                  type="text"
                  id="transliteration"
                  name="transliteration"
                  placeholder="Romanized version"
                />
              </div>
              <div className="form-group">
                <label htmlFor="plainLanguageDefinition">{t('translation.plainLanguageDefinitionLabel') || 'Plain-Language Definition:'}</label>
                <textarea
                  id="plainLanguageDefinition"
                  name="plainLanguageDefinition"
                  rows={3}
                  placeholder="A plain-language explanation citizens can easily understand"
                  required
                ></textarea>
              </div>
              <div className="form-group">
                <label htmlFor="usageExample">{t('translation.usageExampleLabel') || 'Usage Example (optional):'</label>
                <textarea
                  id="usageExample"
                  name="usageExample"
                  rows={2}
                  placeholder="Example of how this term is used in context"
                ></textarea>
              </div>
              <div className="form-group">
                <label htmlFor="rationale">{t('translation.rationaleLabel') || 'Rationale/Source (optional):'</label>
                <textarea
                  id="rationale"
                  name="rationale"
                  rows={2}
                  placeholder="Why are you suggesting this translation? Reference to source material?"
                ></textarea>
              </div>
              <button type="submit" disabled={!canCreateSuggestion}>
                {t('common.submit') || 'Submit'}
              </button>
              <button
                type="button"
                onClick={() => setMode('browse')}
                disabled={!canCreateSuggestion}
              >
                {t('common.cancel') || 'Cancel'}
              </button>
            </form>
          </div>
        )}

        {mode === 'review' && (
          <div className="form-card">
            <h3>{t('translation.reviewSuggestions') || 'Review Pending Suggestions'}</h3>
            {pendingSuggestions.length === 0 && (
              <p>{t('translation.noPendingSuggestions') || 'No pending suggestions at this time.'}</p>
            )}
            {pendingSuggestions.length > 0 && (
              <ul>
                {pendingSuggestions.map((suggestion) => (
                  <li key={suggestion.id} className="suggestion-item">
                    <div className="suggestion-info">
                      <strong>{t('translation.language') || 'Language':} {suggestion.languageCode}</strong>
                      <p>{t('translation.definition') || 'Definition':} {suggestion.plainLanguageDefinition?.substring(0, 80) + (suggestion.plainLanguageDefinition?.length > 80 ? '...' : '')}</p>
                    </div>
                    <div className="suggestion-actions">
                      <button
                        type="button"
                        className="btn-small success"
                        onClick={() => handleApproveSuggestion(suggestion.id)}
                        aria-label={t('translation.approveAria') || 'Approve suggestion'}
                        title={t('translation.approveSuggestion') || 'Approve'}
                      >
                        {t('common.approve') || 'Approve'}
                      </button>
                      <button
                        type="button"
                        className="btn-small danger"
                        onClick={() => handleRejectSuggestion(suggestion.id)}
                        aria-label={t('translation.rejectAria') || 'Reject suggestion'}
                        title={t('translation.rejectSuggestion') || 'Reject'}
                      >
                        {t('common.reject') || 'Reject'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setMode('browse')}
              className="btn-cancel"
            >
              {t('common.cancel') || 'Cancel'}
            </button>
          </div>
        )}

        {mode === 'assign-review' && currentTerm && suggestionsByTerm.length > 0 && (
          <div className="form-card">
            <h3>{t('translation.assignReview') || 'Assign Review'}</h3>
            <p>{t('translation.assignReviewHelp') || 'Assign a pending suggestion to a reviewer:'}</p>
            <form onSubmit={(e) => {
              e.preventDefault();
              const firstPending = suggestionsByTerm.find(s => s.status === 'pending_review');
              if (!firstPending) {
                toast({
                  type: 'warning',
                  message: t('translation.noPendingForReview') || 'No pending suggestions available for review.',
                });
                return;
              }
              const payload = {
                suggestionId: firstPending.id,
                assigneeId: user?.id || 'reviewer-pool',
                assigneeRole: 'reviewer',
                priority: 'medium',
                status: 'pending',
                reviewerComments: '',
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
                createdBy: user?.id || 'citizen-contributor',
              };
              handleCreateAssignment(payload);
            }}>
              <div className="form-group">
                <label>{t('translation.selectSuggestion') || 'Select Suggestion:'}</label>
                <select>
                  {suggestionsByTerm.map((s) => (
                    <option key={s.id} value={s.id}>
                      {`${s.languageCode}: ${s.plainLanguageDefinition?.substring(0, 30) || 'No definition'}${s.plainLanguageDefinition?.length > 30 ? '...' : ''}`}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" disabled={!canCreateAssignment}>
                {t('common.assign') || 'Assign'}
              </button>
              <button
                type="button"
                onClick={() => setMode('browse')}
                disabled={!canCreateAssignment}
              >
                {t('common.cancel') || 'Cancel'}
              </button>
            </form>
          </div>
        )}

        {/* Terms list section */}
        <section className="terms-list">
          <h2>{t('translation.terms') || 'Terms'}</h2>
          {isLoading && (
            <div className="loading-state">
              {t('common.loading') || 'Loading...'}
            </div>
          )}
          {error && (
            <div className="error-state">
              {error}
            </div>
          )}
          {terms.length === 0 && !isLoading && (
            <div className="empty-state">
              {t('translation.noTerms') || 'No terms found. Add a new term to get started.'}
              {online ? (
                <button
                  type="button"
                  onClick={() => setMode('submit-term')}
                  className="btn-empty"
                >
                  {t('common.addTerm') || 'Add Term'}
                </button>
              ) : null}
            </div>
          )}
          {terms.length > 0 && (
            <ul className="terms-grid">
              {terms.map((term) => (
                <li key={term.id} className="term-card" onClick={() => setSelectedTermId(term.id)}>
                  <div className="term-header">
                    <span className="term-name">{term.sourceText || '—'}</span>
                    <span className="term-category">{term.category || '—'}</span>
                  </div>
                  <div className="term-meta">
                    <span>{t('translation.language') || 'Lang':} {Object.keys(
                      // Count language variants - simplified
                      {}).length}</span>
                    <span>{t('translation.suggestions') || 'Sug':} {term._suggestionCount || 0}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Selected term detail section */}
        {selectedTermId && currentTerm && (
          <section className="term-detail">
            <h2>{t('translation.termDetail') || 'Term Detail: {term}'}</h2>
            <p className="term-source-text">{currentTerm.sourceText || '—'}</p>
            
            <div className="term-metadata">
              <div className="meta-row">
                <span>{t('translation.category') || 'Category':}</span>
                <span>{currentTerm.category || '—'}</span>
              </div>
              <div className="meta-row">
                <span>{t('translation.createdBy') || 'Created By':}</span>
                <span>{currentTerm.createdBy || '—'}</span>
              </div>
              <div className="meta-row">
                <span>{t('translation.createdAt') || 'Created':}</span>
                <span>{currentTerm.createdAt ? new Date(currentTerm.createdAt).toLocaleDateString() : '—'}</span>
              </div>
            </div>

            {/* Language Variants Sub-section */}
            {languageVariants.length > 0 && (
              <div className="variants-section">
                <h3>{t('translation.languageVariants') || 'Language Variants'}</h3>
                <ul className="variants-list">
                  {languageVariants.map((variant) => (
                    <li key={variant.id} className="variant-item">
                      <span className="variant-language">{variant.languageCode} {t(`language.${variant.languageCode}` || variant.languageCode)}</span>
                      <span className="variant-transliteration">
                        {variant.transliteration ? `(${variant.transliteration})` : ''}
                      </span>
                      <span className="variant-status">
                        {variant.reviewStatus || 'pending'}
                      </span>
                      <button
                        type="button"
                        className="btn-small"
                        onClick={() => handleApproveSuggestion(variant.id)}
                        title="Approve"
                        style={{ opacity: variant.reviewStatus === 'approved' ? 0.5 : 1 }}
                      >
                        {t('common.approve') || 'Approve'}
                      </button>
                      <button
                        type="button"
                        className="btn-small"
                        onClick={() => handleRejectSuggestion(variant.id)}
                        title="Reject"
                        style={{ opacity: variant.reviewStatus === 'rejected' ? 0.5 : 1 }}
                      >
                        {t('common.reject') || 'Reject'}
                      </button>
                    </li>
                  ))}
                </ul>
                {languageVariants.length === 0 && (
                  <p>{t('translation.noVariants') || 'No language variants yet.'}</p>
                )}
              </div>
            )}

            {/* Translation Suggestions Sub-section */}
            {suggestionsByTerm.length > 0 && (
              <div className="suggestions-section">
                <h3>{t('translation.translationSuggestions') || 'Translation Suggestions'}</h3>
                <ul className="suggestions-list">
                  {suggestionsByTerm.map((suggestion) => (
                    <li key={suggestion.id} className="suggestion-item">
                      <span className="suggestion-language">{suggestion.languageCode}</span>
                      <p className="suggestion-definition">
                        {suggestion.plainLanguageDefinition || '—'}
                      </p>
                      <p className="suggestion-rationale">
                        {t('translation.rationale') || 'Rationale':} {suggestion.rationale || '—'}
                      </p>
                      <div className="suggestion-status-badge">
                        {suggestion.status || 'pending_review'}
                      </div>
                      {suggestion.status !== 'approved' && suggestion.status !== 'rejected' && (
                        <>
                          <button
                            type="button"
                            className="btn-small"
                            onClick={() => handleApproveSuggestion(suggestion.id)}
                            aria-label={t('translation.approveAria') || 'Approve suggestion'}
                          >
                            {t('common.approve') || 'Approve'}
                          </button>
                          <button
                            type="button"
                            className="btn-small"
                            onClick={() => handleRejectSuggestion(suggestion.id)}
                            aria-label={t('translation.rejectAria') || 'Reject suggestion'}
                          >
                            {t('common.reject') || 'Reject'}
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
                {suggestionsByTerm.length === 0 && (
                  <p>{t('translation.noSuggestions') || 'No translation suggestions yet.'}</p>
                )}
              </div>
            )}

            {/* Review Assignments Sub-section */}
            {reviewAssignments.length > 0 && (
              <div className="assignments-section">
                <h3>{t('translation.reviewAssignments') || 'Review Assignments'}</h3>
                <ul className="assignments-list">
                  {reviewAssignments.map((assignment) => (
                    <li key={assignment.id} className="assignment-item">
                      <span className="assignment-status">{assignment.status || 'pending'}</span>
                      <span className="assignment-priority">{assignment.priority || 'medium'}</span>
                      <span className="assignment-reviewer">
                        {t('translation.assignee') || 'Assignee':} {assignment.assigneeId || '—'}
                      </span>
                      <button
                        type="button"
                        className="btn-small"
                        onClick={() => handleRejectSuggestion(assignment.suggestionId)}
                        title="Reject associated suggestion"
                      >
                        {t('common.reject') || 'Reject'}
                      </button>
                    </li>
                  ))}
                </ul>
                {reviewAssignments.length === 0 && (
                  <p>{t('translation.noAssignments') || 'No review assignments.'}</p>
                )}
              </div>
            )}

            {/* Terminology Versions Sub-section */}
            {terminologyVersions.length > 0 && (
              <div className="versions-section">
                <h3>{t('translation.terminologyVersions') || 'Terminology Versions'}</h3>
                <ul className="versions-list">
                  {terminologyVersions.map((version) => (
                    <li key={version.id} className="version-item">
                      <span className="version-number">v{version.versionNumber || '—'}</span>
                      <span className="version-approved">
                        {version.approvedBy || '—'}
                      </span>
                      <span className="version-summary">
                        {version.changeSummary || '—'}
                      </span>
                      <span className="version-published">
                        {version.isPublished ? t('common.yes') || 'Yes' : t('common.no') || 'No'}
                      </span>
                    </li>
                  ))}
                </ul>
                {terminologyVersions.length === 0 && (
                  <p>{t('translation.noVersions') || 'No terminology versions yet.'}</p>
                )}
              </div>
            )}

            {/* Source References Sub-section */}
            {sourceReferences.length > 0 && (
              <div className="references-section">
                <h3>{t('translation.sourceReferences') || 'Source References'}</h3>
                <ul className="references-list">
                  {sourceReferences.map((ref) => (
                    <li key={ref.id} className="reference-item">
                      <a
                        href={ref.sourceUrl || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="reference-link"
                      >
                        {ref.sourceName || '—'}
                      </a>
                      <span className="reference-type">
                        {t(`source.${ref.sourceType || 'other'}` || ref.sourceType || 'other')}
                      </span>
                      <span className="reference-retrieved">
                        {ref.retrievedAt ? new Date(ref.retrievedAt).toLocaleDateString() : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
                {sourceReferences.length === 0 && (
                  <p>{t('translation.noReferences') || 'No source references yet.'}</p>
                )}
              </div>
            )}
          </section>
        )}

        {/* Footer with role-based guidance */}
        <footer className="workspace-footer">
          {role === TRANSLATION_ROLES.ADMIN && (
            <p>
              {t('translation.adminGuidance') || 'Administrator mode: Full access to all term management functions.'}
            </p>
          )}
          {role === TRANSLATION_ROLES.CONTRIBUTOR && (
            <p>
              {t('translation.contributorGuidance') || 'Contributor mode: Can submit terms, variants and translation suggestions for review.'}
            </p>
          )}
          {role === TRANSLATION_ROLES.REVIEWER && (
            <p>
              {t('translation.reviewerGuidance') || 'Reviewer mode: Can approve/reject suggestions and assign reviews.'}
            </p>
          )}
          {role === TRANSLATION_ROLES.CITIZEN && (
            <p>
              {t('translation.citizenGuidance') || 'Citizen mode: Can view terminology and submit suggestions.'}
            </p>
          )}
        </footer>
      </div>
    </div>
  );
}