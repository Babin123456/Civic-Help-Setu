import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Share2,
  Filter,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Clock,
  Search,
  Building,
  Tag,
  MapPin,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react';
import { resolveSharedDirectoryView, applyDirectoryFilters } from '../services/shareableDirectoryService';
import { MOCK_SERVICES } from '../data/services';
import ServiceCard from '../components/ServiceCard';

export default function SharedDirectoryView({ initialToken }) {
  const params = useParams();
  const token = initialToken || params?.token;
  const [data, setData] = useState(() => (token ? resolveSharedDirectoryView(token) : null));
  const [loading, setLoading] = useState(() => !token || !data);

  useEffect(() => {
    if (token) {
      const res = resolveSharedDirectoryView(token);
      setData(res);
      setLoading(false);
    }
  }, [token]);

  // Compute matched services
  const matchedServices = useMemo(() => {
    if (!data?.view?.filters) return [];
    return applyDirectoryFilters(MOCK_SERVICES, data.view.filters);
  }, [data]);

  if (loading) {
    return (
      <div className="section container" style={{ textAlign: 'center', padding: '5rem 1rem' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading curated service directory view...</p>
      </div>
    );
  }

  if (!data || data.status !== 'ACTIVE') {
    const isRevoked = data?.status === 'REVOKED';
    const isExpired = data?.status === 'EXPIRED';

    return (
      <div className="section container" style={{ maxWidth: '600px', margin: '4rem auto', padding: '0 1rem' }}>
        <div
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '0.75rem',
            padding: '2.5rem 2rem',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
          }}
        >
          <div
            style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '50%',
              background: isRevoked ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              color: isRevoked ? '#ef4444' : '#f59e0b',
            }}
          >
            {isRevoked ? <Lock className="w-8 h-8" /> : <Clock className="w-8 h-8" />}
          </div>

          <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            {isRevoked
              ? 'Shared Directory Link Revoked'
              : isExpired
                ? 'Shared Directory Link Expired'
                : 'Directory View Not Found'}
          </h2>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '2rem' }}>
            {data?.error ||
              'This shared directory list is unavailable. Please check the full catalogue or request an updated link.'}
          </p>

          <Link
            to="/services"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.25rem',
              borderRadius: '0.5rem',
              background: 'var(--accent-main)',
              color: '#ffffff',
              fontWeight: '600',
              textDecoration: 'none',
              fontSize: '0.9rem',
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            Browse Full Service Directory
          </Link>
        </div>
      </div>
    );
  }

  const { view } = data;
  const { filters } = view;

  return (
    <div className="shared-directory-view section" style={{ padding: '2.5rem 1rem' }}>
      <div className="container" style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {/* Safety & Scope Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.85rem 1.25rem',
            borderRadius: '0.65rem',
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            color: '#2563eb',
            fontSize: '0.875rem',
            marginBottom: '1.5rem',
          }}
        >
          <ShieldCheck className="w-5 h-5 flex-shrink-0" />
          <div style={{ flex: 1 }}>
            <strong>Curated Directory View:</strong> You are viewing a shared public catalogue selection.
            Contains official civic service specifications only; no personal applicant details or saved folders are accessible.
          </div>
        </div>

        {/* Directory Header */}
        <div
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '0.75rem',
            padding: '2rem',
            marginBottom: '1.5rem',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '0.35rem',
                  background: 'rgba(79, 70, 229, 0.1)',
                  color: '#4f46e5',
                  marginBottom: '0.5rem',
                }}
              >
                <Share2 className="w-3.5 h-3.5" /> Shared Catalogue List
              </span>

              <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                {view.title}
              </h1>

              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: '0.4rem', marginBottom: 0 }}>
                {view.description}
              </p>
            </div>

            <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <div>Created: {new Date(view.createdAt).toLocaleDateString()}</div>
              {view.expiresAt && (
                <div style={{ color: '#d97706', marginTop: '0.25rem' }}>
                  Expires: {new Date(view.expiresAt).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>

          {/* Active Filter Pills */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', alignSelf: 'center' }}>
              Filters Applied:
            </span>

            {filters.search && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: '9999px', background: 'var(--bg-secondary, rgba(0,0,0,0.05))', color: 'var(--text-primary)' }}>
                <Search className="w-3.5 h-3.5 text-slate-400" /> &quot;{filters.search}&quot;
              </span>
            )}

            {filters.category && filters.category !== 'all' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: '9999px', background: 'var(--bg-secondary, rgba(0,0,0,0.05))', color: 'var(--text-primary)' }}>
                <Tag className="w-3.5 h-3.5 text-slate-400" /> Category: {filters.category}
              </span>
            )}

            {filters.department && filters.department !== 'all' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: '9999px', background: 'var(--bg-secondary, rgba(0,0,0,0.05))', color: 'var(--text-primary)' }}>
                <Building className="w-3.5 h-3.5 text-slate-400" /> Dept: {filters.department}
              </span>
            )}

            {filters.location && filters.location !== 'all' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: '9999px', background: 'var(--bg-secondary, rgba(0,0,0,0.05))', color: 'var(--text-primary)' }}>
                <MapPin className="w-3.5 h-3.5 text-slate-400" /> State: {filters.location}
              </span>
            )}
          </div>
        </div>

        {/* Results Count & Grid */}
        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
            Curated Services ({matchedServices.length})
          </h2>

          <Link
            to="/services"
            style={{
              fontSize: '0.85rem',
              color: 'var(--accent-main)',
              textDecoration: 'none',
              fontWeight: '600',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            Explore all services <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        {matchedServices.length === 0 ? (
          <div
            style={{
              padding: '3rem 1.5rem',
              textAlign: 'center',
              background: 'var(--card-bg)',
              borderRadius: '0.75rem',
              border: '1px dashed var(--border-color)',
            }}
          >
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              No current catalogue services match the specific criteria of this curated list.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {matchedServices.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
