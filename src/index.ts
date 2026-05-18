import { Bot } from './core/Bot';
import { logger } from './core/Logger';
import { registerVoiceStateUpdate } from './events/VoiceStateUpdate';
import { registerInteractionCreate } from './events/InteractionCreate';

import { setupCommand } from './commands/Setup';
import { configCommand } from './commands/Config';
import { lockCommand } from './commands/Lock';
import { unlockCommand } from './commands/Unlock';
import { takeOwnershipCommand } from './commands/TakeOwnership';
import { transferCommand } from './commands/Transfer';
import { setRoomControlUiCommand } from './commands/SetRoomControlUi';

async function main() {
  logger.info('Starting Discord Room Manager Bot...');

  const bot = new Bot();

  bot.registerCommand(setupCommand);
  bot.registerCommand(configCommand);
  bot.registerCommand(lockCommand);
  bot.registerCommand(unlockCommand);
  bot.registerCommand(takeOwnershipCommand);
  bot.registerCommand(transferCommand);
  bot.registerCommand(setRoomControlUiCommand);

  registerVoiceStateUpdate(bot.client);
  registerInteractionCreate(bot);

  await bot.start();

  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    await bot.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    await bot.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error('Fatal error during startup', error);
  process.exit(1);
});
