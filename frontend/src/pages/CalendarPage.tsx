import React, { useEffect, useState, useCallback } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { api, type ApiAppointment, type ApiDoctor, type ApiPatient } from '../services/api';
import { availabilityBus } from '../services/availabilityBus';
import { APPOINTMENT_REASONS, getAppointmentReasonLabel } from '../constants/appointmentReasons';
import { BookAppointmentModal } from '../components/BookAppointmentModal';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  User,
  XCircle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

export const CalendarPage: React.FC = () => {
  const [appointments, setAppointments] = useState<ApiAppointment[]>([]);
  const [doctors, setDoctors] = useState<ApiDoctor[]>([]);
  const [patients, setPatients] = useState<ApiPatient[]>([]);
  const [loading, setLoading] = useState(true);

  // Date context
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('all');

  // Modals state
  const [showBookModal, setShowBookModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Targets
  const [selectedAppointment, setSelectedAppointment] = useState<ApiAppointment | null>(null);

  // Booking form states
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<ApiPatient | null>(null);
  const [isNewPatient, setIsNewPatient] = useState(false);
  const [newPatientForm, setNewPatientForm] = useState({ name: '', phone: '', email: '' });
  const [bookingDoctorId, setBookingDoctorId] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [bookingReason, setBookingReason] = useState('routine_checkup');
  const [bookingOtherReason, setBookingOtherReason] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingError, setBookingError] = useState<string | null>(null);

  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [calendarBookSlots, setCalendarBookSlots] = useState<Array<{ time: string; endTime: string; available: boolean; reason?: string; reasonCode?: string }>>([]);
  const [calendarRescheduleSlots, setCalendarRescheduleSlots] = useState<Array<{ time: string; endTime: string; available: boolean; reason?: string; reasonCode?: string }>>([]);
  const [loadingCalendarSlots, setLoadingCalendarSlots] = useState(false);
  const [availabilityRefreshKey, setAvailabilityRefreshKey] = useState(0);

  // Cancel form states
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [apts, docs, pats] = await Promise.all([
        api.getAppointments(),
        api.getDoctors(),
        api.getPatients(),
      ]);
      setAppointments(apts);
      setDoctors(docs);
      setPatients(pats);
      if (docs.length > 0 && !bookingDoctorId) {
        setBookingDoctorId(docs[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [bookingDoctorId]);

  useEffect(() => {
    loadData();

    const handleRevalidate = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };

    window.addEventListener('focus', handleRevalidate);
    document.addEventListener('visibilitychange', handleRevalidate);

    return () => {
      window.removeEventListener('focus', handleRevalidate);
      document.removeEventListener('visibilitychange', handleRevalidate);
    };
  }, [loadData]);

  // Navigate dates
  const handlePrev = () => {
    const nextDate = new Date(currentDate);
    if (view === 'month') {
      nextDate.setMonth(currentDate.getMonth() - 1);
    } else if (view === 'week') {
      nextDate.setDate(currentDate.getDate() - 7);
    } else {
      nextDate.setDate(currentDate.getDate() - 1);
    }
    setCurrentDate(nextDate);
  };

  const handleNext = () => {
    const nextDate = new Date(currentDate);
    if (view === 'month') {
      nextDate.setMonth(currentDate.getMonth() + 1);
    } else if (view === 'week') {
      nextDate.setDate(currentDate.getDate() + 7);
    } else {
      nextDate.setDate(currentDate.getDate() + 1);
    }
    setCurrentDate(nextDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleJumpToDate = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      setCurrentDate(new Date(e.target.value));
    }
  };

  const dNameMatches = (name1: string, name2: string) => {
    return name1.toLowerCase().includes(name2.toLowerCase()) || name2.toLowerCase().includes(name1.toLowerCase());
  };

  // Subscribe to real-time availabilityBus invalidation events
  useEffect(() => {
    return availabilityBus.subscribe(() => {
      setAvailabilityRefreshKey((prev) => prev + 1);
    });
  }, []);

  // Fetch Available Slots for Calendar Booking Modal
  useEffect(() => {
    if (!bookingDoctorId || !bookingDate || !showBookModal) return;
    let isCancelled = false;
    async function fetchBookSlots() {
      setLoadingCalendarSlots(true);
      try {
        const res = await api.getAvailability({
          doctorId: bookingDoctorId,
          date: bookingDate,
          durationMinutes: 30,
        });
        if (!isCancelled && res && Array.isArray(res.slots)) {
          setCalendarBookSlots(res.slots);
          const isCurrentAvailable = res.slots.some((s: any) => s.time === bookingTime && s.available);
          if (!isCurrentAvailable) {
            const firstOpen = res.slots.find((s: any) => s.available);
            if (firstOpen) setBookingTime(firstOpen.time);
          }
        }
      } catch (err) {
        console.warn('Could not fetch calendar booking slots:', err);
        setCalendarBookSlots([]);
      } finally {
        if (!isCancelled) setLoadingCalendarSlots(false);
      }
    }
    fetchBookSlots();
    return () => { isCancelled = true; };
  }, [bookingDoctorId, bookingDate, showBookModal, availabilityRefreshKey]);

  // Fetch Available Slots for Calendar Reschedule Modal
  useEffect(() => {
    const doc = (selectedAppointment?.doctorId ? doctors.find((d) => d.id === selectedAppointment.doctorId) : null) ||
      (selectedAppointment?.doctorName ? doctors.find((d) => dNameMatches(selectedAppointment.doctorName, d.name)) : null);
    const docId = selectedAppointment?.doctorId || doc?.id;
    if (!docId || !rescheduleDate || !showRescheduleModal) return;
    let isCancelled = false;
    async function fetchRescheduleSlots() {
      setLoadingCalendarSlots(true);
      try {
        const res = await api.getAvailability({
          doctorId: String(docId),
          date: rescheduleDate,
          durationMinutes: selectedAppointment?.durationMinutes || 30,
          excludeAppointmentId: selectedAppointment?.id,
        });
        if (!isCancelled && res && Array.isArray(res.slots)) {
          setCalendarRescheduleSlots(res.slots);
          const isCurrentAvailable = res.slots.some((s: any) => s.time === rescheduleTime && s.available);
          if (!isCurrentAvailable) {
            const firstOpen = res.slots.find((s: any) => s.available);
            if (firstOpen) setRescheduleTime(firstOpen.time);
          }
        }
      } catch (err) {
        console.warn('Could not fetch calendar reschedule slots:', err);
        setCalendarRescheduleSlots([]);
      } finally {
        if (!isCancelled) setLoadingCalendarSlots(false);
      }
    }
    fetchRescheduleSlots();
    return () => { isCancelled = true; };
  }, [selectedAppointment, rescheduleDate, showRescheduleModal, availabilityRefreshKey]);

  // Filters appointments based on active dentist selection
  const getFilteredApts = () => {
    return appointments.filter((a) => {
      if (selectedDoctorId === 'all') return true;
      const doctor = doctors.find((d) => d.id === selectedDoctorId);
      return doctor ? dNameMatches(a.doctorName, doctor.name) : true;
    });
  };

  // Confirm pending slot
  const handleConfirmAppointment = async (id: string) => {
    try {
      await api.updateAppointment(id, { status: 'scheduled' });
      setShowDetailModal(false);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to confirm appointment.');
    }
  };

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError(null);

    // Validation
    if (!bookingReason) {
      setBookingError('Please select an appointment reason.');
      return;
    }

    if (bookingReason === 'other' && !bookingOtherReason.trim()) {
      setBookingError('Please specify the reason when selecting "Other".');
      return;
    }

    if (!bookingTime) {
      setBookingError('Please select an available practitioner time slot.');
      return;
    }

    try {
      let patient = selectedPatient;
      if (isNewPatient || !patient) {
        if (!newPatientForm.name.trim() || !newPatientForm.phone.trim()) {
          setBookingError('Patient Name and Phone are required.');
          return;
        }
        patient = await api.createPatient({
          name: newPatientForm.name.trim(),
          phone: newPatientForm.phone.trim(),
          email: newPatientForm.email.trim(),
          dob: '',
        });
      }

      const doctor = doctors.find((d) => d.id === bookingDoctorId);
      if (!doctor) throw new Error('Doctor not selected.');

      await api.createAppointment({
        patientId: patient.id,
        doctorId: doctor.id,
        patientName: patient.name,
        patientPhone: patient.phone,
        doctorName: doctor.name,
        date: bookingDate,
        time: bookingTime,
        status: 'scheduled',
        appointmentType: bookingReason,
        otherReason: bookingReason === 'other' ? bookingOtherReason.trim() : undefined,
        notes: bookingNotes.trim() || undefined,
        durationMinutes: 30,
      });

      setShowBookModal(false);
      resetBookingForm();
      loadData();
    } catch (err: any) {
      console.error('Calendar booking error:', err);
      const errData = err.response?.data?.error;
      const status = err.response?.status;
      if (status === 409 || errData?.code === 'APPOINTMENT_CONFLICT' || errData?.code === 'APPOINTMENT_SLOT_TAKEN') {
        setBookingError('This time slot is no longer available. Please select another available time.');
        availabilityBus.publish();
      } else {
        const msg = errData?.message || err.message || 'Scheduling conflict detected. Please select another slot.';
        setBookingError(msg);
      }
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppointment || !rescheduleDate || !rescheduleTime) return;

    try {
      await api.rescheduleAppointment(selectedAppointment.id, rescheduleDate, rescheduleTime, 30);
      setShowRescheduleModal(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.error?.message || err.message || 'Reschedule conflict detected. Choose a different time.';
      alert(msg);
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppointment) return;

    setCancelling(true);
    try {
      await api.updateAppointment(selectedAppointment.id, {
        status: 'cancelled',
        cancellationReason,
      });
      setShowCancelModal(false);
      setSelectedAppointment(null);
      setCancellationReason('');
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to cancel appointment.');
    } finally {
      setCancelling(false);
    }
  };

  const resetBookingForm = () => {
    setPatientSearch('');
    setSelectedPatient(null);
    setIsNewPatient(false);
    setNewPatientForm({ name: '', phone: '', email: '' });
    setBookingDate('');
    setBookingTime('');
    setBookingReason('routine_checkup');
    setBookingOtherReason('');
    setBookingNotes('');
    setBookingError(null);
  };

  const getStatusColor = (status: ApiAppointment['status']) => {
    switch (status) {
      case 'scheduled':
        return { bg: 'var(--success-light)', text: 'var(--success)', border: '1px solid var(--success)' };
      case 'rescheduled':
        return { bg: 'var(--primary-light)', text: 'var(--primary)', border: '1px solid var(--primary)' };
      case 'pending':
        return { bg: 'var(--warning-light)', text: 'var(--warning)', border: '1px solid var(--warning)' };
      case 'completed':
        return { bg: 'var(--bg-tertiary)', text: 'var(--text-secondary)', border: '1px solid var(--border-color)' };
      default:
        return { bg: 'var(--error-light)', text: 'var(--error)', border: '1px solid var(--error)' };
    }
  };

  // ── RENDER MONTH VIEW ──
  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const blankOffsets = Array.from({ length: firstDayIndex });
    const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const filtered = getFilteredApts();

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
        {blankOffsets.map((_, i) => (
          <div key={`offset-${i}`} style={{ minHeight: '90px', backgroundColor: 'var(--bg-secondary)', opacity: 0.3, borderRadius: 'var(--radius)' }} />
        ))}
        {dayNumbers.map((day) => {
          const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayApts = filtered.filter((a) => a.date === formattedDate && a.status !== 'cancelled');

          return (
            <div
              key={`day-${day}`}
              onClick={() => {
                resetBookingForm();
                setBookingDate(formattedDate);
                setShowBookModal(true);
              }}
              style={{
                minHeight: '100px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius)',
                padding: '6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
            >
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{day}</span>
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexGrow: 1, overflowY: 'auto' }}
                onClick={(e) => e.stopPropagation()}
              >
                {dayApts.map((a) => {
                  const colors = getStatusColor(a.status);
                  return (
                    <div
                      key={a.id}
                      onClick={() => {
                        setSelectedAppointment(a);
                        setShowDetailModal(true);
                      }}
                      style={{
                        fontSize: '0.7rem',
                        backgroundColor: colors.bg,
                        color: colors.text,
                        border: colors.border,
                        padding: '2px 4px',
                        borderRadius: '4px',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {a.time} {a.patientName}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── RENDER WEEK VIEW ──
  const renderWeekView = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return d;
    });

    const hours = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
    const filtered = getFilteredApts();

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(7, 1fr)', gap: '1px', backgroundColor: 'var(--border-color)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '10px', fontWeight: 600, fontSize: '0.75rem', textAlign: 'center' }}>Time</div>
        {days.map((d, i) => (
          <div key={`header-${i}`} style={{ backgroundColor: 'var(--bg-secondary)', padding: '10px', fontWeight: 600, fontSize: '0.75rem', textAlign: 'center' }}>
            {d.toLocaleDateString([], { weekday: 'short', day: 'numeric' })}
          </div>
        ))}

        {/* Hour grids */}
        {hours.map((hour) => (
          <React.Fragment key={`hour-${hour}`}>
            <div style={{ backgroundColor: 'var(--bg-primary)', padding: '10px', fontSize: '0.75rem', textAlign: 'center', fontWeight: 500 }}>
              {hour}
            </div>
            {days.map((day) => {
              const dStr = day.toISOString().split('T')[0];
              const slotApts = filtered.filter((a) => a.date === dStr && a.time.startsWith(hour.split(':')[0]) && a.status !== 'cancelled');

              return (
                <div
                  key={`cell-${dStr}-${hour}`}
                  onClick={() => {
                    resetBookingForm();
                    setBookingDate(dStr);
                    setBookingTime(hour);
                    setShowBookModal(true);
                  }}
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    minHeight: '60px',
                    padding: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    cursor: 'pointer',
                  }}
                >
                  {slotApts.map((a) => {
                    const colors = getStatusColor(a.status);
                    return (
                      <div
                        key={a.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAppointment(a);
                          setShowDetailModal(true);
                        }}
                        style={{
                          fontSize: '0.7rem',
                          backgroundColor: colors.bg,
                          color: colors.text,
                          border: colors.border,
                          padding: '2px 4px',
                          borderRadius: '4px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {a.time} - {a.patientName}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    );
  };

  // ── RENDER DAY VIEW ──
  const renderDayView = () => {
    const dStr = currentDate.toISOString().split('T')[0];
    const hours = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];
    const filtered = getFilteredApts().filter((a) => a.date === dStr && a.status !== 'cancelled');

    return (
      <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        {hours.map((hour) => {
          const hourApts = filtered.filter((a) => a.time === hour);
          return (
            <div
              key={hour}
              onClick={() => {
                resetBookingForm();
                setBookingDate(dStr);
                setBookingTime(hour);
                setShowBookModal(true);
              }}
              style={{
                display: 'grid',
                gridTemplateColumns: '100px 1fr',
                borderBottom: '1px solid var(--border-color)',
                minHeight: '50px',
                cursor: 'pointer',
                backgroundColor: 'var(--bg-primary)',
              }}
            >
              <div style={{ padding: '12px', borderRight: '1px solid var(--border-color)', fontSize: '0.8rem', fontWeight: 600, backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {hour}
              </div>
              <div style={{ padding: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                {hourApts.map((a) => {
                  const colors = getStatusColor(a.status);
                  return (
                    <div
                      key={a.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAppointment(a);
                        setShowDetailModal(true);
                      }}
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.75rem',
                        backgroundColor: colors.bg,
                        color: colors.text,
                        border: colors.border,
                        borderRadius: 'var(--radius)',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {a.patientName} ({a.doctorName})
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const getHeaderTitle = () => {
    if (view === 'month') {
      return currentDate.toLocaleDateString([], { month: 'long', year: 'numeric' });
    } else if (view === 'week') {
      const start = new Date(currentDate);
      start.setDate(currentDate.getDate() - currentDate.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else {
      return currentDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
  };

  const filteredPatients = patientSearch
    ? patients.filter((p) => p.name.toLowerCase().includes(patientSearch.toLowerCase()) || p.phone.includes(patientSearch))
    : [];

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Calendar Filters & View Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="mb-2">Calendar Scheduler</h1>
          <p>Interactive calendar grid visualizer for clinic patient appointments.</p>
        </div>

        {/* Doctor Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Filter Doctor:</span>
          <select
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
            className="input"
            style={{ width: '180px', marginBottom: 0 }}
          >
            <option value="all">All Doctors</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Card>
        {/* Navigation Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button variant="secondary" onClick={handleToday} style={{ padding: '6px 12px' }}>
              Today
            </Button>
            <Button variant="secondary" onClick={handlePrev} style={{ padding: '6px', borderRadius: '50%' }}>
              <ChevronLeft size={16} />
            </Button>
            <Button variant="secondary" onClick={handleNext} style={{ padding: '6px', borderRadius: '50%' }}>
              <ChevronRight size={16} />
            </Button>
            <h2 style={{ fontSize: '1.2rem', marginLeft: '12px', fontWeight: 700 }}>{getHeaderTitle()}</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Jump to Date */}
            <input
              type="date"
              onChange={handleJumpToDate}
              className="input"
              style={{ width: '140px', padding: '6px 8px', fontSize: '0.8rem', marginBottom: 0 }}
            />

            {/* View Selector Tabs */}
            <div style={{ display: 'flex', backgroundColor: 'var(--bg-secondary)', padding: '2px', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
              {['month', 'week', 'day'].map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v as any)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius)',
                    border: 'none',
                    backgroundColor: view === v ? 'var(--bg-primary)' : 'transparent',
                    color: view === v ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: view === v ? 600 : 500,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* View Grid Renderer */}
        {loading ? (
          <p>Syncing calendar scheduler...</p>
        ) : view === 'month' ? (
          renderMonthView()
        ) : view === 'week' ? (
          renderWeekView()
        ) : (
          renderDayView()
        )}
      </Card>

      {/* ── CREATE APPOINTMENT MODAL (UNIFIED STANDARD UI/UX) ── */}
      <BookAppointmentModal
        isOpen={showBookModal}
        onClose={() => setShowBookModal(false)}
        onSuccess={async () => {
          await loadData();
        }}
        initialDate={bookingDate}
        initialTime={bookingTime}
        initialDoctorId={bookingDoctorId}
      />


      {/* ── APPOINTMENT DETAIL ACTION CENTER ── */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="Appointment Details">
        {selectedAppointment && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="flex justify-between">
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Patient Name:</span>
                <span style={{ fontWeight: 600 }}>{selectedAppointment.patientName}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Contact Phone:</span>
                <span>{selectedAppointment.patientPhone}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Dentist Assigned:</span>
                <span>{selectedAppointment.doctorName}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Appointment Schedule:</span>
                <strong>{selectedAppointment.date} at {selectedAppointment.time}</strong>
              </div>
              <div className="flex justify-between">
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Reason:</span>
                <span style={{ fontWeight: 600 }}>{getAppointmentReasonLabel(selectedAppointment.appointmentType)}</span>
              </div>
              {selectedAppointment.notes && (
                <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', fontSize: '0.825rem' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px', fontSize: '0.75rem' }}>Notes / Details:</span>
                  <span>{selectedAppointment.notes}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Status:</span>
                <Badge variant={selectedAppointment.status === 'scheduled' ? 'success' : selectedAppointment.status === 'pending' ? 'warning' : 'danger'}>
                  {selectedAppointment.status}
                </Badge>
              </div>
            </div>

            {selectedAppointment.status !== 'cancelled' && selectedAppointment.status !== 'completed' && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                {selectedAppointment.status === 'pending' && (
                  <Button
                    onClick={() => handleConfirmAppointment(selectedAppointment.id)}
                    variant="primary"
                    style={{ flex: 1, padding: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  >
                    <CheckCircle2 size={14} />
                    <span>Confirm</span>
                  </Button>
                )}
                <Button
                  onClick={() => {
                    setRescheduleDate(selectedAppointment.date);
                    setRescheduleTime(selectedAppointment.time);
                    setShowRescheduleModal(true);
                    setShowDetailModal(false);
                  }}
                  variant="secondary"
                  style={{ flex: 1, padding: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                >
                  <RefreshCw size={14} />
                  <span>Reschedule</span>
                </Button>
                <Button
                  onClick={() => {
                    setCancellationReason('');
                    setShowCancelModal(true);
                    setShowDetailModal(false);
                  }}
                  variant="danger"
                  style={{ flex: 1, padding: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                >
                  <XCircle size={14} />
                  <span>Cancel</span>
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── RESCHEDULE MODAL ── */}
      <Modal isOpen={showRescheduleModal} onClose={() => setShowRescheduleModal(false)} title="Reschedule Appointment">
        {selectedAppointment && (
          <form onSubmit={handleRescheduleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Choose a new slots for <strong>{selectedAppointment.patientName}</strong>.
            </p>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: '6px' }}>Select Date</label>
              <Input
                type="date"
                value={rescheduleDate}
                onChange={(e) => {
                  setRescheduleDate(e.target.value);
                  setRescheduleTime('');
                }}
                required
              />
            </div>

            {rescheduleDate && (
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: '6px' }}>Practitioner Available Time Slots (Single Source of Truth)</label>
                {loadingCalendarSlots ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Loading slots...</p>
                ) : calendarRescheduleSlots.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--error)' }}>No slots available on this date.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', maxHeight: '160px', overflowY: 'auto' }}>
                    {calendarRescheduleSlots.map((slot) => (
                      <button
                        key={slot.time}
                        type="button"
                        disabled={!slot.available}
                        onClick={() => slot.available && setRescheduleTime(slot.time)}
                        title={!slot.available ? slot.reason || 'Unavailable' : `Available ${slot.time} - ${slot.endTime}`}
                        style={{
                          padding: '6px 4px',
                          borderRadius: 'var(--radius)',
                          border: rescheduleTime === slot.time ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                          backgroundColor: !slot.available ? 'var(--bg-disabled, #f3f4f6)' : rescheduleTime === slot.time ? 'var(--primary-light)' : 'var(--bg-secondary)',
                          color: !slot.available ? 'var(--text-disabled, #9ca3af)' : rescheduleTime === slot.time ? 'var(--primary)' : 'var(--text-primary)',
                          fontSize: '0.75rem',
                          fontWeight: rescheduleTime === slot.time ? 700 : 500,
                          cursor: slot.available ? 'pointer' : 'not-allowed',
                          textDecoration: !slot.available ? 'line-through' : 'none',
                          opacity: !slot.available ? 0.6 : 1,
                        }}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Button type="submit" style={{ marginTop: '8px' }}>
              Confirm Reschedule
            </Button>
          </form>
        )}
      </Modal>

      {/* ── CANCELLATION MODAL ── */}
      <Modal isOpen={showCancelModal} onClose={() => setShowCancelModal(false)} title="Cancel Appointment Slot">
        {selectedAppointment && (
          <form onSubmit={handleCancelSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Are you sure you want to cancel the appointment for <strong>{selectedAppointment.patientName}</strong>?
            </p>

            <textarea
              placeholder="Reason for cancellation (optional)..."
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              className="input"
              rows={3}
            />

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <Button type="button" variant="secondary" onClick={() => setShowCancelModal(false)} style={{ flex: 1 }}>
                Keep Appointment
              </Button>
              <Button type="submit" variant="danger" disabled={cancelling} style={{ flex: 1 }}>
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
