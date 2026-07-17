import React, { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { api } from '../services/api';
import type { ApiAppointment } from '../services/api';

export const CalendarPage: React.FC = () => {
  const [appointments, setAppointments] = useState<ApiAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.getAppointments();
        setAppointments(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Simple grid of July 2026 calendar days
  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);

  const getAppointmentsForDay = (day: number): ApiAppointment[] => {
    const formattedDay = `2026-07-${day < 10 ? `0${day}` : day}`;
    return appointments.filter((a) => a.date === formattedDay && a.status !== 'cancelled');
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h1 className="mb-2">Calendar Scheduler</h1>
        <p>Interactive calendar grid visualizer for clinic patient appointments.</p>
      </div>

      <Card>
        <div className="flex justify-between items-center mb-6">
          <h2 style={{ fontSize: '1.25rem' }}>July 2026</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Month view</span>
        </div>

        {/* Days Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '8px',
            textAlign: 'center',
            fontWeight: 600,
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            marginBottom: '8px',
          }}
        >
          <div>Sun</div>
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div>Sat</div>
        </div>

        {/* Calendar Grid */}
        {loading ? (
          <p>Loading schedule grid...</p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '8px',
            }}
          >
            {/* Blank offsets to align start of July 2026 (Wednesday is 1st of July) */}
            <div style={{ minHeight: '90px', backgroundColor: 'var(--bg-secondary)', opacity: 0.3 }} />
            <div style={{ minHeight: '90px', backgroundColor: 'var(--bg-secondary)', opacity: 0.3 }} />
            
            {daysInMonth.map((day) => {
              const dayApts = getAppointmentsForDay(day);
              return (
                <div
                  key={day}
                  style={{
                    minHeight: '100px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius)',
                    padding: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {day}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexGrow: 1, overflowY: 'auto' }}>
                    {dayApts.map((a) => (
                      <div
                        key={a.id}
                        style={{
                          fontSize: '0.7rem',
                          backgroundColor: 'var(--primary-light)',
                          color: 'var(--primary)',
                          padding: '2px 4px',
                          borderRadius: '4px',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          fontWeight: 500,
                        }}
                        title={`${a.patientName} - ${a.time}`}
                      >
                        {a.time} {a.patientName}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};
