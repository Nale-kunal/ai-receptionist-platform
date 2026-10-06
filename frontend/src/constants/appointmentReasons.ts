/**
 * Canonical Dental Appointment Reasons and Display Mappings
 */

export interface AppointmentReasonOption {
  code: string;
  label: string;
}

export const APPOINTMENT_REASONS: AppointmentReasonOption[] = [
  { code: 'routine_checkup', label: 'Routine Check-up / Dental Examination' },
  { code: 'cleaning', label: 'Dental Cleaning / Hygiene' },
  { code: 'tooth_pain', label: 'Tooth Pain / Toothache' },
  { code: 'emergency', label: 'Dental Emergency' },
  { code: 'consultation', label: 'Consultation' },
  { code: 'tooth_sensitivity', label: 'Tooth Sensitivity' },
  { code: 'cavity', label: 'Cavity / Tooth Decay' },
  { code: 'filling', label: 'Filling' },
  { code: 'crown_bridge', label: 'Crown / Bridge' },
  { code: 'root_canal', label: 'Root Canal Treatment' },
  { code: 'extraction', label: 'Tooth Extraction' },
  { code: 'wisdom_tooth', label: 'Wisdom Tooth Consultation' },
  { code: 'gum_problem', label: 'Gum / Periodontal Problem' },
  { code: 'broken_tooth', label: 'Broken / Chipped Tooth' },
  { code: 'implant_consultation', label: 'Dental Implant Consultation' },
  { code: 'denture', label: 'Denture Consultation / Adjustment' },
  { code: 'orthodontic', label: 'Orthodontic Consultation' },
  { code: 'cosmetic', label: 'Cosmetic Dentistry Consultation' },
  { code: 'follow_up', label: 'Follow-up Appointment' },
  { code: 'post_treatment_review', label: 'Post-Treatment Review' },
  { code: 'other', label: 'Other' },
];

export const APPOINTMENT_REASON_LABEL_MAP: Record<string, string> = {
  routine_checkup: 'Routine Check-up / Dental Examination',
  cleaning: 'Dental Cleaning / Hygiene',
  tooth_pain: 'Tooth Pain / Toothache',
  emergency: 'Dental Emergency',
  consultation: 'Consultation',
  tooth_sensitivity: 'Tooth Sensitivity',
  cavity: 'Cavity / Tooth Decay',
  filling: 'Filling',
  crown_bridge: 'Crown / Bridge',
  root_canal: 'Root Canal Treatment',
  extraction: 'Tooth Extraction',
  wisdom_tooth: 'Wisdom Tooth Consultation',
  gum_problem: 'Gum / Periodontal Problem',
  broken_tooth: 'Broken / Chipped Tooth',
  implant_consultation: 'Dental Implant Consultation',
  denture: 'Denture Consultation / Adjustment',
  orthodontic: 'Orthodontic Consultation',
  cosmetic: 'Cosmetic Dentistry Consultation',
  follow_up: 'Follow-up Appointment',
  post_treatment_review: 'Post-Treatment Review',
  other: 'Other',
  // Backward compatibility for legacy values
  checkup: 'Routine Check-up / Dental Examination',
  whitening: 'Teeth Whitening',
  orthodontics: 'Orthodontic Consultation',
};

export function getAppointmentReasonLabel(code?: string | null): string {
  if (!code) return 'Routine Check-up / Dental Examination';
  const normalized = code.toLowerCase().trim();
  return APPOINTMENT_REASON_LABEL_MAP[normalized] || code;
}
