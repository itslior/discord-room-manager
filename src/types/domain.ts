export interface VcHub {
  id: string;
  name: string;
  lobbyChannelId: string;
  namePrefix: string;
  allowRoleIds: string[];
  forbidRoleIds: string[];
  targetCategoryId?: string;
}

export interface GuildConfig {
  guildId: string;
  commandChannelId: string;
  vcHubs: VcHub[];
  createdAt: number;
  updatedAt: number;
  roomControlUi?: {
    enabled: boolean;
    panelChannelId: string;
    panelMessageId: string;
  };
}

export interface ManagedRoom {
  channelId: string;
  guildId: string;
  ownerUserId: string;
  createdAt: number;
  locked: boolean;
  categoryId?: string;
  hubId: string;
}

export interface EnvConfig {
  discordBotToken: string;
  applicationId: string;
  publicKey?: string;
  allowedGuildIds?: string[];
  nodeEnv: string;
}
