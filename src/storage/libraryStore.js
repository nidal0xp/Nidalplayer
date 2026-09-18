export class LibraryStore {
  constructor(bridge) {
    this.bridge = bridge;
  }

  async load() {
    return (await this.bridge.loadLibrary?.()) || { playlists: [], activePlaylistId: '' };
  }

  async saveMetadata(payload) {
    return this.bridge.saveLibrary?.(payload);
  }

  async saveCredentials(playlistId, credentials, remember = true) {
    return this.bridge.saveCredentials?.({ playlistId, credentials, remember });
  }

  async loadCredentials(playlistId) {
    return this.bridge.loadCredentials?.(playlistId);
  }

  async removeCredentials(playlistId) {
    return this.bridge.removeCredentials?.(playlistId);
  }

  async clearAll() {
    return this.bridge.clearAllData?.();
  }
}
