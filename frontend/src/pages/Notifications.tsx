import React, { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { api } from '../services/api';

export const Notifications: React.FC = () => {
  const [reminders, setReminders] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.getNotificationRules();
        setReminders(res);
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
      await api.updateNotificationRules(reminders);
      alert('Notification parameters saved successfully!');
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <p>Loading reminder configurations...</p>;

  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h1 className="mb-2">Notification & Reminder Rules</h1>
        <p>Configure automated appointment reminders and message templates.</p>
      </div>

      <Card style={{ maxWidth: '600px' }}>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="flex items-center justify-between mb-4">
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Enable Automated SMS reminders</span>
            <input
              type="checkbox"
              checked={reminders.smsEnabled}
              onChange={(e) => setReminders({ ...reminders, smsEnabled: e.target.checked })}
              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
            />
          </div>

          <div className="flex items-center justify-between mb-4">
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Enable Email notifications</span>
            <input
              type="checkbox"
              checked={reminders.emailEnabled}
              onChange={(e) => setReminders({ ...reminders, emailEnabled: e.target.checked })}
              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
            />
          </div>

          <Input
            type="number"
            label="Hours Before Appointment to Deliver Reminders"
            value={reminders.timeBeforeHours}
            onChange={(e) => setReminders({ ...reminders, timeBeforeHours: Number(e.target.value) })}
          />

          <div className="flex flex-col gap-2 w-full">
            <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
              SMS Message Template
            </label>
            <textarea
              rows={3}
              value={reminders.smsTemplate}
              onChange={(e) => setReminders({ ...reminders, smsTemplate: e.target.value })}
              className="input"
            />
          </div>

          <Button type="submit" style={{ marginTop: '12px' }}>
            Save Reminder Rules
          </Button>
        </form>
      </Card>
    </div>
  );
};
