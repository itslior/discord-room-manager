import fs from 'fs/promises';
import path from 'path';
import { logger } from '../core/Logger';

export class Persistence {
  private dataDir: string;

  constructor(dataDir = './data') {
    this.dataDir = dataDir;
  }

  async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create data directory', error);
      throw error;
    }
  }

  async read<T>(filename: string): Promise<T | null> {
    const filePath = path.join(this.dataDir, filename);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      logger.error(`Failed to read ${filename}`, error);
      return null;
    }
  }

  async write<T>(filename: string, data: T): Promise<void> {
    await this.ensureDataDir();
    const filePath = path.join(this.dataDir, filename);
    try {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      logger.error(`Failed to write ${filename}`, error);
      throw error;
    }
  }
}

export const persistence = new Persistence();
