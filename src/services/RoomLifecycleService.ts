import {
  Client,
  Guild,
  GuildMember,
  PermissionFlagsBits,
  ChannelType,
  OverwriteResolvable,
} from 'discord.js';
import { ManagedRoom, GuildConfig } from '../types/domain';
import { roomStore } from '../state/RoomStore';
import { logger } from '../core/Logger';

export class RoomLifecycleService {
  constructor(private client: Client) {}

  async createRoom(
    guild: Guild,
    channelName: string,
    owner: GuildMember,
    config: GuildConfig,
  ): Promise<ManagedRoom | null> {
    try {
      const permissionOverwrites: OverwriteResolvable[] = [
        {
          id: this.client.user!.id,
          allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles],
        },
        {
          id: owner.id,
          allow: [
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.MoveMembers,
            PermissionFlagsBits.MuteMembers,
            PermissionFlagsBits.DeafenMembers,
          ],
        },
      ];

      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildVoice,
        parent: config.targetCategoryId || null,
        permissionOverwrites,
      });

      const room: ManagedRoom = {
        channelId: channel.id,
        guildId: guild.id,
        ownerUserId: owner.id,
        createdAt: Date.now(),
        locked: false,
        categoryId: config.targetCategoryId,
      };

      await roomStore.add(room);
      logger.info(`Created room ${channelName} (${channel.id}) for ${owner.user.tag}`);

      return room;
    } catch (error) {
      logger.error(`Failed to create room ${channelName}`, error);
      return null;
    }
  }

  async deleteRoom(channelId: string, guild: Guild): Promise<void> {
    try {
      const channel = guild.channels.cache.get(channelId);
      if (channel) {
        await channel.delete('Room empty - auto cleanup');
        logger.info(`Deleted room ${channel.name} (${channelId})`);
      }
      await roomStore.delete(channelId);
    } catch (error) {
      logger.error(`Failed to delete room ${channelId}`, error);
      await roomStore.delete(channelId);
    }
  }

  async lockRoom(channelId: string, guild: Guild, config: GuildConfig, rolePresetUsed?: string): Promise<void> {
    try {
      const channel = guild.channels.cache.get(channelId);
      if (!channel || channel.type !== ChannelType.GuildVoice) return;

      const baseRoleId = config.baseRoleId || guild.id;
      await channel.permissionOverwrites.edit(baseRoleId, {
        Connect: false,
      });

      if (rolePresetUsed && config.rolePresets[rolePresetUsed]) {
        const roles = config.rolePresets[rolePresetUsed];
        for (const roleId of roles) {
          await channel.permissionOverwrites.edit(roleId, {
            Connect: false,
          });
        }
      }

      await roomStore.update(channelId, { locked: true });
      logger.info(`Locked room ${channel.name} (${channelId})`);
    } catch (error) {
      logger.error(`Failed to lock room ${channelId}`, error);
      throw error;
    }
  }

  async unlockRoom(channelId: string, guild: Guild, config: GuildConfig, rolePresetUsed?: string): Promise<void> {
    try {
      const channel = guild.channels.cache.get(channelId);
      if (!channel || channel.type !== ChannelType.GuildVoice) return;

      const baseRoleId = config.baseRoleId || guild.id;
      await channel.permissionOverwrites.edit(baseRoleId, {
        Connect: null,
      });

      if (rolePresetUsed && config.rolePresets[rolePresetUsed]) {
        const roles = config.rolePresets[rolePresetUsed];
        for (const roleId of roles) {
          await channel.permissionOverwrites.edit(roleId, {
            Connect: null,
          });
        }
      }

      await roomStore.update(channelId, { locked: false });
      logger.info(`Unlocked room ${channel.name} (${channelId})`);
    } catch (error) {
      logger.error(`Failed to unlock room ${channelId}`, error);
      throw error;
    }
  }

  async transferOwnership(channelId: string, guild: Guild, oldOwnerId: string, newOwnerId: string): Promise<void> {
    try {
      const channel = guild.channels.cache.get(channelId);
      if (!channel || channel.type !== ChannelType.GuildVoice) return;

      await channel.permissionOverwrites.delete(oldOwnerId, 'Ownership transferred');

      await channel.permissionOverwrites.edit(newOwnerId, {
        ManageChannels: true,
        MoveMembers: true,
        MuteMembers: true,
        DeafenMembers: true,
      });

      await roomStore.update(channelId, { ownerUserId: newOwnerId });
      logger.info(`Transferred ownership of ${channel.name} from ${oldOwnerId} to ${newOwnerId}`);
    } catch (error) {
      logger.error(`Failed to transfer ownership of ${channelId}`, error);
      throw error;
    }
  }
}
