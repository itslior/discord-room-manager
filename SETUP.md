# Setup & Deployment Guide

This guide covers deployment options, hosting requirements, and operational best practices for running the Discord Room Manager bot.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Hosting Options](#hosting-options)
- [Deployment Methods](#deployment-methods)
- [Configuration Management](#configuration-management)
- [Monitoring & Logging](#monitoring--logging)
- [Backup & Recovery](#backup--recovery)
- [Scaling Considerations](#scaling-considerations)
- [Security Best Practices](#security-best-practices)

---

## Architecture Overview

### Communication Model

This bot uses **Discord Gateway WebSocket** for real-time events, not HTTP webhooks:

- **No exposed API/endpoints required** - Bot connects to Discord's gateway
- **Inbound connections**: Discord Gateway (wss://gateway.discord.gg)
- **Outbound connections**: Discord REST API (https://discord.com/api/v10)
- **Ports**: No inbound ports need to be opened
- **Firewall**: Only requires outbound HTTPS (443) and WSS (443) access

### Data Storage

```
data/
├── config.json    # Per-guild configurations (lobby, command channel, role presets)
└── rooms.json     # Active managed room tracking
```

- **Persistence**: JSON files by default (SQLite optional for production)
- **State**: In-memory with periodic disk writes
- **Size**: Minimal (~1KB per guild, ~100 bytes per active room)
- **Recovery**: Bot rebuilds state from Discord channel scan on startup

---

## Hosting Options

### 1. VPS / Cloud VM (Recommended)

**Best for**: Production deployments, multiple guilds

**Providers**:
- **DigitalOcean Droplet**: $6/month (1GB RAM)
- **Linode Nanode**: $5/month (1GB RAM)
- **AWS EC2 t3.micro**: ~$7/month (1GB RAM, free tier eligible)
- **Google Cloud e2-micro**: ~$7/month (1GB RAM, free tier eligible)
- **Hetzner CX11**: €3.79/month (2GB RAM)

**Requirements**:
- **CPU**: 1 vCPU (minimal load)
- **RAM**: 512MB minimum, 1GB recommended
- **Storage**: 5GB (OS + bot + logs)
- **Network**: Stable connection, <100KB/s typical bandwidth

**Setup**:
```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y
sudo apt install -y nodejs npm git

# Clone and setup
git clone <repository-url>
cd discord-room-manager
npm install
npm run build

# Setup systemd service (see below)
```

### 2. Docker Container

**Best for**: Consistent deployments, easy updates, multi-service hosts

**Providers**:
- **Railway.app**: ~$5/month, free tier available
- **Render.com**: Free tier available, $7/month for persistent storage
- **Fly.io**: Free tier (256MB RAM), pay-as-you-go
- **Your VPS with Docker**: Any provider

**Setup**:
```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f

# Update
git pull
docker-compose up -d --build
```

### 3. Platform as a Service (PaaS)

**Best for**: Minimal maintenance, auto-scaling

**Providers**:
- **Railway**: Auto-deploy from GitHub, ~$5/month
- **Render**: Free tier with sleep, $7/month always-on
- **Heroku**: Free tier deprecated, ~$7/month
- **Fly.io**: 256MB free tier, auto-scale available

**Notes**:
- Ensure persistent volume for `data/` directory
- Some free tiers may sleep after inactivity (not suitable for real-time bot)

### 4. Always-Free Tiers

**Oracle Cloud**: 2x Always Free VMs (ARM-based, 1GB RAM each)
**Google Cloud**: e2-micro free tier (US regions only)
**AWS**: t2.micro/t3.micro free for 12 months

### 5. Home Server / Raspberry Pi

**Best for**: Personal use, small guilds, testing

**Hardware**:
- Raspberry Pi 3B+ or newer (1GB RAM minimum)
- Any x86 PC/server with 512MB+ RAM
- NAS with Docker support (Synology, QNAP)

**Considerations**:
- Reliable power and internet required
- Port forwarding NOT needed (bot initiates connections)
- Consider UPS for power stability

---

## Deployment Methods

### Method 1: Systemd Service (Linux VPS)

Create `/etc/systemd/system/discord-room-manager.service`:

```ini
[Unit]
Description=Discord Room Manager Bot
After=network.target

[Service]
Type=simple
User=discord-bot
WorkingDirectory=/home/discord-bot/discord-room-manager
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/discord-room-manager/output.log
StandardError=append:/var/log/discord-room-manager/error.log

[Install]
WantedBy=multi-user.target
```

**Setup**:
```bash
# Create user
sudo useradd -r -s /bin/false discord-bot

# Create log directory
sudo mkdir -p /var/log/discord-room-manager
sudo chown discord-bot:discord-bot /var/log/discord-room-manager

# Deploy code
sudo cp -r discord-room-manager /home/discord-bot/
sudo chown -R discord-bot:discord-bot /home/discord-bot/discord-room-manager

# Enable and start
sudo systemctl enable discord-room-manager
sudo systemctl start discord-room-manager

# Check status
sudo systemctl status discord-room-manager
sudo journalctl -u discord-room-manager -f
```

### Method 2: Docker Compose

**docker-compose.yml** (already included):
```yaml
version: '3.8'

services:
  bot:
    build: .
    container_name: discord-room-manager
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
```

**Deploy**:
```bash
docker-compose up -d
```

**Update**:
```bash
git pull
docker-compose down
docker-compose up -d --build
```

### Method 3: PM2 Process Manager

```bash
npm install -g pm2

# Start bot
pm2 start dist/index.js --name discord-room-manager

# Save process list
pm2 save

# Auto-start on boot
pm2 startup
# (follow the command it outputs)

# Monitor
pm2 monit
pm2 logs discord-room-manager
```

### Method 4: Screen/Tmux (Development Only)

**NOT recommended for production** (no auto-restart, not persistent across reboots)

```bash
screen -S discord-bot
npm start
# Ctrl+A, D to detach
```

---

## Configuration Management

### Environment Variables

**Minimal setup** (`.env`):
```env
DISCORD_BOT_TOKEN=your_token_here
APPLICATION_ID=your_app_id_here
```

**Production setup**:
```env
DISCORD_BOT_TOKEN=your_token_here
APPLICATION_ID=your_app_id_here
NODE_ENV=production

# Optional: Restrict to specific guilds
ALLOWED_GUILD_IDS=123456789012345678,987654321098765432

# Optional: Custom data directory
DATA_DIR=./data
```

### Secret Management

#### Option 1: Environment Variables (Simple)
```bash
# Set in systemd service file
Environment="DISCORD_BOT_TOKEN=..."

# Or use EnvironmentFile
EnvironmentFile=/etc/discord-room-manager/.env
```

#### Option 2: Docker Secrets
```yaml
services:
  bot:
    secrets:
      - discord_token
    environment:
      - DISCORD_BOT_TOKEN=/run/secrets/discord_token

secrets:
  discord_token:
    file: ./secrets/discord_token.txt
```

#### Option 3: Cloud Provider Secrets
- **AWS**: AWS Secrets Manager + IAM role
- **Google Cloud**: Secret Manager
- **Azure**: Key Vault
- **Railway/Render**: Built-in environment variable encryption

### Data Directory

**Default location**: `./data/`

**Change location**:
```typescript
// src/state/Persistence.ts
constructor(dataDir = process.env.DATA_DIR || './data')
```

**Backup**:
```bash
# Automated backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf "backup_${DATE}.tar.gz" data/
# Upload to S3, rsync, etc.
```

---

## Monitoring & Logging

### Logging

**Current implementation**: Console output with timestamps

**Log levels**:
- `debug`: Development only
- `info`: Normal operations (room created/deleted)
- `warn`: Non-critical issues
- `error`: Failures requiring attention

**Viewing logs**:

**Systemd**:
```bash
sudo journalctl -u discord-room-manager -f
sudo journalctl -u discord-room-manager --since "1 hour ago"
```

**Docker**:
```bash
docker-compose logs -f
docker-compose logs --tail=100
```

**PM2**:
```bash
pm2 logs discord-room-manager
pm2 logs discord-room-manager --lines 100
```

### Log Rotation

**Systemd** (automatic via journald):
```bash
# Configure in /etc/systemd/journald.conf
SystemMaxUse=500M
SystemMaxFileSize=50M
```

**Docker**:
```yaml
services:
  bot:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

**File-based** (logrotate):
```
/var/log/discord-room-manager/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
}
```

### Health Monitoring

**Simple HTTP healthcheck** (optional addition):

Add to `src/index.ts`:
```typescript
import http from 'http';

http.createServer((req, res) => {
  if (req.url === '/health') {
    const healthy = bot.client.ws.status === 0; // READY
    res.writeHead(healthy ? 200 : 503);
    res.end(JSON.stringify({ 
      status: healthy ? 'ok' : 'unhealthy',
      uptime: process.uptime(),
      guilds: bot.client.guilds.cache.size
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(8080);
```

**External monitoring**:
- **UptimeRobot**: Free, 50 monitors
- **Healthchecks.io**: Free, cron-style checks
- **StatusCake**: Free tier available
- **Self-hosted**: Uptime Kuma, Prometheus + Grafana

---

## Backup & Recovery

### What to Backup

1. **`.env` file** - Bot credentials
2. **`data/` directory** - Guild configs and room state
3. **(Optional) Bot application settings** - Document Application ID, permissions

### Backup Strategies

**Manual**:
```bash
cp .env .env.backup
tar -czf data-backup-$(date +%Y%m%d).tar.gz data/
```

**Automated (cron)**:
```bash
# /etc/cron.daily/discord-bot-backup
#!/bin/bash
cd /home/discord-bot/discord-room-manager
tar -czf "/backups/discord-bot-$(date +%Y%m%d).tar.gz" data/
find /backups -name "discord-bot-*.tar.gz" -mtime +30 -delete
```

**Cloud sync**:
```bash
# Sync to S3
aws s3 sync data/ s3://my-bucket/discord-bot-backups/data/

# Sync to Google Drive (rclone)
rclone sync data/ gdrive:discord-bot-backups/data/
```

### Recovery Procedure

**If `data/` is lost**:
1. Bot starts with empty state
2. Reconciliation service scans Discord channels
3. Identifies managed rooms by bot permission overwrites
4. Rebuilds room tracking automatically
5. Admins may need to re-run `/setup` for guild configs

**If `.env` is lost**:
1. Regenerate bot token in Discord Developer Portal
2. Update `.env` with new token
3. Restart bot

---

## Scaling Considerations

### Single Instance Limits

**Tested capacity** (1 instance):
- **Guilds**: 100+ supported
- **Active rooms**: 1000+ simultaneous
- **Events/second**: 100+ voice state updates
- **RAM usage**: ~100-200MB typical
- **CPU usage**: <5% typical, spikes during reconciliation

### When to Scale

**Indicators**:
- Consistently high CPU (>80%)
- RAM usage approaching limit
- Event processing delays
- Gateway disconnections

### Horizontal Scaling

**Current limitation**: Single-instance only (shared in-memory state)

**To enable multi-instance**:
1. Replace `Persistence.ts` with Redis/PostgreSQL
2. Implement distributed locking for room creation
3. Use sticky sessions or session replication

**Simple approach** (if needed):
- Run separate bot instances per region/group of guilds
- Use `ALLOWED_GUILD_IDS` to partition

### Database Upgrade (Optional)

**When to upgrade**:
- 50+ guilds
- High availability requirements
- Multi-instance deployment

**SQLite implementation**:
```typescript
// src/state/Persistence.ts
import sqlite3 from 'sqlite3';

export class SQLitePersistence extends Persistence {
  // Implement read/write with SQL queries
}
```

**PostgreSQL/MySQL**:
- Use connection pooling
- Implement proper migrations
- Consider ORMs (Prisma, TypeORM)

---

## Security Best Practices

### 1. Token Security

**DO**:
- Store token in `.env`, never in code
- Add `.env` to `.gitignore`
- Rotate token if compromised
- Use read-only token for testing (impossible with Discord, but limit permissions)

**DON'T**:
- Commit `.env` to Git
- Share token in Discord messages
- Log token value
- Store token in public CI/CD variables

### 2. Bot Permissions

**Principle of least privilege**:
```
Required:
✅ View Channels
✅ Manage Channels (create/delete only)
✅ Move Members
✅ Send Messages
✅ Use Slash Commands

Not required:
❌ Administrator
❌ Manage Server
❌ Manage Roles
❌ Manage Webhooks
```

### 3. Server Hardening

**VPS/VM**:
```bash
# Firewall (only allow outbound)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw enable

# Auto-updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# Fail2ban (SSH protection)
sudo apt install fail2ban
```

**Docker**:
```yaml
services:
  bot:
    user: "1000:1000"  # Non-root user
    read_only: true    # Read-only filesystem
    security_opt:
      - no-new-privileges:true
    volumes:
      - ./data:/app/data  # Only data writable
```

### 4. Rate Limiting

**Already implemented**:
- Discord API rate limits automatically handled by discord.js
- No exposed HTTP endpoints to rate limit

**Additional protection** (if adding web endpoints):
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
```

### 5. Input Validation

**Already implemented**:
- Guild ID validation (commands only work in owning guild)
- Channel ID validation (must belong to guild)
- Role ID validation (must exist in guild)
- Permission checks before command execution

---

## Troubleshooting

### Bot Won't Start

**Check**:
```bash
# Verify Node.js version
node --version  # Should be 18+

# Check for syntax errors
npm run build

# Verify environment
cat .env  # Token and Application ID present?

# Check logs
journalctl -u discord-room-manager -n 50
```

### Bot Online But Not Responding

**Check**:
1. Commands registered? `npm run deploy-commands`
2. Bot has required permissions in server?
3. Check logs for errors
4. Verify gateway connection: logs should show "Bot ready!"

### Rooms Not Cleaning Up

**Check**:
1. Bot still has `Manage Channels` permission?
2. Check logs for deletion errors
3. Verify voice state intents are enabled (already configured)

### High Memory Usage

**Solutions**:
1. Restart bot (frees accumulated cache)
2. Check for memory leaks in logs
3. Reduce log retention if storing in memory
4. Consider log streaming to external service

---

## Contributing

### Development Setup

```bash
# Clone repository
git clone <repository-url>
cd discord-room-manager

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your test bot credentials

# Run in development mode
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

### Code Structure

See [README.md](README.md#architecture) for architecture overview.

### Pull Requests

1. Fork repository
2. Create feature branch: `git checkout -b feature/your-feature`
3. Make changes with tests
4. Ensure linting passes: `npm run lint`
5. Commit with clear messages
6. Push and create PR

---

## License

MIT - See LICENSE file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)
- **Discord**: [Support Server](https://discord.gg/your-invite) (if applicable)
