import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
} from 'discord.js';
import { Command } from './types';
import { CommandScopeService } from '../services/CommandScopeService';
import { OwnershipService } from '../services/OwnershipService';
import { RoomLifecycleService } from '../services/RoomLifecycleService';
import { logger } from '../core/Logger';

const scopeService = new CommandScopeService();
const ownershipService = new OwnershipService();

export const takeOwnershipCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('take-ownership')
    .setDescription('Take ownership of a managed room (if original owner left)'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild || !(interaction.member instanceof GuildMember)) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const scopeCheck = await scopeService.checkCommandChannel(interaction);
    if (!scopeCheck.allowed) {
      await interaction.reply({ content: scopeCheck.reason, ephemeral: true });
      return;
    }

    const member = interaction.member as GuildMember;
    const currentChannelId = member.voice.channelId;

    if (!currentChannelId) {
      await interaction.reply({ content: 'You must be in a managed room to take ownership.', ephemeral: true });
      return;
    }

    const canTake = ownershipService.canTakeOwnership(member, currentChannelId);
    if (!canTake.allowed) {
      await interaction.reply({ content: canTake.reason, ephemeral: true });
      return;
    }

    try {
      const lifecycleService = new RoomLifecycleService(interaction.client);
      const room = await import('../state/RoomStore').then(m => m.roomStore.get(currentChannelId));
      if (!room) {
        await interaction.reply({ content: 'Room not found.', ephemeral: true });
        return;
      }

      await lifecycleService.transferOwnership(
        currentChannelId,
        interaction.guild,
        room.ownerUserId,
        member.id,
      );

      await interaction.reply({
        content: `✅ You are now the owner of this room!`,
        ephemeral: false,
      });
      logger.info(`User ${member.user.tag} took ownership of room ${currentChannelId}`);
    } catch (error) {
      logger.error('Failed to transfer ownership', error);
      await interaction.reply({ content: 'Failed to transfer ownership. Please try again.', ephemeral: true });
    }
  },
};
