import { GuildMember } from 'discord.js';
import { GuildConfig } from '../types/domain';

export class RoleAccessService {
  async checkAccess(member: GuildMember, config: GuildConfig): Promise<boolean> {
    if (!config.rolePresets || Object.keys(config.rolePresets).length === 0) {
      return true;
    }

    const allAllowedRoles = new Set<string>();
    Object.values(config.rolePresets).forEach((roleIds) => {
      roleIds.forEach((roleId) => allAllowedRoles.add(roleId));
    });

    if (allAllowedRoles.size === 0) {
      return true;
    }

    return member.roles.cache.some((role) => allAllowedRoles.has(role.id));
  }

  getPresetUsed(member: GuildMember, config: GuildConfig): string | undefined {
    for (const [presetName, roleIds] of Object.entries(config.rolePresets)) {
      if (member.roles.cache.some((role) => roleIds.includes(role.id))) {
        return presetName;
      }
    }
    return undefined;
  }
}
