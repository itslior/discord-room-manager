import { Client, Events, VoiceState } from 'discord.js';
import { logger } from '../core/Logger';
import { configStore } from '../state/ConfigStore';
import { roomStore } from '../state/RoomStore';
import { RoomLifecycleService } from '../services/RoomLifecycleService';
import { ChannelNameAllocator } from '../services/ChannelNameAllocator';
import { RoleAccessService } from '../services/RoleAccessService';

export function registerVoiceStateUpdate(client: Client): void {
  const lifecycleService = new RoomLifecycleService(client);
  const allocator = new ChannelNameAllocator();
  const roleAccessService = new RoleAccessService();

  client.on(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
    try {
      if (!newState.guild) return;

      const guildId = newState.guild.id;
      const config = configStore.get(guildId);

      if (!config) return;

      await handleLobbyJoin(newState, oldState, config, lifecycleService, allocator, roleAccessService);
      await handleRoomEmpty(newState, oldState, lifecycleService);
    } catch (error) {
      logger.error('Error in voice state update handler', error);
    }
  });
}

async function handleLobbyJoin(
  newState: VoiceState,
  oldState: VoiceState,
  config: any,
  lifecycleService: RoomLifecycleService,
  allocator: ChannelNameAllocator,
  roleAccessService: RoleAccessService,
) {
  if (
    newState.channelId === config.lobbyChannelId &&
    oldState.channelId !== config.lobbyChannelId &&
    newState.member
  ) {
    const member = newState.member;
    const guild = newState.guild;

    const hasAccess = await roleAccessService.checkAccess(member, config);
    if (!hasAccess) {
      logger.debug(`User ${member.user.tag} does not have required roles for lobby`);
      return;
    }

    const rolePresetUsed = roleAccessService.getPresetUsed(member, config);
    const channelName = await allocator.allocate(guild, config.namePrefix);
    
    const room = await lifecycleService.createRoom(
      guild,
      channelName,
      member,
      config,
    );

    if (room && rolePresetUsed) {
      await import('../state/RoomStore').then(m => 
        m.roomStore.update(room.channelId, { rolePresetUsed })
      );
    }

    if (room) {
      try {
        await member.voice.setChannel(room.channelId);
        logger.info(`Created and moved ${member.user.tag} to ${channelName}`);
      } catch (error) {
        logger.error('Failed to move user to new room', error);
      }
    }
  }
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
