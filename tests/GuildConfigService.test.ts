import { GuildConfigService } from '../src/services/GuildConfigService';
import { configStore } from '../src/state/ConfigStore';
import { GuildConfig, VcHub } from '../src/types/domain';

jest.mock('../src/state/ConfigStore');

describe('GuildConfigService', () => {
  let service: GuildConfigService;

  beforeEach(() => {
    service = new GuildConfigService();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create config with empty hubs', async () => {
      (configStore.set as jest.Mock).mockResolvedValue(undefined);

      const config = await service.create({
        guildId: 'guild1',
        commandChannelId: 'cmd1',
        vcHubs: [],
      });

      expect(config.guildId).toBe('guild1');
      expect(config.commandChannelId).toBe('cmd1');
      expect(config.vcHubs).toEqual([]);
      expect(config.createdAt).toBeDefined();
      expect(config.updatedAt).toBeDefined();
    });

    it('should create config with hubs', async () => {
      (configStore.set as jest.Mock).mockResolvedValue(undefined);

      const hub: VcHub = {
        id: 'main-lobby',
        name: 'Main Lobby',
        lobbyChannelId: 'lobby1',
        namePrefix: 'General',
        allowRoleIds: [],
        forbidRoleIds: [],
      };

      const config = await service.create({
        guildId: 'guild1',
        commandChannelId: 'cmd1',
        vcHubs: [hub],
      });

      expect(config.vcHubs).toHaveLength(1);
      expect(config.vcHubs[0].namePrefix).toBe('General');
    });
  });

  describe('update', () => {
    it('should return null when config does not exist', async () => {
      (configStore.get as jest.Mock).mockReturnValue(undefined);

      const result = await service.update('guild1', { commandChannelId: 'new-cmd' });
      expect(result).toBeNull();
    });

    it('should update existing config', async () => {
      const existing: GuildConfig = {
        guildId: 'guild1',
        commandChannelId: 'cmd1',
        vcHubs: [],
        createdAt: 1000,
        updatedAt: 1000,
      };

      (configStore.get as jest.Mock).mockReturnValue(existing);
      (configStore.set as jest.Mock).mockResolvedValue(undefined);

      const result = await service.update('guild1', { commandChannelId: 'new-cmd' });
      
      expect(result).not.toBeNull();
      expect(result!.commandChannelId).toBe('new-cmd');
      expect(result!.updatedAt).toBeGreaterThan(1000);
    });
  });

  describe('addHub', () => {
    it('should add hub to existing config', async () => {
      const existing: GuildConfig = {
        guildId: 'guild1',
        commandChannelId: 'cmd1',
        vcHubs: [],
        createdAt: 1000,
        updatedAt: 1000,
      };

      const hub: VcHub = {
        id: 'new-hub',
        name: 'New Hub',
        lobbyChannelId: 'lobby2',
        namePrefix: 'VIP',
        allowRoleIds: [],
        forbidRoleIds: [],
      };

      (configStore.get as jest.Mock).mockReturnValue(existing);
      (configStore.set as jest.Mock).mockResolvedValue(undefined);

      const result = await service.addHub('guild1', hub);
      
      expect(result).not.toBeNull();
      expect(result!.vcHubs).toHaveLength(1);
      expect(result!.vcHubs[0].id).toBe('new-hub');
    });

    it('should return null when adding duplicate hub', async () => {
      const hub: VcHub = {
        id: 'existing-hub',
        name: 'Hub',
        lobbyChannelId: 'lobby1',
        namePrefix: '',
        allowRoleIds: [],
        forbidRoleIds: [],
      };

      const existing: GuildConfig = {
        guildId: 'guild1',
        commandChannelId: 'cmd1',
        vcHubs: [hub],
        createdAt: 1000,
        updatedAt: 1000,
      };

      (configStore.get as jest.Mock).mockReturnValue(existing);

      const result = await service.addHub('guild1', hub);
      expect(result).toBeNull();
    });
  });
});
