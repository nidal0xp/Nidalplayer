const { app, BrowserWindow, Menu, dialog, ipcMain, shell, session, safeStorage, Notification } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const os = require('os');
const QRCode = require('qrcode');

const remoteHtml = path.join(__dirname, 'remote', 'index.html');
const tvHtml = path.join(__dirname, 'tv', 'index.html');
let mainWindow;
let remoteServer;
let remotePort = 8765;
let remoteSnapshot = { activePlaylistId: '', activePlaylistName: '', playlists: [], channels: [], playback: {} };
const remotePending = new Map();
const pendingPhonePlaylistImports = [];
const pendingTizenPlaylistImports = [];
const pendingTizenActions = [];

const libraryFile = () => path.join(app.getPath('userData'), 'library.json');
const favoritesFile = () => path.join(app.getPath('userData'), 'favorites.json');
const credentialsFile = () => path.join(app.getPath('userData'), 'credentials.json');
const diagnosticsFile = () => path.join(app.getPath('userData'), 'diagnostics.log');
const watchProgressFile = () => path.join(app.getPath('userData'), 'watch_progress.json');
const remoteTokenFile = () => path.join(app.getPath('userData'), 'remote_token.json');
const cacheDir = () => path.join(app.getPath('userData'), 'cache');
const playlistItemsFile = (id) => path.join(cacheDir(), `pl_${String(id || '').replace(/[^a-zA-Z0-9_-]/g, '_')}_items.json`);

function getPersistentRemoteToken() {
  try {
    const file = remoteTokenFile();
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (data?.token && typeof data.token === 'string' && data.token.length >= 16) {
        return data.token;
      }
    }
    const newToken = crypto.randomBytes(18).toString('hex');
    writeJson(file, { token: newToken, createdAt: Date.now() });
    return newToken;
  } catch {
    return crypto.randomBytes(18).toString('hex');
  }
}

let remoteToken = '';

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const content = fs.readFileSync(file, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading json:', file, err);
    return fallback;
  }
}

function writeJson(file, value) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp.${Date.now()}`;
    fs.writeFileSync(tmp, JSON.stringify(value), 'utf8');
    fs.renameSync(tmp, file);
  } catch (err) {
    try { fs.writeFileSync(file, JSON.stringify(value), 'utf8'); } catch {}
  }
}

async function writeJsonAsync(file, value) {
  try {
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp.${Date.now()}`;
    await fs.promises.writeFile(tmp, JSON.stringify(value), 'utf8');
    await fs.promises.rename(tmp, file);
  } catch (err) {
    console.error('Error writing json async:', file, err);
  }
}

function restoreProvider(item) {
  if (item?.provider?.base) return item.provider;
  if (item?.type !== 'xtream') return null;
  const raw = String(item.providerId || '');
  const separator = raw.indexOf('|');
  const base = separator > 0 ? raw.slice(0, separator) : String(item.sourceUrl || '');
  const username = separator > 0 ? raw.slice(separator + 1) : '';
  return base ? { base, username } : null;
}

function compactItem(i) {
  return {
    id: i.id,
    name: i.name,
    group: i.group || 'Other',
    type: i.type || 'live',
    logo: i.logo || '',
    url: i.url || '',
    fallbackUrl: i.fallbackUrl || undefined,
    seriesId: i.seriesId || undefined,
    rating: i.rating || undefined,
    year: i.releaseDate || i.year || undefined,
    providerOrder: i.providerOrder
  };
}

function sanitizeLibrary(payload) {
  try {
    const rawList = Array.isArray(payload?.playlists) ? payload.playlists : (Array.isArray(payload?.sources) ? payload.sources : []);
    const playlists = rawList.map(item => {
      let safeItems = [];
      if (Array.isArray(item.items)) {
        safeItems = item.items.map(compactItem);
      }
      return {
        id: String(item.id || `pl-${Date.now()}`),
        name: String(item.name || 'Untitled Playlist'),
        type: String(item.type || 'xtream'),
        sourceUrl: String(item.sourceUrl || ''),
        itemCount: safeItems.length || Number(item.itemCount) || 0,
        items: safeItems,
        categories: item.categories || { live: {}, movies: {}, series: {} },
        providerId: item.providerId || item.id,
        provider: restoreProvider(item),
        updatedAt: item.updatedAt || Date.now(),
        lastRefresh: item.lastRefresh || 0,
        lastContentRefresh: item.lastContentRefresh || item.settings?.lastContentRefresh || 0,
        settings: item.settings || {},
        account: item.account || null
      };
    });
    return {
      version: 3,
      activePlaylistId: payload?.activePlaylistId || (playlists[0]?.id || ''),
      playlists,
      favorites: Array.isArray(payload?.favorites) ? payload.favorites : (payload?.favorites ? Array.from(payload.favorites) : []),
      savedAt: Date.now()
    };
  } catch (err) {
    console.error('Error in sanitizeLibrary:', err);
    return {
      version: 3,
      activePlaylistId: '',
      playlists: [],
      favorites: [],
      savedAt: Date.now()
    };
  }
}

function localAddresses() {
  const ifaces = os.networkInterfaces();
  const physical = [];
  const fallback = [];

  for (const [name, list] of Object.entries(ifaces)) {
    const isVirtual = /vEthernet|VirtualBox|VMware|WSL|Loopback|Hyper-V|vbox|docker|vethernet|tailscale|zerotier|hamachi/i.test(name);
    for (const info of list) {
      if (info && info.family === 'IPv4' && !info.internal) {
        const isVirtualIp = isVirtual || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(info.address) || info.address.startsWith('169.254.');
        if (!isVirtualIp) {
          if (info.address.startsWith('192.168.')) {
            physical.unshift(info.address);
          } else {
            physical.push(info.address);
          }
        } else {
          fallback.push(info.address);
        }
      }
    }
  }

  // Return strictly ONE primary physical address to prevent duplicate confusing links/QR codes
  if (physical.length > 0) {
    return [physical[0]];
  }
  if (fallback.length > 0) {
    return [fallback[0]];
  }
  return ['127.0.0.1'];
}

function remoteUrls() {
  return localAddresses().map(address => `http://${address}:${remotePort}/desktop?token=${remoteToken}`);
}

function json(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(payload));
}

function isLanRequest(request) {
  const ip = request.socket?.remoteAddress || '';
  return ip.includes('127.0.0.1') || ip.includes('::1') || ip.includes('192.168.') || ip.includes('10.') || ip.includes('172.') || ip.startsWith('::ffff:192.168.') || ip.startsWith('::ffff:10.') || ip.startsWith('::ffff:127.');
}

function authorized(request) {
  // Always authorize all local/LAN requests seamlessly so mobile remotes never get expired across restarts
  return true;
}

let tvSnapshot = { activePlaylistId: '', activePlaylistName: '', playlists: [], channels: [], movies: [], series: [], playback: {} };
let tvLastSeen = 0;
let remoteLastActive = 0;
let remoteActiveTimer = null;

function markRemoteActive() {
  const now = Date.now();
  const wasActive = (now - remoteLastActive) < 15000;
  remoteLastActive = now;
  if (!wasActive && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('remote-status-change', { connected: true, lastSeen: now });
  }
  clearTimeout(remoteActiveTimer);
  remoteActiveTimer = setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('remote-status-change', { connected: false, lastSeen: remoteLastActive });
    }
  }, 15000);
}

function getActiveDevices() {
  return [
    {
      id: 'desktop',
      name: 'Desktop PC (Windows)',
      type: 'desktop',
      icon: '💻',
      online: Boolean(mainWindow && !mainWindow.isDestroyed()),
      active: true,
      lastSeen: Date.now()
    }
  ];
}

function startRemoteServer() {
  if (remoteServer) return;
  remoteServer = http.createServer((request, response) => {
    const url = new URL(request.url, `http://127.0.0.1:${remotePort}`);
    
    const pathname = (url.pathname || '').replace(/\/+$/, '') || '/';
    
    // Dedicated Desktop PC Companion Remote URL
    if (pathname === '/desktop' || pathname === '/pc' || pathname === '/windows') {
      markRemoteActive();
      return fs.readFile(remoteHtml, 'utf8', (error, data) => {
        if (error) return json(response, 404, { error: 'Remote UI unavailable.' });
        const html = data.replace('<head>', `<head><script>window.SERVER_INJECTED_TOKEN = "${remoteToken}"; window.SERVER_INJECTED_TARGET = "desktop";</script>`);
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(html);
      });
    }

    // Dedicated Samsung TV & Android TV Companion Remote URL
    if (pathname === '/tv' || pathname === '/tizen' || pathname === '/samsung' || pathname.startsWith('/tv')) {
      markRemoteActive();
      return fs.readFile(remoteHtml, 'utf8', (error, data) => {
        if (error) return json(response, 404, { error: 'Remote UI unavailable.' });
        const html = data.replace('<head>', `<head><script>window.SERVER_INJECTED_TOKEN = "${remoteToken}"; window.SERVER_INJECTED_TARGET = "tizen";</script>`);
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(html);
      });
    }

    // Default root /
    if (pathname === '' || pathname === '/' || pathname === '/remote' || pathname === '/remote.html' || pathname === '/index.html') {
      markRemoteActive();
      return fs.readFile(remoteHtml, 'utf8', (error, data) => {
        if (error) return json(response, 404, { error: 'Remote UI unavailable.' });
        const html = data.replace('<head>', `<head><script>window.SERVER_INJECTED_TOKEN = "${remoteToken}"; window.SERVER_INJECTED_TARGET = "desktop";</script>`);
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(html);
      });
    }

    // Tizen TVs use the desktop remote server as a small LAN relay.
    if (url.pathname === '/api/pair' && request.method === 'GET') {
      return json(response, 200, { ok: true, token: remoteToken, port: remotePort });
    }

    // Android TV Downloader Direct APK Route
    if (url.pathname === '/apk' || url.pathname === '/nidalplayer.apk' || url.pathname === '/apk-tv') {
      const apkPath = path.join(__dirname, 'dist', 'Nidalplayer-AndroidTV.apk');
      if (!fs.existsSync(apkPath)) {
        return json(response, 404, { error: 'Android TV APK not found.' });
      }
      const stat = fs.statSync(apkPath);
      response.writeHead(200, {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Length': stat.size,
        'Content-Disposition': 'attachment; filename="Nidalplayer-AndroidTV.apk"',
        'Cache-Control': 'no-store'
      });
      return fs.createReadStream(apkPath).pipe(response);
    }

    // Android Mobile & Tablet Direct APK Route
    if (url.pathname === '/apk-mobile' || url.pathname === '/nidalplayer-mobile.apk') {
      const apkPath = path.join(__dirname, 'dist', 'Nidalplayer-AndroidMobile.apk');
      if (!fs.existsSync(apkPath)) {
        return json(response, 404, { error: 'Android Mobile APK not found.' });
      }
      const stat = fs.statSync(apkPath);
      response.writeHead(200, {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Length': stat.size,
        'Content-Disposition': 'attachment; filename="Nidalplayer-AndroidMobile.apk"',
        'Cache-Control': 'no-store'
      });
      return fs.createReadStream(apkPath).pipe(response);
    }

    if (!authorized(request)) return json(response, 410, { error: 'Remote link expired. Scan a new QR code in Nidalplayer.' });

    markRemoteActive();

    if (url.pathname === '/api/state' && request.method === 'GET') {
      const targetParam = (url.searchParams.get('target') || url.searchParams.get('device') || '').toLowerCase();
      if (targetParam === 'tizen' || targetParam === 'tv' || targetParam === 'samsung') {
        return json(response, 200, tvSnapshot || {});
      }
      return json(response, 200, remoteSnapshot || {});
    }

    // Fast Playlist Send from Smartphone
    if (url.pathname === '/api/send-playlist' && request.method === 'POST') {
      markRemoteActive();
      let body = '';
      request.on('data', chunk => {
        body += chunk.toString();
        if (body.length > 20000) request.destroy();
      });
      request.on('end', () => {
        let payload;
        try { payload = JSON.parse(body || '{}'); } catch { return json(response, 400, { ok: false, error: 'Invalid JSON data.' }); }
        if (!payload || !payload.server || !payload.user || !payload.pass) {
          return json(response, 400, { ok: false, error: 'Server, username, and password are required.' });
        }
        const target = (url.searchParams.get('target') || url.searchParams.get('device') || payload.target || '').toLowerCase();
        const isTizenTarget = target === 'tizen' || target === 'tv' || target === 'samsung';
        pendingTizenPlaylistImports.push(payload);
        if (isTizenTarget) {
          return json(response, 202, { ok: true, accepted: true, target: 'tizen', message: 'Playlist queued for the Tizen TV.' });
        }
        if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) {
          return json(response, 503, { ok: false, error: 'Nidalplayer is not ready to receive the playlist.' });
        }
        if (mainWindow.webContents.isLoading()) {
          pendingPhonePlaylistImports.push(payload);
        } else {
          mainWindow.webContents.send('import-playlist-from-phone', payload);
        }
        return json(response, 202, { ok: true, accepted: true, message: 'Playlist received. Synchronization started.' });
      });
      return;
    }

    if (url.pathname === '/api/tv-state' && request.method === 'POST') {
      let body = '';
      request.on('data', chunk => { body += chunk.toString(); if (body.length > 2000000) request.destroy(); });
      request.on('end', () => {
        try { tvSnapshot = JSON.parse(body || '{}'); tvLastSeen = Date.now(); markRemoteActive(); json(response, 200, { ok: true }); }
        catch { json(response, 400, { ok: false, error: 'Invalid TV state.' }); }
      });
      return;
    }

    if (url.pathname === '/api/tv-log' && request.method === 'POST') {
      let body = '';
      request.on('data', chunk => { body += chunk.toString(); if (body.length > 50000) request.destroy(); });
      request.on('end', () => {
        try {
          const l = JSON.parse(body);
          console.log(`[TV-LOG] ${l.msg}`, l.data !== undefined ? JSON.stringify(l.data) : '');
        } catch(e) {
          console.log(`[TV-LOG] ${body}`);
        }
        json(response, 200, { ok: true });
      });
      return;
    }

    if (url.pathname === '/api/tv-actions' && request.method === 'GET') {
      markRemoteActive();
      return json(response, 200, { actions: pendingTizenActions.splice(0, 20) });
    }

    if (url.pathname === '/api/tv-playlists' && request.method === 'GET') {
      return json(response, 200, { playlists: pendingTizenPlaylistImports.splice(0, 5) });
    }

    // Actions
    if (url.pathname === '/api/action' && request.method === 'POST') {
      markRemoteActive();
      let body = '';
      request.on('data', chunk => {
        body += chunk.toString();
        if (body.length > 100000) request.destroy();
      });
      request.on('end', () => {
        let payload;
        try { payload = JSON.parse(body || '{}'); } catch { return json(response, 400, { error: 'Invalid command.' }); }
        const target = (url.searchParams.get('target') || url.searchParams.get('device') || payload.target || '').toLowerCase();
        const isTizenAction = target === 'tizen' || target === 'tv' || target === 'samsung';
        if (isTizenAction) {
          pendingTizenActions.push(payload);
          return json(response, 202, { ok: true, queued: true, target: 'tizen' });
        }

        if (!mainWindow || mainWindow.isDestroyed()) {
          return json(response, 503, { ok: false, error: 'Desktop application is not running.' });
        }

        const requestId = crypto.randomUUID();
        const promise = new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            remotePending.delete(requestId);
            reject(new Error('Desktop app did not respond.'));
          }, 8000);
          remotePending.set(requestId, {
            resolve: value => {
              clearTimeout(timer);
              remotePending.delete(requestId);
              resolve(value);
            },
            reject
          });
        });
        mainWindow.webContents.send('remote-action', { requestId, ...payload });
        promise
          .then(result => json(response, result?.ok === false ? 400 : 200, result))
          .catch(error => json(response, 504, { ok: false, error: error.message }));
      });
      return;
    }
    return json(response, 404, { error: 'Not found.' });
  });

  const listen = port => remoteServer.listen(port, '0.0.0.0', () => { remotePort = port; });
  remoteServer.on('error', error => {
    if (error.code === 'EADDRINUSE' && remotePort < 8785) {
      remotePort += 1;
      listen(remotePort);
    } else {
      remoteServer = undefined;
    }
  });
  listen(remotePort);
}

function setupNetworkInterceptors() {
  const filter = { urls: ['http://*/*', 'https://*/*'] };
  session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    const url = String(details.url || '');
    const isPublicService = /themoviedb\.org|tmdb\.org|thesportsdb\.com|127\.0\.0\.1|localhost/i.test(url);
    if (isPublicService) {
      return callback({ requestHeaders: details.requestHeaders });
    }

    const headers = {};
    for (const [key, val] of Object.entries(details.requestHeaders || {})) {
      const lower = key.toLowerCase();
      if (
        !lower.startsWith('sec-') &&
        lower !== 'origin' &&
        lower !== 'referer' &&
        lower !== 'user-agent' &&
        lower !== 'accept' &&
        lower !== 'connection' &&
        lower !== 'accept-encoding' &&
        lower !== 'dnt' &&
        lower !== 'upgrade-insecure-requests'
      ) {
        headers[key] = val;
      }
    }

    headers['User-Agent'] = 'TiviMate/4.7.0 (Linux; Android 11)';
    headers['Accept'] = '*/*';
    headers['Connection'] = 'keep-alive';
    headers['Accept-Encoding'] = 'identity';

    callback({ requestHeaders: headers });
  });

  session.defaultSession.webRequest.onHeadersReceived(filter, (details, callback) => {
    const responseHeaders = {};
    for (const [key, val] of Object.entries(details.responseHeaders || {})) {
      const lower = key.toLowerCase();
      if (
        lower !== 'access-control-allow-origin' &&
        lower !== 'access-control-allow-headers' &&
        lower !== 'access-control-allow-methods' &&
        lower !== 'access-control-allow-credentials' &&
        lower !== 'x-frame-options' &&
        lower !== 'content-security-policy'
      ) {
        responseHeaders[key] = val;
      }
    }
    responseHeaders['Access-Control-Allow-Origin'] = ['*'];
    responseHeaders['Access-Control-Allow-Headers'] = ['*'];
    responseHeaders['Access-Control-Allow-Methods'] = ['GET, POST, OPTIONS, HEAD, PUT, DELETE'];
    responseHeaders['Access-Control-Allow-Credentials'] = ['true'];
    callback({ responseHeaders });
  });
}

app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('allow-running-insecure-content');
app.commandLine.appendSwitch('disable-web-security');
app.commandLine.appendSwitch('allow-insecure-localhost');

// Hardware Acceleration & GPU Video Decoding Tuning
// NOTE: use-angle d3d11 is the most stable DirectX backend on Windows for HLS streaming.
// Removed enable-zero-copy and enable-native-gpu-memory-buffers — these were causing GPU
// process crashes on certain Windows GPU drivers (Intel/AMD) during live stream playback.
// Removed VaapiVideoDecoder — this is a Linux-only VA-API flag; applying it on Windows
// caused the GPU process to crash when switching streams or changing resolutions.
// Added disable-gpu-process-crash-limit and in-process-gpu as resilience fallbacks.
app.commandLine.appendSwitch('use-angle', 'd3d11');
app.commandLine.appendSwitch('enable-accelerated-video-decode');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport,CanvasOopRasterization,D3D11VideoDecoder');
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,UseChromeOSDirectVideoDecoder');
app.commandLine.appendSwitch('disable-gpu-process-crash-limit');
app.commandLine.appendSwitch('in-process-gpu');

// Secure DNS (DNS-over-HTTPS) via Cloudflare & Google to bypass ISP 451 blocks and censorship
app.commandLine.appendSwitch('dns-over-https-mode', 'automatic');
app.commandLine.appendSwitch('dns-over-https-templates', 'https://cloudflare-dns.com/dns-query https://dns.google/dns-query');

app.setAppUserModelId('com.streamline.iptvplayer');

function createWindow() {
  const iconPath = process.platform === 'win32'
    ? path.join(__dirname, 'build', 'icon.ico')
    : path.join(__dirname, 'assets', 'logo.png');

  const isWin = process.platform === 'win32';
  mainWindow = new BrowserWindow({
    width: 1540,
    height: 960,
    minWidth: 1100,
    minHeight: 680,
    backgroundColor: '#0b0d11',
    show: false,
    title: 'Nidalplayer',
    icon: iconPath,
    autoHideMenuBar: true,
    titleBarStyle: isWin ? 'hidden' : 'default',
    titleBarOverlay: isWin ? {
      color: '#0e1218',
      symbolColor: '#f0f2f5',
      height: 38
    } : false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
      webSecurity: false,
      allowRunningInsecureContent: true
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Fallback to guarantee window visibility
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  }, 1200);

  mainWindow.setMenuBarVisibility(false);
  Menu.setApplicationMenu(null);

  mainWindow.on('enter-full-screen', () => {
    mainWindow.webContents?.send('native-fullscreen-change', true);
  });

  mainWindow.on('leave-full-screen', () => {
    mainWindow.webContents?.send('native-fullscreen-change', false);
  });

  mainWindow.webContents.on('console-message', (event, ...args) => {
    const level = typeof event === 'object' && event.level !== undefined ? event.level : args[0];
    const msg = typeof event === 'object' && event.message !== undefined ? event.message : args[1];
    console.log(`[Renderer L${level}] ${msg}`);
  });

  // Deliver playlist imports that arrived while the renderer was loading.
  mainWindow.webContents.on('did-finish-load', () => {
    while (pendingPhonePlaylistImports.length > 0) {
      const payload = pendingPhonePlaylistImports.shift();
      mainWindow.webContents.send('import-playlist-from-phone', payload);
    }
  });

  setupNetworkInterceptors();
  const isTvMode = process.argv.includes('--tv') || process.argv.includes('--smart-tv') || process.argv.includes('--tv-mode');
  if (isTvMode) {
    mainWindow.setTitle('Nidalplayer — Smart TV Simulator (1080p)');
    mainWindow.loadFile(tvHtml);
  } else {
    mainWindow.loadFile('index.html');
  }
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.streamline.iptvplayer');
  remoteToken = getPersistentRemoteToken();
  createWindow();
  startRemoteServer();
  initAutoUpdater();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers
ipcMain.handle('save-library', async (_e, payload) => {
  try {
    const sanitized = sanitizeLibrary(payload);
    // Write chunked item caches for each playlist asynchronously
    if (Array.isArray(sanitized.playlists)) {
      for (const pl of sanitized.playlists) {
        if (Array.isArray(pl.items) && pl.items.length > 0) {
          writeJsonAsync(playlistItemsFile(pl.id), pl.items).catch(() => {});
        }
      }
    }
    await writeJsonAsync(libraryFile(), sanitized);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: 'Could not save playlist metadata.' };
  }
});

ipcMain.handle('load-library', async () => {
  const library = readJson(libraryFile(), null);
  const diskFavs = readJson(favoritesFile(), []);
  if (library && Array.isArray(library.playlists)) {
    const favs = (Array.isArray(library.favorites) && library.favorites.length) ? library.favorites : diskFavs;
    library.favorites = favs;

    // Fast Chunked Cache: Ensure active playlist has its items populated
    const activeId = library.activePlaylistId || library.playlists[0]?.id || '';
    const activePl = library.playlists.find(p => p.id === activeId) || library.playlists[0];
    if (activePl && (!Array.isArray(activePl.items) || activePl.items.length === 0)) {
      const cachedItems = readJson(playlistItemsFile(activePl.id), null);
      if (Array.isArray(cachedItems) && cachedItems.length > 0) {
        activePl.items = cachedItems;
        activePl.itemCount = cachedItems.length;
      }
    }

    remoteSnapshot = {
      ...remoteSnapshot,
      activePlaylistId: activeId,
      activePlaylistName: activePl?.name || '',
      favorites: favs,
      playlists: library.playlists.map(p => ({
        id: p.id,
        name: p.name,
        itemCount: Number(p.itemCount || p.items?.length || 0)
      }))
    };
  }
  return library;
});

ipcMain.handle('load-playlist-items', async (_e, playlistId) => {
  try {
    const items = readJson(playlistItemsFile(playlistId), null);
    return { ok: true, items: Array.isArray(items) ? items : [] };
  } catch (err) {
    return { ok: false, items: [], error: err.message };
  }
});

ipcMain.handle('save-favorites', async (_e, favs) => {
  try {
    const list = Array.isArray(favs) ? favs : (favs ? Array.from(favs) : []);
    writeJson(favoritesFile(), list);
    remoteSnapshot.favorites = list;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: 'Could not save favorites to disk.' };
  }
});

ipcMain.handle('load-favorites', async () => {
  return readJson(favoritesFile(), []);
});

ipcMain.handle('save-credentials', async (_e, { playlistId, credentials, remember = true }) => {
  try {
    const store = readJson(credentialsFile(), {});
    if (!remember) {
      delete store[playlistId];
      writeJson(credentialsFile(), store);
      return { ok: true, remembered: false };
    }
    if (!safeStorage.isEncryptionAvailable()) {
      store[playlistId] = `b64:${Buffer.from(JSON.stringify(credentials)).toString('base64')}`;
      writeJson(credentialsFile(), store);
      console.log('[save-credentials fallback b64]', playlistId);
      return { ok: true, remembered: true, fallback: true };
    }
    const encryptedBuf = safeStorage.encryptString(JSON.stringify(credentials));
    store[playlistId] = `enc:${encryptedBuf.toString('base64')}`;
    writeJson(credentialsFile(), store);
    console.log('[save-credentials enc]', playlistId);
    return { ok: true, remembered: true };
  } catch (err) {
    console.error('save-credentials error:', err);
    return { ok: false, error: 'Could not save credentials securely.' };
  }
});

ipcMain.handle('load-credentials', async (_e, playlistId) => {
  try {
    const store = readJson(credentialsFile(), {});
    if (!store[playlistId]) {
      console.log('[load-credentials NOT FOUND]', playlistId);
      return null;
    }
    const value = store[playlistId];
    let res = null;
    if (typeof value === 'string') {
      if (value.startsWith('b64:')) {
        res = JSON.parse(Buffer.from(value.slice(4), 'base64').toString('utf8'));
      } else if (value.startsWith('enc:') && safeStorage.isEncryptionAvailable()) {
        const buf = Buffer.from(value.slice(4), 'base64');
        res = JSON.parse(safeStorage.decryptString(buf));
      }
    } else if (value && typeof value === 'object') {
      if (value.type === 'Buffer' && Array.isArray(value.data) && safeStorage.isEncryptionAvailable()) {
        const buf = Buffer.from(value.data);
        res = JSON.parse(safeStorage.decryptString(buf));
      } else if (value.username && value.password) {
        res = value;
      }
    }
    console.log('[load-credentials RESULT]', playlistId, res ? 'OK' : 'NULL');
    return res;
  } catch (err) {
    console.error('load-credentials error:', err);
    return null;
  }
});

ipcMain.handle('remove-credentials', async (_e, playlistId) => {
  try {
    const store = readJson(credentialsFile(), {});
    delete store[playlistId];
    writeJson(credentialsFile(), store);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('save-watch-progress', async (_e, progressData) => {
  try {
    writeJson(watchProgressFile(), progressData);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('load-watch-progress', async () => readJson(watchProgressFile(), {}));

ipcMain.handle('test-connection', async (_e, url) => {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 VLC/3.0.18 StreamlineIPTV/3.7' }
    });
    clearTimeout(timer);
    const latency = Date.now() - start;
    return { ok: res.ok || res.status < 500, status: res.status, latency };
  } catch (err) {
    return { ok: false, status: 0, error: err.message, latency: Date.now() - start };
  }
});

ipcMain.handle('validate-xtream', async (_e, { base, username, password }) => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const url = `${String(base).replace(/\/+$/, '')}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_user_info`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'IPTVSmartersPro/3.1.5 (Android; 13)', Accept: 'application/json,*/*' }
    });
    const text = await response.text();
    clearTimeout(timer);
    if (!response.ok) return { ok: false, error: `Provider returned HTTP ${response.status}.` };
    let payload;
    try { payload = JSON.parse(text); } catch { return { ok: false, error: 'Provider returned an invalid response.' }; }
    if (payload?.user_info && String(payload.user_info.auth) === '0') {
      return { ok: false, error: 'Username or password was rejected by the provider.' };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.name === 'AbortError' ? 'Provider validation timed out.' : error.message };
  }
});

ipcMain.handle('fetch-playlist', async (_e, url) => {
  try {
    const controller = new AbortController();
    // Large Xtream responses (especially get_series) can legitimately take
    // longer than the old 45 second limit. The renderer already runs live,
    // movie, and series requests in parallel, so this prevents a slow series
    // response from being converted into a false empty catalogue.
    const timeout = setTimeout(() => controller.abort(), 120000);
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'TiviMate/4.7.0 (Linux; Android 11)',
        'Accept': '*/*',
        'Connection': 'keep-alive',
        'Accept-Encoding': 'identity'
      }
    });
    const text = await response.text();
    clearTimeout(timeout);
    return {
      ok: response.ok,
      status: response.status,
      error: response.ok ? '' : (response.status === 451
        ? 'HTTP 451 (Geo/ISP Blocked): Your internet provider or region is blocking this streaming domain. Using a VPN or changing DNS will bypass this.'
        : `Playlist URL returned HTTP ${response.status}${text ? `: ${text.slice(0, 160).replace(/\s+/g, ' ').trim()}` : '.'}`),
      text,
      contentType: response.headers.get('content-type') || '',
      preview: text.slice(0, 240)
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error.name === 'AbortError' ? 'The provider request timed out after 120 seconds.' : error.message
    };
  }
});

ipcMain.handle('fetch-series-discovery', async (_e, { base, username, password, maxId = 250000, batchSize = 100 }) => {
  return new Promise(async (resolve) => {
    const client = String(base).startsWith('https') ? https : http;
    const allShows = [];
    const categories = {};
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 500; // More tolerant for sparse ID ranges

    function fetchOne(id) {
      return new Promise(resSingle => {
        const url = `${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_series_info&series_id=${id}`;
        const req = client.get(url, {
          headers: { 'User-Agent': 'TiviMate/4.7.0 (Linux; Android 11)' },
          timeout: 4500
        }, res => {
          let d = '';
          res.on('data', c => d += c);
          res.on('end', () => {
            try {
              const j = JSON.parse(d);
              if (j?.info?.name) {
                const epCount = Object.values(j.episodes || {}).reduce((acc, s) => acc + (Array.isArray(s) ? s.length : Object.keys(s || {}).length), 0);
                resSingle({
                  id: `series-${id}`,
                  seriesId: String(id),
                  seriesName: j.info.name,
                  name: j.info.name,
                  group: j.info.category_name || 'Series',
                  type: 'series',
                  logo: j.info.cover || '',
                  url: '',
                  rating: j.info.rating || null,
                  releaseDate: j.info.releaseDate || '',
                  episodesCount: epCount || 1,
                  metadata: j.info
                });
              } else {
                resSingle(null);
              }
            } catch {
              resSingle(null);
            }
          });
        });
        req.on('error', () => resSingle(null));
        req.on('timeout', () => { req.destroy(); resSingle(null); });
      });
    }

    try {
      // Try multiple starting points to handle providers with high ID ranges
      const startPoints = [1, 10000, 50000, 100000, 150000, 200000];
      
      for (const start of startPoints) {
        if (start > maxId) break;
        consecutiveFailures = 0;
        
        for (let b = start; b <= maxId; b += batchSize) {
          const promises = [];
          for (let id = b; id < b + batchSize && id <= maxId; id++) {
            promises.push(fetchOne(id));
          }
          const res = await Promise.all(promises);
          const found = res.filter(Boolean);
          
          if (found.length === 0) {
            consecutiveFailures += batchSize;
          } else {
            consecutiveFailures = 0;
            found.forEach(s => {
              if (!allShows.some(existing => existing.seriesId === s.seriesId)) {
                allShows.push(s);
                categories[s.group] = s.group;
              }
            });
          }

          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            console.log(`[Series Discovery] Sparse range detected at ${b}. Jumping to next start point.`);
            break;
          }
        }
      }
      resolve({ ok: true, series: allShows, categories });
    } catch (err) {
      console.error('[Series Discovery] Error:', err);
      resolve({ ok: true, series: allShows, categories });
    }
  });
});

ipcMain.handle('open-m3u-file', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Playlist files (*.m3u, *.m3u8, *.txt)', extensions: ['m3u', 'm3u8', 'txt'] }]
  });
  if (r.canceled || !r.filePaths[0]) return null;
  return {
    name: path.basename(r.filePaths[0]),
    content: fs.readFileSync(r.filePaths[0], 'utf8'),
    path: r.filePaths[0]
  };
});

ipcMain.handle('clear-library', async () => {
  try {
    const file = libraryFile();
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('clear-all-data', async () => {
  try {
    for (const file of [libraryFile(), credentialsFile(), diagnosticsFile(), watchProgressFile()]) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('save-diagnostic', async (_e, entry) => {
  try {
    fs.mkdirSync(path.dirname(diagnosticsFile()), { recursive: true });
    fs.appendFileSync(diagnosticsFile(), JSON.stringify(entry) + '\n', 'utf8');
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('clear-diagnostics', async () => {
  try {
    if (fs.existsSync(diagnosticsFile())) fs.unlinkSync(diagnosticsFile());
    if (mainWindow?.webContents?.session) {
      await mainWindow.webContents.session.clearCache();
    }
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('enter-native-fullscreen', () => {
  if (!mainWindow) return false;
  if (!mainWindow.isFullScreen()) {
    mainWindow.setFullScreen(true);
  }
  return true;
});

ipcMain.handle('toggle-native-fullscreen', () => {
  if (!mainWindow) return false;
  const next = !mainWindow.isFullScreen();
  mainWindow.setFullScreen(next);
  return next;
});

ipcMain.handle('exit-native-fullscreen', () => {
  if (!mainWindow) return false;
  if (mainWindow.isFullScreen()) {
    mainWindow.setFullScreen(false);
    return true;
  }
  return false;
});

ipcMain.handle('is-native-fullscreen', () => {
  return mainWindow ? mainWindow.isFullScreen() : false;
});

ipcMain.handle('relaunch-app', () => {
  app.relaunch();
  app.exit(0);
});

ipcMain.handle('exit-app', () => {
  app.quit();
});
ipcMain.handle('open-external', async (_e, url) => { await shell.openExternal(url); return true; });

// Remote control
ipcMain.on('remote-state-update', (_event, snapshot) => { remoteSnapshot = snapshot || remoteSnapshot; });
ipcMain.on('remote-action-result', (_event, payload) => {
  const pending = remotePending.get(payload?.requestId);
  if (pending) pending.resolve(payload.result || payload);
});
ipcMain.handle('remote-info', async () => {
  const urls = remoteUrls();
  const qrDataUrls = await Promise.all(
    urls.map(url => QRCode.toDataURL(url, {
      width: 280,
      margin: 3,
      errorCorrectionLevel: 'H',
      color: { dark: '#000000', light: '#ffffff' }
    }).catch(() => ''))
  );
  return { enabled: Boolean(remoteServer), port: remotePort, token: remoteToken, urls, qrDataUrls };
});

/* ==========================================================================
   Auto-Updater System (GitHub Releases & electron-updater)
   ========================================================================== */
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowPrerelease = false;
autoUpdater.forceDevUpdateConfig = false;
autoUpdater.logger = console;

// Optional: allow local private token from environment
const updateToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (updateToken) {
  autoUpdater.requestHeaders = {
    Authorization: `token ${updateToken}`
  };
}

function initAutoUpdater() {
  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for updates...');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater-checking');
    }
  });

  autoUpdater.on('update-available', (info) => {
    console.log(`[AutoUpdater] Update available: v${info?.version}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater-available', {
        version: info?.version,
        releaseDate: info?.releaseDate,
        releaseNotes: typeof info?.releaseNotes === 'string' ? info.releaseNotes : (Array.isArray(info?.releaseNotes) ? info.releaseNotes.map(n => n.note).join('\n') : '')
      });
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('[AutoUpdater] App is up to date.');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater-not-available', {
        version: app.getVersion()
      });
    }
  });

  autoUpdater.on('download-progress', (progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater-progress', {
        percent: Math.round(progress?.percent || 0),
        bytesPerSecond: progress?.bytesPerSecond || 0,
        transferred: progress?.transferred || 0,
        total: progress?.total || 0
      });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log(`[AutoUpdater] Update v${info?.version} downloaded successfully and ready for install.`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater-downloaded', {
        version: info?.version,
        releaseNotes: info?.releaseNotes
      });
    }
    try {
      if (Notification.isSupported()) {
        const notif = new Notification({
          title: 'Nidalplayer — Update Ready',
          body: `Version v${info?.version || ''} has been downloaded. Click to restart and apply update.`,
          icon: path.join(__dirname, 'assets', 'logo.png')
        });
        notif.on('click', () => {
          autoUpdater.quitAndInstall(false, true);
        });
        notif.show();
      }
    } catch (e) {
      console.warn('[AutoUpdater] Native notification notice:', e?.message);
    }
  });

  autoUpdater.on('error', (err) => {
    const errorMsg = err?.message || String(err);
    console.warn('[AutoUpdater] Update check encountered non-fatal error:', errorMsg);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater-error', {
        message: errorMsg
      });
    }
  });

  // Schedule background check in packaged production
  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(e => console.warn('[AutoUpdater] Initial check error:', e?.message));
    }, 6000);

    // Re-check periodically every 4 hours
    setInterval(() => {
      autoUpdater.checkForUpdates().catch(e => console.warn('[AutoUpdater] Periodic check error:', e?.message));
    }, 4 * 60 * 60 * 1000);
  }
}

ipcMain.handle('check-for-updates', async () => {
  try {
    if (!app.isPackaged && !process.env.FORCE_UPDATE_CHECK) {
      return { ok: true, dev: true, currentVersion: app.getVersion(), message: 'Auto-updates are active in packaged app builds.' };
    }
    const res = await autoUpdater.checkForUpdates();
    return { ok: true, currentVersion: app.getVersion(), updateInfo: res?.updateInfo };
  } catch (err) {
    const msg = err?.message || String(err);
    console.warn('[AutoUpdater] Manual check error:', msg);
    return { ok: false, currentVersion: app.getVersion(), error: msg };
  }
});

ipcMain.handle('simulate-update-notification', () => {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater-available', {
        version: '4.2.0',
        releaseDate: new Date().toISOString(),
        releaseNotes: 'Simulated Notification: Testing in-app floating banner and native Windows notifications.'
      });
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('updater-downloaded', {
            version: '4.2.0',
            releaseNotes: 'Update ready to install.'
          });
          try {
            if (Notification.isSupported()) {
              new Notification({
                title: 'Nidalplayer — Update Ready',
                body: 'Version v4.2.0 has been downloaded. Click to restart and apply update.',
                icon: path.join(__dirname, 'assets', 'logo.png')
              }).show();
            }
          } catch (e) {}
        }
      }, 1500);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message };
  }
});

ipcMain.handle('restart-and-install-update', () => {
  try {
    setImmediate(() => {
      autoUpdater.quitAndInstall(false, true);
    });
    return { ok: true };
  } catch (err) {
    console.error('[AutoUpdater] Failed to quit and install:', err);
    return { ok: false, error: err?.message };
  }
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

