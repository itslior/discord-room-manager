import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { Command } from './types';
import { GuildConfigService } from '../services/GuildConfigService';
import { VcHub } from '../types/domain';

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
        .setName('set-command-channel')
        .setDescription('Set command channel')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Command channel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add-vc-room')
        .setDescription('Add a new VC hub')
        .addChannelOption((option) =>
          option
            .setName('lobby_channel')
            .setDescription('Voice channel to use as lobby')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true),
        )
        .addRoleOption((option) =>
          option
            .setName('role1')
            .setDescription('Role allowed to connect')
            .setRequired(true),
        )
        .addRoleOption((option) =>
          option
            .setName('role2')
            .setDescription('Additional role allowed to connect')
            .setRequired(false),
        )
        .addRoleOption((option) =>
          option
            .setName('role3')
            .setDescription('Additional role allowed to connect')
            .setRequired(false),
        )
        .addRoleOption((option) =>
          option
            .setName('role4')
            .setDescription('Additional role allowed to connect')
            .setRequired(false),
        )
        .addRoleOption((option) =>
          option
            .setName('role5')
            .setDescription('Additional role allowed to connect')
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName('prefix')
            .setDescription('Room name prefix (e.g., "General" → "General Voice 1", empty → "Voice 1")')
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove-vc-room')
        .setDescription('Remove a VC hub')
        .addChannelOption((option) =>
          option
            .setName('lobby_channel')
            .setDescription('The lobby voice channel of the hub to remove')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set-vc-room-forbid')
        .setDescription('Set forbidden roles for a VC hub')
        .addChannelOption((option) =>
          option
            .setName('lobby_channel')
            .setDescription('The lobby voice channel of the hub')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true),
        )
        .addRoleOption((option) =>
          option
            .setName('role1')
            .setDescription('Role to forbid')
            .setRequired(true),
        )
        .addRoleOption((option) =>
          option
            .setName('role2')
            .setDescription('Additional role to forbid')
            .setRequired(false),
        )
        .addRoleOption((option) =>
          option
            .setName('role3')
            .setDescription('Additional role to forbid')
            .setRequired(false),
        )
        .addRoleOption((option) =>
          option
            .setName('role4')
            .setDescription('Additional role to forbid')
            .setRequired(false),
        )
        .addRoleOption((option) =>
          option
            .setName('role5')
            .setDescription('Additional role to forbid')
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('reset')
        .setDescription('Reset all bot configuration (removes all hubs and settings)'),
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
      case 'set-command-channel':
        await handleSetCommandChannel(interaction, configService);
        break;
      case 'add-vc-room':
        await handleAddVcRoom(interaction, configService);
        break;
      case 'remove-vc-room':
        await handleRemoveVcRoom(interaction, configService);
        break;
      case 'set-vc-room-forbid':
        await handleSetVcRoomForbid(interaction, configService);
        break;
      case 'reset':
        await handleReset(interaction, configService);
        break;
    }
  },
};

async function handleShow(interaction: ChatInputCommandInteraction, configService: GuildConfigService) {
  const config = await configService.get(interaction.guildId!);
  if (!config) {
    await interaction.reply({ 
      content: 'Bot is not configured. Run `/config set-command-channel` first.', 
      ephemeral: true 
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('Bot Configuration')
    .setColor(0x5865f2)
    .addFields(
      { name: 'Command Channel', value: config.commandChannelId ? `<#${config.commandChannelId}>` : 'Not set', inline: true },
      { name: 'VC Hubs', value: config.vcHubs.length.toString(), inline: true },
    );

  if (config.vcHubs.length > 0) {
    for (const hub of config.vcHubs) {
      const allowRoles = hub.allowRoleIds.map(id => `<@&${id}>`).join(', ') || 'None';
      const forbidRoles = hub.forbidRoleIds.map(id => `<@&${id}>`).join(', ') || 'None';
      
      embed.addFields({
        name: `📍 ${hub.name}`,
        value: 
          `**Lobby**: <#${hub.lobbyChannelId}>\n` +
          `**Prefix**: ${hub.namePrefix}\n` +
          `**Allow roles**: ${allowRoles}\n` +
          `**Forbid roles**: ${forbidRoles}`,
        inline: false,
      });
    }
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleSetCommandChannel(interaction: ChatInputCommandInteraction, configService: GuildConfigService) {
  const channel = interaction.options.getChannel('channel', true);
  
  const config = await configService.ensureGuild(interaction.guildId!, channel.id);
  
  if (config.commandChannelId !== channel.id) {
    await configService.update(interaction.guildId!, {
      commandChannelId: channel.id,
    });
  }

  await interaction.reply({ 
    content: `✅ Command channel set to <#${channel.id}>`, 
    ephemeral: false 
  });
}

async function handleAddVcRoom(interaction: ChatInputCommandInteraction, configService: GuildConfigService) {
  const channel = interaction.options.getChannel('lobby_channel', true);
  const prefix = interaction.options.getString('prefix', false) || '';

  const allowRoleIds: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const role = interaction.options.getRole(`role${i}`, false);
    if (role) {
      allowRoleIds.push(role.id);
    }
  }

  if (allowRoleIds.length === 0) {
    await interaction.reply({ 
      content: '❌ You must specify at least one allowed role.', 
      ephemeral: true 
    });
    return;
  }

  const config = await configService.ensureGuild(interaction.guildId!);

  const existingHub = configService.getHubByLobbyId(config, channel.id);
  if (existingHub) {
    await interaction.reply({ 
      content: `❌ Channel <#${channel.id}> is already registered as hub "${existingHub.name}".`, 
      ephemeral: true 
    });
    return;
  }

  const lobbyChannel = await interaction.guild!.channels.fetch(channel.id);
  if (!lobbyChannel || lobbyChannel.type !== ChannelType.GuildVoice) {
    await interaction.reply({ 
      content: '❌ Invalid voice channel.', 
      ephemeral: true 
    });
    return;
  }

  const name = lobbyChannel.name;
  const hubId = configService.nameToId(name);
  
  if (config.vcHubs.some(h => h.id === hubId)) {
    await interaction.reply({ 
      content: `❌ A hub with that channel name already exists. Channel names must be unique.`, 
      ephemeral: true 
    });
    return;
  }

  const hub: VcHub = {
    id: hubId,
    name,
    lobbyChannelId: channel.id,
    namePrefix: prefix,
    allowRoleIds,
    forbidRoleIds: [],
    targetCategoryId: lobbyChannel.parentId ?? undefined,
  };

  const updated = await configService.addHub(interaction.guildId!, hub);
  if (!updated) {
    await interaction.reply({ 
      content: '❌ Failed to add hub.', 
      ephemeral: true 
    });
    return;
  }

  const allowRolesStr = allowRoleIds.map(id => `<@&${id}>`).join(', ');
  await interaction.reply({
    content: 
      `✅ Added VC hub **${name}**\n` +
      `**Lobby**: <#${channel.id}>\n` +
      `**Prefix**: ${prefix}\n` +
      `**Allow roles**: ${allowRolesStr}`,
    ephemeral: false,
  });
}

async function handleRemoveVcRoom(interaction: ChatInputCommandInteraction, configService: GuildConfigService) {
  const channel = interaction.options.getChannel('lobby_channel', true);

  const config = await configService.get(interaction.guildId!);
  if (!config) {
    await interaction.reply({ 
      content: 'Bot is not configured.', 
      ephemeral: true 
    });
    return;
  }

  const hub = configService.getHubByLobbyId(config, channel.id);
  if (!hub) {
    await interaction.reply({ 
      content: `❌ <#${channel.id}> is not registered as a hub lobby.`, 
      ephemeral: true 
    });
    return;
  }

  const updated = await configService.removeHub(interaction.guildId!, hub.id);
  if (!updated) {
    await interaction.reply({ 
      content: '❌ Failed to remove hub.', 
      ephemeral: true 
    });
    return;
  }

  await interaction.reply({
    content: `✅ Removed VC hub **${hub.name}** (lobby: <#${channel.id}>). The Discord channel was not deleted.`,
    ephemeral: false,
  });
}

async function handleSetVcRoomForbid(interaction: ChatInputCommandInteraction, configService: GuildConfigService) {
  const channel = interaction.options.getChannel('lobby_channel', true);

  const forbidRoleIds: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const role = interaction.options.getRole(`role${i}`, false);
    if (role) {
      forbidRoleIds.push(role.id);
    }
  }

  if (forbidRoleIds.length === 0) {
    await interaction.reply({ 
      content: '❌ You must specify at least one role to forbid.', 
      ephemeral: true 
    });
    return;
  }

  const config = await configService.get(interaction.guildId!);
  if (!config) {
    await interaction.reply({ 
      content: 'Bot is not configured.', 
      ephemeral: true 
    });
    return;
  }

  const hub = configService.getHubByLobbyId(config, channel.id);
  if (!hub) {
    await interaction.reply({ 
      content: `❌ <#${channel.id}> is not registered as a hub lobby.`, 
      ephemeral: true 
    });
    return;
  }

  const updated = await configService.updateHubForbid(interaction.guildId!, hub.id, forbidRoleIds);
  if (!updated) {
    await interaction.reply({ 
      content: '❌ Failed to update forbid roles.', 
      ephemeral: true 
    });
    return;
  }

  const forbidRolesStr = forbidRoleIds.map(id => `<@&${id}>`).join(', ');
  await interaction.reply({
    content: `✅ Updated forbid roles for **${hub.name}**: ${forbidRolesStr}`,
    ephemeral: false,
  });
}

async function handleReset(interaction: ChatInputCommandInteraction, configService: GuildConfigService) {
  const config = await configService.get(interaction.guildId!);
  if (!config) {
    await interaction.reply({ 
      content: '⚠️ No configuration found. Nothing to reset.', 
      ephemeral: true 
    });
    return;
  }

  const hubCount = config.vcHubs.length;
  const hasCommandChannel = !!config.commandChannelId;
  
  await configService.delete(interaction.guildId!);

  const removedItems: string[] = [];
  if (hubCount > 0) removedItems.push(`${hubCount} VC hub(s)`);
  if (hasCommandChannel) removedItems.push('command channel');
  if (config.roomControlUi?.enabled) removedItems.push('room control UI');

  await interaction.reply({
    content: 
      `✅ Configuration reset complete.\n` +
      `Removed: ${removedItems.join(', ')}\n` +
      `Note: Existing managed rooms will be cleaned up when they become empty.`,
    ephemeral: false,
  });
}
