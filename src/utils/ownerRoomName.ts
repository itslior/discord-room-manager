import { GuildMember } from 'discord.js';

const DISCORD_CHANNEL_NAME_MAX_LENGTH = 100;
const LOCKED_PREFIX = '[LOCKED] ';

/**
 * Sanitize a display name for use in channel names.
 * Collapses whitespace, strips control characters, and trims.
 */
export function sanitizeOwnerName(member: GuildMember): string {
  let name = member.displayName || member.user.username;
  
  // Strip control characters (U+0000 to U+001F and U+007F) and collapse whitespace
  // eslint-disable-next-line no-control-regex
  name = name.replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim();
  
  return name || 'User';
}

/**
 * Build a room name for an owner with the given index.
 * Index 1 produces an unnumbered name; 2+ appends the number.
 * 
 * Examples:
 * - buildOwnerRoomName('', 'Alice', 1) => "Alice's room"
 * - buildOwnerRoomName('', 'Alice', 2) => "Alice's room 2"
 * - buildOwnerRoomName('General', 'Bob', 1) => "General Bob's room"
 * - buildOwnerRoomName('General', 'Bob', 3) => "General Bob's room 3"
 */
export function buildOwnerRoomName(prefix: string, ownerName: string, index: number): string {
  // Reserve space for [LOCKED] prefix
  const maxLength = DISCORD_CHANNEL_NAME_MAX_LENGTH - LOCKED_PREFIX.length;
  
  // Build the name parts
  const prefixPart = prefix ? `${prefix} ` : '';
  const suffix = "'s room";
  const indexPart = index === 1 ? '' : ` ${index}`;
  
  // Calculate how much space we have for the owner name
  const fixedLength = prefixPart.length + suffix.length + indexPart.length;
  const maxOwnerLength = maxLength - fixedLength;
  
  // Truncate owner name if needed
  const truncatedOwner = ownerName.length > maxOwnerLength 
    ? ownerName.slice(0, maxOwnerLength).trim() 
    : ownerName;
  
  return `${prefixPart}${truncatedOwner}${suffix}${indexPart}`;
}

/**
 * Build regex patterns to match rooms owned by this owner.
 * Returns [unnumberedPattern, numberedPattern].
 * 
 * The unnumbered pattern matches "Alice's room" or "General Alice's room".
 * The numbered pattern matches "Alice's room 2" or "General Alice's room 3".
 */
export function buildOwnerRoomPatterns(prefix: string, ownerName: string): [RegExp, RegExp] {
  const base = prefix ? `${prefix} ${ownerName}'s room` : `${ownerName}'s room`;
  const escapedBase = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  const unnumberedPattern = new RegExp(`^${escapedBase}$`);
  const numberedPattern = new RegExp(`^${escapedBase} (\\d+)$`);
  
  return [unnumberedPattern, numberedPattern];
}

/**
 * Parse a room name to extract the index.
 * Returns 1 for unnumbered, the number for numbered, or null if not a match.
 */
export function parseOwnerRoomIndex(
  roomName: string,
  prefix: string,
  ownerName: string,
): number | null {
  const [unnumberedPattern, numberedPattern] = buildOwnerRoomPatterns(prefix, ownerName);
  
  if (unnumberedPattern.test(roomName)) {
    return 1;
  }
  
  const match = roomName.match(numberedPattern);
  if (match) {
    return parseInt(match[1], 10);
  }
  
  return null;
}
