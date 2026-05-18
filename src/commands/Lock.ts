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

export const lockCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock your managed room (prevent new users from joining)'),

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

    const lifecycleService = new RoomLifecycleService(interaction.client);
    const roomActions = new RoomActions(lifecycleService);

    const result = await roomActions.runLock(interaction.member, interaction.guild);

    await interaction.reply({
      content: result.message || 'An error occurred.',
      ephemeral: true,
    });
  },
};
