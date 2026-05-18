import { GuildConfigService } from '../src/services/GuildConfigService';
import { configStore } from '../src/state/ConfigStore';

jest.mock('../src/state/ConfigStore');

describe('GuildConfigService', () => {
  let service: GuildConfigService;

  beforeEach(() => {
    service = new GuildConfigService();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create config with defaults', async () => {
      (configStore.set as jest.Mock).mockResolvedValue(undefined);

      const config = await service.create({
        guildId: 'guild1',
        lobbyChannelId: 'lobby1',
        commandChannelId: 'cmd1',
        namePrefix: '',
        rolePresets: {},
      });

      expect(config.namePrefix).toBe('VC');
      expect(config.rolePresets).toEqual({});
      expect(config.guildId).toBe('guild1');
    });

    it('should preserve custom prefix', async () => {
      (configStore.set as jest.Mock).mockResolvedValue(undefined);

      const config = await service.create({
        guildId: 'guild1',
        lobbyChannelId: 'lobby1',
        commandChannelId: 'cmd1',
        namePrefix: 'ROOM',
        rolePresets: {},
      });

      expect(config.namePrefix).toBe('ROOM');
    });
  });

  describe('update', () => {
    it('should return null when config does not exist', async () => {
      (configStore.get as jest.Mock).mockReturnValue(undefined);

      const result = await service.update('guild1', { namePrefix: 'NEW' });
      expect(result).toBeNull();
    });

    it('should update existing config', async () => {
      const existing = {
        guildId: 'guild1',
        lobbyChannelId: 'lobby1',
        commandChannelId: 'cmd1',
        namePrefix: 'VC',
        rolePresets: {},
        createdAt: 1000,
        updatedAt: 1000,
      };

      (configStore.get as jest.Mock).mockReturnValue(existing);
      (configStore.set as jest.Mock).mockResolvedValue(undefined);

      const result = await service.update('guild1', { namePrefix: 'NEW' });
      
      expect(result).not.toBeNull();
      expect(result!.namePrefix).toBe('NEW');
      expect(result!.updatedAt).toBeGreaterThan(1000);
    });
  });
});
