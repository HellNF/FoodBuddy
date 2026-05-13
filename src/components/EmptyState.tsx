import type { ReactNode } from 'react';
import { eyebrow, serifItalic, pillPrimary, pillGhost } from '../lib/fbUI';

interface EmptyStateProps {
  icon?: ReactNode;
  eyebrow?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  compact?: boolean;
}

export default function EmptyState({
  icon,
  eyebrow: eb,
  title,
  description,
  action,
  secondaryAction,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: compact ? '24px 16px' : '44px 24px',
        textAlign: 'center',
        background: 'var(--fb-bg)',
        border: '1px dashed var(--fb-border-strong)',
        borderRadius: 14,
        animation: 'fb-fade-up .3s cubic-bezier(0.16,1,0.3,1) both',
      }}
    >
      {icon && (
        <div
          aria-hidden
          style={{
            fontSize: compact ? 28 : 36,
            lineHeight: 1,
            marginBottom: 2,
            filter: 'saturate(0.85)',
          }}
        >
          {icon}
        </div>
      )}
      {eb && <span style={eyebrow}>{eb}</span>}
      <span
        style={{
          ...serifItalic,
          fontSize: compact ? 15 : 17,
          color: 'var(--fb-text-2)',
          lineHeight: 1.2,
        }}
      >
        {title}
      </span>
      {description && (
        <div
          style={{
            fontSize: 12.5,
            color: 'var(--fb-text-3)',
            maxWidth: 360,
            lineHeight: 1.5,
            marginTop: 2,
          }}
        >
          {description}
        </div>
      )}
      {(action || secondaryAction) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              style={pillPrimary}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              style={pillGhost}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--fb-text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--fb-text-2)')}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
