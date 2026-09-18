const net = require('net');

const ports = [26101, 8001, 8002, 7678, 8080, 26099];
const host = '192.168.11.100';

ports.forEach(port => {
  const socket = new net.Socket();
  socket.setTimeout(2000);
  socket.on('connect', () => {
    console.log(`Port ${port} is OPEN on Samsung TV`);
    socket.destroy();
  });
  socket.on('timeout', () => { socket.destroy(); });
  socket.on('error', () => {});
  socket.connect(port, host);
});
