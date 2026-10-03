import { Guild, ChannelType } from 'discord.js';
import { logger } from '../core/Logger';
import { removeLockedPrefix } from '../utils/roomChannelName';
import { buildOwnerRoomName, parseOwnerRoomIndex } from '../utils/ownerRoomName';

export class ChannelNameAllocator {
  async allocate(guild: Guild, prefix: string = '', ownerName: string): Promise<string> {
    const existingIndices = new Set<number>();

    guild.channels.cache.forEach((channel) => {
      if (channel.type === ChannelType.GuildVoice) {
        const unlocked = removeLockedPrefix(channel.name);
        const index = parseOwnerRoomIndex(unlocked, prefix, ownerName);
        if (index !== null) {
          existingIndices.add(index);
        }
      }
    });

    let index = 1;
    while (existingIndices.has(index)) {
      index++;
    }

    const channelName = buildOwnerRoomName(prefix, ownerName, index);
    logger.debug(`Allocated channel name: ${channelName} for owner ${ownerName}`);
    return channelName;
  }

  findLowestFreeIndex(existingIndices: number[]): number {
    const sorted = [...existingIndices].sort((a, b) => a - b);
    let expected = 1;
    
    for (const index of sorted) {
      if (index === expected) {
        expected++;
      } else if (index > expected) {
        return expected;
      }
    }
    
    return expected;
  }
}
