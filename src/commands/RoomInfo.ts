import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
} from 'discord.js';
import { Command } from './types';
import { CommandScopeService } from '../services/CommandScopeService';
import { replyWithRoomInfoSelect } from '../interactions/roomControlInteractions';

const scopeService = new CommandScopeService();

export const roomInfoCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('room-info')
    .setDescription('See who owns a managed room'),

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

    await replyWithRoomInfoSelect(interaction);
  },
};
