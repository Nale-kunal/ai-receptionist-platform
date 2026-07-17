import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', style, onClick }) => {
  return <div className={`card ${className}`} style={style} onClick={onClick}>{children}</div>;
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
