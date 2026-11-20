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
  ShieldCheck,
  Calendar,
  CheckCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Search,
  Bookmark,
  Bell,
  Eye,
  ArrowRight,
  ExternalLink,
  PlusCircle,
  Check,
  Sparkles,
  FileText,
  Layers,
  X,
  FileCheck2,
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
  const [copiedCitationId, setCopiedCitationId] = useState(null);

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

  const userId = user?.id;

  // Track auth changes to resync store during render (avoids setState in effects)
  const [prevAuth, setPrevAuth] = useState({ userId, isAdmin });
  if (prevAuth.userId !== userId || prevAuth.isAdmin !== isAdmin) {
    setPrevAuth({ userId, isAdmin });
    const eventsRes = changeFeedService.listChangeEvents('', { status: isAdmin ? 'all' : 'approved' });
    setEvents(eventsRes.events || []);
    if (userId) {
      const subsRes = changeFeedService.listUserSubscriptions(userId);
      setSubscriptions(subsRes.subscriptions || []);
      const impactsRes = changeFeedService.getSavedItemsImpact(userId);
      setSavedImpacts(impactsRes.impacts || []);
    } else {
      setSubscriptions([]);
      setSavedImpacts([]);
    }
    if (isAdmin) {
      const pendingRes = changeFeedService.listPendingChangeEvents();
      setPendingEvents(pendingRes.events || []);
    } else {
      setPendingEvents([]);
    }
  }

  // Load feed data on manual user actions (refresh, submit, approve, subscribe)
  const loadData = useCallback(() => {
    try {
      const eventsRes = changeFeedService.listChangeEvents('', {
        status: isAdmin ? 'all' : 'approved',
      });
      if (eventsRes.success) setEvents(eventsRes.events || []);

      if (userId) {
        const subsRes = changeFeedService.listUserSubscriptions(userId);
        if (subsRes.success) setSubscriptions(subsRes.subscriptions || []);

        const impactsRes = changeFeedService.getSavedItemsImpact(userId);
        if (impactsRes.success) setSavedImpacts(impactsRes.impacts || []);
      } else {
        setSubscriptions([]);
        setSavedImpacts([]);
      }

      if (isAdmin) {
        const pendingRes = changeFeedService.listPendingChangeEvents();
        if (pendingRes.success) setPendingEvents(pendingRes.events || []);
      } else {
        setPendingEvents([]);
      }
    } catch (err) {
      console.error('Failed to load change feed', err);
    }
  }, [isAdmin, userId]);

  // Keyboard navigation for modal dismissal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedEventForDiff(null);
        setShowProposeModal(false);
        setShowSubscribeModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filtered events
  const filteredEvents = useMemo(() => {
    let list = events;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e =>
        (e.changeTitle && e.changeTitle.toLowerCase().includes(q)) ||
        (e.serviceId && e.serviceId.toLowerCase().includes(q))
      );
    }
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
  }, [events, searchQuery, filterType, filterMateriality, filterJurisdiction]);

  // Overview metrics
  const metrics = useMemo(() => {
    const totalCount = events.length;
    const materialCount = events.filter(e => Boolean(e.isMaterial)).length;
    const impactCount = savedImpacts.length;
    const pendingCount = pendingEvents.length;
    return { totalCount, materialCount, impactCount, pendingCount };
  }, [events, savedImpacts, pendingEvents]);

  // Quick preset pills
  const handleQuickPreset = (preset) => {
    if (preset === 'all') {
      setFilterType('all');
      setFilterMateriality('all');
      setFilterJurisdiction('all');
    } else if (preset === 'material') {
      setFilterMateriality('material');
      setFilterType('all');
    } else if (preset === 'documents') {
      setFilterType('REQUIRED_DOCUMENTS');
      setFilterMateriality('all');
    } else if (preset === 'fees') {
      setFilterType('FEE_STRUCTURE');
      setFilterMateriality('all');
    } else if (preset === 'national') {
      setFilterJurisdiction('national');
      setFilterMateriality('all');
      setFilterType('all');
    }
  };

  // Reset filters
  const hasActiveFilters = searchQuery || filterType !== 'all' || filterMateriality !== 'all' || filterJurisdiction !== 'all';
  const handleResetFilters = () => {
    setSearchQuery('');
    setFilterType('all');
    setFilterMateriality('all');
    setFilterJurisdiction('all');
  };

  // Quick subscribe to a specific service from a feed card
  const handleQuickSubscribe = (serviceId) => {
    if (!isAuthenticated) {
      setStatusMessage('Please sign in to subscribe to service change alerts.');
      return;
    }
    try {
      changeFeedService.subscribeUser({
        userId,
        serviceId,
        jurisdictionId: 'all',
        frequency: 'immediate',
        type: 'service',
      });
      setStatusMessage(`Subscribed to alerts for ${serviceId}.`);
      loadData();
    } catch (err) {
      setStatusMessage(`Subscription failed: ${err.message}`);
    }
  };

  // Copy citation link or text
  const handleCopyCitation = (citation, eventId) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(citation).then(() => {
        setCopiedCitationId(eventId);
        setTimeout(() => setCopiedCitationId(null), 2500);
      });
    }
  };

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
      changeFeedService.approveChange(eventId, userId, 'Approved via Change Feed Desk');
      setStatusMessage('Change event approved and notification delivery queued.');
      loadData();
    } catch (err) {
      setStatusMessage(`Approval failed: ${err.message}`);
    }
  };

  const handleReject = (eventId) => {
    try {
      changeFeedService.rejectChange(eventId, userId, 'Rejected during review');
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
        userId,
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
    <div
      className="container page-container"
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '2rem 1rem 4rem',
      }}
    >
      {/* Standard Header with Eyebrow and Quick Actions */}
      <StandardPageHeader
        eyebrow="Verified Statutory Delta Registry"
        eyebrowIcon={<ShieldCheck size={16} />}
        badgeText="Gazette Tracked"
        badgeType="accent"
        title={t('changeFeed.title', 'Civic Service Change Feed')}
        subtitle={t(
          'changeFeed.description',
          'Track verified amendments to service policies, required documents, fees, and deadlines with citizen impact alerts.'
        )}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {isAuthenticated && (
            <button
              type="button"
              onClick={() => setShowSubscribeModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 1rem',
                borderRadius: '99px',
                fontSize: '0.8rem',
                fontWeight: 600,
                background: 'var(--glass-bg)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-light)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <Bell size={14} style={{ color: 'var(--accent-main)' }} />
              <span>Subscribe to Alerts</span>
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowProposeModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 1rem',
                borderRadius: '99px',
                fontSize: '0.8rem',
                fontWeight: 700,
                background: 'var(--accent-main)',
                color: 'var(--bg-main)',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(56, 189, 248, 0.3)',
                transition: 'all 0.2s ease',
              }}
            >
              <PlusCircle size={14} />
              <span>Record Service Change</span>
            </button>
          )}
        </div>
      </StandardPageHeader>

      {/* Quick Metrics Bar (Bento Cards) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem',
            backdropFilter: 'blur(12px)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Tracked Changes
            </p>
            <p style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
              {metrics.totalCount}
            </p>
          </div>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'rgba(56, 189, 248, 0.1)',
              color: 'var(--accent-main)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Layers size={20} />
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem',
            backdropFilter: 'blur(12px)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Material Impacts
            </p>
            <p style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f43f5e', marginTop: '0.25rem' }}>
              {metrics.materialCount}
            </p>
          </div>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'rgba(244, 63, 94, 0.1)',
              color: '#f43f5e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertTriangle size={20} />
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem',
            backdropFilter: 'blur(12px)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              My Saved Impacts
            </p>
            <p style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.25rem' }}>
              {metrics.impactCount}
            </p>
          </div>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'rgba(245, 158, 11, 0.1)',
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Bookmark size={20} />
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem',
            backdropFilter: 'blur(12px)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Active Subscriptions
            </p>
            <p style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981', marginTop: '0.25rem' }}>
              {subscriptions.length}
            </p>
          </div>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.1)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Bell size={20} />
          </div>
        </div>
      </div>

      {/* Offline Alert Banner */}
      {isOffline && (
        <div 
          role="status" 
          aria-live="polite"
          style={{
            marginBottom: '1.5rem',
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
            You are currently offline. Viewing cached change feed records. Changes made now will be saved locally.
          </span>
        </div>
      )}

      {/* Action / Status announcement */}
      {statusMessage && (
        <div 
          role="status" 
          aria-live="polite"
          style={{
            marginBottom: '1.5rem',
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={16} style={{ color: 'var(--accent-main)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{statusMessage}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setStatusMessage('')} 
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0.2rem 0.6rem',
              borderRadius: '99px',
              background: 'var(--glass-bg)',
              color: 'var(--accent-main)',
              border: '1px solid var(--border-light)',
              cursor: 'pointer',
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Segmented Pill Tabs Navigation */}
      <nav
        aria-label="Change feed sections"
        style={{
          display: 'flex',
          gap: '0.5rem',
          overflowX: 'auto',
          paddingBottom: '0.5rem',
          marginBottom: '1.5rem',
          scrollbarWidth: 'none',
        }}
        role="tablist"
      >
        <button
          role="tab"
          aria-selected={activeTab === 'feed'}
          onClick={() => setActiveTab('feed')}
          style={{
            padding: '0.55rem 1.15rem',
            borderRadius: '99px',
            fontWeight: 600,
            fontSize: '0.88rem',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            border: activeTab === 'feed' ? '1px solid var(--accent-main)' : '1px solid var(--border-light)',
            background: activeTab === 'feed' ? 'var(--accent-main)' : 'var(--glass-bg)',
            color: activeTab === 'feed' ? 'var(--bg-main)' : 'var(--text-secondary)',
            transition: 'all 0.2s ease',
            boxShadow: activeTab === 'feed' ? '0 4px 12px rgba(56, 189, 248, 0.25)' : 'none',
          }}
        >
          <Clock size={15} />
          <span>Public Change Feed</span>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 800,
              padding: '0.1rem 0.5rem',
              borderRadius: '99px',
              background: activeTab === 'feed' ? 'rgba(0, 0, 0, 0.25)' : 'var(--glass-bg-hover)',
              color: activeTab === 'feed' ? 'inherit' : 'var(--text-tertiary)',
            }}
          >
            {events.length}
          </span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'impact'}
          onClick={() => setActiveTab('impact')}
          style={{
            padding: '0.55rem 1.15rem',
            borderRadius: '99px',
            fontWeight: 600,
            fontSize: '0.88rem',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            border: activeTab === 'impact' ? '1px solid var(--accent-main)' : '1px solid var(--border-light)',
            background: activeTab === 'impact' ? 'var(--accent-main)' : 'var(--glass-bg)',
            color: activeTab === 'impact' ? 'var(--bg-main)' : 'var(--text-secondary)',
            transition: 'all 0.2s ease',
            boxShadow: activeTab === 'impact' ? '0 4px 12px rgba(56, 189, 248, 0.25)' : 'none',
          }}
        >
          <Bookmark size={15} />
          <span>Saved-Items Impact</span>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 800,
              padding: '0.1rem 0.5rem',
              borderRadius: '99px',
              background: activeTab === 'impact' ? 'rgba(0, 0, 0, 0.25)' : 'var(--glass-bg-hover)',
              color: activeTab === 'impact' ? 'inherit' : 'var(--text-tertiary)',
            }}
          >
            {savedImpacts.length}
          </span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'subscriptions'}
          onClick={() => setActiveTab('subscriptions')}
          style={{
            padding: '0.55rem 1.15rem',
            borderRadius: '99px',
            fontWeight: 600,
            fontSize: '0.88rem',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            border: activeTab === 'subscriptions' ? '1px solid var(--accent-main)' : '1px solid var(--border-light)',
            background: activeTab === 'subscriptions' ? 'var(--accent-main)' : 'var(--glass-bg)',
            color: activeTab === 'subscriptions' ? 'var(--bg-main)' : 'var(--text-secondary)',
            transition: 'all 0.2s ease',
            boxShadow: activeTab === 'subscriptions' ? '0 4px 12px rgba(56, 189, 248, 0.25)' : 'none',
          }}
        >
          <Bell size={15} />
          <span>My Subscriptions</span>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 800,
              padding: '0.1rem 0.5rem',
              borderRadius: '99px',
              background: activeTab === 'subscriptions' ? 'rgba(0, 0, 0, 0.25)' : 'var(--glass-bg-hover)',
              color: activeTab === 'subscriptions' ? 'inherit' : 'var(--text-tertiary)',
            }}
          >
            {subscriptions.length}
          </span>
        </button>

        {isAdmin && (
          <button
            role="tab"
            aria-selected={activeTab === 'review'}
            onClick={() => setActiveTab('review')}
            style={{
              padding: '0.55rem 1.15rem',
              borderRadius: '99px',
              fontWeight: 600,
              fontSize: '0.88rem',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              border: activeTab === 'review' ? '1px solid var(--accent-main)' : '1px solid var(--border-light)',
              background: activeTab === 'review' ? 'var(--accent-main)' : 'var(--glass-bg)',
              color: activeTab === 'review' ? 'var(--bg-main)' : 'var(--text-secondary)',
              transition: 'all 0.2s ease',
              boxShadow: activeTab === 'review' ? '0 4px 12px rgba(56, 189, 248, 0.25)' : 'none',
            }}
          >
            <ShieldAlert size={15} />
            <span>Editorial Review Desk</span>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                padding: '0.1rem 0.5rem',
                borderRadius: '99px',
                background: activeTab === 'review' ? 'rgba(0, 0, 0, 0.25)' : 'var(--glass-bg-hover)',
                color: activeTab === 'review' ? 'inherit' : 'var(--text-tertiary)',
              }}
            >
              {pendingEvents.length}
            </span>
          </button>
        )}
      </nav>

      {/* TAB 1: PUBLIC CHANGE FEED */}
      {activeTab === 'feed' && (
        <section aria-label="Service Change Records">
          {/* Search & Filter Toolbar */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-xl)',
              padding: '1.25rem',
              backdropFilter: 'blur(12px)',
              boxShadow: 'var(--shadow-sm)',
              marginBottom: '1.75rem',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', alignItems: 'center' }}>
              <div style={{ flex: '1 1 280px', position: 'relative' }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-tertiary)',
                  }}
                />
                <input
                  type="text"
                  placeholder="Search changes by title or service slug..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 2rem 0.65rem 2.25rem',
                    fontSize: '0.85rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-tertiary)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px',
                    }}
                    aria-label="Clear search"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <label htmlFor="filter-type" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Type:
                  </label>
                  <select
                    id="filter-type"
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    style={{
                      fontSize: '0.78rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-light)',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="all">All Types</option>
                    {CHANGE_TYPES.map(type => (
                      <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <label htmlFor="filter-materiality" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Impact:
                  </label>
                  <select
                    id="filter-materiality"
                    value={filterMateriality}
                    onChange={(e) => setFilterMateriality(e.target.value)}
                    style={{
                      fontSize: '0.78rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-light)',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="all">All Levels</option>
                    <option value="material">Material Changes Only</option>
                    <option value="editorial">Non-Material / Editorial</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <label htmlFor="filter-jurisdiction" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Jurisdiction:
                  </label>
                  <select
                    id="filter-jurisdiction"
                    value={filterJurisdiction}
                    onChange={(e) => setFilterJurisdiction(e.target.value)}
                    style={{
                      fontSize: '0.78rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-light)',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="all">All Jurisdictions</option>
                    {JURISDICTION_LEVELS.map(level => (
                      <option key={level} value={level}>{JURISDICTION_LEVEL_LABELS[level] || level}</option>
                    ))}
                  </select>
                </div>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#f43f5e',
                      background: 'rgba(244, 63, 94, 0.1)',
                      border: '1px solid rgba(244, 63, 94, 0.2)',
                      borderRadius: '99px',
                      padding: '0.35rem 0.75rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <X size={12} />
                    <span>Reset</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Preset Filter Chips */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                flexWrap: 'wrap',
                marginTop: '1rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--border-light)',
              }}
            >
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '0.25rem' }}>
                Quick Presets:
              </span>
              <button
                type="button"
                onClick={() => handleQuickPreset('all')}
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.65rem',
                  borderRadius: '99px',
                  background: (!hasActiveFilters || (filterMateriality === 'all' && filterType === 'all' && filterJurisdiction === 'all')) ? 'var(--accent-light)' : 'var(--glass-bg)',
                  color: (!hasActiveFilters || (filterMateriality === 'all' && filterType === 'all' && filterJurisdiction === 'all')) ? 'var(--accent-main)' : 'var(--text-secondary)',
                  border: '1px solid var(--border-light)',
                  cursor: 'pointer',
                }}
              >
                All Updates
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('material')}
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.65rem',
                  borderRadius: '99px',
                  background: filterMateriality === 'material' ? 'rgba(244, 63, 94, 0.15)' : 'var(--glass-bg)',
                  color: filterMateriality === 'material' ? '#f43f5e' : 'var(--text-secondary)',
                  border: '1px solid var(--border-light)',
                  cursor: 'pointer',
                }}
              >
                🚨 Material Changes Only
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('documents')}
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.65rem',
                  borderRadius: '99px',
                  background: filterType === 'REQUIRED_DOCUMENTS' ? 'rgba(16, 185, 129, 0.15)' : 'var(--glass-bg)',
                  color: filterType === 'REQUIRED_DOCUMENTS' ? '#10b981' : 'var(--text-secondary)',
                  border: '1px solid var(--border-light)',
                  cursor: 'pointer',
                }}
              >
                📄 Required Documents
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('fees')}
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.65rem',
                  borderRadius: '99px',
                  background: filterType === 'FEE_STRUCTURE' ? 'rgba(245, 158, 11, 0.15)' : 'var(--glass-bg)',
                  color: filterType === 'FEE_STRUCTURE' ? '#f59e0b' : 'var(--text-secondary)',
                  border: '1px solid var(--border-light)',
                  cursor: 'pointer',
                }}
              >
                💰 Fee Structure
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('national')}
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.65rem',
                  borderRadius: '99px',
                  background: filterJurisdiction === 'national' ? 'rgba(129, 140, 248, 0.15)' : 'var(--glass-bg)',
                  color: filterJurisdiction === 'national' ? 'var(--grad-middle)' : 'var(--text-secondary)',
                  border: '1px solid var(--border-light)',
                  cursor: 'pointer',
                }}
              >
                🏛️ National Scope
              </button>
            </div>
          </div>

          {/* Event Cards List or Empty State */}
          {filteredEvents.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '4rem 1.5rem',
                background: 'var(--bg-card)',
                border: '1px dashed var(--border-main)',
                borderRadius: 'var(--radius-xl)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '99px',
                  background: 'var(--glass-bg)',
                  color: 'var(--text-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                }}
              >
                <Shield size={26} />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                No Change Events Found
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto' }}>
                No civic service changes match your current filter criteria.
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  style={{
                    marginTop: '1.25rem',
                    padding: '0.45rem 1.25rem',
                    borderRadius: '99px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    background: 'var(--accent-main)',
                    color: 'var(--bg-main)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {filteredEvents.map(event => (
                <article
                  key={event.id}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '1.5rem',
                    backdropFilter: 'blur(12px)',
                    boxShadow: 'var(--shadow-sm)',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                  }}
                >
                  {/* Left accent color strip */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: '5px',
                      background: event.isMaterial ? '#f43f5e' : '#10b981',
                    }}
                  />

                  <div style={{ paddingLeft: '0.5rem' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <div>
                        {/* Meta badge chips */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem', marginBottom: '0.65rem' }}>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.6rem',
                              borderRadius: '99px',
                              background: 'var(--accent-light)',
                              color: 'var(--accent-main)',
                              border: '1px solid rgba(56, 189, 248, 0.25)',
                            }}
                          >
                            {event.serviceId}
                          </span>

                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              padding: '0.15rem 0.6rem',
                              borderRadius: '99px',
                              background: 'var(--glass-bg)',
                              color: 'var(--text-secondary)',
                              border: '1px solid var(--border-light)',
                            }}
                          >
                            {event.changeType.replace(/_/g, ' ')}
                          </span>

                          {event.isMaterial ? (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '0.15rem 0.6rem',
                                borderRadius: '99px',
                                background: 'rgba(244, 63, 94, 0.12)',
                                color: '#f43f5e',
                                border: '1px solid rgba(244, 63, 94, 0.25)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                              }}
                            >
                              <AlertTriangle size={12} />
                              <span>Material Impact</span>
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                padding: '0.15rem 0.6rem',
                                borderRadius: '99px',
                                background: 'rgba(16, 185, 129, 0.12)',
                                color: '#10b981',
                                border: '1px solid rgba(16, 185, 129, 0.25)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                              }}
                            >
                              <CheckCircle2 size={12} />
                              <span>Editorial Update</span>
                            </span>
                          )}

                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.6rem',
                              borderRadius: '99px',
                              textTransform: 'capitalize',
                              background: event.status === 'approved' ? 'rgba(16, 185, 129, 0.12)' : event.status === 'pending' ? 'rgba(245, 158, 11, 0.15)' : 'var(--glass-bg)',
                              color: event.status === 'approved' ? '#10b981' : event.status === 'pending' ? '#f59e0b' : 'var(--text-secondary)',
                              border: '1px solid var(--border-light)',
                            }}
                          >
                            {event.status}
                          </span>

                          {event.affectedJurisdictions?.map((j, idx) => (
                            <span
                              key={idx}
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                padding: '0.15rem 0.6rem',
                                borderRadius: '99px',
                                background: 'rgba(129, 140, 248, 0.12)',
                                color: 'var(--grad-middle)',
                                textTransform: 'capitalize',
                                border: '1px solid rgba(129, 140, 248, 0.2)',
                              }}
                            >
                              {JURISDICTION_LEVEL_LABELS[j.level] || j.level}
                            </span>
                          ))}
                        </div>

                        {/* Change Title */}
                        <h3
                          style={{
                            fontSize: '1.15rem',
                            fontWeight: 800,
                            color: 'var(--text-primary)',
                            lineHeight: 1.35,
                          }}
                        >
                          {event.changeTitle}
                        </h3>
                      </div>

                      {/* Effective Date & Metadata Pill */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.3rem 0.75rem',
                            borderRadius: '99px',
                            background: 'var(--glass-bg)',
                            border: '1px solid var(--border-light)',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                          }}
                        >
                          <Calendar size={13} style={{ color: 'var(--accent-main)' }} />
                          <span>Effective: {event.effectiveDate}</span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                          Recorded: {event.changedAt?.split('T')[0] || event.changedAt}
                        </div>
                      </div>
                    </div>

                    {/* Materiality Reasons Breakdown Callout */}
                    {event.materialityRecommendation?.reasons?.length > 0 && (
                      <div
                        style={{
                          marginTop: '1rem',
                          padding: '0.85rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-light)',
                          fontSize: '0.8rem',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                          <Sparkles size={14} style={{ color: 'var(--accent-main)' }} />
                          <span>Analysis Breakdown ({event.materialityRecommendation.rulesetVersion || 'standard'}):</span>
                        </div>
                        <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
                          {event.materialityRecommendation.reasons.map((r, i) => (
                            <li key={i} style={{ marginTop: '0.2rem', lineHeight: 1.5 }}>
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Official Gazette Citation */}
                    {event.officialGazetteCitation && (
                      <div
                        style={{
                          marginTop: '0.85rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: 'var(--accent-main)',
                          background: 'var(--accent-light)',
                          padding: '0.3rem 0.85rem',
                          borderRadius: '99px',
                          border: '1px solid rgba(56, 189, 248, 0.25)',
                        }}
                      >
                        <ExternalLink size={13} />
                        <span>Gazette Citation: {event.officialGazetteCitation}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyCitation(event.officialGazetteCitation, event.id)}
                          style={{
                            marginLeft: '0.5rem',
                            fontSize: '0.7rem',
                            textDecoration: 'underline',
                            color: copiedCitationId === event.id ? '#10b981' : 'var(--text-tertiary)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          {copiedCitationId === event.id ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    )}

                    {/* Card Footer Actions */}
                    <div
                      style={{
                        marginTop: '1.25rem',
                        paddingTop: '0.85rem',
                        borderTop: '1px solid var(--border-light)',
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        fontSize: '0.75rem',
                      }}
                    >
                      <span style={{ color: 'var(--text-tertiary)' }}>
                        Ruleset: {event.materialityRecommendation?.rulesetVersion || 'standard'} | Editor: {event.editorId || 'system'}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        {isAuthenticated && (
                          <button
                            type="button"
                            onClick={() => handleQuickSubscribe(event.serviceId)}
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: 'var(--text-secondary)',
                              background: 'var(--glass-bg)',
                              border: '1px solid var(--border-light)',
                              padding: '0.35rem 0.75rem',
                              borderRadius: '99px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            <Bell size={13} style={{ color: 'var(--accent-main)' }} />
                            <span>Subscribe</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setSelectedEventForDiff(event)}
                          style={{
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            color: 'var(--accent-main)',
                            background: 'var(--accent-light)',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            padding: '0.4rem 0.95rem',
                            borderRadius: '99px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <Eye size={14} />
                          <span>Inspect Version Diff</span>
                        </button>
                      </div>
                    </div>
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
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.08), rgba(129, 140, 248, 0.08))',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: 'var(--radius-xl)',
              padding: '1.25rem 1.5rem',
              marginBottom: '1.75rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '1rem',
              backdropFilter: 'blur(12px)',
            }}
          >
            <Bookmark size={22} style={{ color: 'var(--accent-main)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                Citizen Guidance & Saved-Guide Sentinel
              </h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                This feed checks your saved guides and alert subscriptions against verified service amendments. Only approved material changes are surfaced here.
              </p>
            </div>
          </div>

          {savedImpacts.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '4rem 1.5rem',
                background: 'var(--bg-card)',
                border: '1px dashed var(--border-main)',
                borderRadius: 'var(--radius-xl)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '99px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                }}
              >
                <CheckCircle size={28} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                All Saved Items Up to Date
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto 1.5rem' }}>
                None of your currently bookmarked civic guides have active material policy revisions pending action.
              </p>
              <Link
                to="/services"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.55rem 1.35rem',
                  borderRadius: '99px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  background: 'var(--accent-main)',
                  color: 'var(--bg-main)',
                  boxShadow: '0 4px 12px rgba(56, 189, 248, 0.3)',
                }}
              >
                <span>Explore Services Directory</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {savedImpacts.map(impact => (
                <div
                  key={impact.serviceId}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '1.5rem',
                    backdropFilter: 'blur(12px)',
                    boxShadow: 'var(--shadow-sm)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: '5px',
                      background: '#f59e0b',
                    }}
                  />

                  <div style={{ paddingLeft: '0.5rem' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <div>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '0.15rem 0.65rem',
                            borderRadius: '99px',
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: '#f59e0b',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                          }}
                        >
                          Action Required
                        </span>
                        <h4
                          style={{
                            fontSize: '1.15rem',
                            fontWeight: 800,
                            color: 'var(--text-primary)',
                            marginTop: '0.5rem',
                          }}
                        >
                          Service: {impact.serviceId}
                        </h4>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                          {impact.changesCount} material policy amendment(s) detected since your bookmark.
                        </p>
                      </div>
                      <Link
                        to="/services"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          color: 'var(--accent-main)',
                          background: 'var(--glass-bg)',
                          border: '1px solid var(--border-light)',
                          padding: '0.4rem 0.95rem',
                          borderRadius: '99px',
                        }}
                      >
                        <span>Open Guide</span>
                        <ArrowRight size={13} />
                      </Link>
                    </div>

                    {impact.latestChange && (
                      <div
                        style={{
                          marginTop: '1rem',
                          padding: '0.85rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          background: 'rgba(245, 158, 11, 0.08)',
                          border: '1px solid rgba(245, 158, 11, 0.2)',
                          fontSize: '0.8rem',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <strong>Latest Update:</strong> {impact.latestChange.changeTitle} (Effective {impact.latestChange.effectiveDate})
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 3: USER SUBSCRIPTIONS */}
      {activeTab === 'subscriptions' && (
        <section aria-label="My Change Alert Subscriptions">
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Active Change Notification Subscriptions
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Manage notification preferences and delivery channels for service updates.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSubscribeModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 1rem',
                borderRadius: '99px',
                fontSize: '0.8rem',
                fontWeight: 700,
                background: 'var(--accent-main)',
                color: 'var(--bg-main)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <PlusCircle size={14} />
              <span>Add Subscription</span>
            </button>
          </div>

          {subscriptions.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '3.5rem 1.5rem',
                background: 'var(--bg-card)',
                border: '1px dashed var(--border-main)',
                borderRadius: 'var(--radius-xl)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <div
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '99px',
                  background: 'var(--glass-bg)',
                  color: 'var(--text-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 0.75rem',
                }}
              >
                <Bell size={24} />
              </div>
              <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                No active notification subscriptions
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                You have not subscribed to any service change notifications yet.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {subscriptions.map(sub => (
                <div
                  key={sub.id}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1.25rem',
                    backdropFilter: 'blur(12px)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.75rem',
                  }}
                >
                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {sub.serviceId ? `Service: ${sub.serviceId}` : 'All Civic Services'}
                    </h4>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      Frequency: <strong style={{ color: 'var(--text-primary)' }}>{sub.frequency}</strong> | Channel: In-App Alerts | Target: <strong style={{ color: 'var(--text-primary)' }}>{sub.jurisdictionId}</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnsubscribe(sub.id)}
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#f43f5e',
                      background: 'rgba(244, 63, 94, 0.1)',
                      border: '1px solid rgba(244, 63, 94, 0.2)',
                      borderRadius: '99px',
                      padding: '0.35rem 0.85rem',
                      cursor: 'pointer',
                    }}
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
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.6), rgba(49, 46, 129, 0.6))',
              border: '1px solid rgba(129, 140, 248, 0.3)',
              borderRadius: 'var(--radius-xl)',
              padding: '1.25rem 1.5rem',
              marginBottom: '1.75rem',
              backdropFilter: 'blur(12px)',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldAlert size={18} style={{ color: '#f59e0b' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>
                  Pending Changes Requiring Human-in-the-Loop Review
                </h3>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.75)', marginTop: '0.2rem' }}>
                Gate: Notifications are withheld until explicit review approval.
              </p>
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                padding: '0.25rem 0.75rem',
                borderRadius: '99px',
                background: 'rgba(245, 158, 11, 0.2)',
                color: '#f59e0b',
                border: '1px solid rgba(245, 158, 11, 0.4)',
              }}
            >
              {pendingEvents.length} Pending
            </span>
          </div>

          {pendingEvents.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '3.5rem 1.5rem',
                background: 'var(--bg-card)',
                border: '1px dashed var(--border-main)',
                borderRadius: 'var(--radius-xl)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <div
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '99px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 0.75rem',
                }}
              >
                <CheckCircle size={24} />
              </div>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Review Queue Empty
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                All service changes have been audited and acted upon.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {pendingEvents.map(event => (
                <div
                  key={event.id}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '1.5rem',
                    backdropFilter: 'blur(12px)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            padding: '0.15rem 0.6rem',
                            borderRadius: '99px',
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: '#f59e0b',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                          }}
                        >
                          Pending Decision
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-main)' }}>
                          {event.serviceId}
                        </span>
                      </div>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {event.changeTitle} ({event.serviceId})
                      </h4>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        Type: {event.changeType} | Effective: {event.effectiveDate} | Submitter: {event.editorId}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => handleApprove(event.id)}
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: '#10b981',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '99px',
                          padding: '0.45rem 1rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                        }}
                      >
                        <Check size={14} />
                        <span>Approve & Dispatch</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(event.id)}
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: 'rgba(244, 63, 94, 0.1)',
                          color: '#f43f5e',
                          border: '1px solid rgba(244, 63, 94, 0.3)',
                          borderRadius: '99px',
                          padding: '0.45rem 1rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        <XCircle size={14} />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>

                  {event.materialityRecommendation && (
                    <div
                      style={{
                        marginTop: '1rem',
                        padding: '0.85rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-light)',
                        fontSize: '0.78rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                        Automated Materiality Evaluation ({event.materialityRecommendation.rulesetVersion}):
                      </div>
                      <p style={{ marginBottom: '0.35rem' }}>
                        Material: <strong>{event.materialityRecommendation.isMaterial ? 'YES' : 'NO'}</strong> | Confidence: <strong>{Math.round(event.materialityRecommendation.confidence * 100)}%</strong>
                      </p>
                      <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
                        {event.materialityRecommendation.reasons.map((r, idx) => (
                          <li key={idx} style={{ marginTop: '0.15rem' }}>{r}</li>
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
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            overflowY: 'auto',
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-main)',
              borderRadius: 'var(--radius-xl)',
              maxWidth: '680px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: 'var(--shadow-lg)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <FileText size={13} />
                  <span>Version Specification Diff</span>
                </div>
                <h3 id="diff-dialog-title" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                  Version Specification Comparison
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  Service: <strong style={{ color: 'var(--text-primary)' }}>{selectedEventForDiff.serviceId}</strong> | Effective: <strong style={{ color: 'var(--text-primary)' }}>{selectedEventForDiff.effectiveDate}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEventForDiff(null)}
                style={{
                  color: 'var(--text-tertiary)',
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '99px',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '1.25rem 0', display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.8rem' }}>
              <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                  {selectedEventForDiff.changeTitle}
                </h4>
                <p style={{ color: 'var(--text-secondary)' }}>Reason: {selectedEventForDiff.changeReason}</p>
                {selectedEventForDiff.officialGazetteCitation && (
                  <p style={{ color: 'var(--accent-main)', fontWeight: 700, marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <ExternalLink size={13} />
                    <span>Citation: {selectedEventForDiff.officialGazetteCitation}</span>
                  </p>
                )}
              </div>

              {/* Side by side comparison or modifications */}
              <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <div style={{ background: 'var(--bg-secondary)', padding: '0.65rem 1rem', borderBottom: '1px solid var(--border-light)', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Field-level Modifications:</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Ruleset: {selectedEventForDiff.materialityRecommendation?.rulesetVersion || 'standard'}</span>
                </div>
                <div style={{ padding: '1rem' }}>
                  {selectedEventForDiff.materialityRecommendation?.reasons ? (
                    <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
                      {selectedEventForDiff.materialityRecommendation.reasons.map((r, i) => (
                        <li key={i} style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: '0.3rem' }}>
                          {r}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Standard policy revision registered.</p>
                  )}

                  {selectedEventForDiff.requiredDocuments?.length > 0 && (
                    <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-light)' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '0.4rem' }}>
                        Mandatory Required Documents:
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {selectedEventForDiff.requiredDocuments.map((doc, idx) => (
                          <span
                            key={idx}
                            style={{
                              padding: '0.25rem 0.65rem',
                              borderRadius: '99px',
                              background: 'rgba(16, 185, 129, 0.12)',
                              color: '#10b981',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              border: '1px solid rgba(16, 185, 129, 0.25)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                            }}
                          >
                            <FileCheck2 size={12} />
                            <span>{doc}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setSelectedEventForDiff(null)}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: '99px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  background: 'var(--glass-bg)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-light)',
                  cursor: 'pointer',
                }}
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
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            overflowY: 'auto',
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-main)',
              borderRadius: 'var(--radius-xl)',
              maxWidth: '540px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
              <div>
                <h3 id="propose-dialog-title" style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Record New Civic Service Change
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Submit a verified statutory delta to the immutable feed.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowProposeModal(false)}
                style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleProposeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.8rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Service Identifier *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. aadhaar-guide, property-tax"
                  value={proposeData.serviceId}
                  onChange={e => setProposeData({ ...proposeData, serviceId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontSize: '0.8rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Change Title *</label>
                <input
                  type="text"
                  required
                  placeholder="Summary of statutory amendment or guidance revision"
                  value={proposeData.changeTitle}
                  onChange={e => setProposeData({ ...proposeData, changeTitle: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontSize: '0.8rem',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Change Type</label>
                  <select
                    value={proposeData.changeType}
                    onChange={e => setProposeData({ ...proposeData, changeType: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      fontSize: '0.75rem',
                      boxSizing: 'border-box',
                    }}
                  >
                    {CHANGE_TYPES.map(t => (
                      <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Jurisdiction</label>
                  <select
                    value={proposeData.jurisdictionLevel}
                    onChange={e => setProposeData({ ...proposeData, jurisdictionLevel: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      fontSize: '0.75rem',
                      boxSizing: 'border-box',
                    }}
                  >
                    {JURISDICTION_LEVELS.map(level => (
                      <option key={level} value={level}>{JURISDICTION_LEVEL_LABELS[level] || level}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Effective Date</label>
                  <input
                    type="date"
                    required
                    value={proposeData.effectiveDate}
                    onChange={e => setProposeData({ ...proposeData, effectiveDate: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.45rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      fontSize: '0.75rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Gazette Citation / Circular</label>
                <input
                  type="text"
                  placeholder="e.g. Gazette Notification No. 2026/FIN/402"
                  value={proposeData.officialGazetteCitation}
                  onChange={e => setProposeData({ ...proposeData, officialGazetteCitation: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontSize: '0.8rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Mandatory Documents (comma-separated)</label>
                <input
                  type="text"
                  placeholder="Identity Proof, Address Proof, Electricity Bill"
                  value={proposeData.requiredDocuments}
                  onChange={e => setProposeData({ ...proposeData, requiredDocuments: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontSize: '0.8rem',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)' }}>
                <button
                  type="button"
                  onClick={() => setShowProposeModal(false)}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '99px',
                    background: 'var(--glass-bg)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-light)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.45rem 1.25rem',
                    borderRadius: '99px',
                    background: 'var(--accent-main)',
                    color: 'var(--bg-main)',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                  }}
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
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            overflowY: 'auto',
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-main)',
              borderRadius: 'var(--radius-xl)',
              maxWidth: '460px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
              <div>
                <h3 id="sub-dialog-title" style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Subscribe to Service Alerts
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Get automated alerts when guidance or required documents change.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSubscribeModal(false)}
                style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubscribeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.8rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Service Identifier (optional for all)</label>
                <input
                  type="text"
                  placeholder="e.g. aadhaar-guide (leave blank for all)"
                  value={subscribeData.serviceId}
                  onChange={e => setSubscribeData({ ...subscribeData, serviceId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontSize: '0.8rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Target Jurisdiction</label>
                <select
                  value={subscribeData.jurisdictionId}
                  onChange={e => setSubscribeData({ ...subscribeData, jurisdictionId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    fontSize: '0.8rem',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="all">All Jurisdictions</option>
                  {JURISDICTION_LEVELS.map(level => (
                    <option key={level} value={level}>{JURISDICTION_LEVEL_LABELS[level] || level}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Alert Frequency</label>
                <select
                  value={subscribeData.frequency}
                  onChange={e => setSubscribeData({ ...subscribeData, frequency: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    fontSize: '0.8rem',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="immediate">Immediate In-App Alert</option>
                  <option value="daily">Daily Digest</option>
                  <option value="weekly">Weekly Digest</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)' }}>
                <button
                  type="button"
                  onClick={() => setShowSubscribeModal(false)}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '99px',
                    background: 'var(--glass-bg)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-light)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.45rem 1.25rem',
                    borderRadius: '99px',
                    background: 'var(--accent-main)',
                    color: 'var(--bg-main)',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                  }}
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
