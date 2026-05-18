import { GuildConfig } from '../types/domain';
import { configStore } from '../state/ConfigStore';
import { PermissionFlagsBits } from 'discord.js';

export class GuildConfigService {
  async get(guildId: string): Promise<GuildConfig | undefined> {
    return configStore.get(guildId);
  }

  async create(config: Omit<GuildConfig, 'createdAt' | 'updatedAt'>): Promise<GuildConfig> {
    const fullConfig: GuildConfig = {
      ...config,
      namePrefix: config.namePrefix || 'VC',
      rolePresets: config.rolePresets || {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await configStore.set(fullConfig);
    return fullConfig;
  }

  async update(guildId: string, updates: Partial<GuildConfig>): Promise<GuildConfig | null> {
    const existing = configStore.get(guildId);
    if (!existing) return null;

    const updated: GuildConfig = {
      ...existing,
      ...updates,
      guildId,
      updatedAt: Date.now(),
    };
    await configStore.set(updated);
    return updated;
  }

  async delete(guildId: string): Promise<void> {
    await configStore.delete(guildId);
  }

  hasManageGuild(member: any): boolean {
    return member.permissions.has(PermissionFlagsBits.ManageGuild);
  }
}
