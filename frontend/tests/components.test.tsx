import { describe, it, expect } from 'vitest';

describe('UI Card and Badges parameters', () => {
  it('correctly maps variant classes', () => {
    const getBadgeClass = (variant: 'success' | 'warning' | 'danger' | 'primary') => {
      return `badge badge-${variant}`;
    };

    expect(getBadgeClass('success')).toBe('badge badge-success');
    expect(getBadgeClass('warning')).toBe('badge badge-warning');
    expect(getBadgeClass('danger')).toBe('badge badge-danger');
    expect(getBadgeClass('primary')).toBe('badge badge-primary');
  });

  it('correctly maps button variants class properties', () => {
    const getBtnClass = (variant: 'primary' | 'secondary' | 'danger') => {
      return `btn btn-${variant}`;
    };

    expect(getBtnClass('primary')).toBe('btn btn-primary');
    expect(getBtnClass('secondary')).toBe('btn btn-secondary');
    expect(getBtnClass('danger')).toBe('btn btn-danger');
  });
});
