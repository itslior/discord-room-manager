import { GuildConfig } from '../types/domain';
import { persistence } from './Persistence';
import { logger } from '../core/Logger';

class ConfigStore {
  private configs: Map<string, GuildConfig> = new Map();
  private readonly filename = 'config.json';

  async load(): Promise<void> {
    const data = await persistence.read<Record<string, GuildConfig>>(this.filename);
    if (data) {
      Object.entries(data).forEach(([guildId, config]) => {
        this.configs.set(guildId, config);
      });
      logger.info(`Loaded ${this.configs.size} guild configurations`);
    }
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
