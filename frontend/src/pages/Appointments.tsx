import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Table } from '../components/ui/Table';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { api, type ApiAppointment, type ApiDoctor, type ApiPatient } from '../services/api';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  RefreshCw,
  Search,
  User,
  Phone,
  Check,
  Play,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';

import { appointmentCoordinator } from '../services/AppointmentRequestCoordinator';
import { availabilityBus } from '../services/availabilityBus';

export const Appointments: React.FC = () => {
  const [appointments, setAppointments] = useState<ApiAppointment[]>([]);
  const [doctors, setDoctors] = useState<ApiDoctor[]>([]);
  const [patients, setPatients] = useState<ApiPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters, Search & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<ApiAppointment | null>(null);

  // Booking Form state
  const [bookingType, setBookingType] = useState<'existing' | 'new'>('existing');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [newPatientForm, setNewPatientForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    dob: '',
  });
  const [bookingEmailConflict, setBookingEmailConflict] = useState<{
    existingPatientName: string;
    email: string;
  } | null>(null);
  const [bookingDoctorId, setBookingDoctorId] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('09:00');
  const [appointmentType, setAppointmentType] = useState('checkup');
  const [durationMinutes, setDurationMinutes] = useState(30);

  // Dynamic Doctor Availability Slots state
  const [availableSlots, setAvailableSlots] = useState<Array<{ time: string; endTime: string; available: boolean; reason?: string }>>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);

  // Reschedule & Cancel state
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('09:00');
  const [rescheduleDuration, setRescheduleDuration] = useState(30);
  const [rescheduleAvailableSlots, setRescheduleAvailableSlots] = useState<Array<{ time: string; endTime: string; available: boolean; reason?: string; reasonCode?: string }>>([]);
  const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState<boolean>(false);
  const [availabilityRefreshKey, setAvailabilityRefreshKey] = useState<number>(0);
  const [cancellationReason, setCancellationReason] = useState('');
  const [createErrorMsg, setCreateErrorMsg] = useState<string | null>(null);
  const [rescheduleErrorMsg, setRescheduleErrorMsg] = useState<string | null>(null);

  // Doctor Schedule Modal state
  const [selectedScheduleDoctorId, setSelectedScheduleDoctorId] = useState('');
  const [doctorWorkingHours, setDoctorWorkingHours] = useState<
    Array<{ dayOfWeek: number; openTime?: string; closeTime?: string; startTime: string; endTime: string; breakStart?: string; breakEnd?: string; isClosed: boolean }>
  >([]);

  // Debounce search query changes (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // ---------------------------------------------------------------------------
  // Load All Data via Coordinator
  // ---------------------------------------------------------------------------
  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [res, docsRes, patsRes] = await Promise.all([
        appointmentCoordinator.fetchAppointments({
          page,
          limit: 20,
          search: debouncedSearch,
          status: statusFilter,
        }),
        api.getDoctors(),
        api.getPatients(),
      ]);

      setAppointments(res.appointments);
      setTotalPages(res.pagination.totalPages);
      setTotalItems(res.pagination.total);
      setDoctors(docsRes);
      setPatients(patsRes);

      if (docsRes.length > 0) {
        if (!bookingDoctorId) setBookingDoctorId(docsRes[0].id);
        if (!selectedScheduleDoctorId) setSelectedScheduleDoctorId(docsRes[0].id);
      }
      if (patsRes.length > 0 && !selectedPatientId) {
        setSelectedPatientId(patsRes[0].id);
      }
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      console.error('Failed to load appointments data:', err);
      setErrorMsg(err.message || 'Failed to sync appointment data from server.');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Dynamic Doctor Availability Slots Fetcher
  useEffect(() => {
    if (!bookingDoctorId || !bookingDate || !showCreateModal) return;
    let isCancelled = false;
    async function fetchAvailability() {
      setLoadingSlots(true);
      try {
        const res = await api.getAvailability({
          doctorId: bookingDoctorId,
          date: bookingDate,
          durationMinutes,
          appointmentType,
        });
        if (!isCancelled && res && Array.isArray(res.slots)) {
          setAvailableSlots(res.slots);
          const isCurrentAvailable = res.slots.some((s: any) => s.time === bookingTime && s.available);
          if (!isCurrentAvailable) {
            const firstOpen = res.slots.find((s: any) => s.available);
            if (firstOpen) {
              setBookingTime(firstOpen.time);
            }
          }
        }
      } catch (err) {
        console.warn('Could not fetch doctor availability slots:', err);
        setAvailableSlots([]);
      } finally {
        if (!isCancelled) setLoadingSlots(false);
      }
    }
    fetchAvailability();
    return () => { isCancelled = true; };
  }, [bookingDoctorId, bookingDate, durationMinutes, appointmentType, showCreateModal, availabilityRefreshKey]);

  // Dynamic Doctor Availability Slots Fetcher for Reschedule
  useEffect(() => {
    const doc = (selectedAppointment?.doctorId ? doctors.find((d) => d.id === selectedAppointment.doctorId) : null) ||
      (selectedAppointment?.doctorName ? doctors.find((d) => d.name && d.name.toLowerCase() === selectedAppointment.doctorName.toLowerCase()) : null);
    const docId = selectedAppointment?.doctorId || doc?.id;
    if (!docId || !rescheduleDate || !showRescheduleModal) return;
    let isCancelled = false;
    async function fetchRescheduleSlots() {
      setLoadingRescheduleSlots(true);
      try {
        const res = await api.getAvailability({
          doctorId: String(docId),
          date: rescheduleDate,
          durationMinutes: rescheduleDuration,
          excludeAppointmentId: selectedAppointment?.id,
        });
        if (!isCancelled && res && Array.isArray(res.slots)) {
          setRescheduleAvailableSlots(res.slots);
          const isCurrentAvailable = res.slots.some((s: any) => s.time === rescheduleTime && s.available);
          if (!isCurrentAvailable) {
            const firstOpen = res.slots.find((s: any) => s.available);
            if (firstOpen) {
              setRescheduleTime(firstOpen.time);
            }
          }
        }
      } catch (err) {
        console.warn('Could not fetch reschedule availability slots:', err);
        setRescheduleAvailableSlots([]);
      } finally {
        if (!isCancelled) setLoadingRescheduleSlots(false);
      }
    }
    fetchRescheduleSlots();
    return () => {
      isCancelled = true;
    };
  }, [selectedAppointment, rescheduleDate, rescheduleDuration, showRescheduleModal, availabilityRefreshKey]);

  // Subscribe to real-time availabilityBus invalidation events
  useEffect(() => {
    return availabilityBus.subscribe(() => {
      setAvailabilityRefreshKey((prev) => prev + 1);
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Doctor Schedule Hydration
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!selectedScheduleDoctorId) return;
    const doc = doctors.find((d) => d.id === selectedScheduleDoctorId);
    let hoursArray: any[] = [];

    if (doc && doc.workingHours) {
      if (Array.isArray(doc.workingHours)) {
        hoursArray = doc.workingHours;
      } else if (typeof doc.workingHours === 'string') {
        try {
          const parsed = JSON.parse(doc.workingHours);
          if (Array.isArray(parsed)) hoursArray = parsed;
        } catch (e) {
          hoursArray = [];
        }
      }
    }

    if (hoursArray.length > 0) {
      const normalized = hoursArray.map((h: any) => ({
        dayOfWeek: typeof h.dayOfWeek === 'number' ? h.dayOfWeek : 0,
        openTime: h.openTime || h.startTime || '09:00',
        closeTime: h.closeTime || h.endTime || '17:00',
        startTime: h.startTime || h.openTime || '09:00',
        endTime: h.endTime || h.closeTime || '17:00',
        breakStart: h.breakStart || '12:00',
        breakEnd: h.breakEnd || '13:00',
        isClosed: Boolean(h.isClosed),
      }));
      setDoctorWorkingHours(normalized);
    } else {
      const days = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
        dayOfWeek: d,
        openTime: '09:00',
        closeTime: '17:00',
        startTime: '09:00',
        endTime: '17:00',
        breakStart: '12:00',
        breakEnd: '13:00',
        isClosed: d === 0 || d === 6,
      }));
      setDoctorWorkingHours(days);
    }
  }, [selectedScheduleDoctorId, doctors]);

  // ---------------------------------------------------------------------------
  // Reset Form
  // ---------------------------------------------------------------------------
  const resetBookingForm = () => {
    setBookingType('existing');
    if (patients.length > 0) setSelectedPatientId(patients[0].id);
    setNewPatientForm({ firstName: '', lastName: '', phone: '', email: '', dob: '' });
    if (doctors.length > 0) setBookingDoctorId(doctors[0].id);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0] || '';
    setBookingDate(dateStr);
    setBookingTime('09:00');
    setAppointmentType('checkup');
    setDurationMinutes(30);
    setErrorMsg(null);
    setCreateErrorMsg(null);
    setBookingEmailConflict(null);
  };

  // ---------------------------------------------------------------------------
  // Handlers: Book Appointment
  // ---------------------------------------------------------------------------
  const handleBookAppointment = async (e: React.FormEvent, allowEmailSharing = false) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setCreateErrorMsg(null);
    setBookingEmailConflict(null);

    try {
      let patient: { id?: string; name: string; phone: string };

      if (bookingType === 'existing') {
        const found = patients.find((p) => p.id === selectedPatientId);
        if (!found) throw new Error('Please select a valid patient.');
        patient = { id: found.id, name: found.name, phone: found.phone };
      } else {
        if (!newPatientForm.firstName) {
          throw new Error('Patient First Name is required.');
        }
        const cleanPhone = (newPatientForm.phone || '').replace(/\D/g, '');
        if (cleanPhone.length !== 10) {
          throw new Error('Phone number must be exactly 10 digits.');
        }
        const fullName = `${newPatientForm.firstName} ${newPatientForm.lastName}`.trim();
        try {
          const createdPat = await api.createPatient(
            {
              name: fullName,
              phone: newPatientForm.phone,
              email: newPatientForm.email || '',
              dob: newPatientForm.dob || '',
            },
            { allowEmailSharing }
          );
          patient = { id: createdPat.id, name: createdPat.name, phone: createdPat.phone };
        } catch (err: any) {
          const errData = err.response?.data?.error;
          if (errData?.code === 'EMAIL_IN_USE_WARNING') {
            const details = errData.details?.[0] || {};
            setBookingEmailConflict({
              existingPatientName: details.existingPatientName || 'another patient',
              email: newPatientForm.email,
            });
            return;
          }
          throw err;
        }
      }

      const doctor = doctors.find((d) => d.id === bookingDoctorId);
      if (!doctor) throw new Error('Selected doctor could not be resolved.');

      await api.createAppointment({
        patientName: patient.name,
        patientPhone: patient.phone,
        doctorName: doctor.name,
        date: bookingDate,
        time: bookingTime,
        status: 'scheduled',
        appointmentType,
        durationMinutes,
      });

      setShowCreateModal(false);
      resetBookingForm();
      setBookingEmailConflict(null);
      appointmentCoordinator.invalidateCache();
      await loadData();
    } catch (err: any) {
      console.error('Booking failed:', err);
      const errData = err.response?.data?.error;
      let msg = errData?.message || err.message || 'Scheduling conflict or validation error. Please select another time slot.';
      if (errData?.details && Array.isArray(errData.details) && errData.details.length > 0) {
        const detailMsgs = errData.details
          .map((d: any) => (typeof d === 'string' ? d : d.message ? `${d.field ? d.field + ': ' : ''}${d.message}` : JSON.stringify(d)))
          .join(', ');
        if (detailMsgs) msg = `${msg}: ${detailMsgs}`;
      }
      setCreateErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Handlers: Status Transitions (with optimistic updates)
  // ---------------------------------------------------------------------------
  const handleStatusTransition = async (apt: ApiAppointment, targetStatus: string) => {
    // Optimistic update — reflect change in UI immediately before API call
    setAppointments((prev) =>
      prev.map((a) => (a.id === apt.id ? { ...a, status: targetStatus as any } : a))
    );
    try {
      if (targetStatus === 'confirmed') {
        await api.confirmAppointment(apt.id);
      } else if (targetStatus === 'completed') {
        await api.completeAppointment(apt.id);
      } else {
        await api.updateAppointment(apt.id, { status: targetStatus as any });
      }
      appointmentCoordinator.invalidateCache();
      // Background refresh — don't await so UI stays responsive
      loadData();
    } catch (err: any) {
      // Revert optimistic update on failure
      setAppointments((prev) =>
        prev.map((a) => (a.id === apt.id ? { ...a, status: apt.status } : a))
      );
      console.error(`Failed transition to ${targetStatus}:`, err);
      alert('Status update failed: ' + (err.response?.data?.error?.message || err.message));
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppointment) return;
    setSubmitting(true);
    setRescheduleErrorMsg(null);
    try {
      await api.rescheduleAppointment(selectedAppointment.id, rescheduleDate, rescheduleTime, rescheduleDuration);
      setShowRescheduleModal(false);
      setSelectedAppointment(null);
      appointmentCoordinator.invalidateCache();
      loadData(); // background refresh — don't await
    } catch (err: any) {
      console.error('Reschedule failed:', err);
      const msg = err.response?.data?.error?.message || err.message || 'Reschedule failed';
      setRescheduleErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppointment) return;
    setSubmitting(true);
    // Optimistic: hide cancelled appointment immediately
    const cancelledId = selectedAppointment.id;
    setAppointments((prev) =>
      prev.map((a) => (a.id === cancelledId ? { ...a, status: 'cancelled' as any } : a))
    );
    setShowCancelModal(false);
    setSelectedAppointment(null);
    try {
      await api.cancelAppointment(cancelledId, cancellationReason);
      appointmentCoordinator.invalidateCache();
      loadData(); // background refresh
    } catch (err: any) {
      // Revert optimistic on failure
      setAppointments((prev) =>
        prev.map((a) => (a.id === cancelledId ? { ...a, status: selectedAppointment.status } : a))
      );
      setShowCancelModal(true);
      setSelectedAppointment(selectedAppointment);
      console.error('Cancel failed:', err);
      alert('Cancel failed: ' + (err.response?.data?.error?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveWorkingHours = async () => {
    if (!selectedScheduleDoctorId) return;
    setSubmitting(true);
    try {
      await api.updateDoctorWorkingHours(selectedScheduleDoctorId, doctorWorkingHours);
      alert('Doctor schedule saved successfully to database!');
      setShowScheduleModal(false);
      await loadData();
    } catch (err: any) {
      console.error('Save working hours failed:', err);
      alert('Failed to save working hours: ' + (err.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Appointments List (Server-filtered and paginated)
  // ---------------------------------------------------------------------------
  const filteredAppointments = useMemo(() => appointments, [appointments]);

  // ---------------------------------------------------------------------------
  // Status Badge Mapper
  // ---------------------------------------------------------------------------
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="primary">Scheduled</Badge>;
      case 'confirmed':
        return <Badge variant="success">Confirmed</Badge>;
      case 'checked_in':
        return <Badge variant="warning">Checked In</Badge>;
      case 'in_progress':
        return <Badge variant="primary">In Progress</Badge>;
      case 'completed':
        return <Badge variant="success">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="danger">Cancelled</Badge>;
      case 'no_show':
        return <Badge variant="danger">No Show</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Enterprise Appointment Scheduling
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>
            Multi-clinic booking, real-time doctor availability engine, & atomic double-booking protection.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            onClick={() => {
              if (doctors.length > 0) setSelectedScheduleDoctorId(doctors[0].id);
              setShowScheduleModal(true);
            }}
          >
            <Clock size={16} style={{ marginRight: '8px' }} />
            Doctor Hours & Schedule
          </Button>

          <Button variant="secondary" onClick={() => loadData()} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} style={{ marginRight: '8px' }} />
            Sync Database
          </Button>

          <Button
            variant="primary"
            onClick={() => {
              resetBookingForm();
              setShowCreateModal(true);
            }}
          >
            <Plus size={16} style={{ marginRight: '8px' }} />
            Book New Appointment
          </Button>
        </div>
      </div>

      {errorMsg && (
        <div
          style={{
            padding: '14px 18px',
            backgroundColor: 'var(--error-light)',
            border: '1px solid var(--error)',
            borderRadius: '8px',
            color: 'var(--error)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '14px',
          }}
        >
          <AlertCircle size={18} color="var(--error)" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Control Bar: Search & Status Filters */}
      <Card style={{ padding: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '280px', display: 'flex', alignItems: 'center' }}>
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: '14px',
                zIndex: 2,
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              className="input"
              placeholder="Search by Patient Name, Phone, Doctor, or Date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                paddingLeft: '42px',
                width: '100%',
                height: '42px',
                marginBottom: 0,
                borderRadius: '8px',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Status:</span>
            {['all', 'scheduled', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled'].map((statusKey) => (
              <button
                key={statusKey}
                onClick={() => setStatusFilter(statusKey)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: 500,
                  border: statusFilter === statusKey ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                  backgroundColor: statusFilter === statusKey ? 'var(--primary)' : 'var(--bg-secondary)',
                  color: statusFilter === statusKey ? '#ffffff' : 'var(--text-primary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textTransform: 'capitalize',
                }}
              >
                {statusKey.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Appointments List Table */}
      <Card style={{ padding: 0, overflowX: 'auto' }}>
        <Table headers={['Patient Details', 'Assigned Doctor', 'Date & Time', 'Type', 'Status', 'Actions']}>
          {filteredAppointments.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                No scheduled appointments found matching your criteria.
              </td>
            </tr>
          ) : (
            filteredAppointments.map((apt) => (
              <tr key={apt.id}>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {apt.patientName || 'Patient'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Phone size={12} /> {apt.patientPhone || 'No Phone'}
                  </div>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <User size={16} color="var(--primary)" />
                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                      {apt.doctorName || 'Doctor'}
                    </span>
                  </div>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <div>
                    <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                      <CalendarIcon size={14} color="var(--text-muted)" /> {apt.date}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={12} /> {apt.time} ({apt.durationMinutes || 30} mins)
                    </div>
                  </div>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      textTransform: 'capitalize',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      display: 'inline-block',
                    }}
                  >
                    {apt.appointmentType || 'checkup'}
                  </span>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>{renderStatusBadge(apt.status)}</td>
                <td style={{ whiteSpace: 'nowrap', minWidth: '320px' }}>
                  {/* Single Row Actions Flex Container */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'nowrap', alignItems: 'center' }}>
                    {(apt.status === 'scheduled' || apt.status === 'pending') && (
                      <Button
                        variant="secondary"
                        onClick={() => handleStatusTransition(apt, 'confirmed')}
                        title="Confirm Appointment"
                        style={{
                          backgroundColor: 'var(--success-light)',
                          color: 'var(--success)',
                          borderColor: 'var(--success)',
                          fontWeight: 600,
                          fontSize: '13px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <Check size={14} style={{ marginRight: '4px' }} /> Confirm
                      </Button>
                    )}

                    {apt.status === 'confirmed' && (
                      <Button
                        variant="secondary"
                        onClick={() => handleStatusTransition(apt, 'checked_in')}
                        title="Check-In Patient"
                        style={{
                          backgroundColor: 'var(--warning-light)',
                          color: 'var(--warning)',
                          borderColor: 'var(--warning)',
                          fontWeight: 600,
                          fontSize: '13px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Check In
                      </Button>
                    )}

                    {apt.status === 'checked_in' && (
                      <Button
                        variant="primary"
                        onClick={() => handleStatusTransition(apt, 'in_progress')}
                        title="Start Consultation"
                        style={{
                          fontWeight: 600,
                          fontSize: '13px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <Play size={14} style={{ marginRight: '4px' }} /> Start
                      </Button>
                    )}

                    {(apt.status === 'in_progress' || apt.status === 'confirmed') && (
                      <Button
                        variant="secondary"
                        onClick={() => handleStatusTransition(apt, 'completed')}
                        title="Mark Completed"
                        style={{
                          backgroundColor: 'var(--success-light)',
                          color: 'var(--success)',
                          borderColor: 'var(--success)',
                          fontWeight: 600,
                          fontSize: '13px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <CheckCircle2 size={14} style={{ marginRight: '4px' }} /> Complete
                      </Button>
                    )}

                    {apt.status !== 'completed' && apt.status !== 'cancelled' && (
                      <>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setSelectedAppointment(apt);
                            setRescheduleDate(apt.date);
                            setRescheduleTime(apt.time);
                            setRescheduleDuration(apt.durationMinutes || 30);
                            setShowRescheduleModal(true);
                          }}
                          style={{
                            backgroundColor: 'var(--bg-tertiary)',
                            color: 'var(--text-primary)',
                            borderColor: 'var(--border-color)',
                            fontWeight: 500,
                            fontSize: '13px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Reschedule
                        </Button>

                        <Button
                          variant="danger"
                          onClick={() => {
                            setSelectedAppointment(apt);
                            setCancellationReason('');
                            setShowCancelModal(true);
                          }}
                          style={{
                            backgroundColor: 'var(--error-light)',
                            color: 'var(--error)',
                            borderColor: 'var(--error)',
                            fontWeight: 600,
                            fontSize: '13px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </Table>

        {totalPages > 1 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderTop: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-secondary)',
            }}
          >
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Showing {appointments.length} of {totalItems} appointments (Page {page} of {totalPages})
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{ fontSize: '13px', padding: '6px 12px' }}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={{ fontSize: '13px', padding: '6px 12px' }}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Book New Appointment Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Book Enterprise Patient Appointment"
        maxWidth="680px"
      >
        <form onSubmit={handleBookAppointment} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {createErrorMsg && !bookingEmailConflict && (
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid var(--error, #ef4444)',
                borderRadius: '8px',
                color: '#f87171',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              <AlertCircle size={16} color="#f87171" style={{ flexShrink: 0 }} />
              <span>{createErrorMsg}</span>
            </div>
          )}

          {bookingEmailConflict && (
            <div
              style={{
                padding: '14px 16px',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid var(--warning, #f59e0b)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                fontSize: '13px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <AlertTriangle size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <p style={{ fontWeight: 600, margin: '0 0 4px', color: 'var(--text-primary)' }}>
                    Email Already Associated With Another Person
                  </p>
                  <p style={{ margin: 0, lineHeight: 1.4, color: 'var(--text-secondary)' }}>
                    The email <strong style={{ color: 'var(--text-primary)' }}>{bookingEmailConflict.email}</strong> is already registered under patient:{' '}
                    <strong style={{ color: 'var(--primary)' }}>{bookingEmailConflict.existingPatientName}</strong>.
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <Button
                  type="button"
                  variant="secondary"
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                  onClick={() => {
                    setNewPatientForm((prev) => ({ ...prev, email: '' }));
                    setBookingEmailConflict(null);
                  }}
                >
                  Continue with another email
                </Button>
                <Button
                  type="button"
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                  onClick={(e) => handleBookAppointment(e as any, true)}
                >
                  Continue Anyway
                </Button>
              </div>
            </div>
          )}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
              Patient Record
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setBookingType('existing')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 500,
                  border: bookingType === 'existing' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                  backgroundColor: bookingType === 'existing' ? 'var(--primary-light)' : 'var(--bg-secondary)',
                  color: bookingType === 'existing' ? 'var(--primary)' : 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                Select Existing Patient
              </button>
              <button
                type="button"
                onClick={() => setBookingType('new')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 500,
                  border: bookingType === 'new' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                  backgroundColor: bookingType === 'new' ? 'var(--primary-light)' : 'var(--bg-secondary)',
                  color: bookingType === 'new' ? 'var(--primary)' : 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                + Register New Patient
              </button>
            </div>
          </div>

          {bookingType === 'existing' ? (
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                Choose Patient *
              </label>
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="input"
                required
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.phone})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Input
                  label="First Name *"
                  required
                  value={newPatientForm.firstName}
                  onChange={(e) => setNewPatientForm({ ...newPatientForm, firstName: e.target.value })}
                />
                <Input
                  label="Last Name"
                  value={newPatientForm.lastName}
                  onChange={(e) => setNewPatientForm({ ...newPatientForm, lastName: e.target.value })}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Input
                  label="Primary Phone (10 digits) *"
                  required
                  placeholder="9876543210"
                  maxLength={10}
                  value={newPatientForm.phone}
                  onChange={(e) => setNewPatientForm({ ...newPatientForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                />
                <Input
                  type="date"
                  label="Date of Birth"
                  value={newPatientForm.dob}
                  onChange={(e) => setNewPatientForm({ ...newPatientForm, dob: e.target.value })}
                />
              </div>
              <Input
                type="email"
                label="Email Address"
                value={newPatientForm.email}
                onChange={(e) => setNewPatientForm({ ...newPatientForm, email: e.target.value })}
              />
            </div>
          )}

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
              Assigned Doctor / Practitioner *
            </label>
            <select
              value={bookingDoctorId}
              onChange={(e) => setBookingDoctorId(e.target.value)}
              className="input"
              required
            >
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({(d as any).specialization || 'General Dentistry'})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <Input
                type="date"
                label="Appointment Date *"
                required
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                Appointment Type
              </label>
              <select
                value={appointmentType}
                onChange={(e) => setAppointmentType(e.target.value)}
                className="input"
              >
                <option value="checkup">Regular Checkup</option>
                <option value="consultation">Initial Consultation</option>
                <option value="emergency">Emergency / Toothache</option>
                <option value="whitening">Teeth Whitening</option>
                <option value="root_canal">Root Canal Procedure</option>
                <option value="orthodontics">Orthodontic Adjustment</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                Duration (Minutes) *
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="input"
              >
                <option value={15}>15 Minutes</option>
                <option value={30}>30 Minutes</option>
                <option value={45}>45 Minutes</option>
                <option value={60}>60 Minutes (1 Hour)</option>
                <option value={90}>90 Minutes (1.5 Hours)</option>
                <option value={120}>120 Minutes (2 Hours)</option>
              </select>
            </div>
          </div>

          {/* Dynamic Practitioner Availability Time Slots */}
          {bookingDoctorId && bookingDate && (
            <div style={{ marginTop: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Practitioner Available Time Slots</span>
                {loadingSlots && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Checking schedule...</span>}
              </label>

              {availableSlots.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', maxHeight: '160px', overflowY: 'auto', padding: '4px' }}>
                  {availableSlots.map((slot) => {
                    const isSelected = bookingTime === slot.time;
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        disabled={!slot.available}
                        title={slot.available ? `Available slot (${slot.time} - ${slot.endTime})` : `Unavailable: ${slot.reason || 'Already booked or outside working hours'}`}
                        onClick={() => setBookingTime(slot.time)}
                        style={{
                          padding: '6px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: isSelected ? 600 : 400,
                          border: isSelected
                            ? '1.5px solid var(--primary)'
                            : slot.available
                            ? '1px solid var(--border-color)'
                            : '1px solid transparent',
                          backgroundColor: isSelected
                            ? 'var(--primary-light, rgba(99, 102, 241, 0.15))'
                            : slot.available
                            ? 'var(--bg-secondary)'
                            : 'var(--bg-tertiary, rgba(255,255,255,0.04))',
                          color: isSelected
                            ? 'var(--primary)'
                            : slot.available
                            ? 'var(--text-primary)'
                            : 'var(--text-muted)',
                          cursor: slot.available ? 'pointer' : 'not-allowed',
                          opacity: slot.available ? 1 : 0.45,
                          textDecoration: slot.available ? 'none' : 'line-through',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {slot.time}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                  {loadingSlots ? 'Loading doctor availability...' : 'No open slots on selected date (Dentist closed or on leave).'}
                </p>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Creating Appointment...' : 'Confirm & Schedule'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reschedule Appointment Modal */}
      <Modal
        isOpen={showRescheduleModal}
        onClose={() => setShowRescheduleModal(false)}
        title="Reschedule Patient Appointment"
      >
        <form onSubmit={handleRescheduleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {rescheduleErrorMsg && (
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid var(--error, #ef4444)',
                borderRadius: '8px',
                color: '#f87171',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              <AlertCircle size={16} color="#f87171" style={{ flexShrink: 0 }} />
              <span>{rescheduleErrorMsg}</span>
            </div>
          )}
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
            Select a new date and time for <strong>{selectedAppointment?.patientName}</strong>'s appointment with{' '}
            <strong>{selectedAppointment?.doctorName}</strong>.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input
              type="date"
              label="New Date *"
              required
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
            />
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                Duration (Minutes) *
              </label>
              <select
                value={rescheduleDuration}
                onChange={(e) => setRescheduleDuration(Number(e.target.value))}
                className="input"
              >
                <option value={15}>15 Minutes</option>
                <option value={30}>30 Minutes</option>
                <option value={45}>45 Minutes</option>
                <option value={60}>60 Minutes (1 Hour)</option>
                <option value={90}>90 Minutes (1.5 Hours)</option>
                <option value={120}>120 Minutes (2 Hours)</option>
              </select>
            </div>
          </div>

          {/* Practitioner Available Time Slots Grid */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
              Practitioner Available Time Slots
            </label>
            {loadingRescheduleSlots ? (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                Loading doctor availability slots...
              </p>
            ) : rescheduleAvailableSlots.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                {rescheduleAvailableSlots.map((slot) => {
                  const isSelected = rescheduleTime === slot.time;
                  return (
                    <button
                      key={slot.time}
                      type="button"
                      disabled={!slot.available}
                      title={slot.available ? `Available slot (${slot.time} - ${slot.endTime})` : `Unavailable: ${slot.reason || 'Already booked or outside working hours'}`}
                      onClick={() => setRescheduleTime(slot.time)}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: isSelected ? 600 : 400,
                        border: isSelected
                          ? '1.5px solid var(--primary)'
                          : slot.available
                          ? '1px solid var(--border-color)'
                          : '1px solid transparent',
                        backgroundColor: isSelected
                          ? 'var(--primary-light, rgba(99, 102, 241, 0.15))'
                          : slot.available
                          ? 'var(--bg-secondary)'
                          : 'var(--bg-tertiary, rgba(255,255,255,0.04))',
                        color: isSelected
                          ? 'var(--primary)'
                          : slot.available
                          ? 'var(--text-primary)'
                          : 'var(--text-muted)',
                        cursor: slot.available ? 'pointer' : 'not-allowed',
                        opacity: slot.available ? 1 : 0.45,
                        textDecoration: slot.available ? 'none' : 'line-through',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {slot.time}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                No open slots available on selected date (Practitioner closed or fully booked).
              </p>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <Button type="button" variant="secondary" onClick={() => setShowRescheduleModal(false)}>
              Back
            </Button>
            <Button type="submit" variant="primary" disabled={submitting || !rescheduleTime}>
              {submitting ? 'Updating...' : 'Confirm Reschedule'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Cancel Appointment Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Appointment"
      >
        <form onSubmit={handleCancelSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
            Are you sure you want to cancel appointment for <strong>{selectedAppointment?.patientName}</strong>?
          </p>

          <Input
            label="Cancellation Reason (Optional)"
            placeholder="Patient requested cancellation, illness, etc."
            value={cancellationReason}
            onChange={(e) => setCancellationReason(e.target.value)}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <Button type="button" variant="secondary" onClick={() => setShowCancelModal(false)}>
              Keep Appointment
            </Button>
            <Button type="submit" variant="danger" disabled={submitting}>
              {submitting ? 'Cancelling...' : 'Confirm Cancellation'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Doctor Working Hours & Schedule Modal */}
      <Modal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        title="Doctor Working Hours & Schedule Settings"
        maxWidth="720px"
        hideFooterCancel
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
              Select Practitioner
            </label>
            <select
              value={selectedScheduleDoctorId}
              onChange={(e) => setSelectedScheduleDoctorId(e.target.value)}
              className="input"
            >
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({(d as any).specialization || 'General Dentistry'})
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              maxHeight: '52vh',
              overflowY: 'auto',
              paddingRight: '6px',
            }}
          >
            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((dayName, idx) => {
              const hoursList = Array.isArray(doctorWorkingHours) ? doctorWorkingHours : [];
              const daySchedule = hoursList.find((h) => h && h.dayOfWeek === idx) || {
                dayOfWeek: idx,
                startTime: '09:00',
                endTime: '17:00',
                breakStart: '12:00',
                breakEnd: '13:00',
                isClosed: idx === 0 || idx === 6,
              };

              return (
                <div
                  key={dayName}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '110px' }}>
                    <input
                      type="checkbox"
                      id={`day-${idx}`}
                      checked={!daySchedule.isClosed}
                      onChange={(e) => {
                        const isClosed = !e.target.checked;
                        setDoctorWorkingHours((prev) => {
                          const current = Array.isArray(prev) ? prev : [];
                          const existing = current.filter((item) => item && item.dayOfWeek !== idx);
                          return [...existing, { ...daySchedule, isClosed }].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
                        });
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    <label htmlFor={`day-${idx}`} style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                      {dayName}
                    </label>
                  </div>

                  {!daySchedule.isClosed ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent-color, #4f46e5)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Hours:
                        </span>
                        <input
                          type="time"
                          value={daySchedule.openTime || daySchedule.startTime || '09:00'}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDoctorWorkingHours((prev) => {
                              const current = Array.isArray(prev) ? prev : [];
                              const existing = current.filter((item) => item && item.dayOfWeek !== idx);
                              return [...existing, { ...daySchedule, openTime: val, startTime: val, start: val }].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
                            });
                          }}
                          style={{
                            padding: '3px 6px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                            fontSize: '12px',
                          }}
                        />
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>-</span>
                        <input
                          type="time"
                          value={daySchedule.closeTime || daySchedule.endTime || '17:00'}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDoctorWorkingHours((prev) => {
                              const current = Array.isArray(prev) ? prev : [];
                              const existing = current.filter((item) => item && item.dayOfWeek !== idx);
                              return [...existing, { ...daySchedule, closeTime: val, endTime: val, end: val }].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
                            });
                          }}
                          style={{
                            padding: '3px 6px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                            fontSize: '12px',
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', borderLeft: '1px solid var(--border-color)', paddingLeft: '10px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Lunch:
                        </span>
                        <input
                          type="time"
                          value={daySchedule.breakStart || '12:00'}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDoctorWorkingHours((prev) => {
                              const current = Array.isArray(prev) ? prev : [];
                              const existing = current.filter((item) => item && item.dayOfWeek !== idx);
                              return [...existing, { ...daySchedule, breakStart: val }].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
                            });
                          }}
                          style={{
                            padding: '3px 6px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                            fontSize: '12px',
                          }}
                        />
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>-</span>
                        <input
                          type="time"
                          value={daySchedule.breakEnd || '13:00'}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDoctorWorkingHours((prev) => {
                              const current = Array.isArray(prev) ? prev : [];
                              const existing = current.filter((item) => item && item.dayOfWeek !== idx);
                              return [...existing, { ...daySchedule, breakEnd: val }].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
                            });
                          }}
                          style={{
                            padding: '3px 6px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                            fontSize: '12px',
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', paddingRight: '8px' }}>Off / Closed</span>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <Button type="button" variant="secondary" onClick={() => setShowScheduleModal(false)}>
              Close
            </Button>
            <Button type="button" variant="primary" onClick={handleSaveWorkingHours} disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Schedule Settings'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
