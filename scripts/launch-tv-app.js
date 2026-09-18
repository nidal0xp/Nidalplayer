const http = require('http');

const postData = JSON.stringify({
  url: 'http://192.168.11.126:8765/tv'
});

const req = http.request({
  hostname: '192.168.11.100',
  port: 8001,
  path: '/api/v2/applications/org.tizen.browser',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
}, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('Launch Browser Status:', res.statusCode);
    console.log('Launch Browser Response:', data);
    process.exit(0);
  });
});

req.on('error', err => {
  console.error('Launch Error:', err.message);
  process.exit(1);
});

req.write(postData);
req.end();
