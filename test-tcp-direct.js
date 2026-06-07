// Test TCP connection to search microservice directly
const net = require('net');

// Message format should be: "<length>#<json>"
const packet = {
    id: 'test-123',
    pattern: 'search.flights',
    data: {
        origin: 'HAN',
        destination: 'SGN',
        departDate: '2026-06-15',
        adults: 1,
        minors: 0
    }
};

const jsonStr = JSON.stringify(packet);
const message = jsonStr.length + '#' + jsonStr;

console.log('Sending message to search-ms:4001');
console.log('Message format: "<length>#<json>"');
console.log('Length:', jsonStr.length);
console.log('JSON:', jsonStr.substring(0, 100) + '...');

const client = new net.Socket();

client.connect(4001, 'localhost', () => {
    console.log('Connected to search-ms:4001');
    client.write(message, 'utf8', () => {
        console.log('Message written, waiting for response...');
    });
});

client.on('data', (data) => {
    console.log('Response received:', data.toString('utf8').substring(0, 200));
    client.end();
});

client.on('error', (err) => {
    console.error('Connection error:', err.message);
});

client.on('close', () => {
    console.log('Connection closed');
    process.exit(0);
});

setTimeout(() => {
    console.log('Timeout - no response in 5s');
    client.end();
    process.exit(1);
}, 5000);
