import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { OAuth2Client } from 'google-auth-library';
import { gmail_v1 } from 'googleapis';

@Injectable()
export class GmailApiService implements OnModuleInit {
	private readonly logger = new Logger(GmailApiService.name);
	private gmail: gmail_v1.Gmail | null = null;
	private oauth2Client: OAuth2Client | null = null;
	private readonly credentialsPath: string;
	private readonly tokenPath: string;

	constructor(private readonly configService: ConfigService) {
		this.credentialsPath = this.configService.get<string>('GMAIL_CREDENTIALS_PATH') || 
			resolve(process.cwd(), 'credentials_desktop_apps.json');
		this.tokenPath = this.configService.get<string>('GMAIL_TOKEN_PATH') || 
			resolve(process.cwd(), 'token.json');
	}

	async onModuleInit() {
		try {
			await this.initializeGmailClient();
			this.logger.log('Gmail API client initialized successfully');
		} catch (error: any) {
			this.logger.error(`Failed to initialize Gmail API client: ${error.message}`);
			// Don't throw - allow service to start but email sending will fail gracefully
		}
	}

	private async initializeGmailClient(): Promise<void> {
		try {
			// Load credentials
			const credentials = JSON.parse(readFileSync(this.credentialsPath, 'utf8'));
			
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
			// This format contains both credentials and tokens
			else if (credentials.client_id && credentials.client_secret) {
				client_id = credentials.client_id;
				client_secret = credentials.client_secret;
				redirect_uris = credentials.redirect_uris || ['http://localhost'];
				
				// If this file also contains tokens, use them directly
				if (credentials.token || credentials.refresh_token) {
					this.logger.log('Credentials file contains tokens, using them directly');
					this.oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
					this.oauth2Client.setCredentials({
						access_token: credentials.token,
						refresh_token: credentials.refresh_token,
						expiry_date: credentials.expiry ? new Date(credentials.expiry).getTime() : undefined,
					});
					this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
					this.logger.log('Gmail client initialized with tokens from credentials file');
					return;
				}
			} else {
				throw new Error('Invalid credentials file format. Expected format with installed/web or client_id/client_secret.');
			}

			// Create OAuth2 client
			this.oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

			// Load token if exists (separate token file)
			try {
				const token = JSON.parse(readFileSync(this.tokenPath, 'utf8'));
				this.oauth2Client.setCredentials(token);
				this.logger.log('Gmail token loaded successfully');
			} catch (error: any) {
				this.logger.warn(`Token file not found at ${this.tokenPath}. Please authenticate first.`);
				// Token will be set later when user authenticates
			}

			// Create Gmail client
			this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
		} catch (error: any) {
			this.logger.error(`Failed to initialize Gmail client: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Get authorization URL for OAuth2 flow
	 */
	getAuthUrl(): string {
		if (!this.oauth2Client) {
			throw new Error('OAuth2 client not initialized');
		}

		const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

		return this.oauth2Client.generateAuthUrl({
			access_type: 'offline',
			scope: SCOPES,
			prompt: 'consent',
		});
	}

	/**
	 * Exchange authorization code for tokens
	 */
	async setTokensFromCode(code: string): Promise<void> {
		if (!this.oauth2Client) {
			throw new Error('OAuth2 client not initialized');
		}

		const { tokens } = await this.oauth2Client.getToken(code);
		this.oauth2Client.setCredentials(tokens);

		// Save token to file
		const { writeFileSync } = await import('fs');
		writeFileSync(this.tokenPath, JSON.stringify(tokens, null, 2));
		this.logger.log(`Tokens saved to ${this.tokenPath}`);

		// Reinitialize Gmail client with new tokens
		if (this.gmail) {
			this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
		}
	}

	/**
	 * Send email using Gmail API
	 */
	async sendEmail(to: string, subject: string, htmlBody: string, textBody?: string, replyTo?: string): Promise<string> {
		if (!this.gmail) {
			throw new Error('Gmail client not initialized. Please authenticate first.');
		}

		try {
			// Create email message
			const message = this.createMessage(to, subject, htmlBody, textBody, replyTo);

			// Send email
			const response = await this.gmail.users.messages.send({
				userId: 'me',
				requestBody: {
					raw: message,
				},
			});

			this.logger.log(`Email sent successfully. Message ID: ${response.data.id}`);
			return response.data.id || '';
		} catch (error: any) {
			this.logger.error(`Failed to send email: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Create base64 encoded email message
	 */
	private createMessage(to: string, subject: string, htmlBody: string, textBody?: string, replyTo?: string): string {
		const fromEmail = this.configService.get<string>('GMAIL_FROM_EMAIL') || 'me';
		
		// Encode subject to UTF-8 using RFC 2047 format to avoid encoding issues
		const encodedSubject = this.encodeSubject(subject);
		
		const headers = [
			`To: ${to}`,
			`From: ${fromEmail}`,
			`Subject: ${encodedSubject}`,
			'Content-Type: text/html; charset=utf-8',
		];

		if (replyTo) {
			headers.push(`Reply-To: ${replyTo}`);
		}

		const email = [
			headers.join('\r\n'),
			'',
			htmlBody,
		].join('\r\n');

		// Encode to base64url format
		return Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
	}

	/**
	 * Encode email subject to UTF-8 using RFC 2047 format
	 * This prevents encoding issues with Vietnamese characters
	 */
	private encodeSubject(subject: string): string {
		// Check if subject contains non-ASCII characters
		if (/^[\x00-\x7F]*$/.test(subject)) {
			// Only ASCII characters, no encoding needed
			return subject;
		}
		
		// Encode using RFC 2047 format: =?charset?encoding?encoded-text?=
		// Use base64 encoding for better compatibility
		const encoded = Buffer.from(subject, 'utf-8').toString('base64');
		return `=?UTF-8?B?${encoded}?=`;
	}

	/**
	 * Check if Gmail client is ready
	 */
	isReady(): boolean {
		return this.gmail !== null && this.oauth2Client !== null;
	}

	/**
	 * Refresh access token if needed
	 */
	async refreshTokenIfNeeded(): Promise<void> {
		if (!this.oauth2Client) {
			throw new Error('OAuth2 client not initialized');
		}

		try {
			const { credentials } = await this.oauth2Client.refreshAccessToken();
			this.oauth2Client.setCredentials(credentials);
			this.logger.log('Access token refreshed successfully');
		} catch (error: any) {
			this.logger.error(`Failed to refresh access token: ${error.message}`);
			throw error;
		}
	}
}

