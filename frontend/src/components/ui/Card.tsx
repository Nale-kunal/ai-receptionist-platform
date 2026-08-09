import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e?: any) => void;
  tabIndex?: number;
  role?: string;
  'aria-label'?: string;
  onKeyDown?: (e: any) => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', style, onClick, tabIndex, role, 'aria-label': ariaLabel, onKeyDown }) => {
  return (
    <div
      className={`card ${className}`}
      style={style}
      onClick={onClick}
      tabIndex={tabIndex}
      role={role}
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<CardProps> = ({ children, className = '', style }) => {
  return (
    <div
      className={`mb-4 flex items-center justify-between ${className}`}
      style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', ...style }}
    >
      {children}
    </div>
  );
};

export const CardContent: React.FC<CardProps> = ({ children, className = '', style }) => {
  return <div className={className} style={style}>{children}</div>;
};
