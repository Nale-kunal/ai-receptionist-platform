import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { api, type ApiDoctor, type ApiPatient } from '../services/api';
import { APPOINTMENT_REASONS, getAppointmentReasonLabel } from '../constants/appointmentReasons';
import { availabilityBus } from '../services/availabilityBus';
import { AlertTriangle, ChevronDown, Check } from 'lucide-react';

export interface BookAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (createdAppointment?: any) => void;
  initialDate?: string;
  initialTime?: string;
  initialDoctorId?: string;
  initialPatientId?: string;
  title?: string;
}

// Categorized reasons for rapid scanning
const REASON_CATEGORIES = [
  {
    category: 'Examinations & Preventive',
    codes: ['routine_checkup', 'cleaning', 'consultation', 'follow_up', 'post_treatment_review'],
  },
  {
    category: 'Urgent & Pain Relief',
    codes: ['tooth_pain', 'emergency', 'broken_tooth', 'tooth_sensitivity'],
  },
  {
    category: 'Restorative & Treatments',
    codes: ['cavity', 'filling', 'root_canal', 'crown_bridge', 'extraction'],
  },
  {
    category: 'Specialist & Cosmetic',
    codes: ['wisdom_tooth', 'gum_problem', 'implant_consultation', 'orthodontic', 'denture', 'cosmetic'],
  },
  {
    category: 'Custom Reason',
    codes: ['other'],
  },
];

export const BookAppointmentModal: React.FC<BookAppointmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialDate,
  initialTime,
  initialDoctorId,
  initialPatientId,
  title = 'Book Enterprise Patient Appointment',
}) => {
  // Master lists
  const [patients, setPatients] = useState<ApiPatient[]>([]);
  const [doctors, setDoctors] = useState<ApiDoctor[]>([]);

  // Booking Form State
  const [bookingType, setBookingType] = useState<'existing' | 'new'>('existing');
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [newPatientForm, setNewPatientForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    dob: '',
  });

  const [bookingDoctorId, setBookingDoctorId] = useState<string>('');
  const [bookingDate, setBookingDate] = useState<string>('');
  const [bookingTime, setBookingTime] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [appointmentType, setAppointmentType] = useState<string>('routine_checkup');
  const [otherReason, setOtherReason] = useState<string>('');
  const [bookingNotes, setBookingNotes] = useState<string>('');

  // Custom Dropdown State for Reason (prevents native select from shooting outside window)
  const [reasonDropdownOpen, setReasonDropdownOpen] = useState(false);
  const reasonDropdownRef = useRef<HTMLDivElement>(null);

  // Slots State
  const [availableSlots, setAvailableSlots] = useState<{ time: string; endTime: string; available: boolean; reason?: string }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [availabilityStatus, setAvailabilityStatus] = useState<string>('OPEN');
  const [availabilityMessage, setAvailabilityMessage] = useState<string>('');
  const [fetchError, setFetchError] = useState<boolean>(false);

  // Error & Status State
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookingEmailConflict, setBookingEmailConflict] = useState<{ existingPatientName: string; email: string } | null>(null);
  const [allowEmailSharing, setAllowEmailSharing] = useState(false);

  // Close custom dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (reasonDropdownRef.current && !reasonDropdownRef.current.contains(event.target as Node)) {
        setReasonDropdownOpen(false);
      }
    };
    if (reasonDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [reasonDropdownOpen]);

  // Load Doctors and Patients on Open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    Promise.all([
      api.getDoctors().catch(() => []),
      api.getPatients().catch(() => []),
    ]).then(([docList, patList]) => {
      if (!isMounted) return;
      setDoctors(docList);
      setPatients(patList);

      if (initialDoctorId) {
        setBookingDoctorId(initialDoctorId);
      } else if (docList.length > 0) {
        setBookingDoctorId(docList[0].id);
      }

      if (initialPatientId) {
        setSelectedPatientId(initialPatientId);
        setBookingType('existing');
      } else if (patList.length > 0) {
        setSelectedPatientId(patList[0].id);
      }

      const defaultDate = initialDate || new Date().toISOString().split('T')[0];
      setBookingDate(defaultDate);

      if (initialTime) {
        setBookingTime(initialTime);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, initialDate, initialTime, initialDoctorId, initialPatientId]);

  // Fetch Available Slots whenever Doctor, Date, or Duration changes
  const fetchSlots = useCallback(async () => {
    if (!bookingDoctorId || !bookingDate) {
      setAvailableSlots([]);
      return;
    }

    setLoadingSlots(true);
    setFetchError(false);
    try {
      const res = await api.getAvailability({
        doctorId: bookingDoctorId,
        date: bookingDate,
        durationMinutes,
      });
      const slots = res?.slots || (Array.isArray(res) ? res : []);
      setAvailableSlots(slots);
      setAvailabilityStatus(res?.status || (slots.length > 0 ? 'OPEN' : 'DOCTOR_SCHEDULE_CLOSED'));
      setAvailabilityMessage(res?.message || '');
    } catch (err) {
      console.warn('[BookAppointmentModal] Failed to fetch available slots:', err);
      setAvailableSlots([]);
      setFetchError(true);
    } finally {
      setLoadingSlots(false);
    }
  }, [bookingDoctorId, bookingDate, durationMinutes]);

  useEffect(() => {
    if (isOpen && bookingDoctorId && bookingDate) {
      fetchSlots();
    }
  }, [isOpen, bookingDoctorId, bookingDate, durationMinutes, fetchSlots]);

  // Subscribe to real-time availability bus invalidation
  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = availabilityBus.subscribe((payload) => {
      if (!payload.doctorId || payload.doctorId === bookingDoctorId) {
        fetchSlots();
      }
    });
    return () => unsubscribe();
  }, [isOpen, bookingDoctorId, fetchSlots]);

  // Reset form helper
  const handleClose = () => {
    setErrorMsg(null);
    setBookingEmailConflict(null);
    setAllowEmailSharing(false);
    setBookingTime('');
    setOtherReason('');
    setBookingNotes('');
    setReasonDropdownOpen(false);
    onClose();
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    if (!bookingTime) {
      setErrorMsg('Please choose an available practitioner time slot.');
      setSubmitting(false);
      return;
    }

    if (appointmentType === 'other' && !otherReason.trim()) {
      setErrorMsg('Please specify the reason when selecting "Other".');
      setSubmitting(false);
      return;
    }

    try {
      let patient: { id?: string; name: string; phone: string };

      if (bookingType === 'existing') {
        const found = patients.find((p) => p.id === selectedPatientId);
        if (!found) throw new Error('Please select a valid patient.');
        patient = { id: found.id, name: found.name, phone: found.phone };
      } else {
        if (!newPatientForm.firstName.trim()) {
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
            setSubmitting(false);
            return;
          }
          throw err;
        }
      }

      const doctor = doctors.find((d) => d.id === bookingDoctorId);
      if (!doctor) throw new Error('Selected practitioner could not be resolved.');

      const created = await api.createAppointment({
        patientId: patient.id,
        doctorId: doctor.id,
        patientName: patient.name,
        patientPhone: patient.phone,
        doctorName: doctor.name,
        date: bookingDate,
        time: bookingTime,
        status: 'scheduled',
        appointmentType,
        otherReason: appointmentType === 'other' ? otherReason.trim() : undefined,
        notes: bookingNotes.trim() || undefined,
        durationMinutes,
      });

      availabilityBus.publish({ doctorId: doctor.id, date: bookingDate });
      handleClose();

      if (onSuccess) {
        onSuccess(created);
      }
    } catch (err: any) {
      console.error('[BookAppointmentModal] Booking failed:', err);
      const errData = err.response?.data?.error;
      const status = err.response?.status;

      if (status === 409 || errData?.code === 'APPOINTMENT_CONFLICT' || errData?.code === 'APPOINTMENT_SLOT_TAKEN') {
        setErrorMsg('This time slot is no longer available. Please select another available time.');
        availabilityBus.publish();
        fetchSlots();
      } else {
        let msg = errData?.message || err.message || 'Scheduling conflict or validation error. Please check the details and try again.';
        if (errData?.details && Array.isArray(errData.details) && errData.details.length > 0) {
          const detailMsgs = errData.details
            .map((d: any) => (typeof d === 'string' ? d : d.message ? `${d.field ? d.field + ': ' : ''}${d.message}` : JSON.stringify(d)))
            .join(', ');
          if (detailMsgs) msg = `${msg}: ${detailMsgs}`;
        }
        setErrorMsg(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      maxWidth="720px"
      hideFooterCancel={true}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Error Alert Banner */}
        {errorMsg && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--danger)',
              color: 'var(--danger)',
              fontSize: '12.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              lineHeight: 1.3,
            }}
          >
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Email Sharing Conflict Warning */}
        {bookingEmailConflict && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid var(--warning)',
              color: 'var(--warning)',
              fontSize: '12.5px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={16} />
              <span>
                Email <strong>{bookingEmailConflict.email}</strong> is already registered to{' '}
                <strong>{bookingEmailConflict.existingPatientName}</strong>.
              </span>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11.5px' }}>
              <input
                type="checkbox"
                checked={allowEmailSharing}
                onChange={(e) => setAllowEmailSharing(e.target.checked)}
              />
              <span>Allow shared family email address</span>
            </label>
          </div>
        )}

        {/* Patient Record Selection Segmented Toggle */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Patient Record
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                setBookingType('existing');
                setErrorMsg(null);
              }}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                border: bookingType === 'existing' ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                backgroundColor: bookingType === 'existing' ? 'var(--primary-light, rgba(99, 102, 241, 0.12))' : 'var(--bg-secondary)',
                color: bookingType === 'existing' ? 'var(--primary)' : 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Select Existing Patient
            </button>
            <button
              type="button"
              onClick={() => {
                setBookingType('new');
                setErrorMsg(null);
              }}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                border: bookingType === 'new' ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                backgroundColor: bookingType === 'new' ? 'var(--primary-light, rgba(99, 102, 241, 0.12))' : 'var(--bg-secondary)',
                color: bookingType === 'new' ? 'var(--primary)' : 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              + Register New Patient
            </button>
          </div>
        </div>

        {/* Existing vs New Patient Body */}
        {bookingType === 'existing' ? (
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px', display: 'block' }}>
              Choose Patient *
            </label>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="input"
              style={{ padding: '6px 10px', fontSize: '12.5px' }}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
            {/* Row 1: First Name, Last Name, Phone in 3 columns */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '8px' }}>
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
              <Input
                label="Primary Phone (10 digits) *"
                required
                placeholder="9876543210"
                maxLength={10}
                value={newPatientForm.phone}
                onChange={(e) => setNewPatientForm({ ...newPatientForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              />
            </div>
            {/* Row 2: Date of Birth and Email in 2 columns */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '8px' }}>
              <Input
                type="date"
                label="Date of Birth"
                value={newPatientForm.dob}
                onChange={(e) => setNewPatientForm({ ...newPatientForm, dob: e.target.value })}
              />
              <Input
                type="email"
                label="Email Address"
                value={newPatientForm.email}
                onChange={(e) => setNewPatientForm({ ...newPatientForm, email: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* Row 1: Doctor (1.3fr) + Date (1fr) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px', display: 'block' }}>
              Assigned Doctor / Practitioner *
            </label>
            <select
              value={bookingDoctorId}
              onChange={(e) => setBookingDoctorId(e.target.value)}
              className="input"
              style={{ padding: '6px 10px', fontSize: '12.5px' }}
              required
            >
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({(d as any).specialization || (d as any).specialty || 'General Dentistry'})
                </option>
              ))}
            </select>
          </div>
          <div>
            <Input
              type="date"
              label="Appointment Date *"
              required
              value={bookingDate}
              onChange={(e) => {
                setBookingDate(e.target.value);
                setBookingTime('');
                if (errorMsg) setErrorMsg(null);
              }}
            />
          </div>
        </div>

        {/* Row 2: Custom Reason Dropdown (1.5fr) + Duration (1fr) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '10px' }}>
          {/* Custom Bounded Reason Selector */}
          <div ref={reasonDropdownRef} style={{ position: 'relative' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px', display: 'block' }}>
              Appointment Reason *
            </label>
            <button
              type="button"
              onClick={() => setReasonDropdownOpen(!reasonDropdownOpen)}
              className="input"
              style={{
                width: '100%',
                padding: '7px 10px',
                fontSize: '12.5px',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                backgroundColor: 'var(--bg-secondary)',
                border: reasonDropdownOpen ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {getAppointmentReasonLabel(appointmentType)}
              </span>
              <ChevronDown
                size={15}
                style={{
                  color: 'var(--text-secondary)',
                  flexShrink: 0,
                  transform: reasonDropdownOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.15s ease',
                }}
              />
            </button>

            {/* Custom Dropdown Menu with Max-Height (Stays strictly inside webpage) */}
            {reasonDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  maxHeight: '180px',
                  overflowY: 'auto',
                  backgroundColor: 'var(--bg-primary, #1e293b)',
                  border: '1px solid var(--border-color, #334155)',
                  borderRadius: '6px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
                  zIndex: 100,
                  padding: '4px',
                }}
              >
                {REASON_CATEGORIES.map((group) => {
                  const groupReasons = APPOINTMENT_REASONS.filter((r) => group.codes.includes(r.code));
                  if (groupReasons.length === 0) return null;
                  return (
                    <div key={group.category} style={{ marginBottom: '4px' }}>
                      <div
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          color: 'var(--primary)',
                          padding: '4px 8px 2px',
                        }}
                      >
                        {group.category}
                      </div>
                      {groupReasons.map((r) => {
                        const isSelected = appointmentType === r.code;
                        return (
                          <div
                            key={r.code}
                            onClick={() => {
                              setAppointmentType(r.code);
                              setReasonDropdownOpen(false);
                              if (errorMsg) setErrorMsg(null);
                            }}
                            style={{
                              padding: '6px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              backgroundColor: isSelected ? 'var(--primary-light, rgba(99, 102, 241, 0.18))' : 'transparent',
                              color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                              fontWeight: isSelected ? 600 : 400,
                              transition: 'background-color 0.1s ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-secondary, rgba(255,255,255,0.05))';
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <span>{r.label}</span>
                            {isSelected && <Check size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px', display: 'block' }}>
              Duration (Minutes) *
            </label>
            <select
              value={durationMinutes}
              onChange={(e) => {
                setDurationMinutes(Number(e.target.value));
                setBookingTime('');
              }}
              className="input"
              style={{ padding: '6px 10px', fontSize: '12.5px' }}
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

        {/* Conditional "Other" Reason Input */}
        {appointmentType === 'other' && (
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px', display: 'block' }}>
              Please specify the reason *
            </label>
            <Input
              placeholder="e.g. Consultation for bridge adjustment..."
              value={otherReason}
              onChange={(e) => {
                setOtherReason(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              required
            />
          </div>
        )}

        {/* Additional Notes (Optional) */}
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px', display: 'block' }}>
            Additional Notes (Optional)
          </label>
          <Input
            placeholder="e.g. Patient requested morning slot, needs wheelchair access..."
            value={bookingNotes}
            onChange={(e) => setBookingNotes(e.target.value)}
          />
        </div>

        {/* Practitioner Available Time Slots Grid (6 Columns) */}
        {bookingDoctorId && bookingDate && (
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Practitioner Available Time Slots *</span>
              {loadingSlots && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Checking schedule...</span>}
            </label>

            {availableSlots.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '5px', maxHeight: '110px', overflowY: 'auto', padding: '2px' }}>
                {availableSlots.map((slot) => {
                  const isSelected = bookingTime === slot.time;
                  return (
                    <button
                      key={slot.time}
                      type="button"
                      disabled={!slot.available}
                      title={slot.available ? `Available (${slot.time} - ${slot.endTime})` : `Unavailable: ${slot.reason || 'Booked or outside hours'}`}
                      onClick={() => {
                        setBookingTime(slot.time);
                        if (errorMsg) setErrorMsg(null);
                      }}
                      style={{
                        padding: '4px 6px',
                        borderRadius: '4px',
                        fontSize: '11.5px',
                        fontWeight: isSelected ? 700 : 500,
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
                        opacity: slot.available ? 1 : 0.4,
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
              <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                {loadingSlots
                  ? 'Loading practitioner availability...'
                  : fetchError
                  ? 'Unable to load available times. Please try again.'
                  : availabilityStatus === 'DOCTOR_SCHEDULE_CLOSED'
                  ? 'This dentist is not working on this date.'
                  : availabilityStatus === 'DOCTOR_ON_LEAVE'
                  ? 'This dentist is on leave on this date.'
                  : availabilityStatus === 'CLINIC_CLOSED'
                  ? 'Clinic is closed on this date.'
                  : availabilityStatus === 'NO_AVAILABLE_SLOTS'
                  ? 'No available appointment slots for this doctor on this date.'
                  : availabilityMessage || 'No open slots on selected date.'}
              </p>
            )}
          </div>
        )}

        {/* Modal Footer Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
          <Button type="button" variant="secondary" onClick={handleClose} style={{ padding: '6px 14px', fontSize: '13px' }}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting} style={{ padding: '6px 16px', fontSize: '13px' }}>
            {submitting ? 'Confirming...' : 'Confirm & Schedule'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
