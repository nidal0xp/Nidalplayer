const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('streamline', {
  saveLibrary: payload => ipcRenderer.invoke('save-library', payload),
  loadLibrary: () => ipcRenderer.invoke('load-library'),
  clearLibrary: () => ipcRenderer.invoke('clear-library'),
  saveCredentials: payload => ipcRenderer.invoke('save-credentials', payload),
  loadCredentials: id => ipcRenderer.invoke('load-credentials', id),
  removeCredentials: id => ipcRenderer.invoke('remove-credentials', id),
  saveFavorites: favs => ipcRenderer.invoke('save-favorites', favs),
  loadFavorites: () => ipcRenderer.invoke('load-favorites'),
  saveWatchProgress: data => ipcRenderer.invoke('save-watch-progress', data),
  loadWatchProgress: () => ipcRenderer.invoke('load-watch-progress'),
  testConnection: url => ipcRenderer.invoke('test-connection', url),
  validateXtream: payload => ipcRenderer.invoke('validate-xtream', payload),
  enterNativeFullscreen: () => ipcRenderer.invoke('enter-native-fullscreen'),
  toggleNativeFullscreen: () => ipcRenderer.invoke('toggle-native-fullscreen'),
  exitNativeFullscreen: () => ipcRenderer.invoke('exit-native-fullscreen'),
  isNativeFullscreen: () => ipcRenderer.invoke('is-native-fullscreen'),
  onNativeFullscreenChange: handler => {
    const listener = (_event, isFS) => handler(isFS);
    ipcRenderer.on('native-fullscreen-change', listener);
    return () => ipcRenderer.removeListener('native-fullscreen-change', listener);
  },
  clearAllData: () => ipcRenderer.invoke('clear-all-data'),
  saveDiagnostic: entry => ipcRenderer.invoke('save-diagnostic', entry),
  clearDiagnostics: () => ipcRenderer.invoke('clear-diagnostics'),
  diagnosticsPath: () => ipcRenderer.invoke('diagnostics-path'),
  openM3UFile: () => ipcRenderer.invoke('open-m3u-file'),
  fetchPlaylist: url => ipcRenderer.invoke('fetch-playlist', url),
  fetchSeriesDiscovery: params => ipcRenderer.invoke('fetch-series-discovery', params),
  openExternal: u => ipcRenderer.invoke('open-external', u),
  remoteInfo: () => ipcRenderer.invoke('remote-info'),
  publishRemoteState: snapshot => ipcRenderer.send('remote-state-update', snapshot),
  onRemoteAction: handler => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('remote-action', listener);
    return () => ipcRenderer.removeListener('remote-action', listener);
  },
  onRemoteStatusChange: handler => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('remote-status-change', listener);
    return () => ipcRenderer.removeListener('remote-status-change', listener);
  },
  onImportPlaylistFromPhone: handler => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('import-playlist-from-phone', listener);
    return () => ipcRenderer.removeListener('import-playlist-from-phone', listener);
  },
  publishRemoteActionResult: payload => ipcRenderer.send('remote-action-result', payload),
  relaunchApp: () => ipcRenderer.invoke('relaunch-app'),
  exitApp: () => ipcRenderer.invoke('exit-app'),
  platform: process.platform,
  loadPlaylistItems: id => ipcRenderer.invoke('load-playlist-items', id),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  restartAndInstallUpdate: () => ipcRenderer.invoke('restart-and-install-update'),
  onUpdaterChecking: handler => {
    const listener = () => handler();
    ipcRenderer.on('updater-checking', listener);
    return () => ipcRenderer.removeListener('updater-checking', listener);
  },
  onUpdaterAvailable: handler => {
    const listener = (_event, info) => handler(info);
    ipcRenderer.on('updater-available', listener);
    return () => ipcRenderer.removeListener('updater-available', listener);
  },
  onUpdaterNotAvailable: handler => {
    const listener = (_event, info) => handler(info);
    ipcRenderer.on('updater-not-available', listener);
    return () => ipcRenderer.removeListener('updater-not-available', listener);
  },
  onUpdaterProgress: handler => {
    const listener = (_event, progress) => handler(progress);
    ipcRenderer.on('updater-progress', listener);
    return () => ipcRenderer.removeListener('updater-progress', listener);
  },
  onUpdaterDownloaded: handler => {
    const listener = (_event, info) => handler(info);
    ipcRenderer.on('updater-downloaded', listener);
    return () => ipcRenderer.removeListener('updater-downloaded', listener);
  },
  onUpdaterError: handler => {
    const listener = (_event, error) => handler(error);
    ipcRenderer.on('updater-error', listener);
    return () => ipcRenderer.removeListener('updater-error', listener);
  }
});

