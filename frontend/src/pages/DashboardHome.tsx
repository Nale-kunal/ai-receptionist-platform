import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/hooks';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { CardSkeleton, TableSkeleton } from '../components/ui/Skeleton';
import { WidgetErrorBoundary } from '../components/ui/WidgetErrorBoundary';
import { KpiMetricsWidget } from '../components/dashboard/KpiMetricsWidget';
import { RecentCallsWidget } from '../components/dashboard/RecentCallsWidget';
import { telemetry } from '../services/telemetry';
import { api, parseAppointmentItem } from '../services/api';
import { availabilityBus } from '../services/availabilityBus';
import { APPOINTMENT_REASONS, getAppointmentReasonLabel } from '../constants/appointmentReasons';
import { BookAppointmentModal } from '../components/BookAppointmentModal';
import type { ApiAppointment, ApiDoctor, ApiPatient } from '../services/api';
import {
  PhoneCall,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  ArrowRight,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  User,
  CalendarDays,
  Filter,
  ListFilter,
  Grid,
  Users,
} from 'lucide-react';
import { useDashboardStateMachine } from '../hooks/useDashboardStateMachine';

export const DashboardHome: React.FC = () => {
  const navigate = useNavigate();
  const { user, clinic, tenant } = useAuth();
  const { state: dashboardState, isOnline } = useDashboardStateMachine();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Operational state
  const [appointments, setAppointments] = useState<ApiAppointment[]>([]);
  const [doctors, setDoctors] = useState<ApiDoctor[]>([]);
  const [patients, setPatients] = useState<ApiPatient[]>([]);
  const [recentConversations, setRecentConversations] = useState<any[]>([]);

  // Calendar State for Full Embedded Calendar
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [calendarSubView, setCalendarSubView] = useState<'month' | 'week' | 'day'>('month');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('all');

  // Dashboard Calendar Display Mode: 'full-calendar' vs 'today-list'
  const [dashboardDisplayMode, setDashboardDisplayMode] = useState<'full-calendar' | 'today-list'>('full-calendar');

  // Modals state
  const [showBookModal, setShowBookModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<ApiAppointment | null>(null);

  // Booking form states
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<ApiPatient | null>(null);
  const [isNewPatient, setIsNewPatient] = useState(false);
  const [newPatientForm, setNewPatientForm] = useState({ name: '', phone: '', email: '' });
  const [bookingDoctorId, setBookingDoctorId] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [bookingDuration, setBookingDuration] = useState(30);
  const [bookingReason, setBookingReason] = useState('routine_checkup');
  const [bookingOtherReason, setBookingOtherReason] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [dashboardAvailableSlots, setDashboardAvailableSlots] = useState<Array<{ time: string; endTime: string; available: boolean; reason?: string; reasonCode?: string }>>([]);
  const [loadingDashboardSlots, setLoadingDashboardSlots] = useState<boolean>(false);
  const [availabilityRefreshKey, setAvailabilityRefreshKey] = useState<number>(0);

  // Ref for Pending Confirmations scroll anchor
  const pendingWidgetRef = useRef<HTMLDivElement>(null);

  // Timezone-safe local date formatting helper (prevents UTC offset date-shifting)
  const formatLocalDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Load all dashboard data via single consolidated API call
  const loadDashboardData = useCallback(async () => {
    try {
      const summary = await api.getDashboardSummary();

      setAppointments(summary.appointments);
      setDoctors(summary.doctors);
      setPatients(summary.patients);
      setRecentConversations(summary.conversations.slice(0, 5));

      if (summary.doctors.length > 0 && !bookingDoctorId) {
        setBookingDoctorId(summary.doctors[0].id);
      }
      setErrorMsg(null);
      telemetry.track('widget_loaded', {
        module: 'dashboard',
        action: 'dashboard_data_sync',
        result: 'success',
        tenantId: clinic?.id,
        userId: user?.id,
        userRole: user?.role,
      });
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Failed to sync dashboard metrics. Checking network connection...');
      telemetry.track('widget_failed', {
        module: 'dashboard',
        action: 'dashboard_data_sync',
        result: 'failure',
        errorCode: err.name || 'SYNC_ERROR',
        tenantId: clinic?.id,
        userId: user?.id,
        userRole: user?.role,
      });
    }
  }, [bookingDoctorId, clinic?.id, user?.id, user?.role]);

  useEffect(() => {
    telemetry.track('page_viewed', {
      module: 'dashboard',
      action: 'dashboard_home_render',
      tenantId: clinic?.id,
      userId: user?.id,
      userRole: user?.role,
    });
    loadDashboardData();
    const timer = setInterval(loadDashboardData, 30000);

    return () => clearInterval(timer);
  }, [loadDashboardData, clinic?.id, user?.id, user?.role]);

  // Calendar Navigation Controls
  const handlePrevDate = () => {
    const nextDate = new Date(currentDate);
    if (calendarSubView === 'month') {
      nextDate.setMonth(currentDate.getMonth() - 1);
    } else if (calendarSubView === 'week') {
      nextDate.setDate(currentDate.getDate() - 7);
    } else {
      nextDate.setDate(currentDate.getDate() - 1);
    }
    setCurrentDate(nextDate);
  };

  const handleNextDate = () => {
    const nextDate = new Date(currentDate);
    if (calendarSubView === 'month') {
      nextDate.setMonth(currentDate.getMonth() + 1);
    } else if (calendarSubView === 'week') {
      nextDate.setDate(currentDate.getDate() + 7);
    } else {
      nextDate.setDate(currentDate.getDate() + 1);
    }
    setCurrentDate(nextDate);
  };

  const handleTodayDate = () => {
    setCurrentDate(new Date());
  };

  const handleJumpToDate = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      const parts = e.target.value.split('-').map(Number);
      if (parts.length === 3) {
        setCurrentDate(new Date(parts[0], parts[1] - 1, parts[2]));
      }
    }
  };

  // Doctor Name Matching
  const dNameMatches = (name1: string, name2: string) => {
    return name1.toLowerCase().includes(name2.toLowerCase()) || name2.toLowerCase().includes(name1.toLowerCase());
  };

  // Filtered Appointments (Memoized)
  const filteredApts = React.useMemo(() => {
    return appointments.filter((a) => {
      if (selectedDoctorId === 'all') return true;
      const doctor = doctors.find((d) => d.id === selectedDoctorId);
      return doctor ? (a.doctorName.toLowerCase().includes(doctor.name.toLowerCase()) || doctor.name.toLowerCase().includes(a.doctorName.toLowerCase())) : true;
    });
  }, [appointments, doctors, selectedDoctorId]);

  const getFilteredApts = useCallback(() => filteredApts, [filteredApts]);

  // Status Color Helper (memoized to avoid recreation on each render)
  const getStatusColor = useCallback((status: ApiAppointment['status']) => {
    switch (status) {
      case 'scheduled':
        return { bg: 'var(--success-light)', text: 'var(--success)', border: '1px solid var(--success)' };
      case 'rescheduled':
        return { bg: 'var(--primary-light)', text: 'var(--primary)', border: '1px solid var(--primary)' };
      case 'pending':
        return { bg: 'var(--warning-light)', text: 'var(--warning)', border: '1px solid var(--warning)' };
      default:
        return { bg: 'var(--bg-tertiary)', text: 'var(--text-secondary)', border: '1px solid var(--border-color)' };
    }
  }, []);

  // Calculate metrics for today specifically using local timezone formatting (Memoized)
  const todayStr = React.useMemo(() => formatLocalDate(new Date()), []);
  
  const todayApts = React.useMemo(() => {
    return appointments.filter((a) => a.date === todayStr && a.status !== 'cancelled');
  }, [appointments, todayStr]);

  const pendingApts = React.useMemo(() => {
    return appointments.filter((a) => a.status === 'pending');
  }, [appointments]);

  const todayConvs = React.useMemo(() => {
    return recentConversations.filter((c) => {
      if (!c.startedAt) return false;
      return formatLocalDate(new Date(c.startedAt)) === todayStr;
    });
  }, [recentConversations, todayStr]);

  const missedCallsCount = React.useMemo(() => {
    return todayConvs.filter((c) => c.status === 'abandoned' || c.status === 'failed').length;
  }, [todayConvs]);

  // Appointment Actions
  const handleConfirmAppointment = async (id: string) => {
    // Optimistic update — show confirmed status immediately
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'scheduled' as any } : a))
    );
    setShowDetailModal(false);
    try {
      await api.updateAppointment(id, { status: 'scheduled' });
      loadDashboardData(); // background sync
    } catch (err) {
      // Revert on failure
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'pending' as any } : a))
      );
      console.error(err);
      alert('Failed to confirm appointment.');
    }
  };

  const handleDeclineAppointment = async (id: string) => {
    if (!window.confirm('Are you sure you want to decline and cancel this appointment request?')) return;
    // Optimistic update — show cancelled immediately
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'cancelled' as any } : a))
    );
    setShowDetailModal(false);
    try {
      await api.updateAppointment(id, { status: 'cancelled' });
      loadDashboardData(); // background sync
    } catch (err) {
      // Revert on failure
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'pending' as any } : a))
      );
      console.error(err);
      alert('Failed to cancel appointment.');
    }
  };

  const resetBookingForm = () => {
    setPatientSearch('');
    setSelectedPatient(null);
    setIsNewPatient(false);
    setNewPatientForm({ name: '', phone: '', email: '' });
    setBookingDate(todayStr);
    setBookingTime('');
    setBookingDuration(30);
    setBookingReason('routine_checkup');
    setBookingOtherReason('');
    setBookingNotes('');
    setBookingError(null);
    if (doctors.length > 0) setBookingDoctorId(doctors[0].id);
  };

  // Dynamic Availability Slots Fetcher for Dashboard Booking Modal
  useEffect(() => {
    const targetDate = bookingDate || todayStr;
    if (!bookingDoctorId || !targetDate || !showBookModal) return;
    let isCancelled = false;
    async function fetchDashboardSlots() {
      setLoadingDashboardSlots(true);
      try {
        const res = await api.getAvailability({
          doctorId: bookingDoctorId,
          date: targetDate,
          durationMinutes: bookingDuration,
        });
        if (!isCancelled && res && Array.isArray(res.slots)) {
          setDashboardAvailableSlots(res.slots);
          const isCurrentAvailable = res.slots.some((s: any) => s.time === bookingTime && s.available);
          if (!isCurrentAvailable) {
            const firstOpen = res.slots.find((s: any) => s.available);
            if (firstOpen) {
              setBookingTime(firstOpen.time);
            }
          }
        }
      } catch (err) {
        console.warn('Dashboard availability slots error:', err);
        setDashboardAvailableSlots([]);
      } finally {
        if (!isCancelled) setLoadingDashboardSlots(false);
      }
    }
    fetchDashboardSlots();
    return () => {
      isCancelled = true;
    };
  }, [bookingDoctorId, bookingDate, bookingDuration, showBookModal, availabilityRefreshKey]);

  // Subscribe to real-time availabilityBus invalidation events
  useEffect(() => {
    return availabilityBus.subscribe(() => {
      setAvailabilityRefreshKey((prev) => prev + 1);
    });
  }, []);

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError(null);

    // 1. Validation checks
    if (!bookingReason) {
      setBookingError('Please select an appointment reason.');
      return;
    }

    if (bookingReason === 'other' && !bookingOtherReason.trim()) {
      setBookingError('Please specify the reason for this appointment.');
      return;
    }

    if (!bookingTime) {
      setBookingError('Please select an available practitioner time slot.');
      return;
    }

    setBookingSubmitting(true);
    try {
      let patient = selectedPatient;
      if (isNewPatient || !patient) {
        if (!newPatientForm.name.trim() || !newPatientForm.phone.trim()) {
          setBookingError('Patient Full Name and Phone Number are required.');
          setBookingSubmitting(false);
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
      if (!doctor) throw new Error('Please select a dentist.');

      await api.createAppointment({
        doctorId: doctor.id,
        patientId: patient.id,
        patientName: patient.name,
        patientPhone: patient.phone,
        doctorName: doctor.name,
        date: bookingDate || todayStr,
        time: bookingTime,
        durationMinutes: bookingDuration,
        appointmentType: bookingReason,
        otherReason: bookingReason === 'other' ? bookingOtherReason.trim() : undefined,
        notes: bookingNotes.trim() || undefined,
        status: 'scheduled',
      });

      setShowBookModal(false);
      resetBookingForm();
      await loadDashboardData();
    } catch (err: any) {
      console.error('Appointment booking error:', err);
      const errData = err.response?.data?.error;
      const status = err.response?.status;

      if (status === 409 || errData?.code === 'APPOINTMENT_CONFLICT' || errData?.code === 'APPOINTMENT_SLOT_TAKEN') {
        setBookingError('This time slot is no longer available. Please select another available time.');
        availabilityBus.publish(); // Re-trigger availability fetch to show newly taken slot
      } else if (errData?.message) {
        setBookingError(errData.message);
      } else if (err.message) {
        setBookingError(err.message);
      } else {
        setBookingError('Failed to schedule appointment. Please check the details and try again.');
      }
    } finally {
      setBookingSubmitting(false);
    }
  };

  const filteredPatients = patients.filter((p) => {
    if (!patientSearch.trim()) return false;
    const q = patientSearch.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.phone.includes(q);
  });

  const getCalendarHeaderTitle = () => {
    if (calendarSubView === 'month') {
      return currentDate.toLocaleDateString([], { month: 'long', year: 'numeric' });
    } else if (calendarSubView === 'week') {
      const start = new Date(currentDate);
      start.setDate(currentDate.getDate() - currentDate.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else {
      return currentDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center', paddingBottom: '4px' }}>
            {d}
          </div>
        ))}
        {blankOffsets.map((_, i) => (
          <div key={`offset-${i}`} style={{ minHeight: '80px', backgroundColor: 'var(--bg-secondary)', opacity: 0.3, borderRadius: 'var(--radius)' }} />
        ))}
        {dayNumbers.map((day) => {
          const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayApts = filtered.filter((a) => a.date === formattedDate && a.status !== 'cancelled');
          const isToday = formattedDate === todayStr;

          return (
            <div
              key={`day-${day}`}
              onClick={() => {
                resetBookingForm();
                setBookingDate(formattedDate);
                setShowBookModal(true);
              }}
              style={{
                minHeight: '85px',
                backgroundColor: isToday ? 'var(--primary-light)' : 'var(--bg-secondary)',
                border: isToday ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                borderRadius: 'var(--radius)',
                padding: '6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isToday ? 'var(--primary-light)' : 'var(--bg-tertiary)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isToday ? 'var(--primary-light)' : 'var(--bg-secondary)')}
            >
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isToday ? 'var(--primary)' : 'var(--text-secondary)' }}>{day}</span>
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
                        fontSize: '0.68rem',
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
      <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', gap: '1px', backgroundColor: 'var(--border-color)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '8px', fontWeight: 600, fontSize: '0.75rem', textAlign: 'center' }}>Time</div>
        {days.map((d, i) => (
          <div key={`header-${i}`} style={{ backgroundColor: 'var(--bg-secondary)', padding: '8px', fontWeight: 600, fontSize: '0.75rem', textAlign: 'center' }}>
            {d.toLocaleDateString([], { weekday: 'short', day: 'numeric' })}
          </div>
        ))}

        {hours.map((hour) => (
          <React.Fragment key={`hour-${hour}`}>
            <div style={{ backgroundColor: 'var(--bg-primary)', padding: '8px', fontSize: '0.75rem', textAlign: 'center', fontWeight: 500 }}>
              {hour}
            </div>
            {days.map((day) => {
              const dStr = formatLocalDate(day);
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
                    minHeight: '50px',
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
                          fontSize: '0.68rem',
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
    const dStr = formatLocalDate(currentDate);
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
                gridTemplateColumns: '90px 1fr',
                borderBottom: '1px solid var(--border-color)',
                minHeight: '44px',
                cursor: 'pointer',
                backgroundColor: 'var(--bg-primary)',
              }}
            >
              <div style={{ padding: '8px', borderRight: '1px solid var(--border-color)', fontSize: '0.75rem', fontWeight: 600, backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {hour}
              </div>
              <div style={{ padding: '6px 10px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
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

  const userRole = user?.role || 'clinic_owner';
  const isDoctorRole = userRole === 'doctor';
  const greetingName = user?.firstName
    ? user.firstName
    : isDoctorRole
    ? 'Dentist'
    : userRole === 'receptionist'
    ? 'Receptionist'
    : 'Practice Owner';

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Page Header */}
      <div style={{ marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="mb-2" style={{ fontSize: '1.6rem', fontWeight: 700 }}>
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {greetingName} 👋
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
            Here&apos;s what&apos;s happening at {clinic?.name || tenant?.name || 'your practice'} today.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Badge variant="primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
            {isDoctorRole ? 'Dentist View' : userRole === 'receptionist' ? 'Receptionist View' : 'Practice Owner'}
          </Badge>
        </div>
      </div>

      {/* Stats Cards Row (Interactive & Accessible) */}
      <WidgetErrorBoundary widgetName="KPI Metrics Bar">
        <KpiMetricsWidget
          onSwitchToListMode={() => setDashboardDisplayMode('today-list')}
          pendingWidgetRef={pendingWidgetRef}
        />
      </WidgetErrorBoundary>

      {/* Main Operations Dashboard Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '24px',
          width: '100%',
        }}
      >
        {/* Left Column: Full Embedded Calendar & Call Logs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* ── EMBEDDED FULL CALENDAR WITH TOGGLE TO TODAY'S LIST ── */}
          <Card>
            {/* Header & Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarDays size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                  {dashboardDisplayMode === 'full-calendar' ? 'Calendar Scheduler' : "Today's Appointments List"}
                </h3>
              </div>

              {/* Action Buttons: Toggle Full Calendar vs Today's List View */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {dashboardDisplayMode === 'full-calendar' ? (
                  <Button
                    onClick={() => setDashboardDisplayMode('today-list')}
                    variant="secondary"
                    style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                  >
                    <ListFilter size={15} />
                    <span>Switch to Today&apos;s List View</span>
                  </Button>
                ) : (
                  <Button
                    onClick={() => setDashboardDisplayMode('full-calendar')}
                    variant="secondary"
                    style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                  >
                    <Grid size={15} />
                    <span>Switch to Full Calendar Grid</span>
                  </Button>
                )}

                <Button
                  onClick={() => {
                    resetBookingForm();
                    setBookingDate(todayStr);
                    setShowBookModal(true);
                  }}
                  variant="primary"
                  style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Plus size={15} />
                  <span>Book Appointment</span>
                </Button>
              </div>
            </div>

            {/* ── MODE 1: FULL CALENDAR GRID VIEW ── */}
            {dashboardDisplayMode === 'full-calendar' && (
              <div>
                {/* Full Calendar Control Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Button variant="secondary" onClick={handleTodayDate} style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                      Today
                    </Button>
                    <Button variant="secondary" onClick={handlePrevDate} style={{ padding: '4px', borderRadius: '50%' }}>
                      <ChevronLeft size={16} />
                    </Button>
                    <Button variant="secondary" onClick={handleNextDate} style={{ padding: '4px', borderRadius: '50%' }}>
                      <ChevronRight size={16} />
                    </Button>
                    <h4 style={{ fontSize: '1rem', marginLeft: '8px', fontWeight: 700, margin: 0 }}>
                      {getCalendarHeaderTitle()}
                    </h4>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Doctor Filter */}
                    {doctors.length > 0 && !isDoctorRole && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Filter size={14} style={{ color: 'var(--text-muted)' }} />
                        <select
                          value={selectedDoctorId}
                          onChange={(e) => setSelectedDoctorId(e.target.value)}
                          className="input"
                          style={{ padding: '4px 8px', fontSize: '0.75rem', marginBottom: 0, width: '130px' }}
                        >
                          <option value="all">All Dentists</option>
                          {doctors.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Date Picker Input */}
                    <input
                      type="date"
                      onChange={handleJumpToDate}
                      className="input"
                      style={{ width: '130px', padding: '4px 6px', fontSize: '0.75rem', marginBottom: 0 }}
                    />

                    {/* View Switcher Tabs (Month / Week / Day) */}
                    <div style={{ display: 'flex', backgroundColor: 'var(--bg-secondary)', padding: '2px', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
                      {(['month', 'week', 'day'] as const).map((v) => (
                        <button
                          key={v}
                          onClick={() => setCalendarSubView(v)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 'var(--radius)',
                            border: 'none',
                            backgroundColor: calendarSubView === v ? 'var(--bg-primary)' : 'transparent',
                            color: calendarSubView === v ? 'var(--primary)' : 'var(--text-secondary)',
                            fontWeight: calendarSubView === v ? 600 : 500,
                            fontSize: '0.75rem',
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

                {/* Sub View Grid Renderer */}
                {calendarSubView === 'month' ? renderMonthView() : calendarSubView === 'week' ? renderWeekView() : renderDayView()}
              </div>
            )}

            {/* ── MODE 2: TODAY'S LIST VIEW ── */}
            {dashboardDisplayMode === 'today-list' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Appointments Scheduled for Today ({todayStr})
                  </span>
                  <Badge variant="primary" style={{ fontSize: '0.75rem' }}>{todayApts.length} Total</Badge>
                </div>

                {todayApts.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <Calendar size={32} style={{ margin: '0 auto 8px', color: 'var(--text-muted)', opacity: 0.5 }} />
                    <p style={{ fontSize: '0.875rem', marginBottom: '12px' }}>
                      No appointments scheduled yet today. Your AI receptionist will book them as calls come in.
                    </p>
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        resetBookingForm();
                        setBookingDate(todayStr);
                        setShowBookModal(true);
                      }}
                      style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                    >
                      Book Appointment
                    </button>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <th style={{ padding: '10px 8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>TIME</th>
                          <th style={{ padding: '10px 8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>PATIENT</th>
                          <th style={{ padding: '10px 8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>CONTACT</th>
                          <th style={{ padding: '10px 8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>PROVIDER</th>
                          <th style={{ padding: '10px 8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {todayApts.map((apt) => (
                          <tr
                            key={apt.id}
                            onClick={() => {
                              setSelectedAppointment(apt);
                              setShowDetailModal(true);
                            }}
                            style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.875rem', cursor: 'pointer' }}
                          >
                            <td style={{ padding: '10px 8px', fontWeight: 600 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                                {apt.time}
                              </div>
                            </td>
                            <td style={{ padding: '10px 8px', fontWeight: 500 }}>{apt.patientName}</td>
                            <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>{apt.patientPhone}</td>
                            <td style={{ padding: '10px 8px' }}>{apt.doctorName}</td>
                            <td style={{ padding: '10px 8px' }}>
                              <Badge variant={apt.status === 'scheduled' ? 'success' : apt.status === 'pending' ? 'warning' : 'secondary'}>
                                {apt.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Recent AI Call Logs Panel (Owner & Receptionist only) */}
          {!isDoctorRole && (
            <WidgetErrorBoundary widgetName="Recent AI Calls">
              <RecentCallsWidget />
            </WidgetErrorBoundary>
          )}
        </div>

        {/* Right Column: Quick Actions & Pending Confirmations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Quick Actions Panel */}
          <Card>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '16px' }}>Quick Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => {
                  resetBookingForm();
                  setBookingDate(todayStr);
                  setShowBookModal(true);
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Plus size={16} />
                  <span>Book Appointment</span>
                </div>
                <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
              </button>

              <button
                onClick={() => navigate('/calendar')}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={16} />
                  <span>Open Calendar Schedule</span>
                </div>
                <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
              </button>

              {isDoctorRole ? (
                <button
                  onClick={() => navigate('/patients')}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    fontWeight: 500,
                    fontSize: '0.875rem',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={16} />
                    <span>My Patients</span>
                  </div>
                  <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                </button>
              ) : (
                <button
                  onClick={() => navigate('/ai-receptionist/live')}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    fontWeight: 500,
                    fontSize: '0.875rem',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <PhoneCall size={16} />
                    <span>Live Calls</span>
                  </div>
                  <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                </button>
              )}
            </div>
          </Card>

          {/* Pending Confirmations Action Center */}
          <div ref={pendingWidgetRef}>
            <Card>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '16px' }}>Pending Confirmations</h3>

              {pendingApts.length === 0 ? (
                <div style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <CheckCircle2 size={24} style={{ margin: '0 auto 8px', color: 'var(--success)' }} />
                  <p style={{ fontSize: '0.85rem' }}>All requests processed!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {pendingApts.map((apt) => (
                    <div
                      key={apt.id}
                      style={{
                        padding: '12px',
                        borderRadius: 'var(--radius)',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{apt.patientName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {apt.date} at {apt.time} ({apt.doctorName})
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <Button
                          onClick={() => handleConfirmAppointment(apt.id)}
                          variant="primary"
                          style={{ flex: 1, padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                        >
                          <CheckCircle2 size={12} />
                          <span>Confirm</span>
                        </Button>
                        <Button
                          onClick={() => handleDeclineAppointment(apt.id)}
                          variant="danger"
                          style={{ flex: 1, padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                        >
                          <XCircle size={12} />
                          <span>Decline</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* ── SCHEDULE APPOINTMENT MODAL (UNIFIED STANDARD UI/UX) ── */}
      <BookAppointmentModal
        isOpen={showBookModal}
        onClose={() => setShowBookModal(false)}
        onSuccess={async () => {
          await loadDashboardData();
        }}
        initialDate={bookingDate}
        initialDoctorId={bookingDoctorId}
      />


      {/* ── APPOINTMENT DETAIL MODAL (DASHBOARD) ── */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="Appointment Details">
        {selectedAppointment && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '16px', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{selectedAppointment.patientName}</h3>
                <Badge variant={selectedAppointment.status === 'scheduled' ? 'success' : selectedAppointment.status === 'pending' ? 'warning' : 'secondary'}>
                  {selectedAppointment.status}
                </Badge>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 4px' }}>
                📞 {selectedAppointment.patientPhone}
              </p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 4px' }}>
                👨‍⚕️ Provider: <strong>{selectedAppointment.doctorName}</strong>
              </p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 4px' }}>
                📅 Scheduled: <strong>{selectedAppointment.date} at {selectedAppointment.time} ({selectedAppointment.durationMinutes || 30} mins)</strong>
              </p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 4px' }}>
                🩺 Reason: <strong>{getAppointmentReasonLabel(selectedAppointment.appointmentType)}</strong>
              </p>
              {selectedAppointment.notes && (
                <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: '8px 0 0', padding: '8px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', whiteSpace: 'pre-wrap' }}>
                  {selectedAppointment.notes}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {selectedAppointment.status === 'pending' && (
                <Button
                  onClick={() => handleConfirmAppointment(selectedAppointment.id)}
                  variant="primary"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <CheckCircle2 size={16} /> Confirm Appointment
                </Button>
              )}
              {selectedAppointment.status !== 'completed' && selectedAppointment.status !== 'cancelled' && (
                <Button
                  onClick={() => handleDeclineAppointment(selectedAppointment.id)}
                  variant="danger"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <XCircle size={16} /> Decline / Cancel
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
