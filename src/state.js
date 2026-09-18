const savedPlayerEngine = localStorage.getItem('nidalplayer-player-engine');
const allowedPlayerEngines = new Set(['html5', 'artplayer']);

export const state = {
  // Library data
  playlists: [],
  activePlaylistId: '',
  items: [],
  liveItems: [],
  moviesItems: [],
  seriesItems: [],
  liveGroups: new Map(),
  moviesGroups: new Map(),
  seriesGroups: new Map(),
  categories: { live: {}, movies: {}, series: {} },
  account: null,
  provider: null,

  // Navigation & Filtering
  destination: 'home', // 'home' | 'live' | 'movies' | 'series' | 'favorites' | 'settings'
  category: 'all',
  search: '',
  sort: 'recent',
  view: 'grid', // 'grid' | 'list'

  // User engagement
  favorites: new Set(),
  recent: [],
  watchProgress: {}, // { [itemId]: { currentTime, duration, percentage, updatedAt } }

  // Active Playback
  playerItem: null,
  playerEngine: allowedPlayerEngines.has(savedPlayerEngine) ? savedPlayerEngine : 'html5',
  isPlaying: false,
  isFullscreen: false,
  volume: parseFloat(localStorage.getItem('nidalplayer-volume') || '1'),
  isMuted: false,

  // Active details modal
  selectedVod: null,

  // Refresh & Sync status
  syncState: {
    active: false,
    step: 0,
    totalSteps: 5,
    stepText: '',
    progress: 0,
    error: null,
    counts: { live: 0, movies: 0, series: 0 }
  }
};

export function activatePlaylist(record) {
  state.activePlaylistId = record.id;
  state.items = Array.isArray(record.items) ? record.items : [];
  state.provider = record.provider || null;
  state.account = record.account || null;
  state.categories = record.categories || { live: {}, movies: {}, series: {} };
  state.category = 'all';
  state.search = '';

  // Fast pre-indexing for 200,000+ items
  state.liveItems = [];
  state.moviesItems = [];
  state.seriesItems = [];
  state.liveGroups = new Map();
  state.moviesGroups = new Map();
  state.seriesGroups = new Map();

  for (let i = 0; i < state.items.length; i++) {
    const item = state.items[i];
    const group = item.group || 'Other';
    if (item.type === 'live') {
      state.liveItems.push(item);
      state.liveGroups.set(group, (state.liveGroups.get(group) || 0) + 1);
    } else if (item.type === 'movies') {
      state.moviesItems.push(item);
      state.moviesGroups.set(group, (state.moviesGroups.get(group) || 0) + 1);
    } else if (item.type === 'series') {
      state.seriesItems.push(item);
      state.seriesGroups.set(group, (state.seriesGroups.get(group) || 0) + 1);
    }
  }
}

export function clearActivePlaylistState() {
  state.activePlaylistId = '';
  state.items = [];
  state.liveItems = [];
  state.moviesItems = [];
  state.seriesItems = [];
  state.liveGroups = new Map();
  state.moviesGroups = new Map();
  state.seriesGroups = new Map();
  state.provider = null;
  state.account = null;
  state.playerItem = null;
  state.isPlaying = false;
  state.selectedVod = null;
}

export function addRecent(id) {
  state.recent = [id, ...state.recent.filter(v => v !== id)].slice(0, 50);
}

export function toggleFavorite(id) {
  if (state.favorites.has(id)) {
    state.favorites.delete(id);
  } else {
    state.favorites.add(id);
  }
}

export function updateWatchProgress(itemId, currentTime, duration, meta = {}) {
  if (!itemId || !duration || isNaN(currentTime) || isNaN(duration) || duration <= 0) return;
  const percentage = Math.min(100, Math.round((currentTime / duration) * 100));
  const isWatched = percentage >= 90;
  state.watchProgress[itemId] = {
    id: itemId,
    name: meta.name || state.watchProgress[itemId]?.name || 'Untitled Stream',
    logo: meta.logo || state.watchProgress[itemId]?.logo || '',
    group: meta.group || state.watchProgress[itemId]?.group || 'VOD',
    type: meta.type || state.watchProgress[itemId]?.type || (meta.season ? 'series' : 'movies'),
    currentTime: Math.floor(currentTime),
    duration: Math.floor(duration),
    percentage,
    isWatched,
    season: meta.season !== undefined ? meta.season : state.watchProgress[itemId]?.season,
    episodeNumber: meta.episodeNumber !== undefined ? meta.episodeNumber : state.watchProgress[itemId]?.episodeNumber,
    parentSeriesId: meta.parentSeriesId || state.watchProgress[itemId]?.parentSeriesId,
    parentSeriesName: meta.parentSeriesName || state.watchProgress[itemId]?.parentSeriesName,
    updatedAt: Date.now()
  };
}
