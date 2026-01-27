# 🔔 Dinger Bot

A Discord bot that tracks MLB home run predictions and announces successful calls using Twitter API integration. Users make predictions about which players will hit home runs, and the bot announces when those predictions come true!

## Features

- 🏟️ **Home Run Predictions**: Users can submit predictions for which players will hit home runs
- 🎙️ **Dynamic Announcements**: Entertaining announcer-style messages when predictions hit
- 📊 **Google Sheets Integration**: Stores all predictions with timestamps for leaderboard tracking
- 🐦 **Twitter Streaming**: Real-time monitoring of MLB home run announcements from @MLBHR
- 💬 **Discord Commands**: Easy-to-use slash commands for predictions and management
- 🔐 **Permission System**: Moderator-only controls for managing announcements
- 📅 **Daily Tracking**: Automatic sheet creation for each day with predictions and results

## Prerequisites

- Node.js 12.0.0 or higher
- A Discord bot token (from [Discord Developer Portal](https://discord.com/developers/applications))
- Twitter API v2 Bearer token (from [Twitter Developer Portal](https://developer.twitter.com))
- Google Service Account credentials for Sheets API access
- A Google Sheet for storing predictions

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/DingerBot.git
   cd DingerBot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create configuration file**
   - Copy `config-example.js` to `config-dev.js`
   - Fill in your credentials:
   ```javascript
   module.exports = {
       discord_bot_token: 'YOUR_DISCORD_BOT_TOKEN',
       twitter_token: 'YOUR_TWITTER_BEARER_TOKEN',
       spreadsheetID: 'YOUR_GOOGLE_SHEET_ID',
       spreadsheetLink: 'https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID',
       credentials: {
           // Your Google Service Account JSON
       }
   };
   ```

4. **Set up Google Service Account**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new service account
   - Generate a JSON key
   - Share your Google Sheet with the service account email
   - Add the JSON credentials to `config-dev.js`

5. **Add bot to Discord server**
   - Go to Developer Portal → OAuth2 → URL Generator
   - Select scopes: `bot`
   - Select permissions: `Send Messages`, `Read Messages/View Channels`
   - Use the generated URL to invite the bot

## Usage

### Starting the Bot

```bash
npm start
```

The bot will:
1. Connect to Discord
2. Initialize Twitter stream rules
3. Start listening for home run announcements
4. Be ready to accept user commands

### Discord Commands

All commands should be entered in the designated home-run-calls channel.

#### `!hr-call <player name>`
Submit a home run prediction for today.

**Example:**
```
!hr-call Aaron Judge
```

**Response:** DM confirmation with the prediction and sheet link

**Rules:**
- One prediction per user per day
- Use the player's full name
- Use `!remove-call` to submit a different prediction

---

#### `!remove-call`
Remove your home run prediction for today.

**Example:**
```
!remove-call
```

**Response:** DM confirmation that your prediction has been removed

**Rules:**
- Only works if you've already submitted a prediction today
- Allows you to make a new prediction after removal

---

#### `!enable-announcer`
Enable the bot's announcement feature in the current channel. **(Moderator only)**

**Example:**
```
!enable-announcer
```

**Response:** DM confirmation that announcements are now active

**Features:**
- When enabled, the bot posts messages when predictions match home runs
- Can only be run by users with Moderator or Administrator roles
- The bot will post announcements in the channel where this command is run

---

#### `!disable-announcer`
Disable the bot's announcement feature. **(Moderator only)**

**Example:**
```
!disable-announcer
```

**Response:** DM confirmation that announcements are disabled

---

#### `!help`
Display the list of available commands.

**Example:**
```
!help
```

**Response:** DM with formatted command documentation

## Google Sheets Setup

The bot automatically creates a new sheet for each day with the following columns:

| Column | Description |
|--------|-------------|
| **Name** | Discord username of the predictor |
| **Call** | Player name that was predicted |
| **Timestamp** | Date and time (ET) when the prediction was submitted |

### Sheet Organization

- **Sheet name format**: `MM/DD/YYYY` (e.g., `01/26/2026`)
- **One sheet per day**: New sheet automatically created each day
- **Shared leaderboard**: Everyone can view all predictions and track hits/misses

### Creating the Base Sheet

1. Create a new Google Sheet
2. Share it with your service account email
3. Update `spreadsheetID` in your config file
4. The bot will create sheets automatically as needed

## Configuration

### `config-dev.js` Structure

```javascript
module.exports = {
    // Discord Bot Token (from Developer Portal)
    discord_bot_token: 'YOUR_TOKEN_HERE',
    
    // Twitter API v2 Bearer Token
    twitter_token: 'YOUR_BEARER_TOKEN_HERE',
    
    // Google Sheet ID (from sheet URL)
    spreadsheetID: 'SHEET_ID_FROM_URL',
    
    // Public link to the Google Sheet
    spreadsheetLink: 'https://docs.google.com/spreadsheets/d/...',
    
    // Google Service Account JSON credentials
    credentials: {
        type: 'service_account',
        project_id: '...',
        private_key_id: '...',
        private_key: '...',
        client_email: '...',
        client_id: '...',
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs'
    }
};
```

## Architecture

### Core Components

- **Discord Message Handler**: Processes user commands and manages interactions
- **Twitter Stream Connector**: Real-time connection to Twitter API with auto-reconnect logic
- **Google Sheets Manager**: Handles prediction storage and retrieval
- **Announcement Engine**: Formats and posts announcements when predictions match

### Data Flow

```
Discord User Command
    ↓
Parse Command & Extract Player Name
    ↓
Google Sheets API: Store Prediction
    ↓
Add User to Today's Callers List
    ↓
Send Confirmation DM
    ↓
--- (Later) ---
    ↓
Twitter Stream: New Home Run Posted
    ↓
Extract Player Name
    ↓
Google Sheets API: Search Today's Predictions
    ↓
Match Found?
    ├─ YES → Format Announcement → Post to Discord
    └─ NO → Continue Listening
```

## API Integrations

### Twitter API v2
- **Endpoint**: Filtered Stream API
- **Authentication**: Bearer token in headers
- **Function**: Real-time home run announcement monitoring
- **Reconnection**: Automatic with exponential backoff (1ms, 2ms, 4ms, etc.)

### Google Sheets API
- **Authentication**: Service Account credentials
- **Functions**: Create sheets, read rows, add rows, delete rows
- **Rate Limiting**: Handled by google-spreadsheet library

### Discord API
- **Library**: discord.js v12
- **Features**: Message handling, DM sending, role-based permissions

## Error Handling

The bot includes comprehensive error handling:

- **Twitter Connection Errors**: Automatic reconnection with exponential backoff
- **Google Sheets Errors**: Logged and reported to user
- **Discord Errors**: Graceful degradation with error messages
- **Invalid Commands**: User-friendly error responses via DM

## Logging

The bot logs important events to the console with prefixes:

- `[BOT]` - Discord bot events
- `[STREAM]` - Twitter stream events
- `[API]` - API call results
- `[SHEETS]` - Google Sheets operations
- `[MATCH]` - Home run prediction matches
- `[ACTION]` - Major bot actions
- `[ERROR]` - Error conditions
- `[RECONNECT]` - Connection recovery

## Performance Considerations

- **Google Sheets Queries**: Minimized by checking only today's sheet
- **Twitter Reconnection**: Exponential backoff prevents rate limiting
- **Message Queue**: 2-second delay before announcements ensures data consistency
- **State Management**: In-memory tracking prevents repeated API calls

## Troubleshooting

### Bot doesn't respond to commands
- Ensure bot has message read/send permissions in the channel
- Verify bot is in the correct Discord server
- Check console logs for error messages

### No announcements when predictions match
- Verify announcer is enabled with `!enable-announcer`
- Check that bot has permission to send messages in announcement channel
- Verify Twitter bearer token is valid
- Check that player names match exactly (case-sensitive)

### Google Sheets not updating
- Verify service account email has edit access to the sheet
- Check that spreadsheet ID is correct in config
- Ensure service account credentials are valid JSON

### Twitter stream disconnects frequently
- Check internet connection stability
- Verify Twitter bearer token hasn't expired
- Check rate limiting (Twitter API v2 limits apply)

## Security Notes

- **Never commit `config-dev.js`** to version control
- Use environment variables for production deployment
- Restrict Discord bot permissions to minimum required
- Rotate API tokens regularly
- Limit service account permissions to specific sheets

## Future Enhancements

- [ ] Slash commands support (Discord.js v13+)
- [ ] Statistics and season leaderboards
- [ ] Prediction accuracy tracking
- [ ] Multi-game support (other sports)
- [ ] Custom announcement phrases configuration
- [ ] Web dashboard for leaderboard viewing

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License - see the LICENSE file for details.

## Support

For issues and questions:
- Open an issue on GitHub
- Check existing issues for solutions
- Refer to API documentation:
  - [Discord.js Documentation](https://discord.js.org)
  - [Twitter API v2 Docs](https://developer.twitter.com/en/docs/twitter-api)
  - [Google Sheets API Docs](https://developers.google.com/sheets/api)

## Changelog

### Version 2.0.0
- Complete code refactor with comprehensive documentation
- Improved error handling and logging
- Better code organization with clear sections
- Fixed deprecated API usage
- Removed unused dependencies
- Added JSDoc comments for all functions
- Improved variable naming for clarity

### Version 1.0.0
- Initial release
- Basic home run prediction tracking
- Twitter streaming integration
- Google Sheets storage
- Discord command handling

---

**Made with ⚾ by Riley Hoffman**
