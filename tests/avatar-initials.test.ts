import { initialsFor, hueFor } from '../src/components/AvatarInitials';

describe('AvatarInitials helpers', () => {
  it('renders initials from single / multi-word names', () => {
    expect(initialsFor('')).toBe('?');
    expect(initialsFor('Alex')).toBe('A');
    expect(initialsFor('Alex Rivera')).toBe('AR');
    expect(initialsFor('Mary Jane Parker')).toBe('MP');
  });
  it('hue is deterministic per input', () => {
    expect(hueFor('Alex')).toBe(hueFor('Alex'));
    expect(hueFor('Alex')).not.toBe(hueFor('Bailey'));
  });
  it('hue is in [0, 360)', () => {
    for (const name of ['a', 'Bailey', 'Zzzz', '🔥 flame']) {
      const h = hueFor(name);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
    }
  });
});
