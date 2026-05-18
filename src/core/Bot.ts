import {
  Client,
  GatewayIntentBits,
  Collection,
  Events,
  ActivityType,
} from 'discord.js';
import { env } from '../config/Env';
import { logger } from './Logger';
import { Command } from '../commands/types';
import { configStore } from '../state/ConfigStore';
import { roomStore } from '../state/RoomStore';

export class Bot {
  public client: Client;
  public commands: Collection<string, Command>;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
      ],
    });

    this.commands = new Collection();
  }

  async start(): Promise<void> {
    try {
      await configStore.load();
      await roomStore.load();

      this.client.once(Events.ClientReady, async (client) => {
        logger.info(`Bot ready! Logged in as ${client.user.tag}`);
        logger.info(`Serving ${client.guilds.cache.size} guilds`);
        
        client.user.setActivity('voice channels', { type: ActivityType.Watching });

        const { ReconciliationService } = await import('../services/ReconciliationService');
        const reconciliationService = new ReconciliationService(this.client);
        await reconciliationService.reconcileAll();
      });

      this.client.on(Events.Error, (error) => {
        logger.error('Discord client error', error);
      });

      await this.client.login(env.discordBotToken);
    } catch (error) {
      logger.error('Failed to start bot', error);
      throw error;
    }
  }

  registerCommand(command: Command): void {
    this.commands.set(command.data.name, command);
  }

  async stop(): Promise<void> {
    logger.info('Shutting down bot...');
    this.client.destroy();
  }
}
