import { Events, Interaction } from 'discord.js';
import { logger } from '../core/Logger';
import { Bot } from '../core/Bot';
import {
  handleButtonInteraction,
  handleUserSelectInteraction,
  handleStringSelectInteraction,
  handleUserContextMenuInteraction,
} from '../interactions/roomControlInteractions';

export function registerInteractionCreate(bot: Bot): void {
  bot.client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const command = bot.commands.get(interaction.commandName);

        if (!command) {
          logger.warn(`Unknown command: ${interaction.commandName}`);
          return;
        }

        await command.execute(interaction);
      } else if (interaction.isButton()) {
        await handleButtonInteraction(interaction);
      } else if (interaction.isUserSelectMenu()) {
        await handleUserSelectInteraction(interaction);
      } else if (interaction.isStringSelectMenu()) {
        await handleStringSelectInteraction(interaction);
      } else if (interaction.isUserContextMenuCommand()) {
        await handleUserContextMenuInteraction(interaction);
      }
    } catch (error) {
      logger.error(`Error handling interaction`, error);
      
      const errorMessage = 'There was an error processing this interaction.';
      
      try {
        if (interaction.isRepliable()) {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMessage, ephemeral: true });
          } else {
            await interaction.reply({ content: errorMessage, ephemeral: true });
          }
        }
      } catch (replyError) {
        logger.error('Failed to send error message to user', replyError);
      }
    }
  });
}
