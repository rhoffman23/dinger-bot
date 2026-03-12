# 🏟️ Dinger Bot

A Discord bot that tracks daily home run predictions and logs them to a Google Sheet.

## How It Works

1. Users submit their daily HR prediction with `!hr-call <player name>`
2. The bot logs the call (player, username, timestamp) to a Google Sheet tab for that day
3. One call per user per day — use `!remove-call` to change your pick

## Commands

| Command | Description |
|---------|-------------|
| `!hr-call <player name>` | Submit your HR prediction for today |
| `!remove-call` | Remove your call and pick again |
| `!help` | Show available commands |

---

## Setup

### 1. Discord Bot

- Create an application at [discord.com/developers](https://discord.com/developers/applications)
- Go to **Bot** tab → copy the token
- Under **Privileged Gateway Intents**, enable:
  - ✅ Message Content Intent
  - ✅ Server Members Intent
- Invite the bot to your server using:
  ```
  https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=3072&scope=bot
  ```

### 2. Google Sheet Setup

> **Send these instructions to the Google Sheet owner:**

#### What the Discord server owner needs to do:

1. **Invite the bot** to your server using this link:
   ```
   https://discord.com/oauth2/authorize?client_id=859256971857362954&permissions=3072&scope=bot
   ```
   - Click the link → select your server → click **Authorize**

2. **Create a channel** for HR calls (e.g. `#hr-calls`)
   - The bot listens for `!hr-call` commands in any channel it can see
   - Recommended: dedicate a channel so calls don't get lost in general chat

3. **Set channel permissions** (optional but recommended):
   - Make sure the bot has **Send Messages** and **Read Messages** in the channel
   - You can restrict `!hr-call` to specific channels by only giving the bot access there

That's it — once the bot is in the server, users can start making calls immediately.

---

#### What the Google Sheet owner needs to do:

1. **Share the Google Sheet** with this email address as an **Editor**:
   ```
   dinger-bot@home-run-call-bot.iam.gserviceaccount.com
   ```
   - Open the Google Sheet → click **Share** (top right)
   - Paste the email above → set role to **Editor** → click Send

That's it! The bot will automatically create a new tab for each day's calls.

#### How the sheet works:
- Each day gets its own tab named with the date (e.g. `3/12/2026`)
- Columns: **Name** (Discord username), **Call** (player name), **Timestamp**
- The bot creates the tab automatically on the first call of the day

### 3. Configuration

Copy `config-example.js` to `config-dev.js` and fill in:

```js
module.exports = {
    discord_bot_token: 'YOUR_DISCORD_BOT_TOKEN',
    spreadsheetID: 'YOUR_GOOGLE_SHEET_ID',  // from the sheet URL
    spreadsheetLink: 'https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID',
    credentials: require('./google-credentials.json')
};
```

The **spreadsheet ID** is the long string in the Google Sheet URL:
```
https://docs.google.com/spreadsheets/d/[THIS_PART]/edit
```

Place your Google service account JSON key file as `google-credentials.json` in the project root.

### 4. Run

```bash
npm install
node index.js

# Or with PM2:
pm2 start index.js --name dinger-bot
```

## Requirements

- Node.js 16+
- discord.js v14
- Google Sheets API enabled on your Google Cloud project
