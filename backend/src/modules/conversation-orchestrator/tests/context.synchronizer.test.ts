import { ContextSynchronizer } from '../services/context.synchronizer';

describe('ContextSynchronizer', () => {
  let synchronizer: ContextSynchronizer;

  beforeEach(() => {
    synchronizer = new ContextSynchronizer();
  });

  it('synchronizes and merges conversation context data', () => {
    const base = synchronizer.synchronizeContext('s1', {
      tenantId: 'tenant-1',
      clinicId: 'clinic-2',
      conversationId: 'conv-3',
    });

    expect(base.tenantId).toBe('tenant-1');
    expect(base.clinicId).toBe('clinic-2');

    const updated = synchronizer.synchronizeContext('s1', {
      patientId: 'patient-4',
      variables: { test: 'val' },
    });

    expect(updated.patientId).toBe('patient-4');
    expect(updated.variables.test).toBe('val');
    expect(updated.tenantId).toBe('tenant-1'); // preserved
  });
});
