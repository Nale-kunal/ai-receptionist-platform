import React from 'react';

interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
  style?: React.CSSProperties;
}

// skeletonPulse keyframe is defined in global index.css — NOT injected inline here
// This eliminates a new DOM style node being created on every component render.
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '20px',
  borderRadius = 'var(--radius)',
  style,
}) => {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: 'var(--border-color)',
        opacity: 0.6,
        animation: 'skeletonPulse 1.4s ease-in-out infinite',
        ...style,
      }}
    />
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton width="40%" height="16px" />
        <Skeleton width="32px" height="32px" borderRadius="50%" />
      </div>
      <Skeleton width="60%" height="32px" />
      <Skeleton width="80%" height="14px" />
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
        <Skeleton width="25%" height="18px" />
        <Skeleton width="25%" height="18px" />
        <Skeleton width="25%" height="18px" />
        <Skeleton width="20%" height="18px" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '12px 0' }}>
          <Skeleton width="25%" height="16px" />
          <Skeleton width="25%" height="16px" />
          <Skeleton width="25%" height="16px" />
          <Skeleton width="20%" height="24px" borderRadius="12px" />
        </div>
      ))}
    </div>
  );
};

/**
 * PageSkeleton — renders the layout shell immediately while page content loads.
 * Gives users an instant structural response instead of a blank/spinner screen.
 */
export const PageSkeleton: React.FC<{ rows?: number; cards?: number }> = ({ rows = 5, cards = 2 }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Skeleton width="200px" height="28px" />
          <Skeleton width="140px" height="16px" />
        </div>
        <Skeleton width="120px" height="36px" borderRadius="8px" />
      </div>
      {cards > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(cards, 4)}, 1fr)`, gap: '16px' }}>
          {Array.from({ length: cards }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}
      <TableSkeleton rows={rows} />
    </div>
  );
};

/**
 * ModalSkeleton — renders inside a modal that opened immediately.
 * Allows modal to open in 0ms and load content progressively.
 */
export const ModalSkeleton: React.FC<{ rows?: number }> = ({ rows = 4 }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '8px 0' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Skeleton width="30%" height="12px" />
          <Skeleton width="100%" height="38px" borderRadius="8px" />
        </div>
      ))}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '8px' }}>
        <Skeleton width="80px" height="36px" borderRadius="8px" />
        <Skeleton width="120px" height="36px" borderRadius="8px" />
      </div>
    </div>
  );
};

