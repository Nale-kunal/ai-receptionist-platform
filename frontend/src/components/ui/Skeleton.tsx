import React from 'react';

interface SkeletonProps {
  height?: string;
  width?: string;
  className?: string;
  circle?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  height = '16px',
  width = '100%',
  className = '',
  circle = false,
}) => {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        height,
        width,
        borderRadius: circle ? '50%' : 'var(--radius)',
      }}
    />
  );
};
export const TableSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col gap-4 w-full">
      <Skeleton height="36px" />
      <Skeleton height="20px" />
      <Skeleton height="20px" />
      <Skeleton height="20px" />
      <Skeleton height="20px" />
    </div>
  );
};
