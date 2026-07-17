import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className = '',
  id,
  ...props
}) => {
  return (
    <div className="flex flex-col gap-2 w-full mb-4">
      {label && (
        <label
          htmlFor={id}
          style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}
        >
          {label}
        </label>
      )}
      <input
        id={id}
        className={`input ${className}`}
        style={error ? { borderColor: 'var(--error)' } : {}}
        {...props}
      />
      {error && (
        <span style={{ fontSize: '0.75rem', color: 'var(--error)' }}>
          {error}
        </span>
      )}
    </div>
  );
};
