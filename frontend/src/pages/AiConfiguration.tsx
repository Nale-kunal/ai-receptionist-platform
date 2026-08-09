import React, { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { api } from '../services/api';
import { Settings, Speech, PhoneForwarded, Calendar } from 'lucide-react';

export const AiConfiguration: React.FC = () => {
  const [config, setConfig] = useState<any>({
    model: 'gpt-4o-realtime',
    voice: 'alloy',
    temperature: 0.6,
    maxDurationMs: 900000,
    inactivityTimeoutMs: 30000,
    interruptionThresholdDb: -45,
    greeting: 'Hello! Thank you for calling our dental office. How can I assist you today?',
    tone: 'Professional',
    bookingRules: 'Only schedule appointments inside available slot periods.',
    cancellationRules: 'Cancellations should be requested at least 24 hours in advance.',
    emergencyRules: 'If a medical emergency is declared, advise the caller to hang up and dial 911.',
    transferRules: 'Transfer complex billing calls or angry patients to the clinic staff.',
    businessHoursRules: 'Monday to Friday: 9:00 AM - 5:00 PM.',
  });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.getAiConfig();
        setConfig(res);
      } catch (err) {
        console.error(err);
        setErrorMsg('Failed to load active AI configurations.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const updated = await api.updateAiConfig(config);
      setConfig(updated);
      setSuccessMsg('AI Receptionist Configuration updated successfully!');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to persist configuration rules. Please check validation limits.');
    }
  };

  if (loading) return <p style={{ padding: '24px', color: 'var(--text-secondary)' }}>Loading configuration settings...</p>;

  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h1 className="mb-2">AI Receptionist Settings</h1>
        <p>Configure the voice identity, greeting responses, and booking instructions for your AI dental receptionist.</p>
      </div>

      {successMsg && (
        <div style={{ padding: '12px 16px', backgroundColor: 'var(--success-light)', color: 'var(--success)', borderRadius: 'var(--radius)', border: '1px solid var(--success)', fontSize: '0.875rem' }}>
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div style={{ padding: '12px 16px', backgroundColor: 'var(--error-light)', color: 'var(--error)', borderRadius: 'var(--radius)', border: '1px solid var(--error)', fontSize: '0.875rem' }}>
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Left Column: Voice and prompt behavior rules */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Section 1: Greeting & Persona */}
          <Card>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Speech size={18} style={{ color: 'var(--primary)' }} />
              <span>Greeting & Persona</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="flex flex-col gap-2 w-full">
                <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Vocal Greeting Phrase
                </label>
                <textarea
                  value={config.greeting}
                  onChange={(e) => setConfig({ ...config, greeting: e.target.value })}
                  className="input"
                  rows={3}
                  required
                  placeholder="e.g. Hello! Thanks for calling Family Dentistry. How can I help you today?"
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  The first sentence spoken by the AI when a phone call connects.
                </span>
              </div>

              <div className="flex flex-col gap-2 w-full">
                <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Behavioral Voice Tone
                </label>
                <select
                  value={config.tone}
                  onChange={(e) => setConfig({ ...config, tone: e.target.value })}
                  className="input"
                >
                  <option value="Professional">Professional & Confident</option>
                  <option value="Friendly">Friendly & Welcoming</option>
                  <option value="Calm">Calm & Empathetic</option>
                  <option value="Natural">Natural & Conversational</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Section 2: Core Prompt Instructions */}
          <Card>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} style={{ color: 'var(--primary)' }} />
              <span>Office Rules & Instructions</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="flex flex-col gap-2 w-full">
                <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Business Hours Details
                </label>
                <textarea
                  value={config.businessHoursRules}
                  onChange={(e) => setConfig({ ...config, businessHoursRules: e.target.value })}
                  className="input"
                  rows={2}
                  placeholder="e.g. Monday-Friday: 9am - 5pm. Closed on holidays."
                />
              </div>

              <div className="flex flex-col gap-2 w-full">
                <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Appointment Booking Rules
                </label>
                <textarea
                  value={config.bookingRules}
                  onChange={(e) => setConfig({ ...config, bookingRules: e.target.value })}
                  className="input"
                  rows={3}
                  placeholder="e.g. Appointments are 30 minutes long. Standard cleaning slots are available daily."
                />
              </div>

              <div className="flex flex-col gap-2 w-full">
                <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Cancellation & Re-scheduling Policies
                </label>
                <textarea
                  value={config.cancellationRules}
                  onChange={(e) => setConfig({ ...config, cancellationRules: e.target.value })}
                  className="input"
                  rows={2}
                  placeholder="e.g. Rescheduling requires 24 hours notice."
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Routing & System voice params */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Section 3: Escalation & Routing */}
          <Card>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PhoneForwarded size={18} style={{ color: 'var(--primary)' }} />
              <span>Escalation & Forwarding</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="flex flex-col gap-2 w-full">
                <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Emergency Routing Instructions
                </label>
                <textarea
                  value={config.emergencyRules}
                  onChange={(e) => setConfig({ ...config, emergencyRules: e.target.value })}
                  className="input"
                  rows={3}
                  placeholder="e.g. If the patient has severe bleeding or excruciating pain, advise going to the ER."
                />
              </div>

              <div className="flex flex-col gap-2 w-full">
                <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Call Forwarding Conditions
                </label>
                <textarea
                  value={config.transferRules}
                  onChange={(e) => setConfig({ ...config, transferRules: e.target.value })}
                  className="input"
                  rows={3}
                  placeholder="e.g. Forward angry clients or complex insurance billing inquiries to the front desk."
                />
              </div>
            </div>
          </Card>

          {/* Section 4: System Parameters */}
          <Card>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={18} style={{ color: 'var(--primary)' }} />
              <span>Synthesis Voice Identity</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="flex flex-col gap-2 w-full">
                <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  OpenAI LLM Target Model
                </label>
                <select
                  value={config.model}
                  onChange={(e) => setConfig({ ...config, model: e.target.value })}
                  className="input"
                >
                  <option value="gpt-4o-realtime">gpt-4o-realtime (OpenAI GPT-4o)</option>
                  <option value="gpt-4o-mini-realtime">gpt-4o-mini-realtime (OpenAI Mini)</option>
                </select>
              </div>

              <div className="flex flex-col gap-2 w-full">
                <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Synthetic Voice Pitch / Tone
                </label>
                <select
                  value={config.voice}
                  onChange={(e) => setConfig({ ...config, voice: e.target.value })}
                  className="input"
                >
                  <option value="alloy">Alloy (Balanced)</option>
                  <option value="echo">Echo (Warm)</option>
                  <option value="shimmer">Shimmer (Professional)</option>
                  <option value="sage">Sage (Calm)</option>
                </select>
              </div>

              <Input
                type="number"
                label="Inactivity Timeout Limit (ms)"
                value={config.inactivityTimeoutMs}
                onChange={(e) => setConfig({ ...config, inactivityTimeoutMs: Number(e.target.value) })}
              />

              <Input
                type="number"
                label="Voice Activity Detection (VAD) Speech Threshold (dB)"
                value={config.interruptionThresholdDb}
                onChange={(e) => setConfig({ ...config, interruptionThresholdDb: Number(e.target.value) })}
              />
            </div>
          </Card>

          <Button type="submit" style={{ width: '100%', padding: '12px', fontWeight: 600 }}>
            Save Configuration Rules
          </Button>
        </div>
      </form>
    </div>
  );
};
