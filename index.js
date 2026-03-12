/**
 * ============================================================================
 * Dinger Bot - Discord Home Run Call Tracker (v3.0 - discord.js v14)
 * ============================================================================
 * 
 * @author Riley Hoffman
 * @version 3.0.0
 * @description 
 *   Tracks home run predictions via Discord commands and stores in Google Sheets.
 */

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const config = require('./config-dev.js');

// ============================================================================
// Discord Client Setup (v14)
// ============================================================================

const discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
});

const spreadsheetID = config.spreadsheetID;
const sheetLink = config.spreadsheetLink;

// ============================================================================
// Application State
// ============================================================================

let todaysCallers = [];
let todaysPlayerCalls = [];

// ============================================================================
// Event Handlers
// ============================================================================

discordClient.on('ready', () => {
    console.log(`[BOT] Successfully logged in as ${discordClient.user.tag}`);
    console.log(`[BOT] In ${discordClient.guilds.cache.size} guild(s)`);
});

discordClient.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;

    const currentDateTime = getCurrentDateTimeET();
    const currentDate = currentDateTime.date;

    // !hr-call — Submit a home run prediction
    if (msg.content.startsWith('!hr-call')) {
        if (todaysCallers.includes(msg.author.id)) {
            await msg.author.send(
                'You have already made a call for today. To submit a new call, ' +
                'use the !remove-call command and try again.'
            ).catch(() => msg.reply('You already made a call today. Use !remove-call first.'));
            return;
        }

        const playerName = msg.content.substring(9).trim();
        if (!playerName) {
            await msg.reply('Usage: `!hr-call <player name>`');
            return;
        }

        try {
            await addCall(playerName, msg.author.username);

            todaysCallers.push(msg.author.id);
            todaysPlayerCalls.push(playerName);

            const confirmMsg = `Your home run call for ${currentDate} is **${playerName}**. Good Luck!` +
                (sheetLink ? `\n\nLeaderboard: ${sheetLink}` : '');

            await msg.author.send(confirmMsg)
                .catch(() => msg.reply(confirmMsg));

            await msg.react('⚾').catch(() => {});
        } catch (error) {
            console.error('[ERROR] Failed to add call:', error);
            await msg.reply('Error submitting your call. Please try again.');
        }
    }

    // !help
    if (msg.content.startsWith('!help')) {
        const helpMsg =
            '**🏟️ Dinger Bot — Commands**\n\n' +
            '`!hr-call <player name>` — Submit your HR prediction for today\n' +
            '`!remove-call` — Remove your call for today\n' +
            '`!calls` — See today\'s calls\n' +
            '`!help` — This message';

        await msg.author.send(helpMsg)
            .catch(() => msg.reply(helpMsg));
    }

    // !calls — Show today's predictions
    if (msg.content.startsWith('!calls')) {
        if (todaysPlayerCalls.length === 0) {
            await msg.reply('No calls yet today. Be the first with `!hr-call <player>`!');
        } else {
            const callList = todaysPlayerCalls.map((p) => `• ${p}`).join('\n');
            await msg.reply(`**Today's HR Calls (${currentDate}):**\n${callList}`);
        }
    }

    // !remove-call
    if (msg.content.startsWith('!remove-call')) {
        if (!todaysCallers.includes(msg.author.id)) {
            await msg.reply('You haven\'t made a call today. Use `!hr-call <player>` first.');
            return;
        }

        try {
            const idx = todaysCallers.indexOf(msg.author.id);
            todaysCallers.splice(idx, 1);
            todaysPlayerCalls.splice(idx, 1);

            await removeCall(msg.author.username);
            await msg.reply('✅ Your call has been removed. Feel free to make another.');
        } catch (error) {
            console.error('[ERROR] Failed to remove call:', error);
            await msg.reply('Error removing your call. Please try again.');
        }
    }
});

// ============================================================================
// Reset daily state at midnight ET
// ============================================================================

function scheduleDailyReset() {
    const now = new Date();
    const etNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const tomorrow = new Date(etNow);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const msUntilMidnight = tomorrow.getTime() - etNow.getTime();

    setTimeout(() => {
        console.log('[RESET] Midnight ET — clearing daily state');
        todaysCallers = [];
        todaysPlayerCalls = [];
        scheduleDailyReset();
    }, msUntilMidnight);

    console.log(`[INIT] Daily reset scheduled in ${Math.round(msUntilMidnight / 60000)} minutes`);
}

// ============================================================================
// Google Sheets Functions
// ============================================================================

async function addCall(playerName, username) {
    const doc = new GoogleSpreadsheet(spreadsheetID);
    await doc.useServiceAccountAuth(config.credentials);
    await doc.loadInfo();

    const { date, time } = getCurrentDateTimeET();
    let sheet = doc.sheetsByTitle[date];

    if (!sheet) {
        await doc.addSheet({ title: date, headerValues: ['Name', 'Call', 'Timestamp'] });
        sheet = doc.sheetsByTitle[date];
    }

    await sheet.addRow({ Name: username, Call: playerName, Timestamp: time });
    console.log(`[SHEETS] Added call — ${username}: ${playerName}`);
}

async function removeCall(username) {
    const doc = new GoogleSpreadsheet(spreadsheetID);
    await doc.useServiceAccountAuth(config.credentials);
    await doc.loadInfo();

    const todayDate = getCurrentDateTimeET().date;
    const sheet = doc.sheetsByTitle[todayDate];
    if (!sheet) return;

    const rows = await sheet.getRows();
    for (const row of rows) {
        if (row.Name === username) {
            await row.delete();
            console.log(`[SHEETS] Removed call for ${username}`);
        }
    }
}

// ============================================================================
// Utility Functions
// ============================================================================

function getCurrentDateTimeET() {
    const etTime = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    const [date] = etTime.split(', ');
    return { date, time: etTime };
}

// ============================================================================
// Start
// ============================================================================

scheduleDailyReset();
discordClient.login(config.discord_bot_token);
