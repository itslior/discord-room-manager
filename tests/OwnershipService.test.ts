import { OwnershipService } from '../src/services/OwnershipService';
import { roomStore } from '../src/state/RoomStore';
import { ManagedRoom } from '../src/types/domain';

jest.mock('../src/state/RoomStore');

describe('OwnershipService', () => {
  let service: OwnershipService;

  beforeEach(() => {
    service = new OwnershipService();
    jest.clearAllMocks();
  });

  describe('isOwner', () => {
    it('should return true for room owner', () => {
      const room: ManagedRoom = {
        channelId: 'channel1',
        guildId: 'guild1',
        ownerUserId: 'user1',
        createdAt: Date.now(),
        locked: false,
      };

      (roomStore.get as jest.Mock).mockReturnValue(room);

      expect(service.isOwner('user1', 'channel1')).toBe(true);
    });

    it('should return false for non-owner', () => {
      const room: ManagedRoom = {
        channelId: 'channel1',
        guildId: 'guild1',
        ownerUserId: 'user1',
        createdAt: Date.now(),
        locked: false,
      };

      (roomStore.get as jest.Mock).mockReturnValue(room);

      expect(service.isOwner('user2', 'channel1')).toBe(false);
    });

    it('should return false when room does not exist', () => {
      (roomStore.get as jest.Mock).mockReturnValue(undefined);

      expect(service.isOwner('user1', 'channel1')).toBe(false);
    });
  });

  describe('canTakeOwnership', () => {
    it('should allow when owner is not connected', () => {
      const room: ManagedRoom = {
        channelId: 'channel1',
        guildId: 'guild1',
        ownerUserId: 'user1',
        createdAt: Date.now(),
        locked: false,
      };

      (roomStore.get as jest.Mock).mockReturnValue(room);

      const mockMember = {
        guild: {
          members: {
            cache: new Map(),
          },
        },
        voice: {
          channelId: 'channel1',
        },
      } as any;

      const result = service.canTakeOwnership(mockMember, 'channel1');
      expect(result.allowed).toBe(true);
    });

    it('should deny when room does not exist', () => {
      (roomStore.get as jest.Mock).mockReturnValue(undefined);

      const mockMember = {
        voice: { channelId: 'channel1' },
      } as any;

      const result = service.canTakeOwnership(mockMember, 'channel1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not a managed room');
    });
  });
});
