import {
  Client,
  ChannelType,
  Guild,
  PermissionFlagsBits,
  VoiceChannel,
} from 'discord.js';
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
      const deletedChannelIds = new Set<string>();

      for (const room of trackedRooms) {
        const channel = guild.channels.cache.get(room.channelId);
        if (!channel) {
          await roomStore.delete(room.channelId);
          orphaned++;
          logger.debug(`Removed orphaned room tracking: ${room.channelId}`);
        } else if (channel.type === ChannelType.GuildVoice && channel.members.size === 0) {
          const deleted = await this.safeDeleteChannel(channel, 'Empty room cleanup on reconciliation');
          deletedChannelIds.add(room.channelId);
          if (deleted) {
            await roomStore.delete(room.channelId);
            cleaned++;
            logger.debug(`Cleaned empty room: ${channel.name}`);
          } else {
            await roomStore.delete(room.channelId);
            orphaned++;
          }
        } else {
          preserved++;
        }
      }

      const prefixes = config.vcHubs.map(h => h.namePrefix);
      const managedChannels = this.findManagedChannels(guild, prefixes);

      for (const channel of managedChannels) {
        if (deletedChannelIds.has(channel.id)) continue;
        if (!guild.channels.cache.has(channel.id)) continue;
        if (!roomStore.has(channel.id) && channel.members.size === 0) {
          const deleted = await this.safeDeleteChannel(
            channel,
            'Untracked empty managed room cleanup',
          );
          if (deleted) {
            cleaned++;
            logger.debug(`Cleaned untracked empty room: ${channel.name}`);
          }
        }
      }
    } catch (error) {
      logger.error(`Failed to reconcile guild ${guildId}`, error);
    }

    return { preserved, cleaned, orphaned };
  }

  private findManagedChannels(guild: Guild, prefixes: string[]): VoiceChannel[] {
    const patterns = prefixes.map(prefix => {
      const basePattern = prefix ? `${prefix} VC` : 'VC';
      const escaped = basePattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`^${escaped}\\d+$`);
    });
    const managedChannels: VoiceChannel[] = [];

    for (const channel of guild.channels.cache.values()) {
      if (channel.type !== ChannelType.GuildVoice) continue;
      
      const matchesAnyPattern = patterns.some(pattern => pattern.test(channel.name));
      if (!matchesAnyPattern) continue;

      const botOverwrite = channel.permissionOverwrites.cache.get(this.client.user!.id);
      if (!botOverwrite?.allow.has(PermissionFlagsBits.ManageChannels)) continue;
      if (!this.canBotDeleteChannel(guild, channel)) continue;

      managedChannels.push(channel);
    }

    return managedChannels;
  }

  private canBotDeleteChannel(guild: Guild, channel: VoiceChannel): boolean {
    const me = guild.members.me;
    if (!me) return false;

    const perms = channel.permissionsFor(me);
    if (!perms) return false;

    return perms.has(PermissionFlagsBits.ViewChannel) &&
      perms.has(PermissionFlagsBits.ManageChannels);
  }

  private async safeDeleteChannel(channel: VoiceChannel, reason: string): Promise<boolean> {
    const guild = channel.guild;
    if (!this.canBotDeleteChannel(guild, channel)) {
      logger.warn(
        `Skipping delete for #${channel.name}: bot cannot view or manage this channel (check category permissions).`,
      );
      return false;
    }

    try {
      await channel.delete(reason);
      return true;
    } catch (error) {
      const code = (error as { code?: number }).code;
      if (code === 10003) {
        logger.debug(`#${channel.name} was already deleted`);
        return true;
      }
      if (code === 50001 || code === 50013) {
        logger.warn(
          `Could not delete #${channel.name}: missing access or permissions (Discord error ${code}).`,
        );
        return false;
      }
      logger.error(`Failed to delete #${channel.name}`, error);
      return false;
    }
  }
}
