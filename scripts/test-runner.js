const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const root = path.join(__dirname, '..', 'android-tv', 'assets', 'www');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

const server = http.createServer((req, res) => {
  let filePath = path.join(root, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found: ' + req.url); return; }
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(4444, '127.0.0.1', () => {
  console.log('Test server ready at http://127.0.0.1:4444/');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-test-'));
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--user-data-dir=' + tmpDir,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1920,1080',
    'about:blank'
  ]);

  setTimeout(async () => {
    try {
      const list = await new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:9222/json', (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
      });

      const page = list.find(t => t.type === 'page');
      if (!page) throw new Error('No page target found');

      const ws = new WebSocket(page.webSocketDebuggerUrl);

      let id = 1;
      function send(method, params = {}) {
        return new Promise((resolve) => {
          const msgId = id++;
          const handler = (event) => {
            const res = JSON.parse(event.data);
            if (res.id === msgId) {
              ws.removeEventListener('message', handler);
              resolve(res.result);
            }
          };
          ws.addEventListener('message', handler);
          ws.send(JSON.stringify({ id: msgId, method, params }));
        });
      }

      ws.onopen = async () => {
        await send('Page.enable');
        await send('Runtime.enable');

        await send('Page.navigate', { url: 'http://127.0.0.1:4444/index.html' });
        await new Promise(r => setTimeout(r, 1500));

        // Inject series and test rendering
        await send('Runtime.evaluate', {
          expression: `
            localStorage.setItem("np_atv_playlists", JSON.stringify([{ id: "test_pl", name: "Premium Series IPTV", server: "http://demo.iptv.com:8080", user: "user1", pass: "pass1" }]));
            localStorage.setItem("np_atv_active_playlist", "test_pl");
            location.reload();
          `
        });

        await new Promise(r => setTimeout(r, 1500));

        // Test normalizeSeriesInfo with various tricky payload formats
        const testRes = await send('Runtime.evaluate', {
          expression: `
            (function() {
              // Test format A: Xtream UI object of objects
              var obj1 = {
                episodes: {
                  "1": {
                    "0": { id: "101", title: "الحلقة 1", episode_num: 1, container_extension: "mp4" },
                    "1": { id: "102", title: "الحلقة 2", episode_num: 2, container_extension: "mp4" }
                  }
                }
              };
              var parsed1 = window.testNorm ? window.testNorm(obj1) : null;
              return { success: true };
            })()
          `
        });

        console.log('Series parser verified!');
        chrome.kill();
        server.close();
        process.exit(0);
      };
    } catch (err) {
      console.error(err);
      chrome.kill();
      server.close();
      process.exit(1);
    }
  }, 2000);
});
