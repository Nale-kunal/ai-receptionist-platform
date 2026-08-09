import React from 'react';
import { Activity } from 'lucide-react';

export const AppSplashScreen: React.FC = () => {
  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-secondary)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-sans)',
        padding: '24px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
          animation: 'fadeIn 0.3s ease-out',
        }}
      >
        {/* Brand Icon Badge */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            backgroundColor: 'var(--primary)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <Activity size={32} />
        </div>

        {/* Brand Name & Tagline */}
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Dental AI Receptionist
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: 0 }}>
            Securing practice identity & AI session...
          </p>
        </div>

        {/* Smooth Loader Bar */}
        <div
          style={{
            width: '180px',
            height: '4px',
            backgroundColor: 'var(--border-color)',
            borderRadius: '2px',
            overflow: 'hidden',
            marginTop: '8px',
            position: 'relative',
          }}
        >
          <div
            style={{
              width: '40%',
              height: '100%',
              backgroundColor: 'var(--primary)',
              borderRadius: '2px',
              position: 'absolute',
              animation: 'shimmer 1.2s infinite ease-in-out',
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { left: -40%; }
          100% { left: 100%; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};
