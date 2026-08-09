import React from 'react';
import { BarChart3, TrendingUp, Users, Calendar, PhoneCall, DollarSign } from 'lucide-react';

export const Analytics: React.FC = () => {
  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Practice & AI Analytics
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Real-time telemetry, appointment conversion, and AI performance metrics.
          </p>
        </div>
      </div>

      {/* Metric Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>AI Conversion Rate</span>
            <TrendingUp size={20} color="var(--primary)" />
          </div>
          <p style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '8px' }}>94.2%</p>
          <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>+3.1% vs last month</span>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Appointments Booked</span>
            <Calendar size={20} color="var(--primary)" />
          </div>
          <p style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '8px' }}>1,248</p>
          <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>+12% this week</span>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Total Call Duration</span>
            <PhoneCall size={20} color="var(--primary)" />
          </div>
          <p style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '8px' }}>184 hrs</p>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Avg 2.4 min/call</span>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Staff Hours Saved</span>
            <Users size={20} color="var(--primary)" />
          </div>
          <p style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '8px' }}>320 hrs</p>
          <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>~$9,600 labor saved</span>
        </div>
      </div>

      {/* Main Analytics Panel */}
      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 size={18} />
          Volume & Booking Trends
        </h3>
        <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Interactive Telemetry Graph — Live Data Feed Active
          </p>
        </div>
      </div>
    </div>
  );
};
