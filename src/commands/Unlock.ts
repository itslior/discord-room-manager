import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { Command } from './types';
import { CommandScopeService } from '../services/CommandScopeService';
import { OwnershipService } from '../services/OwnershipService';
import { RoomLifecycleService } from '../services/RoomLifecycleService';
import { configStore } from '../state/ConfigStore';
import { roomStore } from '../state/RoomStore';
import { logger } from '../core/Logger';

const scopeService = new CommandScopeService();
const ownershipService = new OwnershipService();

export const unlockCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock your managed room'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const scopeCheck = await scopeService.checkCommandChannel(interaction);
    if (!scopeCheck.allowed) {
      await interaction.reply({ content: scopeCheck.reason, ephemeral: true });
      return;
    }

    const roomChannelId = ownershipService.getOwnerRoom(interaction.user.id);
    if (!roomChannelId) {
      await interaction.reply({ content: "You don't own a managed room.", ephemeral: true });
      return;
    }

    const room = roomStore.get(roomChannelId);
    if (!room) {
      await interaction.reply({ content: 'Room not found.', ephemeral: true });
      return;
    }

    if (!room.locked) {
      await interaction.reply({ content: 'Your room is not locked.', ephemeral: true });
      return;
    }

    const config = configStore.get(interaction.guildId);
    if (!config) {
      await interaction.reply({ content: 'Bot configuration not found.', ephemeral: true });
      return;
    }

    try {
      const lifecycleService = new RoomLifecycleService(interaction.client);
      await lifecycleService.unlockRoom(roomChannelId, interaction.guild, config, room.rolePresetUsed);

      const restoredRoles = [config.baseRoleId ? `<@&${config.baseRoleId}>` : '@everyone'];
      if (room.rolePresetUsed && config.rolePresets[room.rolePresetUsed]) {
        config.rolePresets[room.rolePresetUsed].forEach((roleId) => {
          restoredRoles.push(`<@&${roleId}>`);
        });
      }

      await interaction.reply({
        content: `🔓 Room unlocked. Restored access to: ${restoredRoles.join(', ')}`,
        ephemeral: false,
      });
      logger.info(`User ${interaction.user.tag} unlocked room ${roomChannelId}`);
    } catch (error) {
      logger.error('Failed to unlock room', error);
      await interaction.reply({ content: 'Failed to unlock room. Please try again.', ephemeral: true });
    }
  },
};
