import { RoleAccessService } from '../src/services/RoleAccessService';
import { GuildConfig } from '../src/types/domain';
import { Collection } from 'discord.js';

describe('RoleAccessService', () => {
  let service: RoleAccessService;

  beforeEach(() => {
    service = new RoleAccessService();
  });

  describe('checkAccess', () => {
    it('should allow when no presets configured', async () => {
      const config: GuildConfig = {
        guildId: 'guild1',
        lobbyChannelId: 'lobby1',
        commandChannelId: 'cmd1',
        namePrefix: 'VC',
        rolePresets: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const mockMember = {
        roles: {
          cache: new Collection(),
        },
      } as any;

      const result = await service.checkAccess(mockMember, config);
      expect(result).toBe(true);
    });

    it('should allow when user has required role', async () => {
      const config: GuildConfig = {
        guildId: 'guild1',
        lobbyChannelId: 'lobby1',
        commandChannelId: 'cmd1',
        namePrefix: 'VC',
        rolePresets: {
          'diamond+': ['role1', 'role2'],
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const mockRoles = new Collection();
      mockRoles.set('role1', { id: 'role1' } as any);

      const mockMember = {
        roles: { cache: mockRoles },
      } as any;

      const result = await service.checkAccess(mockMember, config);
      expect(result).toBe(true);
    });

    it('should deny when user lacks required roles', async () => {
      const config: GuildConfig = {
        guildId: 'guild1',
        lobbyChannelId: 'lobby1',
        commandChannelId: 'cmd1',
        namePrefix: 'VC',
        rolePresets: {
          'diamond+': ['role1', 'role2'],
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const mockMember = {
        roles: {
          cache: new Collection(),
        },
      } as any;

      const result = await service.checkAccess(mockMember, config);
      expect(result).toBe(false);
    });
  });
});
