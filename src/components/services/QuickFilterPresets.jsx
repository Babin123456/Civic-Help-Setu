import { Zap, Sparkles, Award, Globe, Shield } from 'lucide-react';

export const QUICK_PRESETS = [
  {
    id: 'fast-track',
    label: 'Fast Track (≤ 7 Days)',
    icon: Zap,
    color: '#eab308',
    bg: 'rgba(234, 179, 8, 0.1)',
    filterParams: { speed: '7' },
  },
  {
    id: 'free-services',
    label: 'Zero Cost (Free)',
    icon: Sparkles,
    color: '#22c55e',
    bg: 'rgba(34, 197, 94, 0.1)',
    filterParams: { fee: 'free' },
  },
  {
    id: 'online-only',
    label: '100% Online Application',
    icon: Globe,
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.1)',
    filterParams: { type: 'Online' },
  },
  {
    id: 'certificates',
    label: 'Essential Certificates',
    icon: Award,
    color: '#a855f7',
    bg: 'rgba(168, 85, 247, 0.1)',
    filterParams: { cat: 'Certificates' },
  },
  {
    id: 'welfare-schemes',
    label: 'Welfare & Benefits',
    icon: Shield,
    color: '#f97316',
    bg: 'rgba(249, 115, 22, 0.1)',
    filterParams: { cat: 'Social Welfare' },
  },
];

export default function QuickFilterPresets({ activePresetId, onSelectPreset }) {
  return (
    <div
      role="region"
      aria-label="Quick civic service filter presets"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        overflowX: 'auto',
        padding: '0.25rem 0',
        marginBottom: '1.25rem',
        scrollbarWidth: 'none',
      }}
    >
      <span
        style={{
          fontSize: '0.78rem',
          fontWeight: 700,
          color: 'var(--text-tertiary, #94a3b8)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          whiteSpace: 'nowrap',
          marginRight: '0.25rem',
        }}
      >
        Quick Presets:
      </span>
      {QUICK_PRESETS.map((preset) => {
        const Icon = preset.icon;
        const isActive = activePresetId === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelectPreset(isActive ? null : preset)}
            aria-pressed={isActive}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '999px',
              fontSize: '0.8rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease-in-out',
              border: isActive ? `1px solid ${preset.color}` : '1px solid var(--border-light, #334155)',
              background: isActive ? preset.bg : 'var(--glass-bg, rgba(255, 255, 255, 0.03))',
              color: isActive ? preset.color : 'var(--text-secondary, #cbd5e1)',
            }}
          >
            <Icon size={14} color={isActive ? preset.color : 'currentColor'} aria-hidden="true" />
            <span>{preset.label}</span>
          </button>
        );
      })}
    </div>
  );
}
