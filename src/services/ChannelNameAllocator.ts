import { Guild, ChannelType } from 'discord.js';
import { logger } from '../core/Logger';

export class ChannelNameAllocator {
  async allocate(guild: Guild, prefix: string = 'VC'): Promise<string> {
    const pattern = new RegExp(`^${prefix}(\\d+)$`);
    const existingIndices = new Set<number>();

    guild.channels.cache.forEach((channel) => {
      if (channel.type === ChannelType.GuildVoice) {
        const match = channel.name.match(pattern);
        if (match) {
          existingIndices.add(parseInt(match[1], 10));
        }
      }
    });

    let index = 1;
    while (existingIndices.has(index)) {
      index++;
    }

    const channelName = `${prefix}${index}`;
    logger.debug(`Allocated channel name: ${channelName}`);
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
