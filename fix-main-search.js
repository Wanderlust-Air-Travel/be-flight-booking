// Fix main.search.js to use fixed deserializer
const fs = require('fs');
const content = fs.readFileSync('main.search.fixed.js', 'utf8');

// Replace import
let fixed = content.replace(
    'const debug_incoming_request_deserializer_1 = require("./deserializers/debug-incoming-request.deserializer");',
    'const incoming_request_deserializer_1 = require("./deserializers/incoming-request.deserializer");'
);

// Replace usage
fixed = fixed.replace(
    'new debug_incoming_request_deserializer_1.DebugIncomingRequestDeserializer()',
    'new incoming_request_deserializer_1.IncomingRequestDeserializer()'
);

// Remove debug imports that cause issues
fixed = fixed.replace(/require\("\.\/debug\/debug-server-tcp"\);?\n?/g, '');
fixed = fixed.replace(/require\("\.\/debug\/debug-rpc-params"\);?\n?/g, '');
fixed = fixed.replace(/require\("\.\/debug\/debug-rpc-proxy"\);?\n?/g, '');
fixed = fixed.replace(/require\("\.\/debug\/debug-context-utils"\);?\n?/g, '');
fixed = fixed.replace(/require\("\.\/debug\/debug-pipes-consumer"\);?\n?/g, '');
fixed = fixed.replace(/require\("\.\/debug\/debug-rpc-context-creator-v7"\);?\n?/g, '');
fixed = fixed.replace(/require\("\.\/debug\/fix-interceptors-consumer"\);?\n?/g, '');

fs.writeFileSync('main.search.fixed.js', fixed);
console.log('Fixed main.search.js');
console.log('Has deserializer import:', fixed.includes('IncomingRequestDeserializer') ? 'OK' : 'FAIL');
console.log('Has debug imports:', fixed.includes('./debug/') ? 'STILL HAS' : 'CLEAN');
