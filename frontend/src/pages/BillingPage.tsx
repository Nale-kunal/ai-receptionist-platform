import React from 'react';
import { CreditCard, CheckCircle2, ShieldCheck, Download, Zap } from 'lucide-react';

export const BillingPage: React.FC = () => {
  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Billing & Subscription Plan
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
          Manage your clinic's SaaS subscription, usage tiers, and invoicing.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Current Plan Overview */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <span className="badge" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)', marginBottom: '8px', display: 'inline-block' }}>
                CURRENT PLAN
              </span>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Enterprise Dental AI Plan</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Unlimited AI calls, multi-location routing, and EHR integration</p>
            </div>
            <span style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--primary)' }}>$499<span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/mo</span></span>
          </div>

          <hr style={{ borderColor: 'var(--border-color)', margin: '20px 0' }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
              <CheckCircle2 size={16} color="#10b981" />
              <span>Unlimited Voice AI Calls</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
              <CheckCircle2 size={16} color="#10b981" />
              <span>Dedicated HIPAA Compliance Portal</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
              <CheckCircle2 size={16} color="#10b981" />
              <span>24/7 AI Receptionist Availability</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
              <CheckCircle2 size={16} color="#10b981" />
              <span>Full EHR & Calendar Integration</span>
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CreditCard size={18} />
            Payment Method
          </h3>
          <div style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '8px', borderRadius: '6px' }}>
              <CreditCard size={24} color="var(--primary)" />
            </div>
            <div>
              <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>Visa ending in 4242</p>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Expires 12/2028</span>
            </div>
          </div>
          <button className="btn btn-secondary" style={{ width: '100%' }}>Update Card Details</button>
        </div>
      </div>
    </div>
  );
};
