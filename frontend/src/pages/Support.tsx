import React from 'react';
import { HelpCircle, Mail, MessageSquare, BookOpen, ShieldCheck } from 'lucide-react';

export const Support: React.FC = () => {
  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Help & Customer Support
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
          Access 24/7 technical support, HIPAA compliance documentation, and AI setup guides.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        <div className="card" style={{ padding: '24px' }}>
          <MessageSquare size={24} color="var(--primary)" style={{ marginBottom: '12px' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px' }}>Live Priority Support</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Connect with our dedicated SaaS support team for assistance with AI receptionist configuration.
          </p>
          <button className="btn btn-primary" style={{ width: '100%' }}>Start Support Ticket</button>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <BookOpen size={24} color="var(--primary)" style={{ marginBottom: '12px' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px' }}>Documentation & Guides</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Explore setup manuals for AI voice prompts, calendar syncing, and staff RBAC roles.
          </p>
          <button className="btn btn-secondary" style={{ width: '100%' }}>View Knowledge Base</button>
        </div>
      </div>
    </div>
  );
};
