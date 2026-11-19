/**
 * ResourceExchangePage.jsx
 * Main page for the Neighbourhood Resource Exchange.
 * 
 * Features:
 * - Browse active resource listings with filters
 * - Create new resource listings
 * - View listing details and request items
 * - View exchange request status
 * - Accessibility: responsive, keyboard-only, screen-reader announcements
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../contexts/toastContext';
import { useResourceExchange } from '../../hooks/useResourceExchange';
import { useAuth } from '../../contexts/authContext';
import { Icon } from 'lucide-react';
import { ITEM_CATEGORIES, AVAILABILITY_WINDOWS, RESOURCE_LISTING_STATES } from '../../data/resourceContract';
import Spinner from '../common/Spinner';
import Skeleton from '../common/Skeleton';
import ListingCard from '../resource-exchange/ListingCard';
import RequestForm from '../resource-exchange/RequestForm';
import { checkPermission, can } from '../../services/accessControl';
import { useRouteStatus } from '../../hooks/useRouteStatus';

const ResourceExchangePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { data: routeStatus = {} } = useRouteStatus();
  const { listings, loadListings, loadMoreListings, hasMore, loading, error, refetch } = useResourceExchange(
    'listings'
  );
  const [filterCategory, setFilterCategory] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterAvailability, setFilterAvailability] = useState('');
  const [creating, setCreating] = useState(false);
  const [creatingRequest, setCreatingRequest] = useState(false);
  const [newListing, setNewListing] = useState({
    title: '',
    category: '',
    description: '',
    condition: '',
    availabilityWindow: '',
    pickupArea: '',
    expiresAt: '',
  });
  const [newRequest, setNewRequest] = useState({
    listingId: '',
    handoverLocation: '',
    handoverWindow: '',
    statusMessage: '',
  });

  // Can citizen create listings?
  const canCreate = can('resources.write', user);

  // Can citizen create requests?
  const canRequest = can('resources.request', user);

  useEffect(() => {
    refetch();
    loadListings();
  }, [refetch]);

  const handleCreateListing = async (e) => {
    e.preventDefault();
    if (!canCreate) {
      useToast()(('error', t('errors.permission_denied')));
      return;
    }
    setCreating(true);
    try {
      const result = await window.api
        .post('/neighbourhood-resource-exchange', {
          action: 'createListing',
          title: newListing.title,
          category: newListing.category,
          description: newListing.description,
          condition: newListing.condition,
          availabilityWindow: newListing.availabilityWindow,
          pickupArea: newListing.pickupArea,
          expiresAt: newListing.expiresAt,
          createdBy: user?.uid,
          ip: routeStatus.ip,
        });
      if (result.success) {
        useToast()(('success', t('listing_created', { listingTitle: newListing.title })));
        setNewListing({
          title: '',
          category: '',
          description: '',
          condition: '',
          availabilityWindow: '',
          pickupArea: '',
          expiresAt: '',
        });
        refetch();
      } else {
        useToast()(('error', result.errors?.[0]?.reason || t('errors.submission_failed')));
      }
    } catch (err) {
      useToast()(('error', t('errors.submission_failed')));
    } finally {
      setCreating(false);
    }
  };

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    if (!canRequest) {
      useToast()(('error', t('errors.permission_denied')));
      return;
    }
    if (!newRequest.listingId) {
      useToast()(('error', t('errors.select_listing')));
      return;
    }
    setCreatingRequest(true);
    try {
      const result = await window.api
        .post('/neighbourhood-resource-exchange', {
          action: 'createRequest',
          listingId: newRequest.listingId,
          requesterId: user?.uid,
          responderId: '', // Will be filled by backend or left for owner to respond
          handoverLocation: newRequest.handoverLocation,
          handoverWindow: newRequest.handoverWindow,
          statusMessage: newRequest.statusMessage,
        });
      if (result.success) {
        useToast()(('success', t('request_submitted')));
        setNewRequest({
          listingId: '',
          handoverLocation: '',
          handoverWindow: '',
          statusMessage: '',
        });
        refetch();
      } else {
        useToast()(('error', result.errors?.[0]?.reason || t('errors.submission_failed')));
      }
    } catch (err) {
      useToast()(('error', t('errors.submission_failed')));
    } finally {
      setCreatingRequest(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem' }}>
        <Spinner aria-label={t('loading_resources')} />
        <p>{t('loading_resources')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem' }}>
        <p style={{ color: 'var(--text-primary)' }}>{t('error_loading_resources', { error })}</p>
        <button onClick={refetch}>{t('retry')}</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>{t('resource_exchange_title')}</h1>
      <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
        {t('resource_exchange_subtitle')}
      </p>

      {/* Filter toolbar */}
      <div style={{ marginBottom: '1.5rem', background: 'var(--bg-surface)', padding: '1rem', borderRadius: '0.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-primary)' }}>{t('category')}:</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-main)' }}
            >
              <option value="">{t('all_categories')}</option>
              {ITEM_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {t(cat)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-primary)' }}>{t('state')}:</label>
            <select
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-main)' }}
            >
              <option value="">{t('all_states')}</option>
              {RESOURCE_LISTING_STATES.map((state) => (
                <option key={state} value={state}>
                  {t(state)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-primary)' }}>{t('availability_window')}:</label>
            <select
              value={filterAvailability}
              onChange={(e) => setFilterAvailability(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-main)' }}
            >
              <option value="">{t('all_windows')}</option>
              {AVAILABILITY_WINDOWS.map((window) => (
                <option key={window} value={window}>
                  {t(window)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Listings grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {loading && <Skeleton rows={8} />}
        {error && <p>{t('error_loading_resources', { error })}</p>}
        {listings.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            {t('no_listings_available')}
          </div>
        )}
        {listings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            canRequest={canRequest}
            onRequest={handleCreateRequest}
            t={t}
          />
        ))}
      </div>

      {/* Create listing form (visible to authenticated citizens) */}
      {user && canCreate && !creating && (
        <div style={{ marginTop: '2rem', background: 'var(--bg-surface)', padding: '1.5rem', borderRadius: '0.5rem' }}>
          <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem' }}>{t('create_listing')}</h2>
          <form onSubmit={handleCreateListing} style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <label>{t('title')}<span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>*</span></label>
              <input
                type="text"
                value={newListing.title}
                onChange={(e) => setNewListing({ ...newListing, title: e.target.value })}
                placeholder={t('title_placeholder')}
                style={{
                  width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-main)',
                }}
                required
                aria-describedby="title-help"
              />
              <p id="title-help" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {t('title_help')}
              </p>
            </div>
            <div>
              <label>{t('category')}<span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>*</span></label>
              <select
                value={newListing.category}
                onChange={(e) => setNewListing({ ...newListing, category: e.target.value })}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-main)' }}
                required
              >
                <option value="">{t('select_category')}</option>
                {ITEM_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {t(cat)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>{t('description')}<span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>*</span></label>
              <textarea
                value={newListing.description}
                onChange={(e) => setNewListing({ ...newListing, description: e.target.value })}
                placeholder={t('description_placeholder')}
                rows={3}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-main)', resize: 'vertical' }}
                required
              /></textarea>
            </div>
            <div style={{ gridTemplateAreas: '"condition" "availability" "pickup" "expires"', gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
              <div>
                <label>{t('condition')}<span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>*</span></label>
                <select
                  value={newListing.condition}
                  onChange={(e) => setNewListing({ ...newListing, condition: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-main)' }}
                  required
                >
                  <option value="">{t('select_condition')}</option>
                  {ITEM_CONDITIONS.map((c) => (
                    <option key={c} value={c}>
                      {t(c)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>{t('availability_window')}<span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>*</span></label>
                <select
                  value={newListing.availabilityWindow}
                  onChange={(e) => setNewListing({ ...newListing, availabilityWindow: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-main)' }}
                  required
                >
                  <option value="">{t('select_window')}</option>
                  {AVAILABILITY_WINDOWS.map((w) => (
                    <option key={w} value={w}>
                      {t(w)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>{t('pickup_area')}<span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>*</span></label>
                <input
                  value={newListing.pickupArea}
                  onChange={(e) => setNewListing({ ...newListing, pickupArea: e.target.value })}
                  placeholder={t('pickup_area_placeholder')}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-main)' }}
                  required
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  {t('pickup_area_help')}
                </p>
              </div>
              <div>
                <label>{t('expires_at')}<span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>*</span></label>
                <input
                  type="date"
                  value={newListing.expiresAt}
                  onChange={(e) => setNewListing({ ...newListing, expiresAt: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-main)' }}
                  required
                />
              </div>
            </div>
            <button type="submit" disabled={creating} style={{ padding: '0.75rem 1.5rem', fontSize: '0.875rem', fontWeight: '700' }}>
              {creating ? t('creating') : t('submit_listing')}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default ResourceExchangePage;