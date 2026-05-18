import {
  Client,
  Guild,
  GuildMember,
  PermissionFlagsBits,
  ChannelType,
  OverwriteResolvable,
  VoiceChannel,
  EmbedBuilder,
} from 'discord.js';
import { ManagedRoom, VcHub } from '../types/domain';
import { roomStore } from '../state/RoomStore';
import { logger } from '../core/Logger';
export class RoomLifecycleService {
  constructor(private client: Client) {}

  async createRoom(
    guild: Guild,
    channelName: string,
    owner: GuildMember,
    hub: VcHub,
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

    const categoryId = this.resolveRoomCategoryId(guild, hub);

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

    const overwrites: OverwriteResolvable[] = [
      {
        id: this.client.user!.id,
        allow: [
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.MoveMembers,
        ],
      },
      {
        id: guild.id,
        deny: [PermissionFlagsBits.Connect],
      },
    ];

    for (const roleId of hub.allowRoleIds) {
      overwrites.push({
        id: roleId,
        allow: [PermissionFlagsBits.Connect],
      });
    }

    for (const roleId of hub.forbidRoleIds) {
      overwrites.push({
        id: roleId,
        deny: [PermissionFlagsBits.Connect],
      });
    }

    try {
      const channel = await this.createVoiceChannel(guild, channelName, categoryId, overwrites);

      const room: ManagedRoom = {
        channelId: channel.id,
        guildId: guild.id,
        ownerUserId: owner.id,
        createdAt: Date.now(),
        locked: false,
        categoryId: categoryId ?? undefined,
        hubId: hub.id,
      };

      await roomStore.add(room);
      logger.info(`Created room ${channelName} (${channel.id}) for ${owner.user.tag}`);

      return room;
    } catch (error) {
      logger.error(`Failed to create room ${channelName}`, error);
      return null;
    }
  }

  resolveRoomCategoryId(guild: Guild, hub: VcHub): string | null {
    const lobby = guild.channels.cache.get(hub.lobbyChannelId);
    if (lobby?.type === ChannelType.GuildVoice && lobby.parentId) {
      return lobby.parentId;
    }
    return hub.targetCategoryId ?? null;
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

  async deleteRoom(channelId: string, guild: Guild): Promise<void> {
    try {
      const channel = guild.channels.cache.get(channelId);
      if (channel?.type === ChannelType.GuildVoice) {
        const me = guild.members.me;
        const perms = me ? channel.permissionsFor(me) : null;
        const canDelete =
          perms?.has(PermissionFlagsBits.ViewChannel) &&
          perms?.has(PermissionFlagsBits.ManageChannels);

        if (canDelete) {
          try {
            await channel.delete('Room empty - auto cleanup');
            logger.info(`Deleted room ${channel.name} (${channelId})`);
          } catch (error) {
            const code = (error as { code?: number }).code;
            if (code === 50001 || code === 50013) {
              logger.warn(`Could not delete room ${channel.name}: missing access or permissions`);
            } else {
              logger.error(`Failed to delete room ${channelId}`, error);
            }
          }
        } else {
          logger.warn(`Skipping delete for ${channel.name}: bot lacks access in this channel`);
        }
      }
      await roomStore.delete(channelId);
    } catch (error) {
      logger.error(`Failed to delete room ${channelId}`, error);
      await roomStore.delete(channelId);
    }
  }

  async lockRoom(channelId: string, guild: Guild, hub: VcHub): Promise<void> {
    try {
      const channel = guild.channels.cache.get(channelId);
      if (!channel || channel.type !== ChannelType.GuildVoice) return;

      for (const roleId of hub.allowRoleIds) {
        await channel.permissionOverwrites.edit(roleId, {
          Connect: false,
        });
      }

      await roomStore.update(channelId, { locked: true });
      logger.info(`Locked room ${channel.name} (${channelId})`);
    } catch (error) {
      logger.error(`Failed to lock room ${channelId}`, error);
      throw error;
    }
  }

  async unlockRoom(channelId: string, guild: Guild, hub: VcHub): Promise<void> {
    try {
      const channel = guild.channels.cache.get(channelId);
      if (!channel || channel.type !== ChannelType.GuildVoice) return;

      for (const roleId of hub.allowRoleIds) {
        await channel.permissionOverwrites.edit(roleId, {
          Connect: true,
        });
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

    try {
      await channel.permissionOverwrites.delete(oldOwnerId, 'Ownership transferred - cleanup');
    } catch (error) {
      logger.debug(`Could not remove old overwrites for ${oldOwnerId} (may not exist)`, error);
    }

    await roomStore.update(channelId, { ownerUserId: newOwnerId });
    logger.info(`Transferred ownership of ${channel.name} from ${oldOwnerId} to ${newOwnerId}`);

    return { ok: true };
  }

  async kickMember(channel: VoiceChannel, targetMember: GuildMember): Promise<void> {
    if (targetMember.voice.channelId !== channel.id) {
      throw new Error('Target is not in the specified channel');
    }
    await targetMember.voice.disconnect('Kicked from room by owner');
    logger.info(`Kicked ${targetMember.user.tag} from ${channel.name}`);
  }

  async banMember(channel: VoiceChannel, userId: string): Promise<void> {
    const memberInChannel = channel.members.get(userId);
    if (memberInChannel) {
      try {
        await memberInChannel.voice.disconnect('Banned from room by owner');
        logger.info(`Disconnected and banned user ${userId} from channel ${channel.name}`);
      } catch (error) {
        logger.warn(`Could not disconnect user ${userId}, applying ban anyway`, error);
      }
    }
    
    await channel.permissionOverwrites.edit(userId, {
      Connect: false,
    });
    logger.info(`Banned user ${userId} from channel ${channel.name}`);
  }

  async unbanMember(channel: VoiceChannel, userId: string): Promise<void> {
    try {
      await channel.permissionOverwrites.delete(userId);
      logger.info(`Unbanned user ${userId} from channel ${channel.name}`);
    } catch (error) {
      logger.warn(`Could not remove overwrite for ${userId} (may not exist)`, error);
    }
  }

  async giveAccessMember(channel: VoiceChannel, userId: string): Promise<void> {
    await channel.permissionOverwrites.edit(userId, {
      Connect: true,
    });
    logger.info(`Gave access to user ${userId} for channel ${channel.name}`);
  }

  getRoomStatus(channel: VoiceChannel, room: ManagedRoom): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`Room Status: ${channel.name}`)
      .setColor(room.locked ? 0xff0000 : 0x00ff00)
      .addFields(
        { name: 'Owner', value: `<@${room.ownerUserId}>`, inline: true },
        { name: 'Locked', value: room.locked ? 'Yes' : 'No', inline: true },
        { name: 'Members', value: `${channel.members.size}`, inline: true }
      );

    const members = channel.members.map(m => `<@${m.id}>`).join(', ') || 'None';
    embed.addFields({ name: 'Current Members', value: members });

    const bannedUsers: string[] = [];
    const usersWithAccess: string[] = [];
    channel.permissionOverwrites.cache.forEach((overwrite, id) => {
      if (overwrite.type === 1) {
        if (overwrite.deny.has(PermissionFlagsBits.Connect)) {
          bannedUsers.push(`<@${id}>`);
        } else if (overwrite.allow.has(PermissionFlagsBits.Connect)) {
          usersWithAccess.push(`<@${id}>`);
        }
      }
    });

    if (bannedUsers.length > 0) {
      embed.addFields({ name: 'Banned Users', value: bannedUsers.join(', ') });
    }

    if (usersWithAccess.length > 0) {
      embed.addFields({ name: 'Users With Access', value: usersWithAccess.join(', ') });
    }

    return embed;
  }
}
