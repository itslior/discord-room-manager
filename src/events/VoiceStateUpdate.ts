import { Client, Events, VoiceState } from 'discord.js';
import { logger } from '../core/Logger';
import { configStore } from '../state/ConfigStore';
import { roomStore } from '../state/RoomStore';
import { RoomLifecycleService } from '../services/RoomLifecycleService';
import { ChannelNameAllocator } from '../services/ChannelNameAllocator';
import { GuildConfig, VcHub } from '../types/domain';

export function registerVoiceStateUpdate(client: Client): void {
  const lifecycleService = new RoomLifecycleService(client);
  const allocator = new ChannelNameAllocator();

  client.on(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
    try {
      if (!newState.guild) return;

      const guildId = newState.guild.id;
      const config = configStore.get(guildId);

      if (!config) return;

      await handleLobbyJoin(newState, oldState, config, lifecycleService, allocator);
      await handleRoomEmpty(newState, oldState, lifecycleService);
    } catch (error) {
      logger.error('Error in voice state update handler', error);
    }
  });
}

async function handleLobbyJoin(
  newState: VoiceState,
  oldState: VoiceState,
  config: GuildConfig,
  lifecycleService: RoomLifecycleService,
  allocator: ChannelNameAllocator,
) {
  if (!newState.channelId || !newState.member) return;

  const hub = config.vcHubs.find(h => h.lobbyChannelId === newState.channelId);
  if (!hub) return;

  if (oldState.channelId === newState.channelId) return;

  const member = newState.member;
  const guild = newState.guild;

  const hasAccess = checkHubAccess(member, hub);
  if (!hasAccess) {
    logger.debug(`User ${member.user.tag} does not have required roles for hub ${hub.name}`);
    return;
  }

  const channelName = await allocator.allocate(guild, hub.namePrefix);
  
  const room = await lifecycleService.createRoom(
    guild,
    channelName,
    member,
    hub,
  );

  if (room) {
    try {
      await member.voice.setChannel(room.channelId);
      logger.info(`Created and moved ${member.user.tag} to ${channelName} (hub: ${hub.name})`);
    } catch (error) {
      logger.error('Failed to move user to new room', error);
    }
  }
}

function checkHubAccess(member: any, hub: VcHub): boolean {
  if (hub.allowRoleIds.length === 0) {
    return true;
  }

  return member.roles.cache.some((role: any) => hub.allowRoleIds.includes(role.id));
}

async function handleRoomEmpty(
  _newState: VoiceState,
  oldState: VoiceState,
  lifecycleService: RoomLifecycleService,
) {
  if (oldState.channelId && oldState.channel) {
    const room = roomStore.get(oldState.channelId);
    if (room && oldState.channel.members.size === 0) {
      logger.info(`Room ${oldState.channel.name} is empty, deleting...`);
      await lifecycleService.deleteRoom(oldState.channelId, oldState.guild);
    }
  }
}
