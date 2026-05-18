import { ChatInputCommandInteraction } from 'discord.js';
import { configStore } from '../state/ConfigStore';

export class CommandScopeService {
  async checkCommandChannel(interaction: ChatInputCommandInteraction): Promise<{ allowed: boolean; reason?: string }> {
    const config = configStore.get(interaction.guildId!);
    
    if (!config) {
      return { allowed: false, reason: 'Bot is not configured for this server. Run `/config set-command-channel` first.' };
    }

    if (interaction.channelId !== config.commandChannelId) {
      return { allowed: false, reason: `This command can only be used in <#${config.commandChannelId}>.` };
    }

    return { allowed: true };
  }

  isConfigured(guildId: string): boolean {
    return configStore.has(guildId);
  }
}
