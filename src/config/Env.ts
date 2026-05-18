import dotenv from 'dotenv';
import { EnvConfig } from '../types/domain';

dotenv.config();

export function loadEnv(): EnvConfig {
  const requiredVars = ['DISCORD_BOT_TOKEN', 'APPLICATION_ID'];
  const missing = requiredVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const allowedGuildIds = process.env.ALLOWED_GUILD_IDS
    ? process.env.ALLOWED_GUILD_IDS.split(',').map((id) => id.trim())
    : undefined;

  return {
    discordBotToken: process.env.DISCORD_BOT_TOKEN!,
    applicationId: process.env.APPLICATION_ID!,
    publicKey: process.env.PUBLIC_KEY,
    allowedGuildIds,
    nodeEnv: process.env.NODE_ENV || 'development',
  };
}

export const env = loadEnv();
