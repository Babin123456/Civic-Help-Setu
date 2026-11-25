import React from 'react';

const SurveySkeleton = () => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="card animate-pulse"
          style={{
            padding: '1.5rem',
            background: 'var(--bg-card)',
            borderRadius: '1rem',
            border: '1px solid var(--border-light)',
            height: '240px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ height: '14px', width: '30%', background: 'var(--border-light)', borderRadius: '4px', marginBottom: '0.75rem' }} />
            <div style={{ height: '22px', width: '85%', background: 'var(--border-light)', borderRadius: '4px', marginBottom: '0.5rem' }} />
            <div style={{ height: '14px', width: '100%', background: 'var(--border-light)', borderRadius: '4px', marginBottom: '0.35rem' }} />
            <div style={{ height: '14px', width: '70%', background: 'var(--border-light)', borderRadius: '4px' }} />
          </div>
          <div style={{ height: '36px', width: '100%', background: 'var(--border-light)', borderRadius: '0.5rem' }} />
        </div>
      ))}
    </div>
  );
};

export default SurveySkeleton;

