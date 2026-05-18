import { ManagedRoom } from '../types/domain';
import { persistence } from './Persistence';
import { logger } from '../core/Logger';

class RoomStore {
  private rooms: Map<string, ManagedRoom> = new Map();
  private readonly filename = 'rooms.json';

  async load(): Promise<void> {
    const data = await persistence.read<Record<string, any>>(this.filename);
    if (data) {
      Object.entries(data).forEach(([channelId, room]) => {
        if (!room.hubId) {
          room.hubId = 'legacy-lobby';
          logger.debug(`Migrated room ${channelId} to use legacy-lobby hub`);
        }
        this.rooms.set(channelId, room as ManagedRoom);
      });
      logger.info(`Loaded ${this.rooms.size} managed rooms`);
    }
  }

  async save(): Promise<void> {
    const data = Object.fromEntries(this.rooms);
    await persistence.write(this.filename, data);
  }

  get(channelId: string): ManagedRoom | undefined {
    return this.rooms.get(channelId);
  }

  async add(room: ManagedRoom): Promise<void> {
    this.rooms.set(room.channelId, room);
    await this.save();
  }

  async update(channelId: string, updates: Partial<ManagedRoom>): Promise<void> {
    const room = this.rooms.get(channelId);
    if (room) {
      Object.assign(room, updates);
      await this.save();
    }
  }

  async delete(channelId: string): Promise<void> {
    this.rooms.delete(channelId);
    await this.save();
  }

  has(channelId: string): boolean {
    return this.rooms.has(channelId);
  }

  getByGuild(guildId: string): ManagedRoom[] {
    return Array.from(this.rooms.values()).filter((room) => room.guildId === guildId);
  }

  getByOwner(ownerUserId: string): ManagedRoom | undefined {
    return Array.from(this.rooms.values()).find((room) => room.ownerUserId === ownerUserId);
  }

  getAll(): ManagedRoom[] {
    return Array.from(this.rooms.values());
  }
}

export const roomStore = new RoomStore();
