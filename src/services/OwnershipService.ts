import { GuildMember } from 'discord.js';
import { roomStore } from '../state/RoomStore';

export class OwnershipService {
  isOwner(userId: string, channelId: string): boolean {
    const room = roomStore.get(channelId);
    return room?.ownerUserId === userId;
  }

  getOwnerRoom(userId: string): string | null {
    const room = roomStore.getByOwner(userId);
    return room?.channelId || null;
  }

  canTakeOwnership(member: GuildMember, channelId: string): { allowed: boolean; reason?: string } {
    const room = roomStore.get(channelId);
    if (!room) {
      return { allowed: false, reason: 'This is not a managed room.' };
    }

    const currentOwner = member.guild.members.cache.get(room.ownerUserId);
    if (currentOwner?.voice.channelId === channelId) {
      return { allowed: false, reason: 'Cannot take ownership while the original owner is still connected.' };
    }

    if (member.voice.channelId !== channelId) {
      return { allowed: false, reason: 'You must be in the room to take ownership.' };
    }

    return { allowed: true };
  }

  canTransfer(fromUserId: string, toMember: GuildMember, channelId: string): { allowed: boolean; reason?: string } {
    const room = roomStore.get(channelId);
    if (!room) {
      return { allowed: false, reason: 'This is not a managed room.' };
    }

    if (room.ownerUserId !== fromUserId) {
      return { allowed: false, reason: 'Only the room owner can transfer ownership.' };
    }

    if (toMember.voice.channelId !== channelId) {
      return { allowed: false, reason: 'Target user must be in your room to receive ownership.' };
    }

    return { allowed: true };
  }
}
