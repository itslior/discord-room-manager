import {
  ButtonInteraction,
  UserSelectMenuInteraction,
  StringSelectMenuInteraction,
  UserContextMenuCommandInteraction,
  ChatInputCommandInteraction,
  GuildMember,
  ActionRowBuilder,
  UserSelectMenuBuilder,
  StringSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';
import { RoomLifecycleService } from '../services/RoomLifecycleService';
import { RoomActions } from '../services/RoomActions';
import { RoomControlAuth } from '../services/RoomControlAuth';
import { roomStore } from '../state/RoomStore';
import { logger } from '../core/Logger';
import {
  FALLBACK_VOICE_REGIONS,
  buildRegionSelectMenu,
  fetchSelectableVoiceRegions,
  parseRtcRegionSelection,
} from '../utils/voiceRegions';

const USER_LIMIT_MIN = 2;
const USER_LIMIT_MAX = 12;

function buildUserLimitSelectMenu(): StringSelectMenuBuilder {
  const options = [
    {
      label: 'Unlimited',
      value: '0',
      description: 'No limit on how many can join',
    },
    ...Array.from({ length: USER_LIMIT_MAX - USER_LIMIT_MIN + 1 }, (_, i) => {
      const count = i + USER_LIMIT_MIN;
      return {
        label: `${count} users`,
        value: String(count),
        description: `Maximum ${count} people in the room`,
      };
    }),
  ];

  return new StringSelectMenuBuilder()
    .setCustomId('rc:select:user-limit')
    .setPlaceholder('Select a user limit')
    .addOptions(options);
}

export async function replyWithRoomInfoSelect(
  interaction: ButtonInteraction | ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      content: 'This command can only be used in a server.',
      ephemeral: true,
    });
    return;
  }

  const rooms = roomStore.getByGuild(interaction.guild.id);
  
  if (rooms.length === 0) {
    await interaction.reply({
      content: 'No active managed rooms in this server.',
      ephemeral: true,
    });
    return;
  }

  // Sort: occupied first, then by newest
  const sortedRooms = rooms
    .map(room => {
      const channel = interaction.guild!.channels.cache.get(room.channelId);
      const memberCount = channel?.type === ChannelType.GuildVoice ? channel.members.size : 0;
      return { room, channel, memberCount };
    })
    .filter(item => item.channel) // Only include rooms with valid channels
    .sort((a, b) => {
      if (a.memberCount !== b.memberCount) {
        return b.memberCount - a.memberCount; // Occupied first
      }
      return b.room.createdAt - a.room.createdAt; // Newest first
    });

  if (sortedRooms.length === 0) {
    await interaction.reply({
      content: 'No active managed rooms in this server.',
      ephemeral: true,
    });
    return;
  }

  // Limit to 25 options (Discord limit)
  const options = sortedRooms.slice(0, 25).map(({ room, channel, memberCount }) => ({
    label: channel!.name.slice(0, 100),
    value: room.channelId,
    description: memberCount > 0 ? `${memberCount} member${memberCount === 1 ? '' : 's'}` : 'Empty',
  }));

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('rc:select:room-info')
    .setPlaceholder('Select a room to view info')
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  await interaction.reply({
    content: 'Select a room to see its owner:',
    components: [row],
    ephemeral: true,
  });
}

export async function replyWithLocationSelect(
  interaction: ButtonInteraction | ChatInputCommandInteraction,
  requireUiEnabled = false,
): Promise<void> {
  if (!interaction.guild || !(interaction.member instanceof GuildMember)) {
    await interaction.reply({
      content: 'This command can only be used in a server.',
      ephemeral: true,
    });
    return;
  }

  const auth = new RoomControlAuth();
  const authCheck = auth.checkOwnerInRoom(interaction.member, requireUiEnabled);
  if (!authCheck.ok) {
    await interaction.reply({
      content: authCheck.reason || 'Authorization failed.',
      ephemeral: true,
    });
    return;
  }

  const channel = interaction.guild.channels.cache.get(authCheck.roomChannelId!);
  if (!channel || channel.type !== ChannelType.GuildVoice) {
    await interaction.reply({
      content: 'Voice channel not found.',
      ephemeral: true,
    });
    return;
  }

  let regions;
  try {
    regions = await fetchSelectableVoiceRegions(interaction.client, channel.rtcRegion);
  } catch (error) {
    logger.warn('Failed to fetch Discord voice regions, using fallback list', error);
    regions = FALLBACK_VOICE_REGIONS;
  }

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    buildRegionSelectMenu(regions, channel.rtcRegion),
  );

  await interaction.reply({
    content: 'Select the voice server for your room:',
    components: [row],
    ephemeral: true,
  });
}

export async function handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.customId.startsWith('rc:')) return;
  if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;

  const action = interaction.customId.slice(3);
  const lifecycleService = new RoomLifecycleService(interaction.client);
  const roomActions = new RoomActions(lifecycleService);
  const auth = new RoomControlAuth();

  try {
    switch (action) {
      case 'lock': {
        const result = await roomActions.runLock(interaction.member, interaction.guild);
        await interaction.reply({
          content: result.message || 'An error occurred.',
          ephemeral: true,
        });
        break;
      }

      case 'unlock': {
        const result = await roomActions.runUnlock(interaction.member, interaction.guild);
        await interaction.reply({
          content: result.message || 'An error occurred.',
          ephemeral: true,
        });
        break;
      }

      case 'user-limit': {
        const authCheck = auth.checkOwnerInRoom(interaction.member, true);
        if (!authCheck.ok) {
          await interaction.reply({
            content: authCheck.reason || 'Authorization failed.',
            ephemeral: true,
          });
          return;
        }

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          buildUserLimitSelectMenu(),
        );

        await interaction.reply({
          content: 'Select the maximum number of users allowed in your room:',
          components: [row],
          ephemeral: true,
        });
        break;
      }

      case 'location': {
        await replyWithLocationSelect(interaction, true);
        break;
      }

      case 'claim': {
        const result = await roomActions.runClaim(interaction.member, interaction.guild);
        await interaction.reply({
          content: result.message || 'An error occurred.',
          ephemeral: true,
        });
        break;
      }

      case 'status': {
        const result = await roomActions.runStatus(interaction.member, interaction.guild);
        if (result.embed) {
          await interaction.reply({
            embeds: [result.embed],
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: result.message || 'An error occurred.',
            ephemeral: true,
          });
        }
        break;
      }

      case 'room-info': {
        await replyWithRoomInfoSelect(interaction);
        break;
      }

      case 'give-access': {
        const authCheck = auth.checkOwnerInRoom(interaction.member, true);
        if (!authCheck.ok) {
          await interaction.reply({
            content: authCheck.reason || 'Authorization failed.',
            ephemeral: true,
          });
          return;
        }

        const channel = interaction.guild.channels.cache.get(authCheck.roomChannelId!);
        if (!channel || channel.type !== 2) {
          await interaction.reply({
            content: 'Voice channel not found.',
            ephemeral: true,
          });
          return;
        }

        const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
          new UserSelectMenuBuilder()
            .setCustomId('rc:select:give-access')
            .setPlaceholder('Select a user to give access')
            .setMinValues(1)
            .setMaxValues(1)
        );

        await interaction.reply({
          content: 'Select a user to give access:',
          components: [row],
          ephemeral: true,
        });
        break;
      }

      case 'kick':
      case 'ban':
      case 'unban':
      case 'pass': {
        const authCheck = auth.checkOwnerInRoom(interaction.member, true);
        if (!authCheck.ok) {
          await interaction.reply({
            content: authCheck.reason || 'Authorization failed.',
            ephemeral: true,
          });
          return;
        }

        const channel = interaction.guild.channels.cache.get(authCheck.roomChannelId!);
        if (!channel || channel.type !== 2) {
          await interaction.reply({
            content: 'Voice channel not found.',
            ephemeral: true,
          });
          return;
        }

        const members = Array.from(channel.members.values());
        if (members.length === 0) {
          await interaction.reply({
            content: 'No members in the room.',
            ephemeral: true,
          });
          return;
        }

        const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
          new UserSelectMenuBuilder()
            .setCustomId(`rc:select:${action}`)
            .setPlaceholder(`Select a user to ${action}`)
            .setMinValues(1)
            .setMaxValues(1)
        );

        await interaction.reply({
          content: `Select a user to ${action}:`,
          components: [row],
          ephemeral: true,
        });
        break;
      }

      default:
        await interaction.reply({
          content: 'Unknown action.',
          ephemeral: true,
        });
    }
  } catch (error) {
    logger.error('Error handling button interaction', error);
    const replyOptions = {
      content: 'An error occurred while processing your request.',
      ephemeral: true,
    };
    
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(replyOptions);
    } else {
      await interaction.reply(replyOptions);
    }
  }
}

export async function handleUserSelectInteraction(interaction: UserSelectMenuInteraction): Promise<void> {
  if (!interaction.customId.startsWith('rc:select:')) return;
  if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;

  const action = interaction.customId.slice(10);
  const targetId = interaction.values[0];

  const lifecycleService = new RoomLifecycleService(interaction.client);
  const roomActions = new RoomActions(lifecycleService);

  try {
    let result;

    switch (action) {
      case 'kick':
        result = await roomActions.runKick(interaction.member, interaction.guild, targetId);
        break;
      case 'ban':
        result = await roomActions.runBan(interaction.member, interaction.guild, targetId);
        break;
      case 'unban':
        result = await roomActions.runUnban(interaction.member, interaction.guild, targetId);
        break;
      case 'give-access':
        result = await roomActions.runGiveAccess(interaction.member, interaction.guild, targetId);
        break;
      case 'pass':
        result = await roomActions.runPassOwnership(interaction.member, interaction.guild, targetId);
        break;
      default:
        result = { ok: false, message: 'Unknown action.' };
    }

    await interaction.update({
      content: result.message || 'An error occurred.',
      components: [],
    });
  } catch (error) {
    logger.error('Error handling user select interaction', error);
    await interaction.update({
      content: 'An error occurred while processing your request.',
      components: [],
    });
  }
}

export async function handleStringSelectInteraction(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  if (!interaction.customId.startsWith('rc:select:')) return;
  if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;

  const action = interaction.customId.slice(10);
  const lifecycleService = new RoomLifecycleService(interaction.client);
  const roomActions = new RoomActions(lifecycleService);

  try {
    if (action === 'user-limit') {
      const limit = parseInt(interaction.values[0], 10);
      const result = await roomActions.runSetUserLimit(interaction.member, interaction.guild, limit);
      await interaction.update({
        content: result.message || 'An error occurred.',
        components: [],
      });
    } else if (action === 'location') {
      const rtcRegion = parseRtcRegionSelection(interaction.values[0]);
      const result = await roomActions.runSetRtcRegion(interaction.member, interaction.guild, rtcRegion);
      await interaction.update({
        content: result.message || 'An error occurred.',
        components: [],
      });
    } else if (action === 'room-info') {
      const channelId = interaction.values[0];
      const room = roomStore.get(channelId);
      
      if (!room) {
        await interaction.update({
          content: 'Room not found.',
          components: [],
        });
        return;
      }
      
      const channel = interaction.guild.channels.cache.get(channelId);
      if (!channel || channel.type !== ChannelType.GuildVoice) {
        await interaction.update({
          content: 'Channel not found.',
          components: [],
        });
        return;
      }
      
      const embed = new EmbedBuilder()
        .setTitle(`Room Info: ${channel.name}`)
        .setColor(0x5865f2)
        .addFields(
          { name: 'Owner', value: `<@${room.ownerUserId}>`, inline: true },
          { name: 'Locked', value: room.locked ? 'Yes' : 'No', inline: true },
          { name: 'Members', value: `${channel.members.size}`, inline: true },
        );
      
      await interaction.update({
        content: '',
        embeds: [embed],
        components: [],
      });
    } else {
      await interaction.update({
        content: 'Unknown action.',
        components: [],
      });
    }
  } catch (error) {
    logger.error('Error handling string select interaction', error);
    await interaction.update({
      content: 'An error occurred while processing your request.',
      components: [],
    });
  }
}

export async function handleUserContextMenuInteraction(interaction: UserContextMenuCommandInteraction): Promise<void> {
  if (!interaction.guild || !(interaction.member instanceof GuildMember)) {
    await interaction.reply({
      content: 'This command can only be used in a server.',
      ephemeral: true,
    });
    return;
  }

  const auth = new RoomControlAuth();
  const authCheck = auth.checkOwnerInRoom(interaction.member, true);
  
  if (!authCheck.ok) {
    await interaction.reply({
      content: authCheck.reason || 'Authorization failed.',
      ephemeral: true,
    });
    return;
  }

  const lifecycleService = new RoomLifecycleService(interaction.client);
  const roomActions = new RoomActions(lifecycleService);
  const targetId = interaction.targetId;

  try {
    let result;

    switch (interaction.commandName) {
      case 'Kick from Room':
        result = await roomActions.runKick(interaction.member, interaction.guild, targetId);
        break;
      case 'Ban from Room':
        result = await roomActions.runBan(interaction.member, interaction.guild, targetId);
        break;
      case 'Unban from Room':
        result = await roomActions.runUnban(interaction.member, interaction.guild, targetId);
        break;
      case 'Give Access to Room':
        result = await roomActions.runGiveAccess(interaction.member, interaction.guild, targetId);
        break;
      case 'Pass Ownership':
        result = await roomActions.runPassOwnership(interaction.member, interaction.guild, targetId);
        break;
      default:
        result = { ok: false, message: 'Unknown command.' };
    }

    await interaction.reply({
      content: result.message || 'An error occurred.',
      ephemeral: true,
    });
  } catch (error) {
    logger.error('Error handling context menu interaction', error);
    await interaction.reply({
      content: 'An error occurred while processing your request.',
      ephemeral: true,
    });
  }
}
