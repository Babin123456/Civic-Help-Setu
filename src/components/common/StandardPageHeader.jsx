import React from 'react';

/**
 * StandardPageHeader Component (#590)
 *
 * Implements a unified, accessible, responsive page header pattern across Civic-Help-Setu.
 * Enforces:
 *  - Consistent heading typography and vertical rhythm.
 *  - Eyebrow badges with optional icon support.
 *  - Capped subtitle width for optimal measure and reading comfort.
 *  - Optional right/bottom action slot for toolbars, search, or status pills.
 *  - Bounded layout container metrics ensuring zero horizontal overflow.
 */
const StandardPageHeader = ({
  eyebrow,
  eyebrowIcon,
  title,
  subtitle,
  children,
  badgeText,
  badgeType = 'neutral',
  align = 'center',
  maxWidth = '780px',
  className = '',
  style = {},
}) => {
  const isCentered = align === 'center';

  const badgeColors = {
    neutral: { bg: 'var(--glass-bg)', text: 'var(--text-secondary)', border: 'var(--border-light)' },
    accent: { bg: 'rgba(56, 189, 248, 0.1)', text: 'var(--accent-main)', border: 'rgba(56, 189, 248, 0.2)' },
    success: { bg: 'rgba(16, 185, 129, 0.15)', text: 'var(--success, #10b981)', border: 'rgba(16, 185, 129, 0.3)' },
    warning: { bg: 'rgba(245, 158, 11, 0.15)', text: 'var(--warning, #f59e0b)', border: 'rgba(245, 158, 11, 0.3)' },
  };

  const currentBadge = badgeColors[badgeType] || badgeColors.neutral;

  return (
    <header
      className={`standard-page-header ${className}`}
      style={{
        textAlign: align,
        marginBottom: '2.5rem',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Eyebrow / Category Badge */}
      {(eyebrow || badgeText) && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: isCentered ? 'center' : 'flex-start',
            gap: '0.5rem',
            marginBottom: '0.65rem',
            flexWrap: 'wrap',
          }}
        >
          {eyebrow && (
            <span
              className="page-header-eyebrow"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                color: 'var(--accent-main)',
                fontSize: '0.85rem',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              {eyebrowIcon && <span aria-hidden="true">{eyebrowIcon}</span>}
              <span>{eyebrow}</span>
            </span>
          )}

          {badgeText && (
            <span
              className="page-header-badge"
              style={{
                fontSize: '0.75rem',
                fontWeight: '700',
                padding: '0.15rem 0.6rem',
                borderRadius: '99px',
                background: currentBadge.bg,
                color: currentBadge.text,
                border: `1px solid ${currentBadge.border}`,
              }}
            >
              {badgeText}
            </span>
          )}
        </div>
      )}

      {/* Primary Page Title */}
      <h1
        className="page-header-title"
        style={{
          fontSize: 'clamp(2rem, 4.5vw, 3.25rem)',
          fontWeight: '800',
          lineHeight: '1.15',
          letterSpacing: '-0.025em',
          color: 'var(--text-primary)',
          marginBottom: subtitle ? '0.75rem' : '0',
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
        }}
      >
        {title}
      </h1>

      {/* Subtitle / Descriptive Lead */}
      {subtitle && (
        <p
          className="page-header-subtitle"
          style={{
            fontSize: 'clamp(1rem, 2vw, 1.15rem)',
            color: 'var(--text-secondary)',
            lineHeight: '1.6',
            maxWidth,
            margin: isCentered ? '0 auto' : '0',
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
          }}
        >
          {subtitle}
        </p>
      )}

      {/* Optional action/toolbar slot */}
      {children && (
        <div
          className="page-header-actions"
          style={{
            marginTop: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCentered ? 'center' : 'flex-start',
            flexWrap: 'wrap',
            gap: '0.75rem',
            width: '100%',
          }}
        >
          {children}
        </div>
      )}
    </header>
  );
};

export default StandardPageHeader;
