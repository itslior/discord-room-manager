import { Guild, GuildMember, EmbedBuilder } from 'discord.js';
import { RoomLifecycleService } from './RoomLifecycleService';
import { RoomControlAuth } from './RoomControlAuth';
import { roomStore } from '../state/RoomStore';
import { configStore } from '../state/ConfigStore';
import { logger } from '../core/Logger';

export interface ActionResult {
  ok: boolean;
  message?: string;
  embed?: EmbedBuilder;
}

export class RoomActions {
  private auth: RoomControlAuth;

  constructor(private lifecycleService: RoomLifecycleService) {
    this.auth = new RoomControlAuth();
  }

  async runLock(actor: GuildMember, guild: Guild): Promise<ActionResult> {
    const authCheck = this.auth.checkOwnerInRoom(actor);
    if (!authCheck.ok) {
      return { ok: false, message: authCheck.reason };
    }

    const room = roomStore.get(authCheck.roomChannelId!);
    if (!room) {
      return { ok: false, message: 'Room not found.' };
    }

    if (room.locked) {
      return { ok: false, message: 'Your room is already locked.' };
    }

    const config = configStore.get(guild.id);
    if (!config) {
      return { ok: false, message: 'Bot configuration not found.' };
    }

    try {
      await this.lifecycleService.lockRoom(authCheck.roomChannelId!, guild, config, room.rolePresetUsed);

      const deniedRoles = [config.baseRoleId ? `<@&${config.baseRoleId}>` : '@everyone'];
      if (room.rolePresetUsed && config.rolePresets[room.rolePresetUsed]) {
        config.rolePresets[room.rolePresetUsed].forEach((roleId) => {
          deniedRoles.push(`<@&${roleId}>`);
        });
      }

      return {
        ok: true,
        message: `🔒 Room locked. Denied access to: ${deniedRoles.join(', ')}`,
      };
    } catch (error) {
      logger.error('Failed to lock room', error);
      return { ok: false, message: 'Failed to lock room. Please try again.' };
    }
  }

  async runUnlock(actor: GuildMember, guild: Guild): Promise<ActionResult> {
    const authCheck = this.auth.checkOwnerInRoom(actor);
    if (!authCheck.ok) {
      return { ok: false, message: authCheck.reason };
    }

    const room = roomStore.get(authCheck.roomChannelId!);
    if (!room) {
      return { ok: false, message: 'Room not found.' };
    }

    if (!room.locked) {
      return { ok: false, message: 'Your room is not locked.' };
    }

    const config = configStore.get(guild.id);
    if (!config) {
      return { ok: false, message: 'Bot configuration not found.' };
    }

    try {
      await this.lifecycleService.unlockRoom(authCheck.roomChannelId!, guild, config, room.rolePresetUsed);

      return {
        ok: true,
        message: '🔓 Room unlocked.',
      };
    } catch (error) {
      logger.error('Failed to unlock room', error);
      return { ok: false, message: 'Failed to unlock room. Please try again.' };
    }
  }

  async runClaim(actor: GuildMember, guild: Guild): Promise<ActionResult> {
    if (!actor.voice.channelId) {
      return { ok: false, message: 'You must be in a managed room to take ownership.' };
    }

    const authCheck = this.auth.checkCanTakeOwnership(actor, actor.voice.channelId);
    if (!authCheck.ok) {
      return { ok: false, message: authCheck.reason };
    }

    const room = roomStore.get(actor.voice.channelId);
    if (!room) {
      return { ok: false, message: 'Room not found.' };
    }

    try {
      const result = await this.lifecycleService.transferOwnership(
        actor.voice.channelId,
        guild,
        room.ownerUserId,
        actor.id
      );

      if (!result.ok) {
        return { ok: false, message: result.warning || 'Failed to transfer ownership.' };
      }

      return {
        ok: true,
        message: `✅ <@${actor.id}> is now the owner of <#${actor.voice.channelId}>.`,
      };
    } catch (error) {
      logger.error('Failed to claim room', error);
      return { ok: false, message: 'Failed to claim ownership. Please try again.' };
    }
  }

  async runKick(actor: GuildMember, guild: Guild, targetId: string): Promise<ActionResult> {
    const authCheck = this.auth.checkOwnerInRoom(actor);
    if (!authCheck.ok) {
      return { ok: false, message: authCheck.reason };
    }

    const target = await guild.members.fetch(targetId).catch(() => null);
    if (!target) {
      return { ok: false, message: 'Target user not found in this server.' };
    }

    const targetCheck = this.auth.checkTargetInRoom(actor, target, authCheck.roomChannelId!);
    if (!targetCheck.ok) {
      return { ok: false, message: targetCheck.reason };
    }

    const channel = guild.channels.cache.get(authCheck.roomChannelId!);
    if (!channel || channel.type !== 2) {
      return { ok: false, message: 'Voice channel not found.' };
    }

    try {
      await this.lifecycleService.kickMember(channel as any, target);
      return {
        ok: true,
        message: `👢 Kicked <@${targetId}> from the room.`,
      };
    } catch (error) {
      logger.error('Failed to kick member', error);
      return { ok: false, message: 'Failed to kick member. Please try again.' };
    }
  }

  async runBan(actor: GuildMember, guild: Guild, targetId: string): Promise<ActionResult> {
    const authCheck = this.auth.checkOwnerInRoom(actor);
    if (!authCheck.ok) {
      return { ok: false, message: authCheck.reason };
    }

    if (targetId === actor.id) {
      return { ok: false, message: 'You cannot ban yourself.' };
    }

    const channel = guild.channels.cache.get(authCheck.roomChannelId!);
    if (!channel || channel.type !== 2) {
      return { ok: false, message: 'Voice channel not found.' };
    }

    try {
      await this.lifecycleService.banMember(channel as any, targetId);
      return {
        ok: true,
        message: `🚫 Banned <@${targetId}> from the room.`,
      };
    } catch (error) {
      logger.error('Failed to ban member', error);
      return { ok: false, message: 'Failed to ban member. Please try again.' };
    }
  }

  async runUnban(actor: GuildMember, guild: Guild, targetId: string): Promise<ActionResult> {
    const authCheck = this.auth.checkOwnerInRoom(actor);
    if (!authCheck.ok) {
      return { ok: false, message: authCheck.reason };
    }

    const channel = guild.channels.cache.get(authCheck.roomChannelId!);
    if (!channel || channel.type !== 2) {
      return { ok: false, message: 'Voice channel not found.' };
    }

    try {
      await this.lifecycleService.unbanMember(channel as any, targetId);
      return {
        ok: true,
        message: `✅ Unbanned <@${targetId}> from the room.`,
      };
    } catch (error) {
      logger.error('Failed to unban member', error);
      return { ok: false, message: 'Failed to unban member. Please try again.' };
    }
  }

  async runGiveAccess(actor: GuildMember, guild: Guild, targetId: string): Promise<ActionResult> {
    const authCheck = this.auth.checkOwnerInRoom(actor);
    if (!authCheck.ok) {
      return { ok: false, message: authCheck.reason };
    }

    if (targetId === actor.id) {
      return { ok: false, message: 'You cannot give access to yourself.' };
    }

    const channel = guild.channels.cache.get(authCheck.roomChannelId!);
    if (!channel || channel.type !== 2) {
      return { ok: false, message: 'Voice channel not found.' };
    }

    try {
      await this.lifecycleService.giveAccessMember(channel as any, targetId);
      return {
        ok: true,
        message: `🔑 Gave <@${targetId}> access to the room.`,
      };
    } catch (error) {
      logger.error('Failed to give access to member', error);
      return { ok: false, message: 'Failed to give access. Please try again.' };
    }
  }

  async runPassOwnership(actor: GuildMember, guild: Guild, targetId: string): Promise<ActionResult> {
    const authCheck = this.auth.checkOwnerInRoom(actor);
    if (!authCheck.ok) {
      return { ok: false, message: authCheck.reason };
    }

    const target = await guild.members.fetch(targetId).catch(() => null);
    if (!target) {
      return { ok: false, message: 'Target user not found in this server.' };
    }

    const transferCheck = this.auth.checkCanTransfer(actor, target, authCheck.roomChannelId!);
    if (!transferCheck.ok) {
      return { ok: false, message: transferCheck.reason };
    }

    try {
      const result = await this.lifecycleService.transferOwnership(
        authCheck.roomChannelId!,
        guild,
        actor.id,
        targetId
      );

      if (!result.ok) {
        return { ok: false, message: result.warning || 'Failed to transfer ownership.' };
      }

      return {
        ok: true,
        message: `🤝 Ownership of <#${authCheck.roomChannelId}> transferred from <@${actor.id}> to <@${targetId}>.`,
      };
    } catch (error) {
      logger.error('Failed to transfer ownership', error);
      return { ok: false, message: 'Failed to transfer ownership. Please try again.' };
    }
  }

  async runStatus(actor: GuildMember, guild: Guild): Promise<ActionResult> {
    const authCheck = this.auth.checkOwnerInRoom(actor);
    if (!authCheck.ok) {
      return { ok: false, message: authCheck.reason };
    }

    const room = roomStore.get(authCheck.roomChannelId!);
    if (!room) {
      return { ok: false, message: 'Room not found.' };
    }

    const config = configStore.get(guild.id);
    if (!config) {
      return { ok: false, message: 'Bot configuration not found.' };
    }

    const channel = guild.channels.cache.get(authCheck.roomChannelId!);
    if (!channel || channel.type !== 2) {
      return { ok: false, message: 'Voice channel not found.' };
    }

    const embed = this.lifecycleService.getRoomStatus(channel as any, room);
    return { ok: true, embed };
  }
}
