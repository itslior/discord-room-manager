import { Client, ChannelType, PermissionFlagsBits } from 'discord.js';
import { roomStore } from '../state/RoomStore';
import { configStore } from '../state/ConfigStore';
import { logger } from '../core/Logger';

export class ReconciliationService {
  constructor(private client: Client) {}

  async reconcileAll(): Promise<void> {
    logger.info('Starting reconciliation...');
    let preserved = 0;
    let cleaned = 0;
    let orphaned = 0;

    for (const guild of this.client.guilds.cache.values()) {
      const stats = await this.reconcileGuild(guild.id);
      preserved += stats.preserved;
      cleaned += stats.cleaned;
      orphaned += stats.orphaned;
    }

    logger.info(`Reconciliation complete: ${preserved} preserved, ${cleaned} cleaned, ${orphaned} orphaned`);
  }

  async reconcileGuild(guildId: string): Promise<{ preserved: number; cleaned: number; orphaned: number }> {
    let preserved = 0;
    let cleaned = 0;
    let orphaned = 0;

    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) return { preserved, cleaned, orphaned };

      const config = configStore.get(guildId);
      if (!config) return { preserved, cleaned, orphaned };

      const trackedRooms = roomStore.getByGuild(guildId);
      const managedChannels = this.findManagedChannels(guild, config.namePrefix);

      for (const room of trackedRooms) {
        const channel = guild.channels.cache.get(room.channelId);
        if (!channel) {
          await roomStore.delete(room.channelId);
          orphaned++;
          logger.debug(`Removed orphaned room tracking: ${room.channelId}`);
        } else if (channel.type === ChannelType.GuildVoice && channel.members.size === 0) {
          try {
            await channel.delete('Empty room cleanup on reconciliation');
            await roomStore.delete(room.channelId);
            cleaned++;
            logger.debug(`Cleaned empty room: ${channel.name}`);
          } catch (error) {
            logger.error(`Failed to clean room ${channel.name}`, error);
          }
        } else {
          preserved++;
        }
      }

      for (const channel of managedChannels) {
        if (!roomStore.has(channel.id)) {
          if (channel.members.size === 0) {
            try {
              await channel.delete('Untracked empty managed room cleanup');
              cleaned++;
              logger.debug(`Cleaned untracked empty room: ${channel.name}`);
            } catch (error) {
              logger.error(`Failed to clean untracked room ${channel.name}`, error);
            }
          }
        }
      }
    } catch (error) {
      logger.error(`Failed to reconcile guild ${guildId}`, error);
    }

    return { preserved, cleaned, orphaned };
  }

  private findManagedChannels(guild: any, prefix: string) {
    const pattern = new RegExp(`^${prefix}\\d+$`);
    const managedChannels = [];

    for (const channel of guild.channels.cache.values()) {
      if (channel.type !== ChannelType.GuildVoice) continue;
      if (!pattern.test(channel.name)) continue;

      const botOverwrite = channel.permissionOverwrites.cache.get(this.client.user!.id);
      if (botOverwrite?.allow.has(PermissionFlagsBits.ManageChannels)) {
        managedChannels.push(channel);
      }
    }

    return managedChannels;
  }
}
