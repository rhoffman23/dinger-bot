/**
 * ============================================================================
 * Dinger Bot Configuration Template
 * ============================================================================
 * 
 * SETUP INSTRUCTIONS:
 * 1. Copy this file and rename to: config-dev.js
 * 2. Fill in all credentials with your actual values
 * 3. Add config-dev.js to .gitignore (NEVER commit credentials!)
 * 4. Ensure all required credentials are provided
 * 
 * SECURITY REMINDERS:
 * - NEVER commit config files with real credentials to git
 * - NEVER share these credentials publicly
 * - ROTATE credentials regularly
 * - Use environment variables in production
 * 
 * ============================================================================
 */

module.exports = {
    // ========================================================================
    // Discord Bot Token
    // ========================================================================
    // Get from: https://discord.com/developers/applications
    // 1. Create application
    // 2. Go to "Bot" tab
    // 3. Copy the token under "TOKEN"
    // Required permissions: Send Messages, Read Messages/View Channels
    discord_bot_token: 'YOUR_DISCORD_BOT_TOKEN_HERE',

    // ========================================================================
    // Twitter API v2 Bearer Token
    // ========================================================================
    // Get from: https://developer.twitter.com/en/portal/dashboard
    // 1. Go to your app's "Keys and tokens" tab
    // 2. Copy the "Bearer Token"
    // Required: Twitter API v2 access with Tweet Stream permissions
    twitter_token: 'YOUR_TWITTER_BEARER_TOKEN_HERE',

    // ========================================================================
    // Google Sheets Configuration
    // ========================================================================
    // SPREADSHEET_ID: Extract from sheet URL
    // URL example: https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
    spreadsheetID: 'YOUR_GOOGLE_SHEET_ID_HERE',

    // SPREADSHEET_LINK: Public or internal link to your sheet
    // Share this link with users to view predictions and leaderboard
    spreadsheetLink: 'https://docs.google.com/spreadsheets/d/YOUR_GOOGLE_SHEET_ID_HERE',

    // ========================================================================
    // Google Service Account Credentials
    // ========================================================================
    // This is the JSON content from your service account key file
    // 
    // Setup:
    // 1. Go to https://console.cloud.google.com
    // 2. Create or select project
    // 3. Enable Google Sheets API
    // 4. Create Service Account
    // 5. Create JSON key
    // 6. Download JSON file
    // 7. Copy entire JSON object below
    // 8. Share your Google Sheet with the service account email (client_email)
    // 9. Grant Editor permissions to the service account
    credentials: {
        type: 'service_account',
        project_id: 'your-project-id-here',
        private_key_id: 'your-private-key-id-here',
        private_key:
            '-----BEGIN PRIVATE KEY-----\n' +
            'YOUR_PRIVATE_KEY_HERE\n' +
            '-----END PRIVATE KEY-----\n',
        client_email: 'your-service-account@your-project.iam.gserviceaccount.com',
        client_id: 'your-client-id-here',
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url:
            'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/your-service-account%40your-project.iam.gserviceaccount.com'
    }
};
