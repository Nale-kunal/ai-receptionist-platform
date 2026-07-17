import React, { useEffect, useState } from 'react';
import { Table } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { api } from '../services/api';
import type { ApiDoctor } from '../services/api';

export const Doctors: React.FC = () => {
  const [doctors, setDoctors] = useState<ApiDoctor[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDoctors = async () => {
    try {
      const res = await api.getDoctors();
      setDoctors(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoctors();
  }, []);

  const handleToggleAvailability = async (id: string, current: ApiDoctor['availability']) => {
    try {
      const nextAvail: ApiDoctor['availability'] = current === 'available' ? 'busy' : 'available';
      await api.updateDoctor(id, { availability: nextAvail });
      loadDoctors();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h1 className="mb-2">Doctor Directory</h1>
        <p>Manage doctor schedules, medical specialties, and availability routing states.</p>
      </div>

      {loading ? (
        <p>Loading doctor registries...</p>
      ) : (
        <Table headers={['Doctor Name', 'Medical Specialty', 'Shift Hours', 'Availability', 'Actions']}>
          {doctors.map((d) => (
            <tr key={d.id}>
              <td style={{ fontWeight: 600 }}>{d.name}</td>
              <td>{d.specialty}</td>
              <td>{d.workingHours}</td>
              <td>
                <Badge
                  variant={
                    d.availability === 'available'
                      ? 'success'
                      : d.availability === 'busy'
                      ? 'warning'
                      : 'danger'
                  }
                >
                  {d.availability}
                </Badge>
              </td>
              <td>
                {d.availability !== 'vacation' && (
                  <Button
                    variant="secondary"
                    onClick={() => handleToggleAvailability(d.id, d.availability)}
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  >
                    Toggle Busy/Free
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
};
