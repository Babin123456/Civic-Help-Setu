// Versioned Civic Service Change Feed Page
// Provides an end-to-end workflow for inspecting service changes and receiving
// alerts for subscribed services and jurisdictions.

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { useLanguage } from '../context/LanguageContext';
import { changeFeedService } from '../services/changeFeedService';
import { roleOf } from '../services/accessControl';
import { CHANGE_TYPES } from '../data/changeEventContract.js';
import { JURISDICTION_LEVELS, JURISDICTION_LEVEL_LABELS } from '../data/jurisdictions.js';
import StandardPageHeader from '../components/common/StandardPageHeader';
import {
  Shield,
  ShieldAlert,
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Search,
  Bookmark,
  RefreshCw,
  Bell,
  Eye,
  ArrowRight,
  ExternalLink,
  PlusCircle,
  Check,
} from 'lucide-react';

export default function ChangeFeedPage() {
  const { user, isAuthenticated } = useAuth();
  const { isOffline } = useNetwork();
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  const userRole = roleOf(user);
  const isAdmin = userRole === 'admin';

  // Tabs: 'feed' | 'impact' | 'review' | 'subscriptions'
  const activeTab = searchParams.get('tab') || 'feed';
  const setActiveTab = (tab) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  // State
  const [events, setEvents] = useState(() => {
    try {
      const res = changeFeedService.listChangeEvents('', { status: isAdmin ? 'all' : 'approved' });
      return res.events || [];
    } catch {
      return [];
    }
  });
  const [savedImpacts, setSavedImpacts] = useState(() => {
    try {
      if (user?.id) {
        const res = changeFeedService.getSavedItemsImpact(user.id);
        return res.impacts || [];
      }
      return [];
    } catch {
      return [];
    }
  });
  const [subscriptions, setSubscriptions] = useState(() => {
    try {
      if (user?.id) {
        const res = changeFeedService.listUserSubscriptions(user.id);
        return res.subscriptions || [];
      }
      return [];
    } catch {
      return [];
    }
  });
  const [pendingEvents, setPendingEvents] = useState(() => {
    try {
      if (isAdmin) {
        const res = changeFeedService.listPendingChangeEvents();
        return res.events || [];
      }
      return [];
    } catch {
      return [];
    }
  });
  const [selectedEventForDiff, setSelectedEventForDiff] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterMateriality, setFilterMateriality] = useState('all');
  const [filterJurisdiction, setFilterJurisdiction] = useState('all');
  const [statusMessage, setStatusMessage] = useState('');

  // Form states
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [proposeData, setProposeData] = useState({
    serviceId: '',
    changeTitle: '',
    changeType: 'POLICY_CHANGE',
    changeReason: 'policy',
    jurisdictionLevel: 'national',
    effectiveDate: new Date().toISOString().split('T')[0],
    officialGazetteCitation: '',
    requiredDocuments: '',
    fees: '',
    slaDays: '',
    guidanceText: '',
  });

  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [subscribeData, setSubscribeData] = useState({
    serviceId: '',
    jurisdictionId: 'all',
    frequency: 'immediate',
    type: 'service',
  });

  // Load feed data
  const loadData = useCallback(() => {
    try {
      const eventsRes = changeFeedService.listChangeEvents('', {
        status: isAdmin ? 'all' : 'approved',
        search: searchQuery,
      });
      if (eventsRes.success) setEvents(eventsRes.events);

      if (user?.id) {
        const subsRes = changeFeedService.listUserSubscriptions(user.id);
        if (subsRes.success) setSubscriptions(subsRes.subscriptions);

        const impactsRes = changeFeedService.getSavedItemsImpact(user.id);
        if (impactsRes.success) setSavedImpacts(impactsRes.impacts);
      }

      if (isAdmin) {
        const pendingRes = changeFeedService.listPendingChangeEvents();
        if (pendingRes.success) setPendingEvents(pendingRes.events);
      }
    } catch (err) {
      console.error('Failed to load change feed', err);
    }
  }, [isAdmin, user?.id, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    let list = events;
    if (filterType !== 'all') {
      list = list.filter(e => e.changeType === filterType);
    }
    if (filterMateriality !== 'all') {
      const isMat = filterMateriality === 'material';
      list = list.filter(e => Boolean(e.isMaterial) === isMat);
    }
    if (filterJurisdiction !== 'all') {
      list = list.filter(e => 
        e.affectedJurisdictions?.some(j => j.level === filterJurisdiction || j.id === filterJurisdiction)
      );
    }
    return list;
  }, [events, filterType, filterMateriality, filterJurisdiction]);

  // Propose change handler
  const handleProposeSubmit = (e) => {
    e.preventDefault();
    try {
      const docsList = proposeData.requiredDocuments.split(',').map(s => s.trim()).filter(Boolean);
      changeFeedService.createChangeEvent({
        serviceId: proposeData.serviceId.trim(),
        changeTitle: proposeData.changeTitle.trim(),
        changeType: proposeData.changeType,
        changeReason: proposeData.changeReason,
        affectedJurisdictions: [{ level: proposeData.jurisdictionLevel }],
        effectiveDate: proposeData.effectiveDate,
        officialGazetteCitation: proposeData.officialGazetteCitation.trim(),
        requiredDocuments: docsList,
        slaDays: proposeData.slaDays ? Number(proposeData.slaDays) : undefined,
        guidanceText: proposeData.guidanceText.trim(),
      });
      setShowProposeModal(false);
      setStatusMessage('Change proposed successfully and submitted for editorial review.');
      loadData();
    } catch (err) {
      setStatusMessage(`Error proposing change: ${err.message}`);
    }
  };

  // Review handlers (Approve / Reject)
  const handleApprove = (eventId) => {
    try {
      changeFeedService.approveChange(eventId, user?.id, 'Approved via Change Feed Desk');
      setStatusMessage('Change event approved and notification delivery queued.');
      loadData();
    } catch (err) {
      setStatusMessage(`Approval failed: ${err.message}`);
    }
  };

  const handleReject = (eventId) => {
    try {
      changeFeedService.rejectChange(eventId, user?.id, 'Rejected during review');
      setStatusMessage('Change event rejected.');
      loadData();
    } catch (err) {
      setStatusMessage(`Rejection failed: ${err.message}`);
    }
  };

  // Subscribe handler
  const handleSubscribeSubmit = (e) => {
    e.preventDefault();
    try {
      changeFeedService.subscribeUser({
        userId: user?.id,
        serviceId: subscribeData.serviceId.trim(),
        jurisdictionId: subscribeData.jurisdictionId,
        frequency: subscribeData.frequency,
        type: subscribeData.type,
      });
      setShowSubscribeModal(false);
      setStatusMessage('Successfully subscribed to service change alerts.');
      loadData();
    } catch (err) {
      setStatusMessage(`Subscription failed: ${err.message}`);
    }
  };

  const handleUnsubscribe = (subId) => {
    try {
      changeFeedService.unsubscribeUser(subId);
      setStatusMessage('Unsubscribed from alerts.');
      loadData();
    } catch (err) {
      setStatusMessage(`Failed to unsubscribe: ${err.message}`);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <StandardPageHeader
        title={t('changeFeed.title', 'Civic Service Change Feed')}
        description={t(
          'changeFeed.description',
          'Track verified amendments to service policies, required documents, fees, and deadlines with citizen impact alerts.'
        )}
      />

      {/* Offline Alert Banner */}
      {isOffline && (
        <div 
          role="status" 
          aria-live="polite"
          className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 flex items-center gap-3"
        >
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600" />
          <span className="text-sm font-medium">
            You are currently offline. Viewing cached change feed records. Changes made now will be saved locally.
          </span>
        </div>
      )}

      {/* Action / Status announcement */}
      {statusMessage && (
        <div 
          role="status" 
          aria-live="polite"
          className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 flex items-center justify-between"
        >
          <span className="text-sm font-medium">{statusMessage}</span>
          <button 
            type="button" 
            onClick={() => setStatusMessage('')} 
            className="text-xs underline ml-4 hover:text-blue-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 space-x-2" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'feed'}
            onClick={() => setActiveTab('feed')}
            className={`pb-2 px-3 text-sm font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'feed'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Clock className="w-4 h-4" />
            Public Change Feed ({events.length})
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'impact'}
            onClick={() => setActiveTab('impact')}
            className={`pb-2 px-3 text-sm font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'impact'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            Saved-Items Impact ({savedImpacts.length})
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'subscriptions'}
            onClick={() => setActiveTab('subscriptions')}
            className={`pb-2 px-3 text-sm font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'subscriptions'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Bell className="w-4 h-4" />
            My Subscriptions ({subscriptions.length})
          </button>

          {isAdmin && (
            <button
              role="tab"
              aria-selected={activeTab === 'review'}
              onClick={() => setActiveTab('review')}
              className={`pb-2 px-3 text-sm font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                activeTab === 'review'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              Editorial Review Desk ({pendingEvents.length})
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {isAuthenticated && (
            <button
              type="button"
              onClick={() => setShowSubscribeModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-white border border-gray-300 text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <Bell className="w-3.5 h-3.5" />
              Subscribe to Alerts
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowProposeModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Record Service Change
            </button>
          )}

          <button
            type="button"
            onClick={loadData}
            aria-label="Refresh change feed"
            className="p-1.5 text-gray-500 hover:text-gray-700 rounded-md border border-gray-300 hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* TAB 1: PUBLIC CHANGE FEED */}
      {activeTab === 'feed' && (
        <section aria-label="Service Change Records">
          {/* Search & Filter Controls */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6 flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[240px] relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search changes by title or service slug..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="filter-type" className="text-xs font-medium text-gray-600">Type:</label>
              <select
                id="filter-type"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Types</option>
                {CHANGE_TYPES.map(type => (
                  <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="filter-materiality" className="text-xs font-medium text-gray-600">Impact:</label>
              <select
                id="filter-materiality"
                value={filterMateriality}
                onChange={(e) => setFilterMateriality(e.target.value)}
                className="text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Levels</option>
                <option value="material">Material Changes Only</option>
                <option value="editorial">Non-Material / Editorial</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="filter-jurisdiction" className="text-xs font-medium text-gray-600">Jurisdiction:</label>
              <select
                id="filter-jurisdiction"
                value={filterJurisdiction}
                onChange={(e) => setFilterJurisdiction(e.target.value)}
                className="text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Jurisdictions</option>
                {JURISDICTION_LEVELS.map(level => (
                  <option key={level} value={level}>{JURISDICTION_LEVEL_LABELS[level] || level}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Event Cards List */}
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
              <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-medium text-gray-800">No Change Events Found</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                No civic service changes match your current filter criteria.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredEvents.map(event => (
                <article
                  key={event.id}
                  className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm hover:shadow transition-shadow"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                          {event.serviceId}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                          {event.changeType.replace(/_/g, ' ')}
                        </span>
                        {event.isMaterial ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-100 text-red-700 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Material Impact
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded bg-green-50 text-green-700">
                            Editorial Update
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded capitalize ${
                          event.status === 'approved' ? 'bg-green-100 text-green-800' :
                          event.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {event.status}
                        </span>
                        {event.affectedJurisdictions?.map((j, idx) => (
                          <span key={idx} className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 capitalize">
                            {JURISDICTION_LEVEL_LABELS[j.level] || j.level}
                          </span>
                        ))}
                      </div>
                      <h3 className="text-base font-semibold text-gray-900 mt-1">
                        {event.changeTitle}
                      </h3>
                    </div>

                    <div className="text-right text-xs text-gray-500">
                      <div className="flex items-center gap-1 justify-end">
                        <Calendar className="w-3.5 h-3.5" />
                        Effective: {event.effectiveDate}
                      </div>
                      <div className="mt-0.5 text-gray-400">
                        Recorded: {event.changedAt}
                      </div>
                    </div>
                  </div>

                  {/* Materiality Reasons */}
                  {event.materialityRecommendation?.reasons?.length > 0 && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-md border border-gray-100 text-xs text-gray-700">
                      <span className="font-semibold text-gray-900">Analysis Breakdown:</span>
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
                        {event.materialityRecommendation.reasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Official Gazette Citation */}
                  {event.officialGazetteCitation && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-indigo-600 font-medium">
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Gazette Citation: {event.officialGazetteCitation}</span>
                    </div>
                  )}

                  {/* Footer actions */}
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                    <span className="text-gray-400">
                      Ruleset: {event.materialityRecommendation?.rulesetVersion || 'standard'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedEventForDiff(event)}
                      className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Inspect Version Diff
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 2: SAVED-ITEMS IMPACT */}
      {activeTab === 'impact' && (
        <section aria-label="Impact on Saved Services">
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-6 text-sm text-blue-900">
            <strong>Citizen Guidance:</strong> This feed checks your saved guides and alert subscriptions against verified service amendments. Only approved material changes are surfaced here.
          </div>

          {savedImpacts.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-base font-medium text-gray-800">All Saved Items Up to Date</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                None of your currently bookmarked civic guides have active material policy revisions pending action.
              </p>
              <div className="mt-4">
                <Link
                  to="/services"
                  className="inline-flex items-center gap-1 px-4 py-2 text-xs font-semibold rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  Explore Services Directory
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {savedImpacts.map(impact => (
                <div
                  key={impact.serviceId}
                  className="bg-white rounded-lg border border-amber-200 p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                        Action Required
                      </span>
                      <h4 className="text-base font-semibold text-gray-900 mt-1">
                        Service: {impact.serviceId}
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {impact.changesCount} material policy amendment(s) detected since your bookmark.
                      </p>
                    </div>
                    <Link
                      to={`/services`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      Open Guide <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  {impact.latestChange && (
                    <div className="mt-3 p-3 bg-amber-50 rounded border border-amber-100 text-xs text-amber-900">
                      <strong>Latest Update:</strong> {impact.latestChange.changeTitle} (Effective {impact.latestChange.effectiveDate})
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 3: USER SUBSCRIPTIONS */}
      {activeTab === 'subscriptions' && (
        <section aria-label="My Change Alert Subscriptions">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Active Change Notification Subscriptions</h3>
            <button
              type="button"
              onClick={() => setShowSubscribeModal(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Add Subscription
            </button>
          </div>

          {subscriptions.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-lg border border-dashed border-gray-300">
              <Bell className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">You have not subscribed to any service change notifications yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {subscriptions.map(sub => (
                <div key={sub.id} className="p-4 bg-white rounded-lg border border-gray-200 flex justify-between items-center">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800">
                      {sub.serviceId ? `Service: ${sub.serviceId}` : 'All Civic Services'}
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Frequency: {sub.frequency} | Channel: In-App Alerts
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnsubscribe(sub.id)}
                    className="text-xs text-red-600 hover:text-red-800 font-medium"
                  >
                    Unsubscribe
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 4: EDITORIAL REVIEW DESK (Admin Only) */}
      {isAdmin && activeTab === 'review' && (
        <section aria-label="Moderation and Review Desk">
          <div className="mb-4 flex justify-between items-center">
            <h3 className="text-sm font-bold text-gray-800">
              Pending Changes Requiring Human-in-the-Loop Review
            </h3>
            <span className="text-xs text-gray-500">
              Gate: Notifications are withheld until explicit review approval.
            </span>
          </div>

          {pendingEvents.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
              <h4 className="text-sm font-medium text-gray-800">Review Queue Empty</h4>
              <p className="text-xs text-gray-500 mt-1">All service changes have been audited and acted upon.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingEvents.map(event => (
                <div key={event.id} className="p-5 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-yellow-100 text-yellow-800">
                        Pending Decision
                      </span>
                      <h4 className="text-base font-semibold text-gray-900 mt-1">
                        {event.changeTitle} ({event.serviceId})
                      </h4>
                      <p className="text-xs text-gray-500">
                        Type: {event.changeType} | Effective: {event.effectiveDate} | Submitter: {event.editorId}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleApprove(event.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded bg-green-600 text-white hover:bg-green-700"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve & Dispatch
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(event.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded bg-red-600 text-white hover:bg-red-700"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </div>

                  {event.materialityRecommendation && (
                    <div className="mt-3 p-3 bg-gray-50 rounded text-xs text-gray-700 border border-gray-200">
                      <div className="font-semibold text-gray-900 mb-1">
                        Automated Materiality Evaluation ({event.materialityRecommendation.rulesetVersion}):
                      </div>
                      <p>
                        Material: <strong>{event.materialityRecommendation.isMaterial ? 'YES' : 'NO'}</strong> | 
                        Confidence: <strong>{event.materialityRecommendation.confidence * 100}%</strong>
                      </p>
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
                        {event.materialityRecommendation.reasons.map((r, idx) => (
                          <li key={idx}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* VERSION DIFF INSPECTOR MODAL */}
      {selectedEventForDiff && (
        <div 
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="diff-dialog-title"
          className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-gray-200 pb-3">
              <div>
                <h3 id="diff-dialog-title" className="text-lg font-bold text-gray-900">
                  Version Specification Comparison
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Service: {selectedEventForDiff.serviceId} | Effective: {selectedEventForDiff.effectiveDate}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEventForDiff(null)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold p-1"
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              <div>
                <h4 className="font-semibold text-gray-800 text-sm mb-1">{selectedEventForDiff.changeTitle}</h4>
                <p className="text-gray-600">Reason: {selectedEventForDiff.changeReason}</p>
                {selectedEventForDiff.officialGazetteCitation && (
                  <p className="text-indigo-600 font-medium mt-1">
                    Citation: {selectedEventForDiff.officialGazetteCitation}
                  </p>
                )}
              </div>

              <div className="p-3 bg-gray-50 rounded border border-gray-200">
                <span className="font-semibold text-gray-900">Field-level Modifications:</span>
                {selectedEventForDiff.materialityRecommendation?.reasons ? (
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    {selectedEventForDiff.materialityRecommendation.reasons.map((r, i) => (
                      <li key={i} className="text-gray-700">{r}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-gray-500">Standard policy revision registered.</p>
                )}
              </div>
            </div>

            <div className="border-t border-gray-200 pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedEventForDiff(null)}
                className="px-4 py-2 text-xs font-semibold rounded bg-gray-200 hover:bg-gray-300 text-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECORD CHANGE MODAL (Admin) */}
      {showProposeModal && (
        <div 
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="propose-dialog-title"
          className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-lg max-w-lg w-full p-6 shadow-xl">
            <h3 id="propose-dialog-title" className="text-base font-bold text-gray-900 mb-4">
              Record New Civic Service Change
            </h3>
            <form onSubmit={handleProposeSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-gray-700 mb-1">Service Identifier *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. aadhaar-guide, property-tax"
                  value={proposeData.serviceId}
                  onChange={e => setProposeData({ ...proposeData, serviceId: e.target.value })}
                  className="w-full border border-gray-300 rounded p-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Change Title *</label>
                <input
                  type="text"
                  required
                  placeholder="Summary of legal / guidance amendment"
                  value={proposeData.changeTitle}
                  onChange={e => setProposeData({ ...proposeData, changeTitle: e.target.value })}
                  className="w-full border border-gray-300 rounded p-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Change Type</label>
                  <select
                    value={proposeData.changeType}
                    onChange={e => setProposeData({ ...proposeData, changeType: e.target.value })}
                    className="w-full border border-gray-300 rounded p-2 text-xs"
                  >
                    {CHANGE_TYPES.map(t => (
                      <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">Jurisdiction</label>
                  <select
                    value={proposeData.jurisdictionLevel}
                    onChange={e => setProposeData({ ...proposeData, jurisdictionLevel: e.target.value })}
                    className="w-full border border-gray-300 rounded p-2 text-xs"
                  >
                    {JURISDICTION_LEVELS.map(level => (
                      <option key={level} value={level}>{JURISDICTION_LEVEL_LABELS[level] || level}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">Effective Date</label>
                  <input
                    type="date"
                    required
                    value={proposeData.effectiveDate}
                    onChange={e => setProposeData({ ...proposeData, effectiveDate: e.target.value })}
                    className="w-full border border-gray-300 rounded p-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Gazette Circular / Citation</label>
                <input
                  type="text"
                  placeholder="e.g. Circular No. 2026/FIN/402"
                  value={proposeData.officialGazetteCitation}
                  onChange={e => setProposeData({ ...proposeData, officialGazetteCitation: e.target.value })}
                  className="w-full border border-gray-300 rounded p-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Mandatory Documents (comma-separated)</label>
                <input
                  type="text"
                  placeholder="Identity Proof, Address Proof, Electricity Bill"
                  value={proposeData.requiredDocuments}
                  onChange={e => setProposeData({ ...proposeData, requiredDocuments: e.target.value })}
                  className="w-full border border-gray-300 rounded p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowProposeModal(false)}
                  className="px-3 py-1.5 rounded border border-gray-300 text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded bg-indigo-600 text-white font-medium"
                >
                  Submit for Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUBSCRIBE MODAL */}
      {showSubscribeModal && (
        <div 
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="sub-dialog-title"
          className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
            <h3 id="sub-dialog-title" className="text-base font-bold text-gray-900 mb-3">
              Subscribe to Service Change Notifications
            </h3>
            <form onSubmit={handleSubscribeSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-gray-700 mb-1">Service Identifier (optional for all)</label>
                <input
                  type="text"
                  placeholder="e.g. aadhaar-guide (leave blank for all)"
                  value={subscribeData.serviceId}
                  onChange={e => setSubscribeData({ ...subscribeData, serviceId: e.target.value })}
                  className="w-full border border-gray-300 rounded p-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Target Jurisdiction</label>
                <select
                  value={subscribeData.jurisdictionId}
                  onChange={e => setSubscribeData({ ...subscribeData, jurisdictionId: e.target.value })}
                  className="w-full border border-gray-300 rounded p-2 text-xs"
                >
                  <option value="all">All Jurisdictions</option>
                  {JURISDICTION_LEVELS.map(level => (
                    <option key={level} value={level}>{JURISDICTION_LEVEL_LABELS[level] || level}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Alert Frequency</label>
                <select
                  value={subscribeData.frequency}
                  onChange={e => setSubscribeData({ ...subscribeData, frequency: e.target.value })}
                  className="w-full border border-gray-300 rounded p-2 text-xs"
                >
                  <option value="immediate">Immediate In-App Alert</option>
                  <option value="daily">Daily Digest</option>
                  <option value="weekly">Weekly Digest</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowSubscribeModal(false)}
                  className="px-3 py-1.5 rounded border border-gray-300 text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded bg-indigo-600 text-white font-medium"
                >
                  Confirm Subscription
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
