import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
} from 'discord.js';
import { Command } from './types';
import { CommandScopeService } from '../services/CommandScopeService';
import { RoomLifecycleService } from '../services/RoomLifecycleService';
import { RoomActions } from '../services/RoomActions';

const scopeService = new CommandScopeService();

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

    const lifecycleService = new RoomLifecycleService(interaction.client);
    const roomActions = new RoomActions(lifecycleService);

    const result = await roomActions.runPassOwnership(interaction.member, interaction.guild, targetUser.id);

    await interaction.reply({
      content: result.message || 'An error occurred.',
      ephemeral: true,
    });
  },
};
