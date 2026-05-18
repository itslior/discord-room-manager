import { REST, Routes, ContextMenuCommandBuilder, ApplicationCommandType } from 'discord.js';
import { env } from '../config/Env';
import { logger } from '../core/Logger';

export class RoomControlCommandService {
  private rest: REST;

  constructor() {
    this.rest = new REST().setToken(env.discordBotToken);
  }

  async registerGuildContextMenus(guildId: string): Promise<void> {
    const commands = [
      new ContextMenuCommandBuilder()
        .setName('Kick from Room')
        .setType(ApplicationCommandType.User),
      new ContextMenuCommandBuilder()
        .setName('Ban from Room')
        .setType(ApplicationCommandType.User),
      new ContextMenuCommandBuilder()
        .setName('Unban from Room')
        .setType(ApplicationCommandType.User),
      new ContextMenuCommandBuilder()
        .setName('Pass Ownership')
        .setType(ApplicationCommandType.User),
    ].map(cmd => cmd.toJSON());

    try {
      await this.rest.put(
        Routes.applicationGuildCommands(env.applicationId, guildId),
        { body: commands }
      );
      logger.info(`Registered ${commands.length} room control context menus for guild ${guildId}`);
    } catch (error) {
      logger.error(`Failed to register context menus for guild ${guildId}`, error);
      throw error;
    }
  }

  async unregisterGuildContextMenus(guildId: string): Promise<void> {
    try {
      await this.rest.put(
        Routes.applicationGuildCommands(env.applicationId, guildId),
        { body: [] }
      );
      logger.info(`Unregistered context menus for guild ${guildId}`);
    } catch (error) {
      logger.error(`Failed to unregister context menus for guild ${guildId}`, error);
      throw error;
    }
  }
}
