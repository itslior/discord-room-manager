import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { Command } from './types';
import { GuildConfigService } from '../services/GuildConfigService';

const configService = new GuildConfigService();

export const configCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('View or update bot configuration')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('show')
        .setDescription('Show current configuration'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set-lobby')
        .setDescription('Update lobby channel')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('New lobby channel')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set-command-channel')
        .setDescription('Update command channel')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('New command channel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set-category')
        .setDescription('Update target category')
        .addChannelOption((option) =>
          option
            .setName('category')
            .setDescription('Category for managed rooms')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set-base-role')
        .setDescription('Set base role for lock/unlock (default: @everyone)')
        .addRoleOption((option) =>
          option
            .setName('role')
            .setDescription('Base role for permissions')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set-roles')
        .setDescription('Configure role preset for lobby access')
        .addStringOption((option) =>
          option
            .setName('preset_name')
            .setDescription('Name of the preset (e.g., diamond+)')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('role_ids')
            .setDescription('Comma-separated role IDs')
            .setRequired(true),
        ),
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

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'show':
        await handleShow(interaction, configService);
        break;
      case 'set-lobby':
        await handleSetLobby(interaction, configService);
        break;
      case 'set-command-channel':
        await handleSetCommandChannel(interaction, configService);
        break;
      case 'set-category':
        await handleSetCategory(interaction, configService);
        break;
      case 'set-base-role':
        await handleSetBaseRole(interaction, configService);
        break;
      case 'set-roles':
        await handleSetRoles(interaction, configService);
        break;
    }
  },
};

async function handleShow(interaction: ChatInputCommandInteraction, configService: GuildConfigService) {
  const config = await configService.get(interaction.guildId!);
  if (!config) {
    await interaction.reply({ content: 'Bot is not configured. Run `/setup` first.', ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('Bot Configuration')
    .setColor(0x5865f2)
    .addFields(
      { name: 'Lobby Channel', value: `<#${config.lobbyChannelId}>`, inline: true },
      { name: 'Command Channel', value: `<#${config.commandChannelId}>`, inline: true },
      { name: 'Name Prefix', value: config.namePrefix, inline: true },
    );

  if (config.targetCategoryId) {
    embed.addFields({ name: 'Target Category', value: `<#${config.targetCategoryId}>`, inline: true });
  }

  if (config.baseRoleId) {
    embed.addFields({ name: 'Base Role', value: `<@&${config.baseRoleId}>`, inline: true });
  }

  if (Object.keys(config.rolePresets).length > 0) {
    const presets = Object.entries(config.rolePresets)
      .map(([name, roles]) => `**${name}**: ${roles.map((r) => `<@&${r}>`).join(', ')}`)
      .join('\n');
    embed.addFields({ name: 'Role Presets', value: presets });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleSetLobby(interaction: ChatInputCommandInteraction, configService: GuildConfigService) {
  const channel = interaction.options.getChannel('channel', true);

  if (!interaction.guild) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    return;
  }

  const lobbyChannel = await interaction.guild.channels.fetch(channel.id);
  if (!lobbyChannel) {
    await interaction.reply({ content: 'Could not find that channel.', ephemeral: true });
    return;
  }
  const lobbyCategoryId =
    lobbyChannel.type === ChannelType.GuildVoice ? lobbyChannel.parentId : null;

  const updated = await configService.update(interaction.guildId!, {
    lobbyChannelId: channel.id,
    targetCategoryId: lobbyCategoryId ?? undefined,
  });

  if (!updated) {
    await interaction.reply({ content: 'Bot is not configured. Run `/setup` first.', ephemeral: true });
    return;
  }

  const categoryMsg = lobbyCategoryId
    ? ` Rooms will be created in the same category as the lobby.`
    : '';

  await interaction.reply({
    content: `✅ Lobby channel updated to <#${channel.id}>.${categoryMsg}`,
    ephemeral: false,
  });
}

async function handleSetCommandChannel(interaction: ChatInputCommandInteraction, configService: GuildConfigService) {
  const channel = interaction.options.getChannel('channel', true);
  
  const updated = await configService.update(interaction.guildId!, {
    commandChannelId: channel.id,
  });

  if (!updated) {
    await interaction.reply({ content: 'Bot is not configured. Run `/setup` first.', ephemeral: true });
    return;
  }

  await interaction.reply({ content: `✅ Command channel updated to <#${channel.id}>`, ephemeral: false });
}

async function handleSetCategory(interaction: ChatInputCommandInteraction, configService: GuildConfigService) {
  const category = interaction.options.getChannel('category', true);
  
  const updated = await configService.update(interaction.guildId!, {
    targetCategoryId: category.id,
  });

  if (!updated) {
    await interaction.reply({ content: 'Bot is not configured. Run `/setup` first.', ephemeral: true });
    return;
  }

  await interaction.reply({ content: `✅ Target category updated to ${category.name}`, ephemeral: false });
}

async function handleSetBaseRole(interaction: ChatInputCommandInteraction, configService: GuildConfigService) {
  const role = interaction.options.getRole('role', true);

  const updated = await configService.update(interaction.guildId!, {
    baseRoleId: role.id,
  });

  if (!updated) {
    await interaction.reply({ content: 'Bot is not configured. Run `/setup` first.', ephemeral: true });
    return;
  }

  await interaction.reply({
    content: `✅ Base role updated to ${role.name}. This role will be denied when rooms are locked.`,
    ephemeral: false,
  });
}

async function handleSetRoles(interaction: ChatInputCommandInteraction, configService: GuildConfigService) {
  const presetName = interaction.options.getString('preset_name', true);
  const roleIdsStr = interaction.options.getString('role_ids', true);
  
  const roleIds = roleIdsStr.split(',').map((id) => id.trim());

  for (const roleId of roleIds) {
    const role = interaction.guild!.roles.cache.get(roleId);
    if (!role) {
      await interaction.reply({ content: `❌ Invalid role ID: ${roleId}`, ephemeral: true });
      return;
    }
  }

  const config = await configService.get(interaction.guildId!);
  if (!config) {
    await interaction.reply({ content: 'Bot is not configured. Run `/setup` first.', ephemeral: true });
    return;
  }

  const newPresets = { ...config.rolePresets, [presetName]: roleIds };
  await configService.update(interaction.guildId!, { rolePresets: newPresets });

  await interaction.reply({
    content: `✅ Role preset **${presetName}** configured with ${roleIds.length} role(s).`,
    ephemeral: false,
  });
}
