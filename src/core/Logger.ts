import { env } from '../config/Env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private redactPatterns: RegExp[] = [
    /DISCORD_BOT_TOKEN=[\w.-]+/gi,
    /APPLICATION_ID=\d+/gi,
    /PUBLIC_KEY=[\w]+/gi,
    /"token":\s*"[^"]+"/gi,
  ];

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevel = env.nodeEnv === 'production' ? 'info' : 'debug';
    return levels.indexOf(level) >= levels.indexOf(currentLevel);
  }

  private redact(message: string): string {
    let redacted = message;
    for (const pattern of this.redactPatterns) {
      redacted = redacted.replace(pattern, '[REDACTED]');
    }
    return redacted;
  }

  private formatMessage(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const baseMsg = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (data) {
      const dataStr = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
      return this.redact(`${baseMsg}\n${dataStr}`);
    }
    
    return this.redact(baseMsg);
  }

  debug(message: string, data?: unknown): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, data));
    }
  }

  info(message: string, data?: unknown): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, data));
    }
  }

  warn(message: string, data?: unknown): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, data));
    }
  }

  error(message: string, error?: unknown): void {
    if (this.shouldLog('error')) {
      const errorData = error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error;
      console.error(this.formatMessage('error', message, errorData));
    }
  }
}

export const logger = new Logger();
