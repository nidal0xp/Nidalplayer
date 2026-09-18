const http = require('http');

http.get('http://127.0.0.1:8765/tv', (res) => {
  console.log('Status code:', res.statusCode);
  console.log('Headers:', res.headers['content-type']);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Received HTML length:', data.length);
    console.log('Contains NIDALPLAYER TV:', data.includes('NIDALPLAYER'));
    process.exit(0);
  });
}).on('error', (err) => {
  console.error('Server not currently running:', err.message);
  process.exit(1);
});
