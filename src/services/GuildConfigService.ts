import { GuildConfig, VcHub } from '../types/domain';
import { configStore } from '../state/ConfigStore';
import { PermissionFlagsBits } from 'discord.js';

export class GuildConfigService {
  async get(guildId: string): Promise<GuildConfig | undefined> {
    return configStore.get(guildId);
  }

  async ensureGuild(guildId: string, commandChannelId?: string): Promise<GuildConfig> {
    const existing = configStore.get(guildId);
    if (existing) {
      return existing;
    }

    const newConfig: GuildConfig = {
      guildId,
      commandChannelId: commandChannelId || '',
      vcHubs: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await configStore.set(newConfig);
    return newConfig;
  }

  async create(config: Omit<GuildConfig, 'createdAt' | 'updatedAt'>): Promise<GuildConfig> {
    const fullConfig: GuildConfig = {
      ...config,
      vcHubs: config.vcHubs || [],
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

  async addHub(guildId: string, hub: VcHub): Promise<GuildConfig | null> {
    const config = configStore.get(guildId);
    if (!config) return null;

    if (config.vcHubs.some((h) => h.id === hub.id)) {
      return null;
    }

    config.vcHubs.push(hub);
    await configStore.set(config);
    return config;
  }

  async removeHub(guildId: string, hubId: string): Promise<GuildConfig | null> {
    const config = configStore.get(guildId);
    if (!config) return null;

    const index = config.vcHubs.findIndex((h) => h.id === hubId);
    if (index === -1) return null;

    config.vcHubs.splice(index, 1);
    await configStore.set(config);
    return config;
  }

  async updateHubForbid(guildId: string, hubId: string, forbidRoleIds: string[]): Promise<GuildConfig | null> {
    const config = configStore.get(guildId);
    if (!config) return null;

    const hub = config.vcHubs.find((h) => h.id === hubId);
    if (!hub) return null;

    hub.forbidRoleIds = forbidRoleIds;
    await configStore.set(config);
    return config;
  }

  getHubByName(config: GuildConfig, name: string): VcHub | undefined {
    const hubId = this.nameToId(name);
    return config.vcHubs.find((h) => h.id === hubId);
  }

  getHubByLobbyId(config: GuildConfig, lobbyChannelId: string): VcHub | undefined {
    return config.vcHubs.find((h) => h.lobbyChannelId === lobbyChannelId);
  }

  nameToId(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  hasManageGuild(member: any): boolean {
    return member.permissions.has(PermissionFlagsBits.ManageGuild);
  }
}
