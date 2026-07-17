import React, { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { api } from '../services/api';

export const AiConfiguration: React.FC = () => {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.getAiConfig();
        setConfig(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateAiConfig(config);
      alert('AI Configuration updated successfully!');
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <p>Loading configuration settings...</p>;

  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h1 className="mb-2">AI Routing & Voice Settings</h1>
        <p>Manage provider models, vocal synthesis models, timeouts, and VAD parameters.</p>
      </div>

      <Card style={{ maxWidth: '600px' }}>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 w-full">
            <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
              LLM Model Target
            </label>
            <select
              value={config.model}
              onChange={(e) => setConfig({ ...config, model: e.target.value })}
              className="input"
            >
              <option value="gpt-4o-realtime">gpt-4o-realtime (OpenAI)</option>
              <option value="gemini-2.0-flash-exp">gemini-2.0-flash-exp (Google)</option>
            </select>
          </div>

          <div className="flex flex-col gap-2 w-full">
            <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Synthetic Voice Tone
            </label>
            <select
              value={config.voice}
              onChange={(e) => setConfig({ ...config, voice: e.target.value })}
              className="input"
            >
              <option value="alloy">Alloy (Neutral)</option>
              <option value="echo">Echo (Warm)</option>
              <option value="shimmer">Shimmer (Professional)</option>
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
            label="Voice Activity Detection (VAD) Threshold (dB)"
            value={config.interruptionThresholdDb}
            onChange={(e) => setConfig({ ...config, interruptionThresholdDb: Number(e.target.value) })}
          />

          <Button type="submit" style={{ marginTop: '12px' }}>
            Update AI Settings
          </Button>
        </form>
      </Card>
    </div>
  );
};
