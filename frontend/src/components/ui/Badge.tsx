import React from 'react';

interface BadgeProps {
  variant?: 'success' | 'warning' | 'danger' | 'primary' | 'secondary';
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'primary',
  children,
  className = '',
  style,
}) => {
  const badgeVariant = variant === 'secondary' ? 'primary' : variant;
  return (
    <span className={`badge badge-${badgeVariant} ${className}`} style={style}>
      {children}
    </span>
  );
};
