import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { google } from 'googleapis';

const credentialsPath = resolve(process.cwd(), 'credentials_desktop_apps.json');
const tokenPath = resolve(process.cwd(), 'token.json');

function base64UrlEncode(input: string): string {
    return Buffer.from(input)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

async function main() {
    console.log('Checking Gmail API mail delivery...');
    console.log(`Credentials: ${credentialsPath}`);
    console.log(`Token: ${tokenPath}`);

    const credentials = JSON.parse(readFileSync(credentialsPath, 'utf8'));
    const token = JSON.parse(readFileSync(tokenPath, 'utf8'));

    const installed = credentials.installed || credentials.web;
    if (!installed?.client_id || !installed?.client_secret) {
        throw new Error('Invalid credentials file. Missing installed/web OAuth client config.');
    }

    const oAuth2Client = new google.auth.OAuth2(
        installed.client_id,
        installed.client_secret,
        installed.redirect_uris?.[0] || 'http://localhost'
    );
    oAuth2Client.setCredentials(token);

    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    const profile = await gmail.users.getProfile({ userId: 'me' });
    const fromEmail = profile.data.emailAddress;

    const now = new Date().toISOString();
    const toEmail = process.argv[2] || fromEmail;
    const subject = `[Flight Booking] Gmail API test ${now}`;
    const body = [
        'This is a Gmail API delivery test from the Flight Booking backend.',
        '',
        `Sent at: ${now}`,
        `From: ${fromEmail}`,
        `To: ${toEmail}`,
    ].join('\n');

    const rawMessage = [
        `To: ${toEmail}`,
        `From: ${fromEmail}`,
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset="UTF-8"',
        '',
        body,
    ].join('\r\n');

    const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
            raw: base64UrlEncode(rawMessage),
        },
    });

    console.log('Gmail API is working. Test email sent successfully.');
    console.log(`Authenticated sender: ${fromEmail}`);
    console.log(`Recipient: ${toEmail}`);
    console.log(`Message ID: ${response.data.id || 'unknown'}`);
}

main().catch((error: any) => {
    console.error('Gmail API test failed.');
    console.error(error?.message || error);
    if (error?.response?.data) {
        console.error(JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
});
