import { GuildMember } from 'discord.js';
import { roomStore } from '../state/RoomStore';
import { configStore } from '../state/ConfigStore';

export interface AuthResult {
  ok: boolean;
  reason?: string;
  roomChannelId?: string;
}

export class RoomControlAuth {
  checkOwnerInRoom(member: GuildMember, requireUiEnabled = false): AuthResult {
    if (!member.guild) {
      return { ok: false, reason: 'Could not find guild.' };
    }

    if (requireUiEnabled) {
      const config = configStore.get(member.guild.id);
      if (!config?.roomControlUi?.enabled) {
        return { ok: false, reason: 'Room control UI is not enabled. Ask an admin to run `/set-room-control-ui`.' };
      }
    }

    const room = roomStore.getByOwner(member.id);
    if (!room) {
      return { ok: false, reason: "You don't own a managed room." };
    }

    if (member.voice.channelId !== room.channelId) {
      return { ok: false, reason: 'You must be in your voice room to use this control.' };
    }

    return { ok: true, roomChannelId: room.channelId };
  }

  checkTargetInRoom(owner: GuildMember, target: GuildMember, roomChannelId: string): AuthResult {
    if (target.id === owner.id) {
      return { ok: false, reason: 'You cannot target yourself.' };
    }

    if (target.voice.channelId !== roomChannelId) {
      return { ok: false, reason: 'Target user must be in your voice room.' };
    }

    return { ok: true };
  }

  checkCanTakeOwnership(member: GuildMember, channelId: string): AuthResult {
    const room = roomStore.get(channelId);
    if (!room) {
      return { ok: false, reason: 'This is not a managed room.' };
    }

    const currentOwner = member.guild.members.cache.get(room.ownerUserId);
    if (currentOwner?.voice.channelId === channelId) {
      return { ok: false, reason: 'Cannot take ownership while the original owner is still connected.' };
    }

    if (member.voice.channelId !== channelId) {
      return { ok: false, reason: 'You must be in the room to take ownership.' };
    }

    return { ok: true };
  }

  checkCanTransfer(fromMember: GuildMember, toMember: GuildMember, roomChannelId: string): AuthResult {
    const room = roomStore.get(roomChannelId);
    if (!room) {
      return { ok: false, reason: 'This is not a managed room.' };
    }

    if (room.ownerUserId !== fromMember.id) {
      return { ok: false, reason: 'Only the room owner can transfer ownership.' };
    }

    if (fromMember.voice.channelId !== roomChannelId) {
      return { ok: false, reason: 'You must be in your voice room to transfer ownership.' };
    }

    if (toMember.voice.channelId !== roomChannelId) {
      return { ok: false, reason: 'Target user must be in your room to receive ownership.' };
    }

    return { ok: true };
  }
}
