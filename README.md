# Yume - Korean Learning Bot

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

Notes

- The bot requires the `Guild Members` intent to receive join events. Enable it in the Developer Portal if necessary.
- Configs are persisted to `storage/configs.json` per-guild.
