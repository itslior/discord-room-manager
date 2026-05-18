import { Events, Interaction } from 'discord.js';
import { logger } from '../core/Logger';
import { Bot } from '../core/Bot';

export function registerInteractionCreate(bot: Bot): void {
  bot.client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = bot.commands.get(interaction.commandName);

    if (!command) {
      logger.warn(`Unknown command: ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error(`Error executing command ${interaction.commandName}`, error);
      
      const errorMessage = 'There was an error executing this command.';
      
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errorMessage, ephemeral: true });
        } else {
          await interaction.reply({ content: errorMessage, ephemeral: true });
        }
      } catch (replyError) {
        logger.error('Failed to send error message to user', replyError);
      }
    }
  });
}
