import { RoomControlAuth } from '../src/services/RoomControlAuth';
import { roomStore } from '../src/state/RoomStore';
import { configStore } from '../src/state/ConfigStore';
import { ManagedRoom, GuildConfig } from '../src/types/domain';
import { GuildMember, VoiceState, Guild } from 'discord.js';

jest.mock('../src/state/RoomStore');
jest.mock('../src/state/ConfigStore');

describe('RoomControlAuth', () => {
  let auth: RoomControlAuth;
  let mockMember: Partial<GuildMember>;
  let mockGuild: Partial<Guild>;
  let mockVoiceState: Partial<VoiceState>;

  beforeEach(() => {
    auth = new RoomControlAuth();
    jest.clearAllMocks();

    mockGuild = {
      id: 'guild1',
      members: {
        cache: new Map(),
      } as any,
    };

    mockVoiceState = {
      channelId: 'channel1',
    };

    mockMember = {
      id: 'user1',
      guild: mockGuild as Guild,
      voice: mockVoiceState as VoiceState,
    };
  });

  describe('checkOwnerInRoom', () => {
    it('should pass when owner is in their room', () => {
      const room: ManagedRoom = {
        channelId: 'channel1',
        guildId: 'guild1',
        ownerUserId: 'user1',
        createdAt: Date.now(),
        locked: false,
      };

      (roomStore.getByOwner as jest.Mock).mockReturnValue(room);

      const result = auth.checkOwnerInRoom(mockMember as GuildMember);

      expect(result.ok).toBe(true);
      expect(result.roomChannelId).toBe('channel1');
    });

    it('should fail when user does not own a room', () => {
      (roomStore.getByOwner as jest.Mock).mockReturnValue(undefined);

      const result = auth.checkOwnerInRoom(mockMember as GuildMember);

      expect(result.ok).toBe(false);
      expect(result.reason).toContain("don't own");
    });

    it('should fail when owner is not in their room', () => {
      const room: ManagedRoom = {
        channelId: 'channel1',
        guildId: 'guild1',
        ownerUserId: 'user1',
        createdAt: Date.now(),
        locked: false,
      };

      (roomStore.getByOwner as jest.Mock).mockReturnValue(room);
      mockVoiceState.channelId = 'different-channel';

      const result = auth.checkOwnerInRoom(mockMember as GuildMember);

      expect(result.ok).toBe(false);
      expect(result.reason).toContain('must be in your voice room');
    });

    it('should fail when UI not enabled and requireUiEnabled is true', () => {
      const config: Partial<GuildConfig> = {
        guildId: 'guild1',
        roomControlUi: {
          enabled: false,
          panelChannelId: 'channel2',
          panelMessageId: 'msg1',
        },
      };

      (configStore.get as jest.Mock).mockReturnValue(config);

      const result = auth.checkOwnerInRoom(mockMember as GuildMember, true);

      expect(result.ok).toBe(false);
      expect(result.reason).toContain('not enabled');
    });
  });

  describe('checkTargetInRoom', () => {
    let mockTarget: Partial<GuildMember>;

    beforeEach(() => {
      mockTarget = {
        id: 'user2',
        voice: { channelId: 'channel1' } as VoiceState,
      };
    });

    it('should pass when target is in the room', () => {
      const result = auth.checkTargetInRoom(
        mockMember as GuildMember,
        mockTarget as GuildMember,
        'channel1'
      );

      expect(result.ok).toBe(true);
    });

    it('should fail when target is the owner', () => {
      mockTarget.id = 'user1';

      const result = auth.checkTargetInRoom(
        mockMember as GuildMember,
        mockTarget as GuildMember,
        'channel1'
      );

      expect(result.ok).toBe(false);
      expect(result.reason).toContain('cannot target yourself');
    });

    it('should fail when target is not in the room', () => {
      mockTarget.voice = { channelId: 'different-channel' } as VoiceState;

      const result = auth.checkTargetInRoom(
        mockMember as GuildMember,
        mockTarget as GuildMember,
        'channel1'
      );

      expect(result.ok).toBe(false);
      expect(result.reason).toContain('must be in your voice room');
    });
  });

  describe('checkCanTakeOwnership', () => {
    it('should pass when conditions are met', () => {
      const room: ManagedRoom = {
        channelId: 'channel1',
        guildId: 'guild1',
        ownerUserId: 'user2',
        createdAt: Date.now(),
        locked: false,
      };

      (roomStore.get as jest.Mock).mockReturnValue(room);
      (mockGuild.members!.cache as Map<string, GuildMember>).set('user2', {
        voice: { channelId: 'different-channel' } as VoiceState,
      } as GuildMember);

      const result = auth.checkCanTakeOwnership(mockMember as GuildMember, 'channel1');

      expect(result.ok).toBe(true);
    });

    it('should fail when original owner is still connected', () => {
      const room: ManagedRoom = {
        channelId: 'channel1',
        guildId: 'guild1',
        ownerUserId: 'user2',
        createdAt: Date.now(),
        locked: false,
      };

      (roomStore.get as jest.Mock).mockReturnValue(room);
      (mockGuild.members!.cache as Map<string, GuildMember>).set('user2', {
        voice: { channelId: 'channel1' } as VoiceState,
      } as GuildMember);

      const result = auth.checkCanTakeOwnership(mockMember as GuildMember, 'channel1');

      expect(result.ok).toBe(false);
      expect(result.reason).toContain('original owner is still connected');
    });
  });
});
