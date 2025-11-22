/**
 * Test script to send OTP email and check email service status
 * Usage: ts-node -r tsconfig-paths/register tools/test-otp-email.ts
 */

import * as http from 'http';
import * as https from 'https';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';

// Colors for console output
const colors = {
	reset: '\x1b[0m',
	green: '\x1b[32m',
	red: '\x1b[31m',
	yellow: '\x1b[33m',
	blue: '\x1b[36m',
} as const;

type Color = keyof typeof colors;

function log(message: string, color: Color = 'reset'): void {
	console.log(`${colors[color]}${message}${colors.reset}`);
}

interface HttpResponse {
	statusCode: number;
	headers: http.IncomingHttpHeaders;
	body: any;
}

interface EmailHealthResponse {
	status?: string;
	gmailReady?: boolean;
	queueStats?: {
		total?: number;
		queued?: number;
		sending?: number;
		sent?: number;
		failed?: number;
	};
}

interface EmailSendResponse {
	emailId?: string;
	status?: string;
}

interface EmailStatusResponse {
	status?: string;
	to?: string;
	sentAt?: string;
	error?: string;
}

function makeRequest(
	method: string,
	path: string,
	data: any = null,
	token: string | null = null,
): Promise<HttpResponse> {
	return new Promise((resolve, reject) => {
		const url = new URL(path, API_BASE_URL);
		const options: http.RequestOptions = {
			hostname: url.hostname,
			port: url.port || (url.protocol === 'https:' ? 443 : 80),
			path: url.pathname + url.search,
			method: method,
			headers: {
				'Content-Type': 'application/json',
			},
		};

		if (token) {
			options.headers!['Authorization'] = `Bearer ${token}`;
		}

		if (data) {
			const jsonData = JSON.stringify(data);
			options.headers!['Content-Length'] = Buffer.byteLength(jsonData);
		}

		const protocol = url.protocol === 'https:' ? https : http;
		const req = protocol.request(options, (res: http.IncomingMessage) => {
			let body = '';
			res.on('data', (chunk: Buffer) => {
				body += chunk.toString();
			});
			res.on('end', () => {
				try {
					const parsedBody = body ? JSON.parse(body) : {};
					resolve({
						statusCode: res.statusCode || 0,
						headers: res.headers,
						body: parsedBody,
					});
				} catch (e) {
					resolve({
						statusCode: res.statusCode || 0,
						headers: res.headers,
						body: body,
					});
				}
			});
		});

		req.on('error', (error: Error) => {
			reject(error);
		});

		if (data) {
			req.write(JSON.stringify(data));
		}

		req.end();
	});
}

async function checkEmailHealth(): Promise<boolean> {
	log('\nChecking Email Service Health...', 'blue');
	try {
		const response = await makeRequest('GET', '/api/v1/emails/health');
		const body = response.body as EmailHealthResponse;

		if (response.statusCode === 200) {
			log('Email Service is HEALTHY!', 'green');
			log(`   Status: ${body.status || 'unknown'}`, 'green');
			log(
				`   Gmail Ready: ${body.gmailReady ? 'Yes' : 'No'}`,
				body.gmailReady ? 'green' : 'yellow',
			);

			if (body.queueStats) {
				log(`   Queue Stats:`, 'blue');
				log(`     Total: ${body.queueStats.total || 0}`, 'blue');
				log(`     Queued: ${body.queueStats.queued || 0}`, 'blue');
				log(`     Sending: ${body.queueStats.sending || 0}`, 'blue');
				log(`     Sent: ${body.queueStats.sent || 0}`, 'green');
				log(
					`     Failed: ${body.queueStats.failed || 0}`,
					(body.queueStats.failed || 0) > 0 ? 'red' : 'green',
				);
			}

			return true;
		} else {
			log(`Email Service Health Check Failed: ${response.statusCode}`, 'red');
			log(`   Response: ${JSON.stringify(response.body, null, 2)}`, 'red');
			return false;
		}
	} catch (error: any) {
		log(`Error checking email health: ${error.message}`, 'red');
		log(`   Make sure API Gateway is running on ${API_BASE_URL}`, 'yellow');
		return false;
	}
}

async function sendOtpEmail(
	token: string,
	template: string = 'otp_payment',
): Promise<EmailSendResponse | null> {
	log(`\nSending OTP Email (${template})...`, 'blue');
	log(`   To: ${TEST_EMAIL}`, 'blue');

	const otp = Math.floor(100000 + Math.random() * 900000).toString(); // Generate 6-digit OTP
	const expiresIn = '15 minutes';

	const emailData = {
		to: TEST_EMAIL,
		template: template,
		templateData: {
			otp: otp,
			expiresIn: expiresIn,
		},
	};

	try {
		const response = await makeRequest('POST', '/api/v1/emails/send', emailData, token);
		const body = response.body as EmailSendResponse;

		if (response.statusCode === 202) {
			log('OTP Email sent successfully!', 'green');
			log(`   Email ID: ${body.emailId || 'N/A'}`, 'green');
			log(`   Status: ${body.status || 'N/A'}`, 'green');
			log(`   OTP Code: ${otp}`, 'yellow');
			log(`   Expires In: ${expiresIn}`, 'blue');
			return body;
		} else {
			log(`Failed to send OTP email: ${response.statusCode}`, 'red');
			log(`   Response: ${JSON.stringify(response.body, null, 2)}`, 'red');
			return null;
		}
	} catch (error: any) {
		log(`Error sending OTP email: ${error.message}`, 'red');
		if (error.message.includes('ECONNREFUSED')) {
			log(`   Connection refused. Is Email Service running?`, 'yellow');
		}
		return null;
	}
}

async function getEmailStatus(emailId: string, token: string): Promise<void> {
	if (!emailId) return;

	log(`\nChecking Email Status...`, 'blue');
	log(`   Email ID: ${emailId}`, 'blue');

	try {
		const response = await makeRequest('GET', `/api/v1/emails/${emailId}/status`, null, token);
		const body = response.body as EmailStatusResponse;

		if (response.statusCode === 200) {
			log('Email Status:', 'green');
			log(`   Status: ${body.status || 'N/A'}`, 'green');
			log(`   To: ${body.to || 'N/A'}`, 'blue');
			if (body.sentAt) {
				log(`   Sent At: ${body.sentAt}`, 'blue');
			}
			if (body.error) {
				log(`   Error: ${body.error}`, 'red');
			}
		} else {
			log(`Failed to get email status: ${response.statusCode}`, 'red');
		}
	} catch (error: any) {
		log(`Error getting email status: ${error.message}`, 'red');
	}
}

async function main(): Promise<void> {
	log('Testing Email Service OTP Functionality', 'blue');
	log('='.repeat(50), 'blue');

	// Check if API Gateway is accessible
	log('\nChecking API Gateway...', 'blue');
	try {
		const healthResponse = await makeRequest('GET', '/api/v1/health');
		if (healthResponse.statusCode === 200 || healthResponse.statusCode === 503) {
			log('API Gateway is accessible', 'green');
		} else {
			log(`API Gateway returned: ${healthResponse.statusCode}`, 'yellow');
		}
	} catch (error: any) {
		log(`Cannot connect to API Gateway: ${error.message}`, 'red');
		log(`   Make sure API Gateway is running on ${API_BASE_URL}`, 'yellow');
		process.exit(1);
	}

	// Check Email Service Health
	const isHealthy = await checkEmailHealth();

	if (!isHealthy) {
		log('\nEmail Service appears to be down. Cannot send test email.', 'yellow');
		log('   Please start the Email Microservice first.', 'yellow');
		process.exit(1);
	}

	// Try to send OTP email (without auth first - might fail, but we'll see the error)
	log('\nNote: Sending email requires authentication token', 'yellow');
	log('   For testing without auth, you can check the health endpoint above.', 'yellow');
	log('   To send actual OTP email, you need to:', 'yellow');
	log('   1. Login/Register to get an access token', 'yellow');
	log('   2. Use the token in Authorization header', 'yellow');
	log('\n   Example:', 'blue');
	log('   export TOKEN="your-access-token-here"', 'blue');
	log('   export TEST_EMAIL="your-email@example.com"', 'blue');
	log('   ts-node -r tsconfig-paths/register tools/test-otp-email.ts', 'blue');

	// If token is provided, try to send email
	const token = process.env.TOKEN;
	if (token) {
		const emailResult = await sendOtpEmail(token, 'otp_payment');

		if (emailResult && emailResult.emailId) {
			// Wait a bit then check status
			await new Promise((resolve) => setTimeout(resolve, 2000));
			await getEmailStatus(emailResult.emailId, token);
		}
	} else {
		log('\nTip: Set TOKEN environment variable to test sending OTP email', 'yellow');
	}

	log('\n' + '='.repeat(50), 'blue');
	log('Test completed!', 'green');
}

main().catch((error: Error) => {
	log(`\nFatal error: ${error.message}`, 'red');
	process.exit(1);
});

