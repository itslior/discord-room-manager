export interface GuildConfig {
  guildId: string;
  lobbyChannelId: string;
  commandChannelId: string;
  targetCategoryId?: string;
  namePrefix: string;
  baseRoleId?: string;
  rolePresets: Record<string, string[]>;
  createdAt: number;
  updatedAt: number;
}

export interface ManagedRoom {
  channelId: string;
  guildId: string;
  ownerUserId: string;
  createdAt: number;
  locked: boolean;
  categoryId?: string;
  rolePresetUsed?: string;
}

export interface EnvConfig {
  discordBotToken: string;
  applicationId: string;
  publicKey?: string;
  allowedGuildIds?: string[];
  nodeEnv: string;
}
