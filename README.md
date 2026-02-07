# Discord Welcome Bot

Simple Discord bot to interactively configure a welcome message per-server.

Setup

1. Copy `.env.example` to `.env` and fill `TOKEN` and `CLIENT_ID`. Optionally set `GUILD_ID` to register the slash command quickly to a guild for testing.

2. Install dependencies:

```bash
npm install
```

3. Register the slash command (for dev guild or global):

```bash
npm run deploy-commands
```

4. Run the bot:

```bash
npm start
```

Usage

- Run `/welcome-setup` in a server where the bot is present. An ephemeral interactive menu will appear allowing you to select a channel, configure embed content (title, description, color, image URL), preview, and save. After saving, the bot will send the configured welcome embed when new members join.

Notes

- The bot requires the `Guild Members` intent to receive join events. Enable it in the Developer Portal if necessary.
- Configs are persisted to `storage/configs.json` per-guild.
