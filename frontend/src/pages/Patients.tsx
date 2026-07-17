import React, { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Table } from '../components/ui/Table';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { api } from '../services/api';
import type { ApiPatient } from '../services/api';

export const Patients: React.FC = () => {
  const [patients, setPatients] = useState<ApiPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    dob: '',
  });

  const loadPatients = async () => {
    try {
      const res = await api.getPatients();
      setPatients(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createPatient(form);
      setShowCreateModal(false);
      setForm({ name: '', phone: '', email: '', dob: '' });
      loadPatients();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = patients.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.phone.includes(search)
  );

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex justify-between items-center w-full">
        <div>
          <h1 className="mb-2">Patient Registry</h1>
          <p>Manage patient profiles and their clinical histories.</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>Add Patient</Button>
      </div>

      <Card style={{ padding: '16px' }}>
        <Input
          placeholder="Search by name or phone number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: 0 }}
        />
      </Card>

      {loading ? (
        <p>Loading patient list...</p>
      ) : (
        <Table headers={['Patient Name', 'Phone', 'Email Address', 'Date of Birth', 'Last Clinical Visit']}>
          {filtered.map((p) => (
            <tr key={p.id}>
              <td style={{ fontWeight: 600 }}>{p.name}</td>
              <td>{p.phone}</td>
              <td>{p.email}</td>
              <td>{p.dob}</td>
              <td>{p.lastVisit || 'No visits registered'}</td>
            </tr>
          ))}
        </Table>
      )}

      {/* Patient Creation Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Register Patient Profile">
        <form onSubmit={handleCreate}>
          <Input
            label="Full Name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="Phone Number"
            required
            placeholder="+15550000"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Input
            type="email"
            label="Email Address"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            type="date"
            label="Date of Birth"
            required
            value={form.dob}
            onChange={(e) => setForm({ ...form, dob: e.target.value })}
          />
          <Button type="submit" style={{ marginTop: '16px', width: '100%' }}>
            Save Profile
          </Button>
        </form>
      </Modal>
    </div>
  );
};
