import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} from 'discord.js';
import { Command } from './types';
import { GuildConfigService } from '../services/GuildConfigService';
import { RoomControlCommandService } from '../services/RoomControlCommandService';
import { configStore } from '../state/ConfigStore';
import { logger } from '../core/Logger';

const configService = new GuildConfigService();
const contextMenuService = new RoomControlCommandService();

export const setRoomControlUiCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('set-room-control-ui')
    .setDescription('Enable and post room control panel with buttons')
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

    const config = configStore.get(interaction.guildId);
    if (!config) {
      await interaction.reply({ content: 'Bot is not configured. Run `/config set-command-channel` first.', ephemeral: true });
      return;
    }

    const commandChannel = interaction.guild.channels.cache.get(config.commandChannelId);
    if (!commandChannel || !commandChannel.isTextBased()) {
      await interaction.reply({ content: 'Command channel not found or is not a text channel.', ephemeral: true });
      return;
    }

    try {
      if (config.roomControlUi?.panelMessageId) {
        try {
          const oldMessage = await commandChannel.messages.fetch(config.roomControlUi.panelMessageId);
          await oldMessage.delete();
        } catch (error) {
          logger.debug('Old panel message not found or already deleted', error);
        }
      }

      const embed = new EmbedBuilder()
        .setTitle('Room Controls')
        .setDescription(
          'Click a button while in your voice room. Only you see the result.\n\n' +
          '**Lock** - prevent others from joining\n' +
          '**Unlock** - allow others to join\n' +
          '**User Limit** - set max people (unlimited or 2-12)\n' +
          '**Kick** - remove someone temporarily\n' +
          '**Ban** - block someone from joining\n' +
          '**Unban** - remove block\n' +
          '**Claim** - take ownership of empty room\n' +
          '**Pass Ownership** - transfer to another user\n' +
          '**Give Access** - allow specific user to join\n' +
          '**Status** - view room info'
        )
        .setColor(0x5865f2);

      const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('rc:lock')
          .setLabel('Lock')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('rc:unlock')
          .setLabel('Unlock')
          .setEmoji('🔓')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('rc:kick')
          .setLabel('Kick')
          .setEmoji('👢')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('rc:ban')
          .setLabel('Ban')
          .setEmoji('🚫')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('rc:unban')
          .setLabel('Unban')
          .setEmoji('✅')
          .setStyle(ButtonStyle.Secondary)
      );

      const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('rc:user-limit')
          .setLabel('User Limit')
          .setEmoji('👥')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('rc:claim')
          .setLabel('Claim')
          .setEmoji('👑')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('rc:pass')
          .setLabel('Pass Ownership')
          .setEmoji('🤝')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('rc:give-access')
          .setLabel('Give Access')
          .setEmoji('🔑')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('rc:status')
          .setLabel('Status')
          .setEmoji('ℹ️')
          .setStyle(ButtonStyle.Secondary)
      );

      const panelMessage = await commandChannel.send({
        embeds: [embed],
        components: [row1, row2],
      });

      await contextMenuService.registerGuildContextMenus(interaction.guildId);

      config.roomControlUi = {
        enabled: true,
        panelChannelId: config.commandChannelId,
        panelMessageId: panelMessage.id,
      };
      await configStore.set(config);

      await interaction.reply({
        content: `✅ Room control panel posted in <#${config.commandChannelId}>. Guild context menus registered.`,
        ephemeral: true,
      });

      logger.info(`Room control UI enabled for guild ${interaction.guildId}`);
    } catch (error) {
      logger.error('Failed to set up room control UI', error);
      await interaction.reply({
        content: 'Failed to set up room control UI. Please try again.',
        ephemeral: true,
      });
    }
  },
};
