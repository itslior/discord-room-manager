export const LOCKED_PREFIX = '[LOCKED] ';

const LOCKED_PREFIX_PATTERN = /^\[LOCKED\]\s*/;

const DISCORD_CHANNEL_NAME_MAX_LENGTH = 100;

export function hasLockedPrefix(name: string): boolean {
  return LOCKED_PREFIX_PATTERN.test(name);
}

export function addLockedPrefix(name: string): string {
  if (hasLockedPrefix(name)) {
    return name;
  }

  const newName = `${LOCKED_PREFIX}${name}`;
  return newName.length > DISCORD_CHANNEL_NAME_MAX_LENGTH
    ? newName.slice(0, DISCORD_CHANNEL_NAME_MAX_LENGTH)
    : newName;
}

export function removeLockedPrefix(name: string): string {
  return name.replace(LOCKED_PREFIX_PATTERN, '');
}
