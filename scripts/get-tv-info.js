const http = require('http');

http.get('http://192.168.11.100:8001/api/v2/', res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('TV Info Response:', data);
    process.exit(0);
  });
}).on('error', err => {
  console.error('Error fetching TV info:', err.message);
  process.exit(1);
});
