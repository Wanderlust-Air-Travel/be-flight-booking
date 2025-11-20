import { google } from 'googleapis';
import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { resolve } from 'path';
import * as readline from 'readline';

/**
 * Gmail Authentication Helper Script
 * 
 * This script helps you authenticate Gmail API by:
 * 1. Loading OAuth 2.0 credentials
 * 2. Generating authorization URL
 * 3. Exchanging authorization code for tokens
 * 4. Saving tokens to file
 * 
 * Usage:
 *   npx ts-node scripts/gmail-auth.ts
 *   or
 *   npm run gmail:auth (if added to package.json)
 */

const credentialsPath = resolve(process.cwd(), 'credentials_desktop_apps.json');
const tokenPath = resolve(process.cwd(), 'token.json');

// Check if token.json is a directory (should be a file)
if (existsSync(tokenPath)) {
  const stats = statSync(tokenPath);
  if (stats.isDirectory()) {
    console.error('Error: token.json is a directory, not a file!');
    console.error(`   Please delete or rename the directory at: ${tokenPath}`);
    console.error('   Then run this script again.');
    process.exit(1);
  }
}

// Check if credentials file exists
if (!existsSync(credentialsPath)) {
  console.error('Error: credentials_desktop_apps.json not found!');
  console.error(`   Expected location: ${credentialsPath}`);
  console.error('\nPlease follow these steps:');
  console.error('   1. Go to https://console.cloud.google.com/');
  console.error('   2. Create OAuth 2.0 credentials (Desktop app type)');
  console.error('   3. Download credentials JSON file');
  console.error('   4. Save as "credentials_desktop_apps.json" in project root');
  console.error('\nSee docs/setup/GMAIL_SETUP.md for detailed instructions');
  process.exit(1);
}

async function authenticate() {
  try {
    console.log('Starting Gmail API authentication...\n');

    // Load credentials
    console.log(`Loading credentials from: ${credentialsPath}`);
    const credentials = JSON.parse(readFileSync(credentialsPath, 'utf8'));
    
    // Handle different credential file formats
    let client_id: string;
    let client_secret: string;
    let redirect_uris: string[];
    
    // Format 1: Standard Google Cloud Console format (installed or web)
    if (credentials.installed) {
      client_id = credentials.installed.client_id;
      client_secret = credentials.installed.client_secret;
      redirect_uris = credentials.installed.redirect_uris || ['http://localhost'];
    } else if (credentials.web) {
      client_id = credentials.web.client_id;
      client_secret = credentials.web.client_secret;
      redirect_uris = credentials.web.redirect_uris || ['http://localhost'];
    } 
    // Format 2: Token file format (has client_id and client_secret at root level)
    else if (credentials.client_id && credentials.client_secret) {
      client_id = credentials.client_id;
      client_secret = credentials.client_secret;
      redirect_uris = credentials.redirect_uris || ['http://localhost'];
      console.log('Warning: File appears to be a token file, not a credentials file.');
      console.log('Please download the OAuth 2.0 Client ID credentials from Google Cloud Console.');
      console.log('Expected format: { "installed": { "client_id": "...", "client_secret": "..." } }');
      console.log('Using client_id and client_secret from file...\n');
    } else {
      throw new Error(
        'Invalid credentials file format. Expected format:\n' +
        '  { "installed": { "client_id": "...", "client_secret": "...", "redirect_uris": [...] } }\n' +
        '  or\n' +
        '  { "web": { "client_id": "...", "client_secret": "...", "redirect_uris": [...] } }\n' +
        'Please download the OAuth 2.0 Client ID credentials from Google Cloud Console.'
      );
    }

    if (!client_id || !client_secret) {
      throw new Error('Invalid credentials file. Missing client_id or client_secret.');
    }

    console.log('Credentials loaded successfully\n');

    // Check if credentials file already contains tokens
    if (credentials.token || credentials.refresh_token) {
      console.log('Found tokens in credentials file. Extracting and saving to token.json...\n');
      
      // Extract tokens from credentials file
      const tokens = {
        access_token: credentials.token,
        refresh_token: credentials.refresh_token,
        scope: credentials.scopes || credentials.scope,
        token_type: 'Bearer',
        expiry_date: credentials.expiry ? new Date(credentials.expiry).getTime() : undefined,
      };
      
      // Save tokens to token.json
      writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
      
      console.log(`Tokens extracted and saved successfully to: ${tokenPath}`);
      console.log('Gmail authentication completed!\n');
      
      console.log('Next steps:');
      console.log('   1. Restart the Email microservice');
      console.log('   2. Check health: curl http://localhost:3000/emails/health');
      console.log('   3. Verify gmailReady is true\n');
      
      process.exit(0);
    }

    // Create OAuth2 client
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0] || 'http://localhost');

    // Get authorization URL
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/gmail.send'],
      prompt: 'consent', // Force consent screen to get refresh token
    });

    console.log('Please visit this URL to authorize the application:');
    console.log('\n' + '='.repeat(80));
    console.log(authUrl);
    console.log('='.repeat(80) + '\n');

    console.log('Instructions:');
    console.log('   1. Copy the URL above and open it in your browser');
    console.log('   2. Sign in with your Gmail account');
    console.log('   3. Click "Allow" to grant permissions');
    console.log('   4. You will be redirected to a page (may show "This site can\'t be reached")');
    console.log('   5. Copy the ENTIRE URL from the address bar');
    console.log('   6. Look for the "code" parameter in the URL');
    console.log('   7. Copy the code value and paste it below\n');

    // Get authorization code from user
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('Enter the authorization code here: ', async (code) => {
      rl.close();

      if (!code || code.trim().length === 0) {
        console.error('Error: Authorization code is required');
        process.exit(1);
      }

      try {
        console.log('\nExchanging authorization code for tokens...');

        // Exchange code for tokens
        const { tokens } = await oAuth2Client.getToken(code.trim());
        oAuth2Client.setCredentials(tokens);

        // Save tokens to file
        writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
        
        console.log(`\nTokens saved successfully to: ${tokenPath}`);
        console.log('Gmail authentication completed!\n');
        
        console.log('Next steps:');
        console.log('   1. Restart the Email microservice');
        console.log('   2. Check health: curl http://localhost:3000/emails/health');
        console.log('   3. Verify gmailReady is true\n');

        process.exit(0);
      } catch (error: any) {
        console.error('\nError while retrieving access token:');
        console.error(`   ${error.message}`);
        
        if (error.message.includes('invalid_grant')) {
          console.error('\nTip: The authorization code may have expired.');
          console.error('   Please run this script again to get a new code.');
        }
        
        process.exit(1);
      }
    });
  } catch (error: any) {
    console.error('\nError during authentication:');
    console.error(`   ${error.message}`);
    
    if (error.message.includes('ENOENT')) {
      console.error(`\nMake sure the credentials file exists at: ${credentialsPath}`);
    } else if (error.message.includes('Unexpected token')) {
      console.error(`\nThe credentials file may be corrupted or invalid JSON.`);
      console.error('   Please download a fresh copy from Google Cloud Console.');
    }
    
    process.exit(1);
  }
}

// Run authentication
authenticate();

