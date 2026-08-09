import React, { useState } from 'react';
import { validateEmail } from '../utils/validators';
import { Input } from './ui/Input';
import { PasswordField } from './PasswordField';
import { RememberMeCheckbox } from './RememberMeCheckbox';
import { Button } from './ui/Button';

interface LoginFormProps {
  onSubmit: (email: string, password: string) => Promise<void>;
  isLoading: boolean;
  onForgotPasswordClick: () => void;
  onRegisterClick?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSubmit,
  isLoading,
  onForgotPasswordClick,
  onRegisterClick,
}) => {
  const [email, setEmail] = useState(() => {
    const isOptIn = localStorage.getItem('remember_me_optin') === 'true';
    return isOptIn ? localStorage.getItem('e2e_remembered_email') || '' : '';
  });
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem('remember_me_optin') === 'true';
  });

  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    const emailErr = validateEmail(email);
    const passErr = password ? null : 'Password is required.';

    setEmailError(emailErr);
    setPasswordError(passErr);

    if (emailErr || passErr) {
      return;
    }

    try {
      if (rememberMe) {
        localStorage.setItem('remember_me_optin', 'true');
        localStorage.setItem('e2e_remembered_email', email);
      } else {
        localStorage.removeItem('remember_me_optin');
        localStorage.removeItem('e2e_remembered_email');
      }
      await onSubmit(email, password);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'Login failed. Please try again.';
      setGeneralError(msg);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
      {generalError && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--error-light)',
            color: 'var(--error)',
            borderRadius: 'var(--radius)',
            fontSize: '0.875rem',
            border: '1px solid var(--error)',
          }}
          role="alert"
        >
          {generalError}
        </div>
      )}

      <Input
        id="login-email"
        label="Email Address"
        type="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (emailError) {
            setEmailError(null);
          }
        }}
        onBlur={() => setEmailError(validateEmail(email))}
        error={emailError || undefined}
        placeholder="you@clinic.com"
        autoComplete="username"
        required
        disabled={isLoading}
      />

      <PasswordField
        id="login-password"
        label="Password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          if (passwordError) {
            setPasswordError(null);
          }
        }}
        error={passwordError || undefined}
        placeholder="••••••••••••"
        autoComplete="current-password"
        required
        disabled={isLoading}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
        <RememberMeCheckbox checked={rememberMe} onChange={setRememberMe} />
        <button
          type="button"
          onClick={onForgotPasswordClick}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--primary)',
            fontSize: '0.875rem',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Forgot password?
        </button>
      </div>

      <Button
        type="submit"
        variant="primary"
        disabled={isLoading}
        style={{ marginTop: '8px', padding: '12px', fontSize: '0.95rem' }}
      >
        {isLoading ? 'Verifying secure session...' : 'Sign In'}
      </Button>

      {onRegisterClick && (
        <div style={{ textAlign: 'center', marginTop: '12px' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            New clinic owner?{' '}
            <button
              type="button"
              onClick={onRegisterClick}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Create an account
            </button>
          </span>
        </div>
      )}
    </form>
  );
};
