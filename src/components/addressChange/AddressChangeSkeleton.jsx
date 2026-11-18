export default function AddressChangeSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading address change action plan"
      style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
    >
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-main)',
            borderRadius: '0.75rem',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'var(--border-light, #e5e7eb)',
              }}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  width: '40%',
                  height: '16px',
                  backgroundColor: 'var(--border-light, #e5e7eb)',
                  borderRadius: '4px',
                  marginBottom: '6px',
                }}
              />
              <div
                style={{
                  width: '70%',
                  height: '12px',
                  backgroundColor: 'var(--border-light, #f3f4f6)',
                  borderRadius: '4px',
                }}
              />
            </div>
          </div>
          <div
            style={{
              width: '90%',
              height: '14px',
              backgroundColor: 'var(--border-light, #f3f4f6)',
              borderRadius: '4px',
            }}
          />
        </div>
      ))}
    </div>
  );
}

