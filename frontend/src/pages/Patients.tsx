import React, { useEffect, useState, useCallback } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Table } from '../components/ui/Table';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { api } from '../services/api';
import type { ApiPatient, ApiAppointment } from '../services/api';
import { Search, User, Phone, Mail, Calendar, ArrowLeft, Edit2, MessageSquare, Clock, Plus, Activity, AlertTriangle } from 'lucide-react';

export const Patients: React.FC = () => {
  const [patients, setPatients] = useState<ApiPatient[]>([]);
  const [appointments, setAppointments] = useState<ApiAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Focus targets
  const [selectedPatient, setSelectedPatient] = useState<ApiPatient | null>(null);
  const [patientConversations, setPatientConversations] = useState<any[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [emailConflict, setEmailConflict] = useState<{
    existingPatientName: string;
    email: string;
    mode: 'create' | 'edit';
  } | null>(null);
  const [modalErrorMsg, setModalErrorMsg] = useState<string | null>(null);

  // Forms
  const [createForm, setCreateForm] = useState({
    name: '',
    phone: '',
    email: '',
    dob: '',
  });

  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    email: '',
    dob: '',
  });

  const loadData = useCallback(async () => {
    try {
      const [pats, apts] = await Promise.all([
        api.getPatients(),
        api.getAppointments(),
      ]);
      setPatients(pats);
      setAppointments(apts);
      setErrorMsg(null);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Failed to load patient registries. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load selected patient conversations
  const loadPatientConversations = async (patientId: string) => {
    setLoadingConversations(true);
    try {
      const convs = await api.getConversations({ patientId });
      setPatientConversations(convs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingConversations(false);
    }
  };

  const handleSelectPatient = (patient: ApiPatient) => {
    setSelectedPatient(patient);
    loadPatientConversations(patient.id);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalErrorMsg(null);
    const cleanPhone = createForm.phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setModalErrorMsg('Phone number must be exactly 10 digits.');
      return;
    }
    try {
      await api.createPatient(createForm);
      setShowCreateModal(false);
      setCreateForm({ name: '', phone: '', email: '', dob: '' });
      loadData();
    } catch (err: any) {
      console.error(err);
      const errData = err.response?.data?.error;
      if (errData?.code === 'EMAIL_IN_USE_WARNING') {
        const details = errData.details?.[0] || {};
        setEmailConflict({
          existingPatientName: details.existingPatientName || 'another patient',
          email: createForm.email,
          mode: 'create',
        });
      } else {
        let msg = errData?.message || 'Failed to register patient profile.';
        if (errData?.details && Array.isArray(errData.details) && errData.details.length > 0) {
          const detailMsgs = errData.details
            .map((d: any) => (typeof d === 'string' ? d : d.message ? `${d.field ? d.field + ': ' : ''}${d.message}` : JSON.stringify(d)))
            .join(', ');
          if (detailMsgs) msg = `${msg}: ${detailMsgs}`;
        }
        setModalErrorMsg(msg);
      }
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    setModalErrorMsg(null);
    const cleanPhone = editForm.phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setModalErrorMsg('Phone number must be exactly 10 digits.');
      return;
    }

    try {
      const updated = await api.updatePatient(selectedPatient.id, editForm);
      setSelectedPatient(updated);
      setShowEditModal(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      const errData = err.response?.data?.error;
      if (errData?.code === 'EMAIL_IN_USE_WARNING') {
        const details = errData.details?.[0] || {};
        setEmailConflict({
          existingPatientName: details.existingPatientName || 'another patient',
          email: editForm.email,
          mode: 'edit',
        });
      } else {
        let msg = errData?.message || 'Failed to update patient profile.';
        if (errData?.details && Array.isArray(errData.details) && errData.details.length > 0) {
          const detailMsgs = errData.details
            .map((d: any) => (typeof d === 'string' ? d : d.message ? `${d.field ? d.field + ': ' : ''}${d.message}` : JSON.stringify(d)))
            .join(', ');
          if (detailMsgs) msg = `${msg}: ${detailMsgs}`;
        }
        setModalErrorMsg(msg);
      }
    }
  };

  const handleConfirmEmailSharing = async () => {
    if (!emailConflict) return;
    try {
      if (emailConflict.mode === 'create') {
        await api.createPatient(createForm, { allowEmailSharing: true });
        setShowCreateModal(false);
        setCreateForm({ name: '', phone: '', email: '', dob: '' });
      } else if (emailConflict.mode === 'edit' && selectedPatient) {
        const updated = await api.updatePatient(selectedPatient.id, editForm, { allowEmailSharing: true });
        setSelectedPatient(updated);
        setShowEditModal(false);
      }
      setEmailConflict(null);
      loadData();
    } catch (err: any) {
      console.error(err);
      alert('Failed to save profile after confirming email sharing.');
    }
  };

  const handleUseAnotherEmail = () => {
    if (!emailConflict) return;
    if (emailConflict.mode === 'create') {
      setCreateForm((prev) => ({ ...prev, email: '' }));
    } else if (emailConflict.mode === 'edit') {
      setEditForm((prev) => ({ ...prev, email: '' }));
    }
    setEmailConflict(null);
  };

  const getPatientAppointments = (patient: ApiPatient) => {
    return appointments.filter(
      (a) => a.patientId === patient.id || a.patientPhone === patient.phone
    );
  };

  const getNextAppointment = (patient: ApiPatient) => {
    const apts = getPatientAppointments(patient).filter((a) => a.status !== 'cancelled');
    const future = apts.filter((a) => new Date(`${a.date}T${a.time}`) >= new Date());
    if (future.length === 0) return null;
    future.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
    return future[0];
  };

  const getLastVisit = (patient: ApiPatient) => {
    const apts = getPatientAppointments(patient).filter((a) => a.status === 'completed' || a.status === 'scheduled');
    const past = apts.filter((a) => new Date(`${a.date}T${a.time}`) < new Date());
    if (past.length === 0) return null;
    past.sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
    return past[0];
  };

  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.phone.includes(search) ||
      p.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <p style={{ color: 'var(--text-secondary)', padding: '24px' }}>Loading patient databases...</p>;

  // ── PATIENT DETAIL PROFILE LAYOUT ──
  if (selectedPatient) {
    const patientApts = getPatientAppointments(selectedPatient);
    const nextApt = getNextAppointment(selectedPatient);
    const lastApt = getLastVisit(selectedPatient);

    return (
      <div className="flex flex-col gap-6 w-full">
        {/* Detail Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setSelectedPatient(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              padding: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-secondary)',
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="mb-1">{selectedPatient.name}</h1>
            <p>Review contact files, booking histories, and vocal transcript recordings.</p>
          </div>
        </div>

        {/* Profile Grid Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', alignItems: 'start' }}>
          {/* Left Column: Personal info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Personal File</h3>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setModalErrorMsg(null);
                    setEditForm({
                      name: selectedPatient.name,
                      phone: selectedPatient.phone,
                      email: selectedPatient.email,
                      dob: selectedPatient.dob,
                    });
                    setShowEditModal(true);
                  }}
                  style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Edit2 size={12} />
                  <span>Edit</span>
                </Button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <User size={16} style={{ color: 'var(--text-muted)' }} />
                  <div>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Name</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{selectedPatient.name}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Phone size={16} style={{ color: 'var(--text-muted)' }} />
                  <div>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Phone</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{selectedPatient.phone}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Mail size={16} style={{ color: 'var(--text-muted)' }} />
                  <div>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Email</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{selectedPatient.email || 'No email registered'}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
                  <div>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Date of Birth</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{selectedPatient.dob || 'Not provided'}</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Overview Quick Stats */}
            <Card>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>Overview</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.875rem' }}>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>Last Visit:</span>
                  <span style={{ fontWeight: 600 }}>{lastApt ? `${lastApt.date} (${lastApt.time})` : 'Never'}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>Next Slot:</span>
                  <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{nextApt ? `${nextApt.date} (${nextApt.time})` : 'None'}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>AI Call Count:</span>
                  <span style={{ fontWeight: 600 }}>{patientConversations.length}</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: Appointment history and AI transcripts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Appointments Tab Card */}
            <Card>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '16px' }}>Scheduled Appointments</h3>
              {patientApts.length === 0 ? (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>No appointment slots registered for this patient.</p>
              ) : (
                <Table headers={['Date', 'Time Slot', 'Dentist', 'Status']}>
                  {patientApts.map((a) => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600 }}>{a.date}</td>
                      <td>{a.time}</td>
                      <td>{a.doctorName}</td>
                      <td>
                        <Badge
                          variant={
                            a.status === 'scheduled'
                              ? 'success'
                              : a.status === 'rescheduled'
                              ? 'primary'
                              : a.status === 'pending'
                              ? 'warning'
                              : 'danger'
                          }
                        >
                          {a.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </Table>
              )}
            </Card>

            {/* AI Calls History */}
            <Card>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '16px' }}>AI Receptionist Calls</h3>
              {loadingConversations ? (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Syncing voice stream data...</p>
              ) : patientConversations.length === 0 ? (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>No AI interactions recorded for this patient.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {patientConversations.map((c) => {
                    const callTime = c.startedAt ? new Date(c.startedAt).toLocaleString() : 'Unknown';
                    return (
                      <div
                        key={c.id}
                        style={{
                          padding: '16px',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius)',
                          backgroundColor: 'var(--bg-secondary)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <div className="flex justify-between items-center w-full">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{callTime}</span>
                          </div>
                          <Badge variant={c.status === 'completed' ? 'success' : 'warning'}>{c.status}</Badge>
                        </div>
                        <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                          <strong>Intent resolved: </strong> {c.summary?.text || c.intent || 'No intent resolved'}
                        </div>
                        {Array.isArray(c.transcript) && c.transcript.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedConversation(c);
                              setShowTranscriptModal(true);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--primary)',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              textAlign: 'left',
                              padding: 0,
                              marginTop: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <MessageSquare size={12} />
                            <span>View Call Transcript</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* ── EDIT PATIENT DETAILS MODAL ── */}
        <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Patient File">
          <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {modalErrorMsg && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid var(--error, #ef4444)',
                  borderRadius: 'var(--radius)',
                  color: '#f87171',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                }}
              >
                {modalErrorMsg}
              </div>
            )}
            <Input
              label="Full Name"
              required
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
            <Input
              label="Phone Number (10 digits)"
              required
              placeholder="9876543210"
              maxLength={10}
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
            />
            <Input
              type="email"
              label="Email Address"
              required
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            />
            <Input
              type="date"
              label="Date of Birth"
              required
              value={editForm.dob}
              onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })}
            />
            <Button type="submit" style={{ marginTop: '8px' }}>
              Save Profile Changes
            </Button>
          </form>
        </Modal>

        {/* ── VOCAL TRANSCRIPT MODAL ── */}
        <Modal isOpen={showTranscriptModal} onClose={() => setShowTranscriptModal(false)} title="Vocal Call Dialogue Trace">
          {selectedConversation && (
            <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '8px' }}>
              {selectedConversation.transcript.map((t: any, index: number) => {
                const isAI = t.speaker?.toLowerCase().includes('ai') || t.speaker?.toLowerCase().includes('assistant');
                return (
                  <div
                    key={index}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius)',
                      maxWidth: '85%',
                      alignSelf: isAI ? 'flex-start' : 'flex-end',
                      backgroundColor: isAI ? 'var(--bg-secondary)' : 'var(--primary-light)',
                      border: isAI ? '1px solid var(--border-color)' : '1px solid var(--primary-light)',
                      color: isAI ? 'var(--text-primary)' : 'var(--primary)',
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                      {isAI ? 'AI RECEPTIONIST' : 'PATIENT'}
                    </div>
                    <div style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>{t.text}</div>
                  </div>
                );
              })}
            </div>
          )}
        </Modal>
      </div>
    );
  }

  // ── PATIENTS LIST LAYOUT ──
  return (
    <div className="flex flex-col gap-6 w-full">
      {/* List Header */}
      <div className="flex justify-between items-center w-full flex-wrap gap-4">
        <div>
          <h1 className="mb-2">Patient Registry</h1>
          <p>Search patient contact records and review scheduling files.</p>
        </div>
        <Button
          onClick={() => {
            setModalErrorMsg(null);
            setCreateForm({ name: '', phone: '', email: '', dob: '' });
            setShowCreateModal(true);
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={16} />
          <span>Add Patient</span>
        </Button>
      </div>

      {/* Error Info Alert */}
      {errorMsg && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--error-light)',
            color: 'var(--error)',
            borderRadius: 'var(--radius)',
            fontSize: '0.875rem',
            border: '1px solid var(--error)',
            maxWidth: '1000px',
          }}
          role="alert"
        >
          {errorMsg}
        </div>
      )}

      {/* Filter and Search Bar */}
      <Card style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Search size={18} style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="Filter patients by name, phone, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input"
          style={{ border: 'none', padding: '4px', fontSize: '0.9rem', width: '100%', outline: 'none', background: 'transparent' }}
        />
      </Card>

      {/* Patient Database Table */}
      {filteredPatients.length === 0 ? (
        <Card style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <User size={48} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
          <h3>No patients found</h3>
          <p style={{ fontSize: '0.875rem', marginTop: '6px', marginBottom: '16px' }}>
            Get started by registering a patient profile.
          </p>
          <Button onClick={() => setShowCreateModal(true)}>Add Patient</Button>
        </Card>
      ) : (
        <Table headers={['Patient Name', 'Phone Number', 'Email Address', 'Date of Birth', 'Actions']}>
          {filteredPatients.map((p) => (
            <tr key={p.id}>
              <td style={{ fontWeight: 600 }}>{p.name}</td>
              <td>{p.phone}</td>
              <td style={{ color: 'var(--text-secondary)' }}>{p.email || 'No email registered'}</td>
              <td>{p.dob || 'Not provided'}</td>
              <td>
                <Button
                  variant="secondary"
                  onClick={() => handleSelectPatient(p)}
                  style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Activity size={12} />
                  <span>View Profile</span>
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      )}

      {/* ── CREATE PATIENT MODAL ── */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Register Patient Profile">
        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {modalErrorMsg && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid var(--error, #ef4444)',
                borderRadius: 'var(--radius)',
                color: '#f87171',
                fontSize: '0.85rem',
                fontWeight: 500,
              }}
            >
              {modalErrorMsg}
            </div>
          )}
          <Input
            label="Full Name"
            required
            value={createForm.name}
            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
          />
          <Input
            label="Phone Number (10 digits)"
            required
            placeholder="9876543210"
            maxLength={10}
            value={createForm.phone}
            onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
          />
          <Input
            type="email"
            label="Email Address"
            required
            value={createForm.email}
            onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
          />
          <Input
            type="date"
            label="Date of Birth"
            required
            value={createForm.dob}
            onChange={(e) => setCreateForm({ ...createForm, dob: e.target.value })}
          />
          <Button type="submit" style={{ marginTop: '8px' }}>
            Save Patient Profile
          </Button>
        </form>
      </Modal>

      {/* ── EMAIL CONFLICT CONFIRMATION MODAL ── */}
      <Modal
        isOpen={!!emailConflict}
        onClose={() => setEmailConflict(null)}
        title="Email Address Warning"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid var(--warning, #f59e0b)',
              borderRadius: 'var(--radius)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              color: 'var(--text-primary)',
            }}
          >
            <AlertTriangle size={22} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.875rem' }}>
              <p style={{ fontWeight: 600, margin: '0 0 4px', color: 'var(--text-primary)' }}>
                Email Already Associated With Another Person
              </p>
              <p style={{ margin: 0, lineHeight: 1.4, color: 'var(--text-secondary)' }}>
                The email <strong style={{ color: 'var(--text-primary)' }}>{emailConflict?.email}</strong> is already registered under patient:{' '}
                <strong style={{ color: 'var(--primary)' }}>{emailConflict?.existingPatientName}</strong>.
              </p>
            </div>
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            Family members or relatives frequently share the same email address. Would you like to use this email for this patient as well without overwriting any existing records?
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
            <Button
              variant="secondary"
              type="button"
              onClick={() => setEmailConflict(null)}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              type="button"
              onClick={handleUseAnotherEmail}
            >
              Continue with another email
            </Button>
            <Button
              type="button"
              onClick={handleConfirmEmailSharing}
            >
              Continue Anyway
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
