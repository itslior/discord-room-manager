import {
  addLockedPrefix,
  hasLockedPrefix,
  removeLockedPrefix,
} from '../src/utils/roomChannelName';

describe('roomChannelName', () => {
  describe('addLockedPrefix', () => {
    it('adds prefix to unlocked room names', () => {
      expect(addLockedPrefix('Voice 1')).toBe('[LOCKED] Voice 1');
    });

    it('does not double-prefix', () => {
      expect(addLockedPrefix('[LOCKED] Voice 1')).toBe('[LOCKED] Voice 1');
    });

    it('truncates to Discord max length', () => {
      const longName = 'a'.repeat(100);
      expect(addLockedPrefix(longName)).toHaveLength(100);
      expect(addLockedPrefix(longName).startsWith('[LOCKED] ')).toBe(true);
    });
  });

  describe('removeLockedPrefix', () => {
    it('removes prefix when present', () => {
      expect(removeLockedPrefix('[LOCKED] Voice 1')).toBe('Voice 1');
    });

    it('leaves name unchanged when prefix is absent', () => {
      expect(removeLockedPrefix('Voice 1')).toBe('Voice 1');
    });
  });

  describe('hasLockedPrefix', () => {
    it('detects locked prefix', () => {
      expect(hasLockedPrefix('[LOCKED] Voice 1')).toBe(true);
    });

    it('returns false without prefix', () => {
      expect(hasLockedPrefix('Voice 1')).toBe(false);
    });
  });
});
