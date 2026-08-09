import React from 'react';
import { Shield, Users, CheckCircle2 } from 'lucide-react';

export const RolesPermissions: React.FC = () => {
  const roles = [
    { name: 'Platform Administrator', title: 'System Super Admin', count: 1, permissions: 'Full Platform Access' },
    { name: 'Tenant Enterprise Owner', title: 'Organization Owner', count: 2, permissions: 'Full Tenant & Practice Admin' },
    { name: 'Practice Owner', title: 'Clinic Owner / Principal', count: 4, permissions: 'Full Practice Management' },
    { name: 'Practice Manager', title: 'Operations Manager', count: 6, permissions: 'Staff & Daily Operations' },
    { name: 'Dentist / Practitioner', title: 'Clinical Staff', count: 12, permissions: 'Clinical Care & Appointments' },
    { name: 'Front Desk Staff', title: 'Receptionist', count: 8, permissions: 'Scheduling & Inbound Calls' },
    { name: 'Dental Assistant', title: 'Clinical Assistant', count: 5, permissions: 'Patient Charting & Schedules' },
    { name: 'Billing Specialist', title: 'Finance Specialist', count: 3, permissions: 'Invoicing & Claims' },
    { name: 'Compliance Auditor', title: 'Read-Only Auditor', count: 2, permissions: 'Inspection & Logs Only' },
  ];

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Staff Roles & Access Control
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
          Role-based security policies, staff access levels, and least-privilege compliance.
        </p>
      </div>

      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={18} style={{ color: 'var(--primary)' }} />
          Configured Staff Roles
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
              <th style={{ padding: '12px 16px' }}>Role Title</th>
              <th style={{ padding: '12px 16px' }}>Classification</th>
              <th style={{ padding: '12px 16px' }}>Active Members</th>
              <th style={{ padding: '12px 16px' }}>Access Privilege Level</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.name} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</td>
                <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{r.title}</td>
                <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{r.count} staff members</td>
                <td style={{ padding: '12px 16px' }}>
                  <span className="badge" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 600 }}>
                    <CheckCircle2 size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                    {r.permissions}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
