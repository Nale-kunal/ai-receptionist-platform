import React, { useState, useEffect } from 'react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 9999,
        maxWidth: '360px',
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onRemove(t.id)} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: () => void }> = ({
  toast,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const getStyle = () => {
    switch (toast.type) {
      case 'success':
        return { borderLeft: '4px solid var(--success)', bg: 'var(--bg-primary)' };
      case 'error':
        return { borderLeft: '4px solid var(--error)', bg: 'var(--bg-primary)' };
      default:
        return { borderLeft: '4px solid var(--primary)', bg: 'var(--bg-primary)' };
    }
  };

  const style = getStyle();

  return (
    <div
      className="card"
      style={{
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'between',
        gap: '12px',
        boxShadow: 'var(--shadow-lg)',
        borderLeft: style.borderLeft,
        animation: 'toast-slide-in 0.2s ease-out',
        width: '320px',
      }}
    >
      <span style={{ fontSize: '0.875rem', flexGrow: 1, color: 'var(--text-primary)' }}>
        {toast.message}
      </span>
      <button
        onClick={onDismiss}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontSize: '1rem',
        }}
      >
        &times;
      </button>
    </div>
  );
};
export const useToast = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = (message: string, type: ToastMessage['type'] = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return { toasts, toast, removeToast, ToastContainer };
};
