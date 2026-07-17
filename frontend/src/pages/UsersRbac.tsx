import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Table } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';

export const UsersRbac: React.FC = () => {
  const [users, setUsers] = useState([
    { id: 'u1', email: 'admin@clinic.com', role: 'admin', status: 'active' },
    { id: 'u2', email: 'receptionist@clinic.com', role: 'receptionist', status: 'active' },
    { id: 'u3', email: 'doctor@clinic.com', role: 'doctor', status: 'active' },
  ]);

  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ email: '', role: 'receptionist' });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setUsers([...users, { id: `u_${Date.now()}`, email: form.email, role: form.role, status: 'active' }]);
    setForm({ email: '', role: 'receptionist' });
    setShowInvite(false);
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex justify-between items-center w-full">
        <div>
          <h1 className="mb-2">User Access Controls (RBAC)</h1>
          <p>Invite clinic staff and enforce role-based access permissions.</p>
        </div>
        <Button onClick={() => setShowInvite(true)}>Invite User</Button>
      </div>

      <Table headers={['Email Address', 'Assigned System Role', 'Account Status', 'Role Scope']}>
        {users.map((u) => (
          <tr key={u.id}>
            <td style={{ fontWeight: 600 }}>{u.email}</td>
            <td style={{ textTransform: 'capitalize' }}>{u.role}</td>
            <td>
              <Badge variant="success">{u.status}</Badge>
            </td>
            <td>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {u.role === 'admin' ? 'Tenant Wide' : 'Clinic Restricted'}
              </span>
            </td>
          </tr>
        ))}
      </Table>

      {/* Invite Modal */}
      <Modal isOpen={showInvite} onClose={() => setShowInvite(false)} title="Invite Team Member">
        <form onSubmit={handleInvite}>
          <Input
            type="email"
            label="Email Address"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <div className="flex flex-col gap-2 w-full mb-4">
            <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Access Role
            </label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="input"
            >
              <option value="admin">Admin</option>
              <option value="receptionist">Receptionist</option>
              <option value="doctor">Doctor</option>
            </select>
          </div>
          <Button type="submit" style={{ width: '100%', marginTop: '16px' }}>
            Send Invitation
          </Button>
        </form>
      </Modal>
    </div>
  );
};
