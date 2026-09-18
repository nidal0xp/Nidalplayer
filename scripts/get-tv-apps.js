const http = require('http');

http.get('http://192.168.11.100:8001/api/v2/applications/', res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('Installed Apps on Samsung TV:', data);
    process.exit(0);
  });
}).on('error', err => {
  console.error('Error:', err.message);
  process.exit(1);
});
