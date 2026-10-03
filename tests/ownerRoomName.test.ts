import {
  sanitizeOwnerName,
  buildOwnerRoomName,
  parseOwnerRoomIndex,
  buildOwnerRoomPatterns,
} from '../src/utils/ownerRoomName';
import { GuildMember } from 'discord.js';

describe('ownerRoomName', () => {
  describe('sanitizeOwnerName', () => {
    it('uses displayName when available', () => {
      const member = {
        displayName: 'Alice',
        user: { username: 'alice123' },
      } as GuildMember;
      
      expect(sanitizeOwnerName(member)).toBe('Alice');
    });

    it('falls back to username when displayName is empty', () => {
      const member = {
        displayName: '',
        user: { username: 'bob456' },
      } as GuildMember;
      
      expect(sanitizeOwnerName(member)).toBe('bob456');
    });

    it('collapses whitespace', () => {
      const member = {
        displayName: 'Alice   Cooper',
        user: { username: 'alice' },
      } as GuildMember;
      
      expect(sanitizeOwnerName(member)).toBe('Alice Cooper');
    });

    it('strips control characters', () => {
      const member = {
        displayName: 'Alice\x00\x1FCooper',
        user: { username: 'alice' },
      } as GuildMember;
      
      expect(sanitizeOwnerName(member)).toBe('AliceCooper');
    });

    it('trims leading and trailing spaces', () => {
      const member = {
        displayName: '  Alice  ',
        user: { username: 'alice' },
      } as GuildMember;
      
      expect(sanitizeOwnerName(member)).toBe('Alice');
    });

    it('returns "User" when name is empty after sanitization', () => {
      const member = {
        displayName: '   ',
        user: { username: '' },
      } as GuildMember;
      
      expect(sanitizeOwnerName(member)).toBe('User');
    });
  });

  describe('buildOwnerRoomName', () => {
    it('builds unnumbered name for index 1 without prefix', () => {
      expect(buildOwnerRoomName('', 'Alice', 1)).toBe("Alice's Room");
    });

    it('builds numbered name for index 2+ without prefix', () => {
      expect(buildOwnerRoomName('', 'Alice', 2)).toBe("Alice's Room 2");
      expect(buildOwnerRoomName('', 'Alice', 3)).toBe("Alice's Room 3");
    });

    it('builds unnumbered name for index 1 with prefix', () => {
      expect(buildOwnerRoomName('General', 'Bob', 1)).toBe("General Bob's Room");
    });

    it('builds numbered name for index 2+ with prefix', () => {
      expect(buildOwnerRoomName('General', 'Bob', 2)).toBe("General Bob's Room 2");
      expect(buildOwnerRoomName('General', 'Bob', 3)).toBe("General Bob's Room 3");
    });

    it('handles names ending in s', () => {
      expect(buildOwnerRoomName('', 'James', 1)).toBe("James's Room");
      expect(buildOwnerRoomName('', 'James', 2)).toBe("James's Room 2");
    });

    it('truncates long names to fit with [LOCKED] prefix', () => {
      const longName = 'A'.repeat(100);
      const result = buildOwnerRoomName('', longName, 1);
      
      // Should be truncated to allow for "[LOCKED] " (9 chars)
      // Max channel name is 100, so unlocked name can be up to 91
      expect(result.length).toBeLessThanOrEqual(91);
      
      // Verify that adding [LOCKED] prefix would not exceed 100
      const locked = `[LOCKED] ${result}`;
      expect(locked.length).toBeLessThanOrEqual(100);
    });

    it('truncates long names with prefix and number', () => {
      const longName = 'B'.repeat(100);
      const result = buildOwnerRoomName('VeryLongPrefix', longName, 999);
      
      expect(result.length).toBeLessThanOrEqual(91);
      
      // Verify that adding [LOCKED] prefix would not exceed 100
      const locked = `[LOCKED] ${result}`;
      expect(locked.length).toBeLessThanOrEqual(100);
    });
  });

  describe('buildOwnerRoomPatterns', () => {
    it('builds patterns for unnumbered and numbered rooms', () => {
      const [unnumbered, numbered] = buildOwnerRoomPatterns('', 'Alice');
      
      expect(unnumbered.test("Alice's Room")).toBe(true);
      expect(unnumbered.test("Alice's Room 2")).toBe(false);
      
      expect(numbered.test("Alice's Room 2")).toBe(true);
      expect(numbered.test("Alice's Room 999")).toBe(true);
      expect(numbered.test("Alice's Room")).toBe(false);
    });

    it('builds patterns with prefix', () => {
      const [unnumbered, numbered] = buildOwnerRoomPatterns('General', 'Bob');
      
      expect(unnumbered.test("General Bob's Room")).toBe(true);
      expect(unnumbered.test("Bob's Room")).toBe(false);
      
      expect(numbered.test("General Bob's Room 2")).toBe(true);
      expect(numbered.test("Bob's Room 2")).toBe(false);
    });

    it('escapes special regex characters in names', () => {
      const [unnumbered] = buildOwnerRoomPatterns('', 'Alice (Pro)');
      
      expect(unnumbered.test("Alice (Pro)'s Room")).toBe(true);
      expect(unnumbered.test("Alice Pro's Room")).toBe(false);
    });
  });

  describe('parseOwnerRoomIndex', () => {
    it('returns 1 for unnumbered rooms', () => {
      expect(parseOwnerRoomIndex("Alice's Room", '', 'Alice')).toBe(1);
      expect(parseOwnerRoomIndex("General Bob's Room", 'General', 'Bob')).toBe(1);
    });

    it('returns the number for numbered rooms', () => {
      expect(parseOwnerRoomIndex("Alice's Room 2", '', 'Alice')).toBe(2);
      expect(parseOwnerRoomIndex("Alice's Room 99", '', 'Alice')).toBe(99);
      expect(parseOwnerRoomIndex("General Bob's Room 3", 'General', 'Bob')).toBe(3);
    });

    it('returns null for non-matching rooms', () => {
      expect(parseOwnerRoomIndex("Bob's Room", '', 'Alice')).toBeNull();
      expect(parseOwnerRoomIndex("Alice room", '', 'Alice')).toBeNull();
      expect(parseOwnerRoomIndex("General Alice's Room", '', 'Alice')).toBeNull();
    });

    it('handles rooms with special characters in owner name', () => {
      expect(parseOwnerRoomIndex("Alice (Pro)'s Room", '', 'Alice (Pro)')).toBe(1);
      expect(parseOwnerRoomIndex("Alice (Pro)'s Room 5", '', 'Alice (Pro)')).toBe(5);
    });
  });
});
