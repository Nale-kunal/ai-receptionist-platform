import { describe, it, expect, beforeAll } from 'vitest';

// Basic LocalStorage mock environment for Node
class LocalStorageMock {
  private store: Record<string, string> = {};

  public clear() {
    this.store = {};
  }

  public getItem(key: string): string | null {
    return this.store[key] || null;
  }

  public setItem(key: string, value: string) {
    this.store[key] = String(value);
  }

  public removeItem(key: string) {
    delete this.store[key];
  }
}

describe('Frontend API Local Storage & State Engine', () => {
  let mockStore: LocalStorageMock;

  beforeAll(() => {
    mockStore = new LocalStorageMock();
    global.localStorage = mockStore as any;
  });

  it('correctly saves and retrieves theme states', () => {
    mockStore.setItem('e2e_theme', 'dark');
    expect(mockStore.getItem('e2e_theme')).toBe('dark');

    mockStore.setItem('e2e_theme', 'light');
    expect(mockStore.getItem('e2e_theme')).toBe('light');
  });

  it('correctly tracks simulated appointments list data', () => {
    const list = [
      { id: 'apt_1', patientName: 'Alice Green', status: 'scheduled' },
      { id: 'apt_2', patientName: 'Bob Vance', status: 'cancelled' },
    ];

    mockStore.setItem('db_appointments', JSON.stringify(list));

    const retrieved = JSON.parse(mockStore.getItem('db_appointments') || '[]');
    expect(retrieved).toHaveLength(2);
    expect(retrieved[0].patientName).toBe('Alice Green');
    expect(retrieved[1].status).toBe('cancelled');
  });
});
