/**
 * ============================================================================
 * Dinger Bot - Discord Home Run Call Tracker
 * ============================================================================
 * 
 * @file Main entry point for Dinger Bot application
 * @author Riley Hoffman
 * @version 2.0.0
 * @description 
 *   Dinger Bot is a Discord bot that monitors the home-run-call channel and
 *   tracks user predictions for home runs hit by monitored MLB players.
 *   
 *   Features:
 *   - Tracks home run predictions via Discord commands
 *   - Stores predictions in Google Sheets with timestamps
 *   - Streams MLB home run alerts from Twitter API
 *   - Announces successful predictions to Discord channel
 *   - Supports command-based user interactions
 * 
 *   Twitter API Documentation:
 *   https://developer.twitter.com/en/docs/twitter-api/tweets/filtered-stream/quick-start
 */

// ============================================================================
// External Dependencies
// ============================================================================

const needle = require('needle');
const Discord = require('discord.js');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const config = require('./config-dev.js');

// ============================================================================
// Constants and Configuration
// ============================================================================

// Twitter API configuration
const token = config.twitter_token;
const rulesURL = 'https://api.twitter.com/2/tweets/search/stream/rules';
const streamURL = 'https://api.twitter.com/2/tweets/search/stream';

/**
 * Twitter stream rules for filtering home run announcements.
 * Only matches tweets from @MLBHR that are not retweets or replies.
 * 
 * Note: Standard projects support up to 25 concurrent rules, each up to 512 characters.
 * Modify this array to track different players or accounts.
 */
const rules = [
    {
        value: '-is:retweet -is:reply from:MLBHR',
        tag: 'NewHomeRun'
    },
];

// Discord configuration
const discordClient = new Discord.Client();
const discordBotToken = config.discord_bot_token;
const spreadsheetID = config.spreadsheetID;
const sheetLink = config.spreadsheetLink;

// Authenticate Discord bot
discordClient.login(discordBotToken);

// ============================================================================
// Application State
// ============================================================================

/** 
 * Flag indicating whether the announcer feature is currently active.
 * When true, the bot will post messages to the monitored channel.
 * @type {boolean}
 */
let isAnnouncerEnabled = false;

/** 
 * The Discord channel ID where announcements will be posted.
 * Set by !enable-announcer command.
 * @type {string}
 */
let announcementChannelId = '';

/** 
 * Array of user IDs who have already submitted a home run call today.
 * Prevents duplicate calls per day per user.
 * @type {string[]}
 */
let todaysCallers = [];

/** 
 * Array of player names that were called today.
 * Used for tracking predictions.
 * @type {string[]}
 */
let todaysPlayerCalls = [];

/** 
 * Flag indicating whether a recent tweet matched one of our player predictions.
 * @type {boolean}
 */
let isMatchFound = false;

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Bot ready event handler.
 * Logs successful connection to Discord.
 * 
 * @event ready
 */
discordClient.on('ready', () => {
    console.log(`[BOT] Successfully logged in as ${discordClient.user.tag}`);
});

/**
 * Main message handler for Discord messages.
 * Processes all user commands for the home run call bot.
 * 
 * @event message
 * @param {Discord.Message} msg - The Discord message object
 */
discordClient.on('message', async (msg) => {
    // Ignore messages from bot accounts
    if (msg.author.bot) {
        return;
    }

    // Get current date/time in Eastern timezone
    const currentDateTime = getCurrentDateTimeET();
    const currentDate = currentDateTime.date;

    // ========================================================================
    // !hr-call Command: Submit a home run prediction
    // ========================================================================
    if (msg.content.startsWith('!hr-call')) {
        // Check if user has already submitted a call today
        if (todaysCallers.includes(msg.author.id)) {
            msg.member.send(
                'You have already made a call for today. To submit a new call, ' +
                'use the !remove-call command and try again.'
            );
            return;
        }

        // Extract player name from command arguments
        const playerName = getPlayerName(msg);

        try {
            // Add the prediction to Google Sheet
            await addCall(playerName, msg.author.username);

            // Track that this user has submitted a call today
            todaysCallers.push(msg.author.id);
            todaysPlayerCalls.push(playerName);

            // Send confirmation DM to user
            msg.member.send(
                `Your home run call for ${currentDate} is **${playerName}**. Good Luck! \n\n` +
                `You can check out the leaderboard and daily call sheet at ${sheetLink}`
            );
        } catch (error) {
            console.error('[ERROR] Failed to add call:', error);
            msg.member.send('An error occurred while submitting your call. Please try again.');
        }
    }

    // ========================================================================
    // !help Command: Display available commands
    // ========================================================================
    if (msg.content.startsWith('!help')) {
        msg.member.send(
            '**Home Run Call Bot - Available Commands**\n\n' +
            '**1. !help** - Displays this list of available commands.\n\n' +
            '**2. !hr-call <player name>** - Submit your home run prediction for today.\n' +
            '   (Please provide the player\'s full name)\n\n' +
            '**3. !remove-call** - Remove your home run call from today\'s sheet.\n\n' +
            '**4. !enable-announcer** (Moderator only) - Enable bot announcements when predictions hit.\n\n' +
            '**5. !disable-announcer** (Moderator only) - Disable announcements.\n\n' +
            'All commands must be entered in the home-run-calls channel.'
        );
    }

    // ========================================================================
    // !enable-announcer Command: Activate announcement feature (Moderator only)
    // ========================================================================
    if (msg.content.startsWith('!enable-announcer')) {
        // Check user permissions (Moderator or Administrator)
        const isModerator = msg.member.roles.cache.some(
            (role) => role.name === 'Moderator' || role.name === 'Administrator'
        );

        if (!isModerator) {
            msg.member.send('You do not have permission to use this command.');
            return;
        }

        announcementChannelId = msg.channel.id;
        isAnnouncerEnabled = true;
        msg.member.send(
            'You have enabled the Dinger Bot announcer feature. Announcements will be posted ' +
            'when home run predictions are matched. To disable, use !disable-announcer.'
        );
    }

    // ========================================================================
    // !disable-announcer Command: Deactivate announcement feature (Moderator only)
    // ========================================================================
    if (msg.content.startsWith('!disable-announcer')) {
        announcementChannelId = '';
        isAnnouncerEnabled = false;
        msg.member.send(
            'You have disabled the Dinger Bot announcer feature. ' +
            'To enable announcements, use the !enable-announcer command.'
        );
    }

    // ========================================================================
    // !remove-call Command: Delete user's prediction for today
    // ========================================================================
    if (msg.content.startsWith('!remove-call')) {
        // Check if user has submitted a call today
        if (!todaysCallers.includes(msg.member.id)) {
            msg.member.send(
                'You have not made a home run call yet today. ' +
                'Use the !hr-call command to submit your call.'
            );
            return;
        }

        try {
            // Remove user's ID from the callers list
            todaysCallers = todaysCallers.filter((id) => id !== msg.member.id);

            // Remove call from Google Sheet
            await removeCall(msg.member.displayName);

            // Send confirmation DM
            msg.member.send(
                'You have removed your home run call for today. ' +
                'Feel free to make another call.'
            );
        } catch (error) {
            console.error('[ERROR] Failed to remove call:', error);
            msg.member.send('An error occurred while removing your call. Please try again.');
        }
    }
});

// ============================================================================
// Twitter API Functions
// ============================================================================

/**
 * Retrieves all active Twitter stream filtering rules.
 * 
 * @async
 * @returns {Promise<Object>} Response object containing array of rule objects
 * @throws {Error} If API request fails (non-200 status)
 * 
 * @example
 * const rules = await getAllRules();
 * console.log(rules.data); // Array of rule objects
 */
async function getAllRules() {
    try {
        const response = await needle('get', rulesURL, {
            headers: {
                authorization: `Bearer ${token}`
            }
        });

        if (response.statusCode !== 200) {
            throw new Error(
                `Twitter API error: ${response.statusMessage} (${response.statusCode})`
            );
        }

        console.log('[API] Retrieved Twitter rules successfully');
        return response.body;
    } catch (error) {
        console.error('[ERROR] Failed to retrieve Twitter rules:', error);
        throw error;
    }
}

/**
 * Deletes all active Twitter stream filtering rules.
 * Useful for resetting the stream before applying new rules.
 * 
 * @async
 * @param {Object} rules - Rules object returned from getAllRules()
 * @returns {Promise<Object>} Response object with deletion status
 * @throws {Error} If rules are not in expected format or API call fails
 * 
 * @example
 * const rules = await getAllRules();
 * await deleteAllRules(rules); // All rules now deleted
 */
async function deleteAllRules(rules) {
    // Return early if no rules exist
    if (!Array.isArray(rules.data)) {
        console.log('[API] No rules to delete');
        return null;
    }

    // Extract rule IDs
    const ruleIds = rules.data.map((rule) => rule.id);

    const deletePayload = {
        delete: {
            ids: ruleIds
        }
    };

    try {
        const response = await needle('post', rulesURL, deletePayload, {
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${token}`
            }
        });

        if (response.statusCode !== 200) {
            throw new Error(`Failed to delete rules: ${response.statusMessage}`);
        }

        console.log(`[API] Successfully deleted ${ruleIds.length} Twitter rules`);
        return response.body;
    } catch (error) {
        console.error('[ERROR] Failed to delete Twitter rules:', error);
        throw error;
    }
}

/**
 * Applies new filtering rules to the Twitter stream.
 * Rules determine which tweets will be returned by the stream.
 * 
 * @async
 * @returns {Promise<Object>} Response object with creation status
 * @throws {Error} If API request fails (non-201 status)
 * 
 * @example
 * await setRules(); // Apply configured rules to stream
 */
async function setRules() {
    const addPayload = {
        add: rules
    };

    try {
        const response = await needle('post', rulesURL, addPayload, {
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${token}`
            }
        });

        if (response.statusCode !== 201) {
            throw new Error(`Failed to add rules: ${response.statusMessage}`);
        }

        console.log(`[API] Successfully added ${rules.length} Twitter rules`);
        return response.body;
    } catch (error) {
        console.error('[ERROR] Failed to set Twitter rules:', error);
        throw error;
    }
}

// ============================================================================
// Twitter Stream Handler
// ============================================================================

/**
 * Establishes and maintains connection to Twitter filtered stream.
 * Handles data events, parsing, and error recovery with exponential backoff.
 * 
 * This function implements a persistent stream connection that:
 * - Listens for incoming tweet data
 * - Parses player names from tweet text
 * - Compares against user predictions
 * - Posts announcements when matches are found
 * - Automatically reconnects on errors with exponential backoff
 * 
 * @param {number} retryAttempt - Current retry attempt count (exponential backoff)
 * @returns {stream} Needle stream object for connection management
 * 
 * @example
 * streamConnect(0); // Initial connection with 0 retry attempts
 */
function streamConnect(retryAttempt) {
    const stream = needle.get(streamURL, {
        headers: {
            'User-Agent': 'v2FilterStreamJS',
            Authorization: `Bearer ${token}`
        },
        timeout: 20000
    });

    stream.on('data', (data) => {
        try {
            const json = JSON.parse(data);
            console.log('[STREAM] Tweet received:', json);

            // Extract player name from tweet text
            const tweetText = json.data.text;
            const playerName = tweetText.split(' -')[0];

            // Check if this player matches any user predictions
            findMatch(playerName);

            // Delay announcement to ensure data consistency
            setTimeout(() => {
                const announcementMessage = getMessage(playerName);

                console.log('[ANNOUNCEMENT] Message:', announcementMessage);
                console.log('[ANNOUNCER] Enabled:', isAnnouncerEnabled);
                console.log('[MATCH] Found:', isMatchFound);

                // Post announcement if announcer is enabled and we have a match
                if (isAnnouncerEnabled && isMatchFound) {
                    console.log(
                        '[ACTION] Announcing match - announcer enabled and match found'
                    );

                    const announcementClient = new Discord.Client();
                    announcementClient.login(discordBotToken);

                    announcementClient.on('ready', () => {
                        console.log(
                            `[DISCORD] Logged in as ${announcementClient.user.tag}`
                        );
                        announcementClient.channels.cache
                            .get(announcementChannelId)
                            .send(announcementMessage);
                    });
                }
            }, 2000);

            // Successfully received data - reset retry counter
            retryAttempt = 0;
        } catch (error) {
            if (data.detail ===
                'This stream is currently at the maximum allowed connection limit.') {
                console.error('[ERROR] Stream at max connection limit:', data.detail);
                process.exit(1);
            } else {
                // Keep-alive signal - no action needed
                console.log('[STREAM] Keep-alive signal received');
            }
        }
    }).on('err', (error) => {
        // Handle connection errors
        if (error.code !== 'ECONNRESET') {
            console.error('[ERROR] Stream error:', error.code);
            process.exit(1);
        } else {
            // Connection reset - implement exponential backoff reconnection
            // Wait time increases: 1ms, 2ms, 4ms, 8ms, 16ms, etc.
            const backoffMs = Math.pow(2, retryAttempt);
            console.warn(
                `[RECONNECT] Connection reset. Retrying in ${backoffMs}ms ` +
                `(attempt ${retryAttempt + 1})`
            );

            setTimeout(() => {
                console.log('[RECONNECT] Attempting to reconnect to stream...');
                streamConnect(++retryAttempt);
            }, backoffMs);
        }
    });

    return stream;
}


// ============================================================================
// Application Initialization
// ============================================================================

/**
 * Main application startup function.
 * Initializes Twitter stream rules and starts listening for tweets.
 * 
 * Workflow:
 * 1. Fetch any existing rules from Twitter API
 * 2. Delete all existing rules to start fresh
 * 3. Apply configured rules
 * 4. Start listening to the filtered stream
 * 
 * @async
 * @returns {Promise<void>}
 */
(async () => {
    let currentRules;

    try {
        console.log('[INIT] Fetching current Twitter stream rules...');
        currentRules = await getAllRules();

        console.log('[INIT] Deleting existing rules to start fresh...');
        await deleteAllRules(currentRules);

        console.log('[INIT] Setting new filtering rules...');
        await setRules();

        console.log('[INIT] Rules configured. Starting stream listener...');
    } catch (error) {
        console.error('[ERROR] Failed to initialize Twitter stream:', error);
        process.exit(1);
    }

    // Begin listening to the Twitter stream
    streamConnect(0);
})();

// ============================================================================
// Google Sheets Integration Functions
// ============================================================================

/**
 * Searches today's sheet for any user predictions matching the given player name.
 * Sets the isMatchFound flag if a match is detected.
 * 
 * This function:
 * - Authenticates with Google Sheets API
 * - Retrieves today's date
 * - Loads the sheet for today
 * - Searches all rows for matching player names
 * - Sets isMatchFound flag accordingly
 * 
 * @async
 * @param {string} playerName - The player name to search for in predictions
 * @returns {Promise<void>}
 * @throws {Error} If Google Sheets API call fails
 * 
 * @example
 * await findMatch('Mike Trout');
 * if (isMatchFound) console.log('We have a winning prediction!');
 */
async function findMatch(playerName) {
    isMatchFound = false;

    try {
        const credentials = config.credentials;
        const doc = new GoogleSpreadsheet(spreadsheetID);
        await doc.useServiceAccountAuth(credentials);
        await doc.loadInfo();

        // Get today's sheet
        const currentDateTime = getCurrentDateTimeET();
        const todayDate = currentDateTime.date;
        const sheet = doc.sheetsByTitle[todayDate];

        if (!sheet) {
            console.log(`[SHEETS] No sheet found for ${todayDate}`);
            return;
        }

        // Retrieve all rows from today's sheet
        const rows = await sheet.getRows();

        // Search for matching player name
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].Call === playerName) {
                console.log(`[MATCH] Found prediction match: ${playerName}`);
                isMatchFound = true;
                return;
            }
        }

        console.log(`[MATCH] No predictions found for ${playerName}`);
    } catch (error) {
        console.error('[ERROR] Failed to search for match:', error);
    }
}

/**
 * Adds a new home run prediction to today's Google Sheet.
 * Creates a new sheet for today if one doesn't exist.
 * 
 * @async
 * @param {string} playerName - The name of the player being predicted
 * @param {string} username - The Discord username of the predictor
 * @returns {Promise<void>}
 * @throws {Error} If Google Sheets API call fails
 * 
 * @example
 * await addCall('Aaron Judge', 'user123');
 * // Row added to today's sheet with name, call, and timestamp
 */
async function addCall(playerName, username) {
    try {
        const credentials = config.credentials;
        const doc = new GoogleSpreadsheet(spreadsheetID);
        await doc.useServiceAccountAuth(credentials);
        await doc.loadInfo();

        // Get current date and time
        const currentDateTime = getCurrentDateTimeET();
        const todayDate = currentDateTime.date;
        const currentTime = currentDateTime.time;

        let sheet = doc.sheetsByTitle[todayDate];

        // Create new sheet for today if it doesn't exist
        if (!sheet) {
            console.log(`[SHEETS] Creating new sheet for ${todayDate}`);
            await doc.addSheet({
                title: todayDate,
                headerValues: ['Name', 'Call', 'Timestamp']
            });
            sheet = doc.sheetsByTitle[todayDate];
        }

        // Add new row with prediction
        await sheet.addRow({
            Name: username,
            Call: playerName,
            Timestamp: currentTime
        });

        console.log(`[SHEETS] Added call - User: ${username}, Player: ${playerName}`);
    } catch (error) {
        console.error('[ERROR] Failed to add call to sheet:', error);
        throw error;
    }
}

/**
 * Removes a user's home run prediction from today's Google Sheet.
 * Searches for rows matching the username and deletes them.
 * 
 * @async
 * @param {string} username - The Discord username of the predictor to remove
 * @returns {Promise<void>}
 * @throws {Error} If Google Sheets API call fails
 * 
 * @example
 * await removeCall('user123');
 * // All rows with username 'user123' removed from today's sheet
 */
async function removeCall(username) {
    try {
        const credentials = config.credentials;
        const doc = new GoogleSpreadsheet(spreadsheetID);
        await doc.useServiceAccountAuth(credentials);
        await doc.loadInfo();

        // Get today's sheet
        const currentDateTime = getCurrentDateTimeET();
        const todayDate = currentDateTime.date;
        const sheet = doc.sheetsByTitle[todayDate];

        if (!sheet) {
            console.log(`[SHEETS] No sheet found for ${todayDate}`);
            return;
        }

        // Retrieve all rows and delete matching ones
        const rows = await sheet.getRows();

        for (const row of rows) {
            if (row.Name === username) {
                console.log(`[SHEETS] Removing call - User: ${username}`);
                await row.delete();
            }
        }
    } catch (error) {
        console.error('[ERROR] Failed to remove call from sheet:', error);
        throw error;
    }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parses a Discord message to extract the player name from the !hr-call command.
 * Removes the command prefix "!hr-call " to get just the player name.
 * 
 * @param {Discord.Message} message - The Discord message object
 * @returns {string} The player name extracted from the message
 * 
 * @example
 * const msg = { content: '!hr-call Aaron Judge' };
 * getPlayerName(msg); // Returns: 'Aaron Judge'
 */
function getPlayerName(message) {
    // Remove "!hr-call " prefix (9 characters) from message
    const playerName = message.content.substring(9).trim();
    return playerName;
}

/**
 * Retrieves current date and time in Eastern Time (ET) format.
 * Used for creating sheet names and timestamps.
 * 
 * @returns {Object} Object containing:
 *   - date {string}: Format 'MM/DD/YYYY' (sheet identifier)
 *   - time {string}: Full datetime string in ET timezone
 * 
 * @example
 * const { date, time } = getCurrentDateTimeET();
 * console.log(date); // '01/26/2026'
 * console.log(time); // '1/26/2026, 2:30:45 PM'
 */
function getCurrentDateTimeET() {
    const utcTime = new Date().toUTCString();
    const etTime = new Date(utcTime).toLocaleString('en-US', {
        timeZone: 'America/New_York'
    });

    // Split into date and time parts
    const [date] = etTime.split(', ');

    return {
        date: date,
        time: etTime
    };
}

/**
 * Generates an announcement message for a home run prediction hit.
 * Selects a random baseball announcer-style phrase and appends the player name.
 * 
 * This function provides variety and entertainment in announcement messages
 * by randomly selecting from a curated list of classic baseball home run calls.
 * 
 * @param {string} playerName - The name of the player who hit the home run
 * @returns {string} Formatted announcement message with player name
 * 
 * @example
 * getMessage('Aaron Judge');
 * // Possible output: "It's high, it's deep, IT IS outta here! Home run Aaron Judge!"
 */
function getMessage(playerName) {
    /**
     * Collection of classic baseball home run announcement phrases.
     * Each can be combined with a player name for dynamic messages.
     * 
     * These are styled after famous MLB announcers (Buck Martinez, Jerry Remy, etc.)
     * @type {string[]}
     */
    const announcementPhrases = [
        'Big fly! ',
        'Going back, at the track, at the wall...SSSEEYA! Home run, ',
        'Dinger Alert! Dinger Alert! Home run, ',
        'Swung on and belted! Deep to center field...gone! A home run for ',
        'It could be, it might be, it is! Home run, ',
        'Back, back, back, back, back, back, back, back, GONE! Home run, ',
        "It's going, going, GONE! Home run, ",
        "Long drive, way back, warning track...wall...you can touch 'em all! Home run, ",
        'An absolute MOONSHOT! Home run for ',
        "Somebody get this pitcher a map! He's gonna need it to find that ball. Home run, ",
        'Hold on to your hats, peanuts and cracker jacks. We have a correct home run call ' +
            'for anyone that chose ',
        "Wayyyyy outta here. That's a no doubter for ",
        'Look who just went yicketty! It was ',
        'That, ladies and gentlemen, is what we call a tater. Home run for ',
        'You can kiss that one goodbye! Home run, ',
        'He hits it high. He hits it deep. GONE! Home run, ',
        'How can you not be romantic about baseball? Home run for ',
        'There it gooooooooooooes, SEE YA! Home run ',
        "You're gonna need a 50 foot ladder to make that catch! Home run, ",
        "Just like the ex-girlfriend who ain't comin' back, that one is gone. Home run for ",
        "I don't believe what I just saw! Home run for ",
        'Santa Maria! Home run, ',
        "It's high, it's deep, IT IS outta here! Home run ",
        'Ding, dong, that pitch is dead. Put a dinger on the board for ',
        'Yahtzee! Home run, ',
        '3..2..1 We have lift off. Home run, ',
        "Big dog's gotta eat! Home run for ",
        'Adios pelota! Home run for',
        'Forget it. Home run, ',
        'Bye bye baby. Home run for ',
        'Oh Doctor! That\'s a home run for '
    ];

    // Select a random announcement phrase
    const randomPhrase =
        announcementPhrases[getRandomInt(announcementPhrases.length)];

    // Combine phrase with player name
    const fullMessage = `${randomPhrase}${playerName}!`;

    return fullMessage;
}

/**
 * Generates a random integer between 0 (inclusive) and max (exclusive).
 * Used for selecting random announcement phrases.
 * 
 * @param {number} max - The upper bound (exclusive)
 * @returns {number} Random integer in range [0, max)
 * 
 * @example
 * getRandomInt(10); // Returns random number: 0-9
 */
function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}
