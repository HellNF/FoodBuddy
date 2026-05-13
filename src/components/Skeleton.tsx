import type { CSSProperties } from 'react';
import { cardOuter } from '../lib/fbUI';
import { useT } from '../i18n/useT';

const baseStyle: CSSProperties = {
  background:
    'linear-gradient(90deg, var(--fb-bg-2) 0%, var(--fb-card-2) 50%, var(--fb-bg-2) 100%)',
  backgroundSize: '200% 100%',
  animation: 'fb-shimmer 1.6s linear infinite',
  borderRadius: 8,
};

export function SkeletonLine({
  width = '100%',
  height = 12,
  radius = 6,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden
      style={{ ...baseStyle, width, height, borderRadius: radius, ...style }}
    />
  );
}

export function SkeletonCard({
  lines = 3,
  showEyebrow = true,
  style,
}: {
  lines?: number;
  showEyebrow?: boolean;
  style?: CSSProperties;
}) {
  const { t } = useT();
  return (
    <div
      role="status"
      aria-label={t('common.loading')}
      style={{ ...cardOuter, ...style }}
    >
      {showEyebrow && <SkeletonLine width={80} height={10} radius={4} />}
      <SkeletonLine width="55%" height={18} radius={6} />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine
          key={i}
          width={i === lines - 1 ? '70%' : '100%'}
          height={12}
          radius={4}
        />
      ))}
    </div>
  );
}

export function SkeletonRow({
  count = 4,
  height = 44,
}: {
  count?: number;
  height?: number;
}) {
  const { t } = useT();
  return (
    <div role="status" aria-label={t('common.loading')} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonLine key={i} height={height} radius={12} />
      ))}
    </div>
  );
}

export default SkeletonCard;
