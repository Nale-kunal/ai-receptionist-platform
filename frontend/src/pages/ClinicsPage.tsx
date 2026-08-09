import React, { useEffect, useState } from 'react';
import { Building, Plus, MapPin, Phone, User, RefreshCw } from 'lucide-react';
import { axiosClient } from '../services/axiosClient';

export const ClinicsPage: React.FC = () => {
  const [clinics, setClinics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClinics = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/clinics');
      const data = res.data?.data?.clinics || res.data?.data || res.data || [];
      setClinics(Array.isArray(data) ? data : []);
    } catch {
      setClinics([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClinics();
  }, []);

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Clinic Locations &amp; Settings
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Manage physical dental practice locations, operating hours, and doctor assignments.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={fetchClinics} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={16} /> Add Location
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)', padding: '24px' }}>Loading clinic locations…</p>
      ) : clinics.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Building size={36} style={{ opacity: 0.3, margin: '0 auto 12px', display: 'block' }} />
          <p style={{ margin: 0, fontSize: '0.95rem' }}>No clinic locations registered.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {clinics.map((c) => (
            <div key={c.id} className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{c.name}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{c.isPrimary ? 'Primary Facility' : 'Secondary Facility'}</p>
                </div>
                {c.isPrimary && <span className="badge" style={{ backgroundColor: '#10b98120', color: '#10b981' }}>PRIMARY</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><MapPin size={16} /> {c.address || 'Address not specified'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Phone size={16} /> {c.phone || 'Phone not specified'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><User size={16} /> {c.contactPerson || 'Lead Staff'}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
