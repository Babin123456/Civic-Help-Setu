import { MapPin, Navigation, Compass } from 'lucide-react';
import { MOVE_TYPES, MOVE_TYPE_LABELS, MOVE_TYPE_DESCRIPTIONS } from '../../data/addressChangeContract';
import { INDIAN_STATES_AND_UTS } from '../../data/jurisdictions';

export default function MoveTypeSelector({
  moveType,
  originState,
  destinationState,
  onChangeMoveType,
  onChangeOriginState,
  onChangeDestinationState,
}) {
  const getIcon = (type) => {
    switch (type) {
      case 'same_city':
        return <MapPin size={20} color="var(--accent-main, #2563eb)" />;
      case 'inter_district':
        return <Navigation size={20} color="var(--accent-main, #2563eb)" />;
      case 'inter_state':
        return <Compass size={20} color="var(--accent-main, #2563eb)" />;
      default:
        return <MapPin size={20} />;
    }
  };

  return (
    <div
      className="card"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-main)',
        borderRadius: '0.75rem',
        padding: '1.25rem',
        marginBottom: '1.5rem',
      }}
    >
      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
        Step 1: Choose Your Relocation Scope
      </h3>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        Address update procedures vary significantly based on whether you are shifting within your city, across districts, or moving to a different state.
      </p>

      {/* Move Type Cards */}
      <div
        role="radiogroup"
        aria-label="Relocation scope options"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        {MOVE_TYPES.map((type) => {
          const isSelected = moveType === type;
          return (
            <button
              type="button"
              key={type}
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChangeMoveType(type)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                textAlign: 'left',
                padding: '1rem',
                borderRadius: '0.5rem',
                border: isSelected
                  ? '2px solid var(--accent-main)'
                  : '1px solid var(--border-main)',
                backgroundColor: isSelected
                  ? 'var(--accent-light)'
                  : 'var(--glass-bg)',
                cursor: 'pointer',
                transition: 'all 0.15s ease-in-out',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                {getIcon(type)}
                <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  {MOVE_TYPE_LABELS[type]}
                </span>
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {MOVE_TYPE_DESCRIPTIONS[type]}
              </span>
            </button>
          );
        })}
      </div>

      {/* State & District Selectors for Inter-State or Inter-District moves */}
      {(moveType === 'inter_state' || moveType === 'inter_district') && (
        <div
          style={{
            borderTop: '1px solid var(--border-light)',
            paddingTop: '1rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
          }}
        >
          {/* Origin */}
          <div>
            <label
              htmlFor="origin-state-select"
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}
            >
              Origin State / UT:
            </label>
            <select
              id="origin-state-select"
              value={originState}
              onChange={(e) => onChangeOriginState(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--border-main)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
              }}
            >
              <option value="">Select Origin State</option>
              {INDIAN_STATES_AND_UTS.map((st) => (
                <option key={`orig-${st}`} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Destination */}
          <div>
            <label
              htmlFor="destination-state-select"
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}
            >
              Destination State / UT:
            </label>
            <select
              id="destination-state-select"
              value={destinationState}
              onChange={(e) => onChangeDestinationState(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--border-main)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
              }}
            >
              <option value="">Select Destination State</option>
              {INDIAN_STATES_AND_UTS.map((st) => (
                <option key={`dest-${st}`} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

