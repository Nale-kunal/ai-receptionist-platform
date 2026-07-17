import React, { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Table } from '../components/ui/Table';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { api } from '../services/api';
import type { ApiAppointment } from '../services/api';

export const Appointments: React.FC = () => {
  const [appointments, setAppointments] = useState<ApiAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Form state
  const [form, setForm] = useState({
    patientName: '',
    patientPhone: '',
    doctorName: 'Dr. Gregory House',
    date: '',
    time: '',
  });

  const loadAppointments = async () => {
    try {
      const res = await api.getAppointments();
      setAppointments(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createAppointment({
        patientName: form.patientName,
        patientPhone: form.patientPhone,
        doctorName: form.doctorName,
        date: form.date,
        time: form.time,
        status: 'scheduled',
      });
      setShowCreateModal(false);
      setForm({ patientName: '', patientPhone: '', doctorName: 'Dr. Gregory House', date: '', time: '' });
      loadAppointments();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await api.updateAppointment(id, { status: 'cancelled' });
      loadAppointments();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = appointments.filter(
    (a) =>
      a.patientName.toLowerCase().includes(search.toLowerCase()) ||
      a.doctorName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex justify-between items-center w-full">
        <div>
          <h1 className="mb-2">Appointment Registry</h1>
          <p>Search, schedule, and reschedule patient appointments.</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>New Appointment</Button>
      </div>

      {/* Filter and Search Bar */}
      <Card style={{ padding: '16px' }}>
        <Input
          placeholder="Filter by patient name or doctor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: 0 }}
        />
      </Card>

      {/* Appointment List Table */}
      {loading ? (
        <p>Loading appointments list...</p>
      ) : (
        <Table headers={['Patient Name', 'Phone', 'Doctor', 'Date', 'Time', 'Status', 'Actions']}>
          {filtered.map((a) => (
            <tr key={a.id}>
              <td style={{ fontWeight: 600 }}>{a.patientName}</td>
              <td>{a.patientPhone}</td>
              <td>{a.doctorName}</td>
              <td>{a.date}</td>
              <td>{a.time}</td>
              <td>
                <Badge
                  variant={
                    a.status === 'scheduled'
                      ? 'success'
                      : a.status === 'rescheduled'
                      ? 'primary'
                      : 'danger'
                  }
                >
                  {a.status}
                </Badge>
              </td>
              <td>
                {a.status !== 'cancelled' && (
                  <Button variant="danger" onClick={() => handleCancel(a.id)} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                    Cancel
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}

      {/* Appointment Creation Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create New Appointment">
        <form onSubmit={handleCreate}>
          <Input
            label="Patient Name"
            required
            value={form.patientName}
            onChange={(e) => setForm({ ...form, patientName: e.target.value })}
          />
          <Input
            label="Patient Phone"
            required
            placeholder="+15550100"
            value={form.patientPhone}
            onChange={(e) => setForm({ ...form, patientPhone: e.target.value })}
          />
          <div className="flex flex-col gap-2 w-full mb-4">
            <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Doctor</label>
            <select
              value={form.doctorName}
              onChange={(e) => setForm({ ...form, doctorName: e.target.value })}
              className="input"
            >
              <option value="Dr. Gregory House">Dr. Gregory House</option>
              <option value="Dr. John Watson">Dr. John Watson</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="date"
              label="Date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
            <Input
              type="time"
              label="Time"
              required
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
            />
          </div>
          <Button type="submit" style={{ marginTop: '16px', width: '100%' }}>
            Book Appointment
          </Button>
        </form>
      </Modal>
    </div>
  );
};
