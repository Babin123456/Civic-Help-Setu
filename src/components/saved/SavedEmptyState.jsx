import { Link } from 'react-router-dom';
import { Bookmark, FolderPlus, Bell, FileText, ArrowRight, Compass } from 'lucide-react';

/**
 * SavedEmptyState Component (#587)
 *
 * Distinct empty state surface when a citizen has no saved guides across the application.
 * Explains how bookmarking, folders, notes, and renewal reminders work.
 */
const SavedEmptyState = () => (
  <section
    className="saved-empty-state card glass-panel animate-fade-in"
    aria-labelledby="saved-empty-title"
    style={{
      textAlign: 'center',
      padding: 'clamp(2.5rem, 6vw, 4.5rem) clamp(1rem, 4vw, 2.5rem)',
      background: 'var(--glass-bg)',
      border: '1px dashed var(--border-light)',
      borderRadius: '1.25rem',
      maxWidth: '800px',
      margin: '0 auto',
    }}
  >
    <div
      style={{
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        background: 'rgba(56, 189, 248, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 1.5rem',
        color: 'var(--accent-main)',
      }}
    >
      <Bookmark size={32} aria-hidden="true" />
    </div>

    <h2
      id="saved-empty-title"
      style={{
        fontSize: '1.75rem',
        fontWeight: '800',
        marginBottom: '0.65rem',
        color: 'var(--text-primary)',
      }}
    >
      You have not saved any services yet
    </h2>

    <p
      style={{
        color: 'var(--text-secondary)',
        maxWidth: '520px',
        margin: '0 auto 2rem',
        lineHeight: '1.6',
        fontSize: '0.98rem',
      }}
    >
      Open any service guide in the directory and click <strong>"Save Guide"</strong> to keep private notes,
      schedule document renewal reminders, and organize related applications into custom collections.
    </p>

    {/* Feature Highlights Grid */}
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        textAlign: 'left',
        marginBottom: '2.5rem',
      }}
    >
      <div
        style={{
          padding: '1rem',
          borderRadius: '0.75rem',
          background: 'var(--bg-main)',
          border: '1px solid var(--border-light)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-main)', fontWeight: '700', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
          <FolderPlus size={16} aria-hidden="true" />
          <span>Custom Collections</span>
        </div>
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
          Group guides by life event (e.g., "Child Birth", "Property Purchase", "Vehicle Transfer").
        </p>
      </div>

      <div
        style={{
          padding: '1rem',
          borderRadius: '0.75rem',
          background: 'var(--bg-main)',
          border: '1px solid var(--border-light)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', fontWeight: '700', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
          <Bell size={16} aria-hidden="true" />
          <span>Renewal Reminders</span>
        </div>
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
          Set statutory expiry alerts before driving licences or certificates lapse.
        </p>
      </div>

      <div
        style={{
          padding: '1rem',
          borderRadius: '0.75rem',
          background: 'var(--bg-main)',
          border: '1px solid var(--border-light)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b', fontWeight: '700', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
          <FileText size={16} aria-hidden="true" />
          <span>Private Notes</span>
        </div>
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
          Jot down application reference numbers, office visit tokens, and officer names.
        </p>
      </div>
    </div>

    {/* Primary Action Button */}
    <Link
      to="/services"
      className="btn btn-primary"
      style={{
        padding: '0.75rem 2rem',
        fontSize: '0.95rem',
        borderRadius: '99px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}
    >
      <span>Browse the services directory</span>
      <ArrowRight size={16} aria-hidden="true" />
    </Link>
  </section>
);

export default SavedEmptyState;
