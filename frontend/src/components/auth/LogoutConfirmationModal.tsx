import React, { useEffect, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { LogOut, AlertTriangle } from 'lucide-react';
import { telemetry } from '../../services/telemetry';

interface LogoutConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  isLoggingOut: boolean;
}

export const LogoutConfirmationModal: React.FC<LogoutConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isLoggingOut,
}) => {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      telemetry.track('button_clicked', {
        module: 'auth',
        action: 'logout_dialog_opened',
      });

      // Auto-focus primary confirm button for fast keyboard accessibility
      const timer = setTimeout(() => {
        confirmButtonRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleCancel = () => {
    if (isLoggingOut) return;
    telemetry.track('button_clicked', {
      module: 'auth',
      action: 'logout_cancelled',
    });
    onClose();
  };

  const handleConfirm = async () => {
    telemetry.track('button_clicked', {
      module: 'auth',
      action: 'logout_confirmed',
    });
    await onConfirm();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isLoggingOut) {
      handleCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} title="Sign out?">
      <div
        onKeyDown={handleKeyDown}
        style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
          <div
            style={{
              padding: '10px',
              borderRadius: '50%',
              backgroundColor: 'var(--error-light)',
              color: 'var(--error)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={24} />
          </div>
          <div>
            <h4
              id="logout-dialog-title"
              style={{ fontSize: '1.05rem', fontWeight: 600, margin: '0 0 6px' }}
            >
              Sign out?
            </h4>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Are you sure you want to sign out of your account? Your current session cache will be cleared.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
          <Button
            type="button"
            variant="secondary"
            onClick={handleCancel}
            disabled={isLoggingOut}
            style={{ padding: '8px 16px', fontSize: '0.875rem' }}
          >
            Cancel
          </Button>
          <Button
            ref={confirmButtonRef}
            type="button"
            variant="danger"
            onClick={handleConfirm}
            disabled={isLoggingOut}
            style={{ padding: '8px 16px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <LogOut size={16} />
            <span>{isLoggingOut ? 'Signing out...' : 'Sign Out'}</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
};
