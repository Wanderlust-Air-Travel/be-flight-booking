/**
 * Test script to send OTP email and check email service status
 * Usage: node tools/test-otp-email.js
 */

const http = require('http');
const https = require('https');

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data) {
      const jsonData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(jsonData);
    }

    const protocol = url.protocol === 'https:' ? https : http;
    const req = protocol.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsedBody = body ? JSON.parse(body) : {};
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: parsedBody,
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body,
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function checkEmailHealth() {
  log('\n📧 Checking Email Service Health...', 'blue');
  try {
    const response = await makeRequest('GET', '/api/v1/emails/health');
    
    if (response.statusCode === 200) {
      log('✅ Email Service is HEALTHY!', 'green');
      log(`   Status: ${response.body.status || 'unknown'}`, 'green');
      log(`   Gmail Ready: ${response.body.gmailReady ? 'Yes' : 'No'}`, response.body.gmailReady ? 'green' : 'yellow');
      
      if (response.body.queueStats) {
        log(`   Queue Stats:`, 'blue');
        log(`     Total: ${response.body.queueStats.total || 0}`, 'blue');
        log(`     Queued: ${response.body.queueStats.queued || 0}`, 'blue');
        log(`     Sending: ${response.body.queueStats.sending || 0}`, 'blue');
        log(`     Sent: ${response.body.queueStats.sent || 0}`, 'green');
        log(`     Failed: ${response.body.queueStats.failed || 0}`, response.body.queueStats.failed > 0 ? 'red' : 'green');
      }
      
      return true;
    } else {
      log(`❌ Email Service Health Check Failed: ${response.statusCode}`, 'red');
      log(`   Response: ${JSON.stringify(response.body, null, 2)}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error checking email health: ${error.message}`, 'red');
    log(`   Make sure API Gateway is running on ${API_BASE_URL}`, 'yellow');
    return false;
  }
}

async function sendOtpEmail(token, template = 'otp_payment') {
  log(`\n📨 Sending OTP Email (${template})...`, 'blue');
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
    
    if (response.statusCode === 202) {
      log('✅ OTP Email sent successfully!', 'green');
      log(`   Email ID: ${response.body.emailId || 'N/A'}`, 'green');
      log(`   Status: ${response.body.status || 'N/A'}`, 'green');
      log(`   OTP Code: ${otp}`, 'yellow');
      log(`   Expires In: ${expiresIn}`, 'blue');
      return response.body;
    } else {
      log(`❌ Failed to send OTP email: ${response.statusCode}`, 'red');
      log(`   Response: ${JSON.stringify(response.body, null, 2)}`, 'red');
      return null;
    }
  } catch (error) {
    log(`❌ Error sending OTP email: ${error.message}`, 'red');
    if (error.message.includes('ECONNREFUSED')) {
      log(`   Connection refused. Is Email Service running?`, 'yellow');
    }
    return null;
  }
}

async function getEmailStatus(emailId, token) {
  if (!emailId) return;
  
  log(`\n📊 Checking Email Status...`, 'blue');
  log(`   Email ID: ${emailId}`, 'blue');
  
  try {
    const response = await makeRequest('GET', `/api/v1/emails/${emailId}/status`, null, token);
    
    if (response.statusCode === 200) {
      log('✅ Email Status:', 'green');
      log(`   Status: ${response.body.status || 'N/A'}`, 'green');
      log(`   To: ${response.body.to || 'N/A'}`, 'blue');
      if (response.body.sentAt) {
        log(`   Sent At: ${response.body.sentAt}`, 'blue');
      }
      if (response.body.error) {
        log(`   Error: ${response.body.error}`, 'red');
      }
    } else {
      log(`❌ Failed to get email status: ${response.statusCode}`, 'red');
    }
  } catch (error) {
    log(`❌ Error getting email status: ${error.message}`, 'red');
  }
}

async function main() {
  log('🚀 Testing Email Service OTP Functionality', 'blue');
  log('='.repeat(50), 'blue');
  
  // Check if API Gateway is accessible
  log('\n📡 Checking API Gateway...', 'blue');
  try {
    const healthResponse = await makeRequest('GET', '/api/v1/health');
    if (healthResponse.statusCode === 200 || healthResponse.statusCode === 503) {
      log('✅ API Gateway is accessible', 'green');
    } else {
      log(`⚠️  API Gateway returned: ${healthResponse.statusCode}`, 'yellow');
    }
  } catch (error) {
    log(`❌ Cannot connect to API Gateway: ${error.message}`, 'red');
    log(`   Make sure API Gateway is running on ${API_BASE_URL}`, 'yellow');
    process.exit(1);
  }
  
  // Check Email Service Health
  const isHealthy = await checkEmailHealth();
  
  if (!isHealthy) {
    log('\n⚠️  Email Service appears to be down. Cannot send test email.', 'yellow');
    log('   Please start the Email Microservice first.', 'yellow');
    process.exit(1);
  }
  
  // Try to send OTP email (without auth first - might fail, but we'll see the error)
  log('\n📝 Note: Sending email requires authentication token', 'yellow');
  log('   For testing without auth, you can check the health endpoint above.', 'yellow');
  log('   To send actual OTP email, you need to:', 'yellow');
  log('   1. Login/Register to get an access token', 'yellow');
  log('   2. Use the token in Authorization header', 'yellow');
  log('\n   Example:', 'blue');
  log('   export TOKEN="your-access-token-here"', 'blue');
  log('   export TEST_EMAIL="your-email@example.com"', 'blue');
  log('   node tools/test-otp-email.js', 'blue');
  
  // If token is provided, try to send email
  const token = process.env.TOKEN;
  if (token) {
    const emailResult = await sendOtpEmail(token, 'otp_payment');
    
    if (emailResult && emailResult.emailId) {
      // Wait a bit then check status
      await new Promise(resolve => setTimeout(resolve, 2000));
      await getEmailStatus(emailResult.emailId, token);
    }
  } else {
    log('\n💡 Tip: Set TOKEN environment variable to test sending OTP email', 'yellow');
  }
  
  log('\n' + '='.repeat(50), 'blue');
  log('✨ Test completed!', 'green');
}

main().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  process.exit(1);
});

