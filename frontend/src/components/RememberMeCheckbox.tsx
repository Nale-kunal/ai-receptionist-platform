import React from 'react';

interface RememberMeCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export const RememberMeCheckbox: React.FC<RememberMeCheckboxProps> = ({
  checked,
  onChange,
}) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', userSelect: 'none' }}>
      <input
        type="checkbox"
        id="remember-me"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          width: '16px',
          height: '16px',
          borderRadius: '4px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-primary)',
          cursor: 'pointer',
        }}
      />
      <label
        htmlFor="remember-me"
        style={{
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
        }}
      >
        Remember me
      </label>
    </div>
  );
};
