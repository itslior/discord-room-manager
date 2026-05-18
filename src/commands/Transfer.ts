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

export const transferCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('transfer')
    .setDescription('Transfer ownership of your room to another user')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('User to transfer ownership to')
        .setRequired(true),
    ),

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

    const targetUser = interaction.options.getUser('user', true);
    const targetMember = interaction.guild.members.cache.get(targetUser.id);

    if (!targetMember) {
      await interaction.reply({ content: 'Target user not found in this server.', ephemeral: true });
      return;
    }

    const roomChannelId = ownershipService.getOwnerRoom(interaction.user.id);
    if (!roomChannelId) {
      await interaction.reply({ content: "You don't own a managed room.", ephemeral: true });
      return;
    }

    const canTransfer = ownershipService.canTransfer(interaction.user.id, targetMember, roomChannelId);
    if (!canTransfer.allowed) {
      await interaction.reply({ content: canTransfer.reason, ephemeral: true });
      return;
    }

    try {
      const lifecycleService = new RoomLifecycleService(interaction.client);
      await lifecycleService.transferOwnership(
        roomChannelId,
        interaction.guild,
        interaction.user.id,
        targetMember.id,
      );

      await interaction.reply({
        content: `✅ Ownership transferred to ${targetMember.user.tag}. They are now the room owner.`,
        ephemeral: false,
      });
      logger.info(`User ${interaction.user.tag} transferred ownership to ${targetMember.user.tag}`);
    } catch (error) {
      logger.error('Failed to transfer ownership', error);
      await interaction.reply({ content: 'Failed to transfer ownership. Please try again.', ephemeral: true });
    }
  },
};
