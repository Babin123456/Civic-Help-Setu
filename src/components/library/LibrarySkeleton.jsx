export default function LibrarySkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading verified libraries"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '1.25rem',
      }}
    >
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-main)',
            borderRadius: '1rem',
            padding: '1.5rem',
            height: '240px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
            opacity: 0.7,
            animation: 'pulse 1.5s infinite ease-in-out',
          }}
        >
          <div>
            <div
              style={{
                width: '40%',
                height: '18px',
                backgroundColor: 'var(--border-light)',
                borderRadius: '4px',
                marginBottom: '1rem',
              }}
            />
            <div
              style={{
                width: '80%',
                height: '22px',
                backgroundColor: 'var(--border-light)',
                borderRadius: '4px',
                marginBottom: '0.75rem',
              }}
            />
            <div
              style={{
                width: '60%',
                height: '14px',
                backgroundColor: 'var(--border-light)',
                borderRadius: '4px',
                marginBottom: '0.5rem',
              }}
            />
          </div>
          <div
            style={{
              width: '100%',
              height: '36px',
              backgroundColor: 'var(--border-light)',
              borderRadius: '6px',
            }}
          />
        </div>
      ))}
    </div>
  );
}

