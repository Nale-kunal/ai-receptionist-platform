import React from 'react';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
  hideFooterCancel?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = '500px',
  hideFooterCancel = false,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
        overflowY: 'auto',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth,
          boxShadow: 'var(--shadow-lg, 0 20px 25px -5px rgba(0, 0, 0, 0.5))',
          animation: 'modal-appear 0.15s ease-out',
          maxHeight: 'calc(100vh - 32px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 0,
          margin: 'auto',
        }}
      >
        <div
          className="flex items-center justify-between"
          style={{
            borderBottom: '1px solid var(--border-color)',
            padding: '12px 18px',
            backgroundColor: 'var(--bg-primary)',
            flexShrink: 0,
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.25rem',
              lineHeight: 1,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: '4px',
            }}
          >
            &times;
          </button>
        </div>
        <div style={{ padding: '16px 18px', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
        {!hideFooterCancel && (
          <div
            className="flex justify-end gap-2"
            style={{
              borderTop: '1px solid var(--border-color)',
              padding: '10px 18px',
              backgroundColor: 'var(--bg-primary)',
              flexShrink: 0,
            }}
          >
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
