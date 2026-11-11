import { ASSIGNABLE_ROLES, isManager, roleLabel } from '@/lib/roles';

describe('isManager', () => {
  test('true for MANAGER', () => {
    expect(isManager('MANAGER')).toBe(true);
  });

  test('false for PHARMACIST', () => {
    expect(isManager('PHARMACIST')).toBe(false);
  });

  test('false for STAFF', () => {
    expect(isManager('STAFF')).toBe(false);
  });

  test('false for TECHNICIAN', () => {
    expect(isManager('TECHNICIAN')).toBe(false);
  });

  test('case-sensitive: lowercase "manager" is not a manager', () => {
    expect(isManager('manager')).toBe(false);
  });

  test('false for null', () => {
    expect(isManager(null)).toBe(false);
  });

  test('false for undefined', () => {
    expect(isManager(undefined)).toBe(false);
  });

  test('false for empty string', () => {
    expect(isManager('')).toBe(false);
  });
});

describe('ASSIGNABLE_ROLES', () => {
  test('contains only D3-approved roles', () => {
    expect(ASSIGNABLE_ROLES).toEqual(['PHARMACIST', 'STAFF', 'TECHNICIAN']);
  });

  test('does not include MANAGER', () => {
    expect(ASSIGNABLE_ROLES).not.toContain('MANAGER');
  });

  test('does not include ADMIN', () => {
    expect(ASSIGNABLE_ROLES).not.toContain('ADMIN');
  });

  test('does not include OWNER', () => {
    expect(ASSIGNABLE_ROLES).not.toContain('OWNER');
  });
});

describe('roleLabel', () => {
  test('capitalizes first letter, lowercases the rest', () => {
    expect(roleLabel('MANAGER')).toBe('Manager');
    expect(roleLabel('PHARMACIST')).toBe('Pharmacist');
    expect(roleLabel('STAFF')).toBe('Staff');
    expect(roleLabel('TECHNICIAN')).toBe('Technician');
  });

  test('handles already-capitalized roles', () => {
    expect(roleLabel('Manager')).toBe('Manager');
  });

  test('returns empty string for null', () => {
    expect(roleLabel(null)).toBe('');
  });

  test('returns empty string for undefined', () => {
    expect(roleLabel(undefined)).toBe('');
  });
});