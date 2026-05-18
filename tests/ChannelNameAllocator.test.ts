import { ChannelNameAllocator } from '../src/services/ChannelNameAllocator';

describe('ChannelNameAllocator', () => {
  let allocator: ChannelNameAllocator;

  beforeEach(() => {
    allocator = new ChannelNameAllocator();
  });

  describe('findLowestFreeIndex', () => {
    it('should return 1 when no indices exist', () => {
      expect(allocator.findLowestFreeIndex([])).toBe(1);
    });

    it('should return 2 when 1 exists', () => {
      expect(allocator.findLowestFreeIndex([1])).toBe(2);
    });

    it('should return 1 when 2 and 3 exist', () => {
      expect(allocator.findLowestFreeIndex([2, 3])).toBe(1);
    });

    it('should find gap in middle', () => {
      expect(allocator.findLowestFreeIndex([1, 3, 5])).toBe(2);
    });

    it('should handle sequential numbers', () => {
      expect(allocator.findLowestFreeIndex([1, 2, 3, 4, 5])).toBe(6);
    });

    it('should work with unsorted input', () => {
      expect(allocator.findLowestFreeIndex([5, 1, 3])).toBe(2);
    });
  });
});
