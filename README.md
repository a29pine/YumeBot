# Yume — Korean Learning Discord Bot 🇰🇷

Yume is a Discord bot built to make learning Korean more interactive inside your server. It focuses on daily practice, light competition, and small game loops that keep people coming back.

It’s designed to be simple to set up and easy to run in community servers.

---

## What It Does

### Daily Word Game
Posts Korean words automatically in a chosen channel.  
Users can:
- Answer in chat
- Earn XP and coins
- Build streaks
- Level up over time

You control how often words are posted and where they go.

---

### Mini-Games

**`/kminigame`**  
Guess the Korean word based on an image.

**`/kflagminigame`**  
Multi-round flag guessing game:
- Lobby system
- Adjustable rounds and answer time
- Placement-based scoring
- Results summary at the end

---

### Economy & Progression

- XP and leveling system  
- Coins for correct answers  
- Shop with usable items (hints, streak freezes, etc.)  
- Profiles and leaderboards  
- Achievement tracking  

Core commands:
- `/kprofile`
- `/kleaderboard`
- `/kwallet`
- `/kshop`
- `/kstreak`

---

### Admin Controls

Server admins can:

- `/kstart` — Enable daily word posting  
- `/kstop` — Disable it  
- `/kinterval <minutes>` — Set posting frequency  
- `/ksetchannel <channel>` — Set word channel  
- `/ksetlevelchannel <channel>` — Set level-up channel  
- `/kword add|list|import|export` — Manage word bank  

---

## Setup

1. Copy `.env.example` to `.env`
2. Fill in:
   - `TOKEN`
   - `CLIENT_ID`
   - (Optional) `GUILD_ID` for faster local testing

3. Install dependencies:

```bash
npm install
```

4. Register commands:

```bash
npm run deploy-commands
```

5. Start the bot:

```bash
npm start
```

---

## Storage

- Per-server config: `storage/configs.json`
- SQLite database: `storage/game.db`

Make sure these files are not committed publicly.

---

## Requirements

- Node.js 18+
- `Guild Members` intent enabled in the Discord Developer Portal

---

## Notes

- Designed for community servers.
- Not intended for massive-scale deployment without modification.
- Uses SQLite for simplicity.
- Keep your bot token private.

---

If you run into issues or want to contribute, feel free to reach out.
