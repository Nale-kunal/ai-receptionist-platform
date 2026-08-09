import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/hooks';
import {
  Building,
  Clock,
  Phone,
  HelpCircle,
  UserPlus,
  Bot,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
} from 'lucide-react';

const STEPS = [
  { id: 'practice', label: 'Practice Info', icon: Building },
  { id: 'hours', label: 'Business Hours', icon: Clock },
  { id: 'phone', label: 'Phone Number', icon: Phone },
  { id: 'faqs', label: 'FAQs', icon: HelpCircle },
  { id: 'team', label: 'Invite Team', icon: UserPlus },
  { id: 'test', label: 'Test AI', icon: Bot },
];

export const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState(false);

  // Form state
  const [practice, setPractice] = useState({ name: '', phone: '', email: user?.email || '', address: '' });
  const [hours, setHours] = useState({ businessHours: '09:00 - 17:00', timezone: 'America/New_York', workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] });
  const [phoneNumber, setPhoneNumber] = useState('');
  const [faqs, setFaqs] = useState([
    { question: '', answer: '' },
    { question: '', answer: '' },
    { question: '', answer: '' },
  ]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('receptionist');
  const [invitedMembers, setInvitedMembers] = useState<string[]>([]);

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const handleDayToggle = (day: string) => {
    const days = [...hours.workingDays];
    const idx = days.indexOf(day);
    if (idx > -1) days.splice(idx, 1);
    else days.push(day);
    setHours({ ...hours, workingDays: days });
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;
    try {
      const { api } = await import('../services/api');
      await api.inviteUser(inviteEmail, inviteRole);
      setInvitedMembers([...invitedMembers, inviteEmail]);
      setInviteEmail('');
    } catch (err) {
      console.error('Failed to invite:', err);
    }
  };

  const handleSavePractice = async () => {
    try {
      const { api } = await import('../services/api');
      await api.updateClinicSettings({
        clinicName: practice.name,
        contactPhone: practice.phone,
        contactEmail: practice.email,
        address: practice.address,
      });
    } catch (err) {
      console.error('Failed to save practice info:', err);
    }
  };

  const handleSaveHours = async () => {
    try {
      const { api } = await import('../services/api');
      await api.updateClinicSettings({
        businessHours: hours.businessHours,
        timezone: hours.timezone,
        workingDays: hours.workingDays,
      });
    } catch (err) {
      console.error('Failed to save hours:', err);
    }
  };

  const handleSaveFaqs = async () => {
    try {
      const { api } = await import('../services/api');
      for (const faq of faqs) {
        if (faq.question.trim() && faq.answer.trim()) {
          await api.createFAQ(faq);
        }
      }
    } catch (err) {
      console.error('Failed to save FAQs:', err);
    }
  };

  const handleNext = async () => {
    // Save current step data
    if (currentStep === 0) await handleSavePractice();
    if (currentStep === 1) await handleSaveHours();
    if (currentStep === 3) await handleSaveFaqs();

    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setCompleted(true);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  if (completed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', textAlign: 'center', gap: '20px' }}>
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--success), #059669)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)',
          }}
        >
          <Sparkles size={36} color="#fff" />
        </div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Your AI Receptionist is Live! 🎉
        </h1>
        <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', maxWidth: '480px', lineHeight: 1.6 }}>
          Your practice is set up and your AI receptionist is ready to answer calls, book appointments, and help patients — 24/7.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/')}
          style={{ padding: '12px 32px', fontSize: '1rem', fontWeight: 600, borderRadius: '10px', marginTop: '8px' }}
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  const step = STEPS[currentStep];
  const StepIcon = step.icon;

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      {/* Progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '32px' }}>
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 700,
                backgroundColor: i <= currentStep ? 'var(--primary)' : 'var(--bg-tertiary)',
                color: i <= currentStep ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.2s ease',
                flexShrink: 0,
              }}
            >
              {i < currentStep ? <CheckCircle2 size={16} /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: '2px',
                  backgroundColor: i < currentStep ? 'var(--primary)' : 'var(--border-color)',
                  transition: 'background-color 0.2s ease',
                }}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <StepIcon size={22} style={{ color: 'var(--primary)' }} />
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>{step.label}</h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Step {currentStep + 1} of {STEPS.length}
        </p>
      </div>

      {/* Step Content */}
      <div className="card" style={{ marginBottom: '24px' }}>
        {currentStep === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>Tell us about your dental practice.</p>
            <div className="flex flex-col gap-2 w-full">
              <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Practice Name</label>
              <input className="input" placeholder="e.g. Sunshine Dental Care" value={practice.name} onChange={(e) => setPractice({ ...practice, name: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="flex flex-col gap-2 w-full">
                <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Phone</label>
                <input className="input" placeholder="+1 (555) 000-0000" value={practice.phone} onChange={(e) => setPractice({ ...practice, phone: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2 w-full">
                <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Email</label>
                <input className="input" type="email" value={practice.email} onChange={(e) => setPractice({ ...practice, email: e.target.value })} />
              </div>
            </div>
            <div className="flex flex-col gap-2 w-full">
              <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Address</label>
              <input className="input" placeholder="123 Main St, Suite 100, City, State" value={practice.address} onChange={(e) => setPractice({ ...practice, address: e.target.value })} />
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>When is your practice open?</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="flex flex-col gap-2 w-full">
                <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Daily Hours</label>
                <input className="input" value={hours.businessHours} onChange={(e) => setHours({ ...hours, businessHours: e.target.value })} placeholder="09:00 - 17:00" />
              </div>
              <div className="flex flex-col gap-2 w-full">
                <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Timezone</label>
                <select className="input" value={hours.timezone} onChange={(e) => setHours({ ...hours, timezone: e.target.value })}>
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="Europe/London">London (GMT)</option>
                  <option value="Australia/Sydney">Sydney (AEST)</option>
                  <option value="Asia/Singapore">Singapore (SGT)</option>
                  <option value="Asia/Dubai">Dubai (GST)</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Working Days</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {daysOfWeek.map((day) => (
                  <label key={day} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={hours.workingDays.includes(day)} onChange={() => handleDayToggle(day)} style={{ accentColor: 'var(--primary)' }} />
                    <span>{day}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
              Enter the phone number patients will call. Your AI receptionist will answer on this line.
            </p>
            <div className="flex flex-col gap-2 w-full">
              <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Phone Number</label>
              <input className="input" placeholder="+1 (800) 555-0199" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              You can configure this later in Settings → Advanced → Phone Numbers.
            </p>
          </div>
        )}

        {currentStep === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
              Add common questions patients ask. Your AI receptionist will use these to answer callers.
            </p>
            {faqs.map((faq, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <input className="input" placeholder={`Question ${i + 1} — e.g. "What are your hours?"`} value={faq.question} onChange={(e) => { const updated = [...faqs]; updated[i].question = e.target.value; setFaqs(updated); }} />
                <textarea className="input" rows={2} placeholder="Answer..." value={faq.answer} onChange={(e) => { const updated = [...faqs]; updated[i].answer = e.target.value; setFaqs(updated); }} />
              </div>
            ))}
            <button className="btn btn-secondary" onClick={() => setFaqs([...faqs, { question: '', answer: '' }])} style={{ alignSelf: 'flex-start', padding: '6px 12px', fontSize: '0.8rem' }}>
              + Add Another FAQ
            </button>
          </div>
        )}

        {currentStep === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
              Invite your team to access the platform. You can always add more later.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input className="input" style={{ flex: 1 }} placeholder="colleague@practice.com" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
              <select className="input" style={{ width: '160px' }} value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                <option value="receptionist">Receptionist</option>
                <option value="doctor">Dentist</option>
                <option value="admin">Practice Owner</option>
              </select>
              <button className="btn btn-primary" onClick={handleInvite} style={{ padding: '8px 16px', flexShrink: 0 }}>Invite</button>
            </div>
            {invitedMembers.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                {invitedMembers.map((email) => (
                  <div key={email} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--success)' }}>
                    <CheckCircle2 size={14} /> <span>Invited {email}</span>
                  </div>
                ))}
              </div>
            )}
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              You can skip this step and invite team members later from Settings → Team.
            </p>
          </div>
        )}

        {currentStep === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center', textAlign: 'center', padding: '24px 0' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={32} color="#fff" />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Test Your AI Receptionist</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: '400px' }}>
              Your AI receptionist is configured and ready. You can call your connected phone number to hear it in action, or proceed to your dashboard.
            </p>
            <button className="btn btn-secondary" style={{ padding: '10px 20px', fontSize: '0.9rem' }} onClick={() => navigate('/ai-receptionist/live')}>
              Open Live Calls Monitor
            </button>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {currentStep > 0 ? (
          <button className="btn btn-secondary" onClick={handleBack} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px' }}>
            <ChevronLeft size={16} /> Back
          </button>
        ) : (
          <div />
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          {currentStep < STEPS.length - 1 && (
            <button className="btn btn-secondary" onClick={() => setCurrentStep(currentStep + 1)} style={{ padding: '10px 16px', fontSize: '0.85rem' }}>
              Skip
            </button>
          )}
          <button className="btn btn-primary" onClick={handleNext} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', fontWeight: 600 }}>
            {currentStep === STEPS.length - 1 ? 'Finish Setup' : 'Continue'} <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
