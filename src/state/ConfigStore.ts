import { GuildConfig, VcHub } from '../types/domain';
import { persistence } from './Persistence';
import { logger } from '../core/Logger';

interface LegacyGuildConfig {
  guildId: string;
  lobbyChannelId?: string;
  commandChannelId: string;
  targetCategoryId?: string;
  namePrefix?: string;
  baseRoleId?: string;
  rolePresets?: Record<string, string[]>;
  vcHubs?: VcHub[];
  createdAt: number;
  updatedAt: number;
  roomControlUi?: {
    enabled: boolean;
    panelChannelId: string;
    panelMessageId: string;
  };
}

class ConfigStore {
  private configs: Map<string, GuildConfig> = new Map();
  private readonly filename = 'config.json';

  async load(): Promise<void> {
    const data = await persistence.read<Record<string, LegacyGuildConfig>>(this.filename);
    if (data) {
      Object.entries(data).forEach(([guildId, config]) => {
        const migratedConfig = this.migrateConfig(config);
        this.configs.set(guildId, migratedConfig);
      });
      logger.info(`Loaded ${this.configs.size} guild configurations`);
    }
  }

  private migrateConfig(legacy: LegacyGuildConfig): GuildConfig {
    if (legacy.vcHubs && legacy.vcHubs.length > 0) {
      return legacy as GuildConfig;
    }

    const vcHubs: VcHub[] = [];
    
    if (legacy.lobbyChannelId) {
      const allowRoleIds: string[] = [];
      if (legacy.rolePresets) {
        Object.values(legacy.rolePresets).forEach((roleIds) => {
          roleIds.forEach((roleId) => {
            if (!allowRoleIds.includes(roleId)) {
              allowRoleIds.push(roleId);
            }
          });
        });
      }

      vcHubs.push({
        id: 'legacy-lobby',
        name: 'Lobby',
        lobbyChannelId: legacy.lobbyChannelId,
        namePrefix: legacy.namePrefix || 'VC',
        allowRoleIds,
        forbidRoleIds: [],
        targetCategoryId: legacy.targetCategoryId,
      });

      logger.info(`Migrated legacy config for guild ${legacy.guildId}`);
    }

    return {
      guildId: legacy.guildId,
      commandChannelId: legacy.commandChannelId,
      vcHubs,
      createdAt: legacy.createdAt,
      updatedAt: legacy.updatedAt,
      roomControlUi: legacy.roomControlUi,
    };
  }

  async save(): Promise<void> {
    const data = Object.fromEntries(this.configs);
    await persistence.write(this.filename, data);
  }

  get(guildId: string): GuildConfig | undefined {
    return this.configs.get(guildId);
  }

  async set(config: GuildConfig): Promise<void> {
    config.updatedAt = Date.now();
    this.configs.set(config.guildId, config);
    await this.save();
  }

  async delete(guildId: string): Promise<void> {
    this.configs.delete(guildId);
    await this.save();
  }

  has(guildId: string): boolean {
    return this.configs.has(guildId);
  }

  getAll(): GuildConfig[] {
    return Array.from(this.configs.values());
  }
}

export const configStore = new ConfigStore();
