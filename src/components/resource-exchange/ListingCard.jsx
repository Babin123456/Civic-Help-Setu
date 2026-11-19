/**
 * ListingCard.jsx
 * Card component displaying a single resource listing.
 * Accessible: semantic markup, screen-reader labels, keyboard focus.
 */

import { useTranslation } from 'react-i18next';
import { useBadgeAccessibility } from '../../hooks/useBadgeAccessibility';
import { ITEM_CONDITIONS, AVAILABILITY_WINDOWS } from '../../data/resourceContract';
import { Icon } from 'lucide-react';

const ListingCard = ({ listing, canRequest, onRequest, t }) => {
  const { t: translate } = useTranslation();
  const categoryLabel = translate(listing.category) || listing.category;
  const conditionLabel = translate(listing.condition) || listing.condition;
  const availabilityLabel = translate(listing.availabilityWindow) || listing.availabilityWindow;
  const stateLabel = translate(listing.state) || listing.state;

  // Calculate days remaining
  const created = new Date(listing.createdAt);
  const expires = new Date(listing.expiresAt);
  const now = new Date();
  const diffMs = expires - now;
  const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  // Determine if listing is expired
  const isExpired = daysRemaining <= 0;

  return (
    <div
      style={{
        border: '1px solid var(--border-main)',
        borderRadius: '0.75rem',
        background: 'var(--bg-surface)',
        padding: '1.5rem',
        marginBottom: '1rem',
        transition: 'box-shadow 0.2s',
        ':hover': { boxShadow: 'var(--shadow-hover)' },
        role: 'region',
        aria-label: `${translate('listing_card_aria', {
          title: listing.title,
          category: categoryLabel,
          state: stateLabel,
        })}`,
      }}
    >
      {/* Header with category badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem' }}>
        <span
          style={{
            background: 'var(--glass-bg, rgba(255,255,255,0.03))',
            border: '1px solid var(--border-main)',
            borderRadius: '0.375rem',
            padding: '0.25rem 0.5rem',
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            fontWeight: '600',
            color: 'var(--text-tertiary)',
            whiteSpace: 'nowrap',
          }}
        >
          {categoryLabel}
        </span>

        {isExpired && (
          <span
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '0.375rem',
              padding: '0.25rem 0.5rem',
              fontSize: '0.7rem',
              textTransform: 'uppercase',
              fontWeight: '600',
              color: '#ef4444',
              whiteSpace: 'nowrap',
            }}
          >
            {translate('expired')}
          </span>
        )}
      </div>

      <h3 style={{ margin: '0.25rem 0', fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)' }}>
        {listing.title}
      </h3>

      <p style={{ margin: '0.5rem 0', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
        {listing.description}
      </p>

      {/* Details row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.75rem' }}>
        <div>
          <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>
            {t('condition')}
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
            {conditionLabel}
          </p>
        </div>
        <div>
          <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>
            {t('availability')}
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
            {availabilityLabel}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      {canRequest && !isExpired && listing.state === 'active' && (
        <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-main)' }}>
          <button
            onClick={() => onRequest(listing.id)}
            style={{
              width: '100%',
              padding: '0.6rem 1rem',
              fontSize: '0.85rem',
              fontWeight: '600',
              background: 'var(--primary)',
              color: 'var(--bg-primary)',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            disabled={listing.state !== 'active'}
            aria-label={translate('request_item_aria', { title: listing.title })}
          >
            {translate('request_item')}
          </button>
        </div>
      )}

      {/* Metadata */}
      <div style={{ marginTop: '0.75rem', fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
        <span>
          {t('created')} {listing.createdAt ? new Date(listing.createdAt).toLocaleDateString() : 'unknown'}
        </span>
        <span style={{ marginLeft: '1rem' }}>
          {t('expires_in', { days: daysRemaining })}
        </span>
      </div>
    </div>
  );
};

export default ListingCard;