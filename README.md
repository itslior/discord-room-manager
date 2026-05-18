# Discord Dynamic VC Room Manager

A production-ready Discord bot that automatically creates temporary voice channels when users join a lobby, with role-based access control, room ownership permissions, and robust failure recovery.

## Features

- **Auto Room Creation**: Users joining a configured lobby voice channel automatically get their own temporary room
- **Smart Naming**: Rooms use lowest available index (VC1, VC2, etc.) with automatic gap filling
- **Role-Based Access**: Configure role presets to restrict who can create rooms
- **Room Ownership**: Channel creators get elevated permissions and command access
- **Lock/Unlock**: Owners can lock rooms to prevent new users from joining
- **Ownership Transfer**: Transfer or take ownership when original owner leaves
- **Auto Cleanup**: Empty rooms are automatically deleted
- **Crash Recovery**: Bot identifies and cleans orphaned rooms on restart using permission markers
- **Multi-Guild**: Isolated configuration and state per Discord server

## Prerequisites

- Node.js 18 or higher
- A Discord bot application (create at [Discord Developer Portal](https://discord.com/developers/applications))
- Bot token and Application ID

## Installation

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd discord-room-manager
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```env
DISCORD_BOT_TOKEN=your_bot_token_here
APPLICATION_ID=your_application_id_here

# Optional: Restrict to specific servers
# ALLOWED_GUILD_IDS=123456789012345678,987654321098765432
```

### 3. Invite Bot to Your Server

Use this invite URL (replace `<APPLICATION_ID>` with your bot's Application ID):

```
https://discord.com/api/oauth2/authorize?client_id=<APPLICATION_ID>&permissions=16785488&scope=bot%20applications.commands
```

**Required Permissions:**
- View Channels
- Manage Channels
- Move Members
- Send Messages
- Use Slash Commands

### 4. Build and Deploy Commands

```bash
npm run build
npm run deploy-commands
```

### 5. Start the Bot

```bash
# Production
npm start

# Development (with auto-reload)
npm run dev
```

## Configuration

### Initial Setup

Run `/setup` in your Discord server (requires `MANAGE_GUILD` permission):

```
/setup
  lobby: #join-for-room (voice channel)
  command_channel: #bot-commands (text channel)
  category: Voice Rooms (optional)
  prefix: VC (optional, default)
```

### Advanced Configuration

#### View Current Config
```
/config show
```

#### Update Lobby Channel
```
/config set-lobby channel:#new-lobby
```

#### Update Command Channel
```
/config set-command-channel channel:#new-commands
```

#### Set Base Role for Permissions
By default, lock/unlock operations affect `@everyone`. If your server uses a custom base role (like "Member"), configure it:

```
/config set-base-role role:@Member
```

#### Configure Role Presets
Restrict room creation to users with specific roles:

```
/config set-roles preset_name:diamond+ role_ids:123,456,789
```

Example: Allow only Diamond, Master, Champion, and Grandmaster roles to create rooms:
1. Get role IDs (enable Developer Mode, right-click role, Copy ID)
2. Run: `/config set-roles preset_name:diamond+ role_ids:DIAMOND_ID,MASTER_ID,CHAMPION_ID,GRANDMASTER_ID`

## User Commands

All room control commands must be run in the configured command channel.

### `/lock`
Lock your managed room (prevents new users from joining).
- Must be room owner
- Denies configured base role + any role preset roles used during creation
- Example response: `🔒 Room locked. Denied access to: @everyone, @Diamond, @Master`

### `/unlock`
Unlock your managed room.
- Must be room owner
- Restores access to base role + preset roles
- Example response: `🔓 Room unlocked. Restored access to: @everyone, @Diamond, @Master`

### `/take-ownership`
Take ownership of a room when the original owner has left.
- Must be in the room
- Original owner must **not** be connected
- Transfers all owner permissions

### `/transfer @user`
Explicitly transfer ownership to another user.
- Must be current room owner
- Target user must be in your room
- Example: `/transfer @Alice`

## How It Works

### Room Creation Flow
1. User with eligible roles joins the configured lobby
2. Bot finds lowest available room index (e.g., `VC1`, `VC2`, or fills gaps)
3. Bot creates voice channel with:
   - Bot's `MANAGE_CHANNELS` permission overwrite (for tracking)
   - Owner's elevated permissions (ManageChannels, MoveMembers, etc.)
4. User is automatically moved to new room
5. Room metadata is persisted to disk

### Room Cleanup Flow
1. Last user leaves a managed room (owner or not)
2. Bot detects 0 members via voice state update
3. Channel is deleted via Discord API
4. Metadata is removed from storage

### Startup Reconciliation
When bot restarts or reconnects:
1. Scans all voice channels in configured guilds
2. Identifies managed rooms by:
   - Name pattern match (`VC\d+` by default)
   - Bot has `MANAGE_CHANNELS` permission overwrite
3. For each identified room:
   - If empty: delete channel
   - If occupied: preserve and track
4. Removes stale metadata for deleted channels
5. Logs summary: preserved, cleaned, orphaned

## Docker Deployment

### Build and Run

```bash
docker-compose up -d
```

### View Logs

```bash
docker-compose logs -f
```

### Stop

```bash
docker-compose down
```

## Architecture

```
src/
├── index.ts                  # Entrypoint
├── config/
│   └── Env.ts               # Environment validation
├── core/
│   ├── Bot.ts               # Discord client setup
│   └── Logger.ts            # Structured logging with redaction
├── events/
│   ├── VoiceStateUpdate.ts  # Lobby join + room empty detection
│   └── InteractionCreate.ts # Slash command routing
├── services/
│   ├── ChannelNameAllocator.ts    # Find lowest free VC index
│   ├── RoomLifecycleService.ts    # Create/delete/lock/transfer
│   ├── OwnershipService.ts        # Ownership validation
│   ├── RoleAccessService.ts       # Role preset evaluation
│   ├── GuildConfigService.ts      # Config CRUD
│   ├── CommandScopeService.ts     # Command channel enforcement
│   └── ReconciliationService.ts   # Startup orphan cleanup
├── commands/
│   ├── Setup.ts, Config.ts        # Admin configuration
│   └── Lock.ts, Unlock.ts, TakeOwnership.ts, Transfer.ts
├── state/
│   ├── ConfigStore.ts       # Guild configurations (disk-backed)
│   ├── RoomStore.ts         # Active room tracking (disk-backed)
│   └── Persistence.ts       # JSON file adapter
└── types/
    └── domain.ts            # TypeScript interfaces
```

## Testing

Run unit tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

## Integration Test Checklist

- [ ] Bot invite and permission grant successful
- [ ] `/setup` completes with valid channels
- [ ] User joining lobby creates `VC1`
- [ ] Second user creates `VC2`
- [ ] Deleting `VC1` and creating new room results in `VC1` (gap filling)
- [ ] Empty room auto-deletes within 5 seconds
- [ ] `/lock` prevents new users from joining
- [ ] `/lock` fails outside command channel (scope enforcement)
- [ ] `/unlock` restores access
- [ ] `/take-ownership` succeeds when owner leaves
- [ ] `/take-ownership` fails while owner present
- [ ] `/transfer @user` succeeds when target is in room
- [ ] User without required role cannot create room (if presets configured)
- [ ] Bot restart cleans up orphaned empty rooms
- [ ] Bot restart preserves occupied rooms with correct ownership
- [ ] Multi-guild: separate configs and rooms per server

## Security

- **Secrets**: Only `DISCORD_BOT_TOKEN` and `APPLICATION_ID` are stored in `.env`
- **Logging**: Sensitive data (tokens, keys) is automatically redacted
- **Permissions**: Bot uses least-privilege Discord permissions
- **Authorization**: `/setup` and `/config` require `MANAGE_GUILD`
- **Validation**: All channel/role IDs are validated to belong to the invoking guild
- **Scope Enforcement**: Room commands restricted to configured command channel

## Troubleshooting

### Bot doesn't respond to commands
1. Verify bot is online (`npm start` running without errors)
2. Ensure commands were deployed: `npm run deploy-commands`
3. Check bot has `Use Application Commands` permission
4. Wait up to 1 hour for global command registration (or test in DM with bot)

### Rooms aren't being created
1. Verify `/setup` was completed successfully
2. Check bot has `Manage Channels` and `Move Members` permissions
3. Ensure lobby channel ID is correct: `/config show`
4. Check role preset configuration if used
5. Review logs for errors: `docker-compose logs -f` or console output

### Rooms aren't cleaning up
1. Bot must have `Manage Channels` permission
2. Check bot is receiving voice state updates (needs `GuildVoiceStates` intent - already configured)
3. Review logs for deletion errors

### Bot lost track of rooms after crash
- Run reconciliation manually by restarting the bot
- Reconciliation runs automatically on startup
- Check logs for reconciliation summary

## Development

### Scripts
- `npm run build` - Compile TypeScript
- `npm run dev` - Run with hot reload
- `npm test` - Run unit tests
- `npm run lint` - Lint code
- `npm run format` - Format code with Prettier

### Adding New Commands
1. Create command file in `src/commands/`
2. Implement `Command` interface with `data` and `execute`
3. Register in `src/index.ts`
4. Run `npm run deploy-commands`

## License

MIT

## Support

For issues, questions, or contributions, please open an issue on the repository.
