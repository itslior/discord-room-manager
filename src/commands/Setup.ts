import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ChannelType,
  PermissionFlagsBits,
} from 'discord.js';
import { Command } from './types';
import { GuildConfigService } from '../services/GuildConfigService';
import { logger } from '../core/Logger';

const configService = new GuildConfigService();

export const setupCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Initial bot configuration')
    .addChannelOption((option) =>
      option
        .setName('lobby')
        .setDescription('Voice channel to monitor for new room creation')
        .addChannelTypes(ChannelType.GuildVoice)
        .setRequired(true),
    )
    .addChannelOption((option) =>
      option
        .setName('command_channel')
        .setDescription('Text channel where room commands can be used')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true),
    )
    .addChannelOption((option) =>
      option
        .setName('category')
        .setDescription('Only if lobby has no category: where to create rooms')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName('prefix')
        .setDescription('Prefix for room names (default: VC)')
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    if (!configService.hasManageGuild(interaction.member)) {
      await interaction.reply({ content: 'You need MANAGE_GUILD permission to configure the bot.', ephemeral: true });
      return;
    }

    const lobby = interaction.options.getChannel('lobby', true);
    const commandChannel = interaction.options.getChannel('command_channel', true);
    const category = interaction.options.getChannel('category', false);
    const prefix = interaction.options.getString('prefix', false) || 'VC';

    if ('guildId' in lobby && lobby.guildId !== interaction.guildId) {
      await interaction.reply({ content: 'Lobby channel must be in this server.', ephemeral: true });
      return;
    }

    if ('guildId' in commandChannel && commandChannel.guildId !== interaction.guildId) {
      await interaction.reply({ content: 'Command channel must be in this server.', ephemeral: true });
      return;
    }

    if (category && 'guildId' in category && category.guildId !== interaction.guildId) {
      await interaction.reply({ content: 'Category must be in this server.', ephemeral: true });
      return;
    }

    try {
      const lobbyChannel = await interaction.guild.channels.fetch(lobby.id);
      if (!lobbyChannel) {
        await interaction.reply({ content: 'Could not find the lobby channel.', ephemeral: true });
        return;
      }
      const lobbyCategoryId =
        lobbyChannel.type === ChannelType.GuildVoice ? lobbyChannel.parentId : null;

      await configService.create({
        guildId: interaction.guildId,
        lobbyChannelId: lobby.id,
        commandChannelId: commandChannel.id,
        targetCategoryId: lobbyCategoryId ?? category?.id,
        namePrefix: prefix,
        rolePresets: {},
      });

      logger.info(`Bot configured for guild ${interaction.guild.name} (${interaction.guildId})`);

      const categoryNote = lobbyCategoryId
        ? `**Rooms category:** same as lobby (<#${lobbyCategoryId}>)\n`
        : category
          ? `**Rooms category:** ${category.name}\n`
          : '**Rooms category:** top level (lobby has no category)\n';

      await interaction.reply({
        content: `✅ **Bot configured successfully!**\n\n` +
          `**Lobby:** <#${lobby.id}>\n` +
          `**Command Channel:** <#${commandChannel.id}>\n` +
          categoryNote +
          `**Name Prefix:** ${prefix}\n\n` +
          `Users joining the lobby will automatically get their own voice channel!`,
        ephemeral: false,
      });
    } catch (error) {
      logger.error('Failed to save configuration', error);
      await interaction.reply({ content: 'Failed to save configuration. Please try again.', ephemeral: true });
    }
  },
};
