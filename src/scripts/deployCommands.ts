import { REST, Routes } from 'discord.js';
import { env } from '../config/Env';
import { logger } from '../core/Logger';

import { setupCommand } from '../commands/Setup';
import { configCommand } from '../commands/Config';
import { lockCommand } from '../commands/Lock';
import { unlockCommand } from '../commands/Unlock';
import { takeOwnershipCommand } from '../commands/TakeOwnership';
import { transferCommand } from '../commands/Transfer';
import { setRoomControlUiCommand } from '../commands/SetRoomControlUi';

const commands = [
  setupCommand,
  configCommand,
  lockCommand,
  unlockCommand,
  takeOwnershipCommand,
  transferCommand,
  setRoomControlUiCommand,
].map((cmd) => cmd.data.toJSON());

const rest = new REST().setToken(env.discordBotToken);

async function deployCommands() {
  try {
    logger.info(`Started refreshing ${commands.length} application (/) commands.`);

    const data = await rest.put(
      Routes.applicationCommands(env.applicationId),
      { body: commands },
    ) as any[];

    logger.info(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    logger.error('Failed to deploy commands', error);
    process.exit(1);
  }
}

deployCommands();
