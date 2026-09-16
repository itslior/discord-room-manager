import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageEditOptions,
  MessageCreateOptions,
} from 'discord.js';

export function buildRoomControlPanel(): Pick<MessageCreateOptions & MessageEditOptions, 'embeds' | 'components'> {
  const embed = new EmbedBuilder()
    .setTitle('Room Controls')
    .setDescription(
      'Click a button while in your voice room. Only you see the result.\n\n' +
      '**Lock** - prevent others from joining\n' +
      '**Unlock** - allow others to join\n' +
      '**User Limit** - set max people (unlimited or 2-12)\n' +
      '**Location** - change voice server region\n' +
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

  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('rc:location')
      .setLabel('Location')
      .setEmoji('🌍')
      .setStyle(ButtonStyle.Secondary)
  );

  return {
    embeds: [embed],
    components: [row1, row2, row3],
  };
}
