

# Yume — Your Friendly Korean Learning Discord Bot 🇰🇷

Welcome to Yume! This is a community-driven Discord bot designed to make learning Korean fun, social, and rewarding. Whether you’re a total beginner or a seasoned learner, Yume brings daily practice, games, and friendly competition right to your server.

---

## 🌟 What Can Yume Do?

- **Daily Korean Word Game:** Get a new word posted automatically in your server. Keep your streak going, earn XP, and level up as you play!
- **Mini-Games:**
  - `/kminigame` — Guess the Korean word for a random image. Great for visual learners!
  - `/kflagminigame` — Compete to name country flags in Korean. Supports lobbies, custom settings, and placement-based scoring.
- **Economy & Shop:** Earn coins for playing and spend them on hints, streak freezes, and more with `/kshop`.
- **Profiles & Leaderboards:** Track your stats, streaks, and achievements. See how you stack up with `/kprofile` and `/kleaderboard`.
- **Achievements:** Unlock badges for special milestones and show off your progress.
- **Admin Tools:** Set up channels, control game intervals, and manage your server’s learning experience.

---

## 🚀 Getting Started

1. **Set up your environment:**
	- Copy `.env.example` to `.env` and fill in your `TOKEN` and `CLIENT_ID`. (Optional: set `GUILD_ID` for faster command registration.)
2. **Install dependencies:**
	```bash
	npm install
	```
3. **Register slash commands:**
	```bash
	npm run deploy-commands
	```
4. **Start the bot:**
	```bash
	npm start
	```

---

## 📝 Main Commands

- `/kminigame` — Picture guessing game
- `/kflagminigame` — Flag guessing game (multi-round, lobby, scoring)
- `/kstart` — Enable daily word game
- `/kstop` — Disable daily word game
- `/kinterval <minutes>` — Set word post frequency
- `/ksetchannel <channel>` — Set channel for word posts
- `/ksetlevelchannel <channel>` — Set channel for level-up pings
- `/ksend` — Force send a word now
- `/kprofile view|edit` — View or edit your profile
- `/kwallet` — See your coins and items
- `/kleaderboard` — Top users by XP
- `/kshop` — Buy items with coins
- `/kstreak` — View your current streak
- `/kword add|list|import|export` — Manage the word bank (admin)
- `/kinfo` — Info about the bot

---

## 🔒 Safety & Privacy

- **Keep your secrets safe!** Your `.env`, database, and user data are protected by the included `.gitignore`.
- Please don’t share your bot token or sensitive files publicly.

---

## ℹ️ Extra Notes

- The bot needs the `Guild Members` intent enabled in the Discord Developer Portal to track join events.
- Per-server settings are saved in `storage/configs.json`.
- The database is in `storage/game.db` (SQLite).
- For help, bug reports, or to say hi, contact bomberrie (744828801153892382) on Discord.

---

Thanks for checking out Yume. Have fun, make friends, and happy Korean learning! 🇰🇷✨
