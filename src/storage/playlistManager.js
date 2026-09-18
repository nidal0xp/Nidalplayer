export class PlaylistManager {
  constructor({ state, store, load, loadContent = null, onError = () => {} }) {
    this.state = state;
    this.store = store;
    this.load = load;
    this.loadContent = loadContent;
    this.onError = onError;
    this.timers = new Map();
  }

  async rename(id, name) {
    const record = this.state.playlists.find(item => item.id === id);
    if (!record || !String(name || '').trim()) return false;
    record.name = String(name).trim();
    record.updatedAt = Date.now();
    await this.store.saveMetadata({ playlists: this.state.playlists, activePlaylistId: this.state.activePlaylistId });
    return true;
  }

  async duplicate(id) {
    const source = this.state.playlists.find(item => item.id === id);
    if (!source) return null;
    const copy = { ...source, id: `${source.id}:copy:${Date.now()}`, name: `${source.name} copy`, items: source.items.map(item => ({ ...item })), updatedAt: Date.now() };
    this.state.playlists.push(copy);
    await this.store.saveMetadata({ playlists: this.state.playlists, activePlaylistId: this.state.activePlaylistId });
    return copy;
  }

  async remove(id) {
    this.state.playlists = this.state.playlists.filter(item => item.id !== id);
    await this.store.removeCredentials(id);
    if (this.state.activePlaylistId === id) this.state.activePlaylistId = this.state.playlists[0]?.id || '';
    await this.store.saveMetadata({ playlists: this.state.playlists, activePlaylistId: this.state.activePlaylistId });
    return true;
  }

  async refresh(record) {
    if (!record?.sourceUrl) throw new Error('This playlist has no refreshable source URL.');
    const updated = await this.load(record);
    record.items = updated.items;
    if (updated.account) record.account = updated.account;
    record.updatedAt = Date.now();
    record.lastRefresh = Date.now();
    await this.store.saveMetadata({ playlists: this.state.playlists, activePlaylistId: this.state.activePlaylistId });
    return record;
  }

  async refreshContent(record) {
    if (!record?.sourceUrl) throw new Error('This playlist has no refreshable source URL.');
    if (typeof this.loadContent !== 'function') throw new Error('Lightweight content refresh is unavailable for this playlist.');
    const updated = await this.loadContent(record);
    const liveItems = (record.items || []).filter(item => item.type === 'live');
    const contentItems = (updated.items || []).filter(item => item.type === 'movies' || item.type === 'series').map((item, index) => ({ ...item, providerOrder: liveItems.length + index }));
    record.items = [...liveItems, ...contentItems];
    if (updated.account) record.account = updated.account;
    record.updatedAt = Date.now();
    record.lastContentRefresh = Date.now();
    record.settings = { ...(record.settings || {}), lastContentRefresh: record.lastContentRefresh };
    await this.store.saveMetadata({ playlists: this.state.playlists, activePlaylistId: this.state.activePlaylistId });
    return record;
  }

  schedule(record, intervalMinutes) {
    if (this.timers.has(record.id)) clearInterval(this.timers.get(record.id));
    if (!intervalMinutes || intervalMinutes <= 0) return;
    const timer = setInterval(() => this.refresh(record).catch(error => this.onError(error, record)), intervalMinutes * 60 * 1000);
    this.timers.set(record.id, timer);
    record.settings = { ...(record.settings || {}), refreshIntervalMinutes: intervalMinutes };
  }
}
