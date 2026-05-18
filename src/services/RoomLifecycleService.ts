import {
  Client,
  Guild,
  GuildMember,
  PermissionFlagsBits,
  ChannelType,
  OverwriteResolvable,
  VoiceChannel,
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
    const botMember = guild.members.me;
    if (!botMember) {
      logger.error('Bot member not found in guild');
      return null;
    }

    const required = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ManageRoles,
      PermissionFlagsBits.MoveMembers,
    ];
    const missing = required.filter((perm) => !botMember.permissions.has(perm));
    if (missing.length > 0) {
      logger.error(
        `Bot is missing guild permissions: ${missing.join(', ')}. ` +
          'Re-invite the bot with Manage Channels + Manage Roles + Move Members, ' +
          'and move the bot role above member roles in Server Settings → Roles.',
      );
      return null;
    }

    const categoryId = this.resolveRoomCategoryId(guild, config);

    if (
      categoryId &&
      !botMember.permissionsIn(categoryId).has(PermissionFlagsBits.ManageChannels)
    ) {
      logger.error(
        `Bot cannot Manage Channels in category ${categoryId}. ` +
          'Fix category permissions for the bot role (same category as the lobby).',
      );
      return null;
    }

    const botOverwrite: OverwriteResolvable = {
      id: this.client.user!.id,
      allow: [PermissionFlagsBits.ManageChannels],
    };

    try {
      const channel = await this.createVoiceChannel(guild, channelName, categoryId, [botOverwrite]);
      await this.applyOwnerOverwrites(channel, owner);

      const room: ManagedRoom = {
        channelId: channel.id,
        guildId: guild.id,
        ownerUserId: owner.id,
        createdAt: Date.now(),
        locked: false,
        categoryId: categoryId ?? undefined,
      };

      await roomStore.add(room);
      logger.info(`Created room ${channelName} (${channel.id}) for ${owner.user.tag}`);

      return room;
    } catch (error) {
      logger.error(`Failed to create room ${channelName}`, error);
      return null;
    }
  }

  /** Uses the lobby voice channel's category so new rooms appear next to the lobby. */
  resolveRoomCategoryId(guild: Guild, config: GuildConfig): string | null {
    const lobby = guild.channels.cache.get(config.lobbyChannelId);
    if (lobby?.type === ChannelType.GuildVoice && lobby.parentId) {
      return lobby.parentId;
    }
    return config.targetCategoryId ?? null;
  }

  private async createVoiceChannel(
    guild: Guild,
    channelName: string,
    parentCategoryId: string | null,
    permissionOverwrites: OverwriteResolvable[],
  ): Promise<VoiceChannel> {
    return await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildVoice,
      parent: parentCategoryId,
      permissionOverwrites,
    });
  }

  /** Room control is enforced via RoomStore; channel overwrites are moderation-only. */
  private ownerOverwriteAllow() {
    return {
      MoveMembers: true,
      MuteMembers: true,
      DeafenMembers: true,
    };
  }

  private async applyOwnerOverwrites(channel: VoiceChannel, owner: GuildMember): Promise<boolean> {
    try {
      await channel.permissionOverwrites.edit(owner.id, this.ownerOverwriteAllow());
      return true;
    } catch (error) {
      logger.warn(
        `Could not grant moderation overwrites to ${owner.user.tag}. ` +
          'Ownership is still tracked; move the bot role above this user\'s highest role for in-channel mod perms.',
        error,
      );
      return false;
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

  async transferOwnership(
    channelId: string,
    guild: Guild,
    oldOwnerId: string,
    newOwnerId: string,
  ): Promise<{ ok: boolean; warning?: string }> {
    const channel = guild.channels.cache.get(channelId);
    if (!channel || channel.type !== ChannelType.GuildVoice) {
      return { ok: false, warning: 'Voice channel not found.' };
    }

    const newOwner = await guild.members.fetch(newOwnerId).catch(() => null);
    if (!newOwner) {
      return { ok: false, warning: 'New owner not found in this server.' };
    }

    const warnings: string[] = [];

    try {
      await channel.permissionOverwrites.delete(oldOwnerId, 'Ownership transferred');
    } catch (error) {
      logger.warn(`Could not remove overwrites for previous owner ${oldOwnerId}`, error);
      warnings.push('Could not clear the previous owner\'s channel permissions.');
    }

    const overwritesApplied = await this.applyOwnerOverwrites(channel, newOwner);
    if (!overwritesApplied) {
      warnings.push(
        'You are the owner for bot commands (/lock, etc.), but in-channel mod permissions may be limited.',
      );
    }

    await roomStore.update(channelId, { ownerUserId: newOwnerId });
    logger.info(`Transferred ownership of ${channel.name} from ${oldOwnerId} to ${newOwnerId}`);

    return {
      ok: true,
      warning: warnings.length > 0 ? warnings.join(' ') : undefined,
    };
  }
}
