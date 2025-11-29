import * as amqp from 'amqplib';

const RABBITMQ_HOST = process.env.RABBITMQ_HOST || 'localhost';
const RABBITMQ_PORT = parseInt(process.env.RABBITMQ_PORT || '5672', 10);
const RABBITMQ_USER = process.env.RABBITMQ_USER || 'admin';
const RABBITMQ_PASS = process.env.RABBITMQ_PASS || 'admin123';
const RABBITMQ_VHOST = process.env.RABBITMQ_VHOST || '/';
const MAX_RETRIES = 30;
const RETRY_DELAY = 2000; // 2 seconds

async function waitForRabbitMQ(): Promise<void> {
	console.log(`Waiting for RabbitMQ at ${RABBITMQ_HOST}:${RABBITMQ_PORT}...`);

	for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
		try {
			const connectionUrl = `amqp://${RABBITMQ_USER}:${RABBITMQ_PASS}@${RABBITMQ_HOST}:${RABBITMQ_PORT}${RABBITMQ_VHOST}`;
			const connection = await amqp.connect(connectionUrl);
			await connection.close();
			console.log('RabbitMQ is ready!');
			return;
		} catch (error: any) {
			if (attempt < MAX_RETRIES) {
				console.log(`Attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}. Retrying in ${RETRY_DELAY}ms...`);
				await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
			} else {
				console.error(`Failed to connect to RabbitMQ after ${MAX_RETRIES} attempts`);
				process.exit(1);
			}
		}
	}
}

waitForRabbitMQ().catch((error) => {
	console.error('Error waiting for RabbitMQ:', error);
	process.exit(1);
});

