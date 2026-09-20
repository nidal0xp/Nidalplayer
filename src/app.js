import { state, activatePlaylist, clearActivePlaylistState, addRecent, toggleFavorite, updateWatchProgress } from './state.js';
import { XtreamApi, normalizeServer } from './playlist/xtreamApi.js';
import { parseM3U } from './playlist/m3uParser.js';
import { PlayerManager } from './player/playerManager.js';
import { LibraryStore } from './storage/libraryStore.js';
import { VirtualScroller } from './ui/virtualScroller.js';
import { getLang, setLang, applyTranslations, t } from './i18n.js';
import { matchCenter, TOP_5_LEAGUES } from './sports/matchCenter.js';
import lineupService from './sports/lineupService.js';
import tmdbService from './services/tmdbService.js';
import favoriteTeamService from './sports/favoriteTeamService.js';

// Global API Bridge from Electron Preload
const bridge = window.streamline || {};
const store = new LibraryStore(bridge);
const xtream = new XtreamApi(
  url => bridge.fetchPlaylist(url),
  params => bridge.fetchSeriesDiscovery ? bridge.fetchSeriesDiscovery(params) : null
);

// Global Virtual Scroller instances
let liveScroller = null;
let moviesScroller = null;
let seriesScroller = null;
let favScroller = null;

// Global Player Instance
let player = null;
let currentMovieTitle = '';
let currentSeriesTitle = '';
let hudHideTimer = null;
let searchDebounceTimer = null;
let activeSeriesEpisodes = [];
let currentSportsMatches = [];
let selectedSportsLeague = 'all';

/* ==========================================================================
   INITIALIZATION & BOOT LIFECYCLE
   ========================================================================== */
function init() {
  try { setupDomElements(); } catch (e) { console.error('setupDomElements error:', e); }
  try { setupPlayerManager(); } catch (e) { console.error('setupPlayerManager error:', e); }
  try { setupEventListeners(); } catch (e) { console.error('setupEventListeners error:', e); }
  try { setupKeyboardShortcuts(); } catch (e) { console.error('setupKeyboardShortcuts error:', e); }
  try { setupRemoteControlBridge(); } catch (e) { console.error('setupRemoteControlBridge error:', e); }
  try { applyTranslations(); } catch (e) { console.error('applyTranslations error:', e); }
  bootstrapApp();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function setupDomElements() {
  window.els = {
    boot: document.getElementById('boot'),
    bootStatus: document.getElementById('bootStatus'),
    appShell: document.getElementById('appShell'),
    viewIndicator: document.getElementById('viewIndicator'),
    globalSearchInput: document.getElementById('globalSearchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    appLanguageSelect: document.getElementById('appLanguageSelect'),
    topEngineSelect: document.getElementById('topEngineSelect'),
    quickPlaylistSwitch: document.getElementById('quickPlaylistSwitch'),
    topSyncBtn: document.getElementById('topSyncBtn'),
    topUpdateBtn: document.getElementById('topUpdateBtn'),
    topUpdateBtnText: document.getElementById('topUpdateBtnText'),
    topAddPlaylistBtn: document.getElementById('topAddPlaylistBtn'),
    topRemoteBtn: document.getElementById('topRemoteBtn'),
    topWindowFullscreenBtn: document.getElementById('topWindowFullscreenBtn'),
    topWindowFullscreenIcon: document.getElementById('topWindowFullscreenIcon'),

    // Updater & Settings
    settingsUpdateTitle: document.getElementById('settingsUpdateTitle'),
    settingsUpdateSubtitle: document.getElementById('settingsUpdateSubtitle'),
    settingsCheckUpdateBtn: document.getElementById('settingsCheckUpdateBtn'),
    settingsSimulateUpdateBtn: document.getElementById('settingsSimulateUpdateBtn'),
    settingsCheckUpdateIcon: document.getElementById('settingsCheckUpdateIcon'),
    settingsCheckUpdateText: document.getElementById('settingsCheckUpdateText'),
    settingsInstallUpdateBtn: document.getElementById('settingsInstallUpdateBtn'),
    settingsUpdateProgressRow: document.getElementById('settingsUpdateProgressRow'),
    settingsUpdateProgressBar: document.getElementById('settingsUpdateProgressBar'),
    settingsUpdateProgressText: document.getElementById('settingsUpdateProgressText'),
    settingsUpdateSpeedText: document.getElementById('settingsUpdateSpeedText'),
    updateNoticeModal: document.getElementById('updateNoticeModal'),
    updateModalTitle: document.getElementById('updateModalTitle'),
    updateModalDesc: document.getElementById('updateModalDesc'),
    updateModalNotes: document.getElementById('updateModalNotes'),
    updateModalRestartBtn: document.getElementById('updateModalRestartBtn'),
    updateModalDismissBtn: document.getElementById('updateModalDismissBtn'),

    // Floating Update Notification Banner
    floatingUpdateBanner: document.getElementById('floatingUpdateBanner'),
    floatingUpdateTitle: document.getElementById('floatingUpdateTitle'),
    floatingUpdateDesc: document.getElementById('floatingUpdateDesc'),
    floatingUpdateCloseBtn: document.getElementById('floatingUpdateCloseBtn'),
    floatingUpdateProgressTrack: document.getElementById('floatingUpdateProgressTrack'),
    floatingUpdateProgressBar: document.getElementById('floatingUpdateProgressBar'),
    floatingUpdateInstallBtn: document.getElementById('floatingUpdateInstallBtn'),
    floatingUpdateDetailsBtn: document.getElementById('floatingUpdateDetailsBtn'),

    // Sidebar
    sidebarLiveCount: document.getElementById('sidebarLiveCount'),
    sidebarMoviesCount: document.getElementById('sidebarMoviesCount'),
    sidebarSeriesCount: document.getElementById('sidebarSeriesCount'),
    sidebarActivePlaylist: document.getElementById('sidebarActivePlaylist'),
    sidebarPlaylistMeta: document.getElementById('sidebarPlaylistMeta'),
    sidebarExpiryPill: document.getElementById('sidebarExpiryPill'),
    sidebarQuickEditBtn: document.getElementById('sidebarQuickEditBtn'),

    // Views
    viewHome: document.getElementById('viewHome'),
    viewLive: document.getElementById('viewLive'),
    viewMovies: document.getElementById('viewMovies'),
    viewSeries: document.getElementById('viewSeries'),
    viewSettings: document.getElementById('viewSettings'),

    // Dashboard
    heroLiveTotal: document.getElementById('heroLiveTotal'),
    heroMoviesTotal: document.getElementById('heroMoviesTotal'),
    heroSeriesTotal: document.getElementById('heroSeriesTotal'),
    dashLiveCount: document.getElementById('dashLiveCount'),
    dashMoviesCount: document.getElementById('dashMoviesCount'),
    dashSeriesCount: document.getElementById('dashSeriesCount'),
    heroFavClubContainer: document.getElementById('heroFavClubContainer'),
    homeExpiryPill: document.getElementById('homeExpiryPill'),
    homeSportsSection: document.getElementById('homeSportsSection'),
    sportsLeagueChips: document.getElementById('sportsLeagueChips'),
    homeSportsMatchRow: document.getElementById('homeSportsMatchRow'),
    continueWatchingSection: document.getElementById('continueWatchingSection'),
    continueWatchingRow: document.getElementById('continueWatchingRow'),
    homeSearchSection: document.getElementById('homeSearchSection'),
    homeSearchLiveRow: document.getElementById('homeSearchLiveRow'),
    homeSearchMoviesRow: document.getElementById('homeSearchMoviesRow'),
    homeSearchSeriesRow: document.getElementById('homeSearchSeriesRow'),

    // Sports Match Channels & Lineups Modal
    matchChannelsModal: document.getElementById('matchChannelsModal'),
    matchModalTitle: document.getElementById('matchModalTitle'),
    matchModalLeagueKicker: document.getElementById('matchModalLeagueKicker'),
    matchModalStatusBadge: document.getElementById('matchModalStatusBadge'),
    matchModalTimeText: document.getElementById('matchModalTimeText'),
    matchChannelsGrid: document.getElementById('matchChannelsGrid'),
    closeMatchModalBtn: document.getElementById('closeMatchModalBtn'),
    matchTabBroadcastersBtn: document.getElementById('matchTabBroadcastersBtn'),
    matchTabLineupsBtn: document.getElementById('matchTabLineupsBtn'),
    matchBroadcastersPanel: document.getElementById('matchBroadcastersPanel'),
    matchLineupsPanel: document.getElementById('matchLineupsPanel'),
    matchLineupsContainer: document.getElementById('matchLineupsContainer'),

    // Home Mini-Player Dock
    homeMiniPlayerCard: document.getElementById('homeMiniPlayerCard'),
    homeMiniPlayerMount: document.getElementById('homeMiniPlayerMount'),
    homeMiniStandby: document.getElementById('homeMiniStandby'),
    homeMiniStandbyTitle: document.getElementById('homeStandbyTitle'),
    homeMiniStandbySub: document.getElementById('homeStandbySub'),
    homeMiniLiveBadge: document.getElementById('homeMiniLiveBadge'),
    homeMiniLiveText: document.getElementById('homeMiniLiveText'),
    homeMiniTitle: document.getElementById('homeMiniTitle'),
    homeMiniCategory: document.getElementById('homeMiniCategory'),
    homeMiniPlayPauseBtn: document.getElementById('homeMiniPlayPauseBtn'),
    homeMiniStopBtn: document.getElementById('homeMiniStopBtn'),
    homeMiniExpandBtn: document.getElementById('homeMiniExpandBtn'),

    // Live TV View & Embedded Preview Dock
    liveCategoryCount: document.getElementById('liveCategoryCount'),
    liveCategoryList: document.getElementById('liveCategoryList'),
    liveAllCount: document.getElementById('liveAllCount'),
    liveShowingCount: document.getElementById('liveShowingCount'),
    liveVirtualContainer: document.getElementById('liveVirtualContainer'),
    liveGridBtn: document.getElementById('liveGridBtn'),
    liveListBtn: document.getElementById('liveListBtn'),

    previewVideoContainer: document.getElementById('previewVideoContainer'),
    previewPlaceholder: document.getElementById('previewPlaceholder'),
    previewStatusBadge: document.getElementById('previewStatusBadge'),
    previewTitle: document.getElementById('previewTitle'),
    previewGroup: document.getElementById('previewGroup'),
    previewExpandBtn: document.getElementById('previewExpandBtn'),
    previewSeekBackBtn: document.getElementById('previewSeekBackBtn'),
    previewPlayBtn: document.getElementById('previewPlayBtn'),
    previewSeekFwdBtn: document.getElementById('previewSeekFwdBtn'),
    previewMuteBtn: document.getElementById('previewMuteBtn'),
    previewVolumeSlider: document.getElementById('previewVolumeSlider'),
    liveFavBtn: document.getElementById('liveFavBtn'),
    previewResolution: document.getElementById('previewResolution'),
    previewFps: document.getElementById('previewFps'),
    previewBitrate: document.getElementById('previewBitrate'),
    previewEngine: document.getElementById('previewEngine'),
    liveSidebarLineupDock: document.getElementById('liveSidebarLineupDock'),
    sidebarLineupContent: document.getElementById('sidebarLineupContent'),
    sidebarLineupStatus: document.getElementById('sidebarLineupStatus'),

    // Movies View & Embedded Movie Preview Dock
    moviesCategoryCount: document.getElementById('moviesCategoryCount'),
    moviesCategoryList: document.getElementById('moviesCategoryList'),
    moviesAllCount: document.getElementById('moviesAllCount'),
    moviesShowingCount: document.getElementById('moviesShowingCount'),
    moviesVirtualContainer: document.getElementById('moviesVirtualContainer'),

    moviesPreviewVideoContainer: document.getElementById('moviesPreviewVideoContainer'),
    moviePlaceholder: document.getElementById('moviePlaceholder'),
    movieStatusBadge: document.getElementById('movieStatusBadge'),
    moviePreviewTitle: document.getElementById('moviePreviewTitle'),
    moviePreviewRating: document.getElementById('moviePreviewRating'),
    moviePreviewYear: document.getElementById('moviePreviewYear'),
    moviePreviewGenre: document.getElementById('moviePreviewGenre'),
    moviePreviewPlot: document.getElementById('moviePreviewPlot'),
    movieProgressWrap: document.getElementById('movieProgressWrap'),
    movieProgressFill: document.getElementById('movieProgressFill'),
    movieCurrentTime: document.getElementById('movieCurrentTime'),
    movieTotalTime: document.getElementById('movieTotalTime'),
    movieExpandBtn: document.getElementById('movieExpandBtn'),
    movieSeekBackBtn: document.getElementById('movieSeekBackBtn'),
    moviePlayBtn: document.getElementById('moviePlayBtn'),
    movieSeekFwdBtn: document.getElementById('movieSeekFwdBtn'),
    movieMuteBtn: document.getElementById('movieMuteBtn'),
    movieVolumeSlider: document.getElementById('movieVolumeSlider'),
    movieFavBtn: document.getElementById('movieFavBtn'),

    // Series View & Embedded Series Preview Dock
    seriesCategoryCount: document.getElementById('seriesCategoryCount'),
    seriesCategoryList: document.getElementById('seriesCategoryList'),
    seriesAllCount: document.getElementById('seriesAllCount'),
    seriesShowingCount: document.getElementById('seriesShowingCount'),
    seriesVirtualContainer: document.getElementById('seriesVirtualContainer'),

    seriesPreviewVideoContainer: document.getElementById('seriesPreviewVideoContainer'),
    seriesPlaceholder: document.getElementById('seriesPlaceholder'),
    seriesStatusBadge: document.getElementById('seriesStatusBadge'),
    seriesPreviewTitle: document.getElementById('seriesPreviewTitle'),
    seriesPreviewRating: document.getElementById('seriesPreviewRating'),
    seriesActiveEpLabel: document.getElementById('seriesActiveEpLabel'),
    seriesProgressWrap: document.getElementById('seriesProgressWrap'),
    seriesProgressFill: document.getElementById('seriesProgressFill'),
    seriesCurrentTime: document.getElementById('seriesCurrentTime'),
    seriesTotalTime: document.getElementById('seriesTotalTime'),
    seriesExpandBtn: document.getElementById('seriesExpandBtn'),
    seriesPrevEpBtn: document.getElementById('seriesPrevEpBtn'),
    seriesSeekBackBtn: document.getElementById('seriesSeekBackBtn'),
    seriesPlayBtn: document.getElementById('seriesPlayBtn'),
    seriesSeekFwdBtn: document.getElementById('seriesSeekFwdBtn'),
    seriesNextEpBtn: document.getElementById('seriesNextEpBtn'),
    seriesMuteBtn: document.getElementById('seriesMuteBtn'),
    seriesVolumeSlider: document.getElementById('seriesVolumeSlider'),
    seriesFavBtn: document.getElementById('seriesFavBtn'),
    seriesDockSeasonTabs: document.getElementById('seriesDockSeasonTabs'),
    seriesDockEpisodeList: document.getElementById('seriesDockEpisodeList'),

    // Settings
    settingsPlaylistsList: document.getElementById('settingsPlaylistsList'),
    settingsAddBtn: document.getElementById('settingsAddBtn'),
    settingsRefreshAllBtn: document.getElementById('settingsRefreshAllBtn'),
    settingEngineSelect: document.getElementById('settingEngineSelect'),
    settingLangSelect: document.getElementById('settingLangSelect'),
    settingFavTeamSelect: document.getElementById('settingFavTeamSelect'),
    settingTmdbApiKey: document.getElementById('settingTmdbApiKey'),
    settingToggleTmdbKeyVisBtn: document.getElementById('settingToggleTmdbKeyVisBtn'),
    settingSaveTmdbKeyBtn: document.getElementById('settingSaveTmdbKeyBtn'),
    settingTestTmdbKeyBtn: document.getElementById('settingTestTmdbKeyBtn'),
    settingTmdbStatus: document.getElementById('settingTmdbStatus'),
    settingGpuAccelSelect: document.getElementById('settingGpuAccelSelect'),
    settingGpuStatus: document.getElementById('settingGpuStatus'),
    gpuDiagnosticsStatus: document.getElementById('gpuDiagnosticsStatus'),
    refreshCrashLogsBtn: document.getElementById('refreshCrashLogsBtn'),
    clearCrashLogsBtn: document.getElementById('clearCrashLogsBtn'),
    crashLogsContainer: document.getElementById('crashLogsContainer'),
    crashLogsEmpty: document.getElementById('crashLogsEmpty'),
    crashLogsList: document.getElementById('crashLogsList'),
    clearCacheBtn: document.getElementById('clearCacheBtn'),
    resetAllDataBtn: document.getElementById('resetAllDataBtn'),

    // Sidebar Favorite Team Sports Widget
    sidebarSportsWidget: document.getElementById('sidebarSportsWidget'),
    sidebarSportsLeagueName: document.getElementById('sidebarSportsLeagueName'),
    sidebarSportsTeamBadge: document.getElementById('sidebarSportsTeamBadge'),
    sidebarSportsTabs: document.getElementById('sidebarSportsTabs'),
    sidebarSportsContent: document.getElementById('sidebarSportsContent'),

    // Fullscreen Player & In-Stream HUD
    fullscreenPlayer: document.getElementById('fullscreenPlayer'),
    fullscreenViewport: document.getElementById('fullscreenViewport'),
    nativeVideo: document.getElementById('nativeVideo'),
    artplayerMount: document.getElementById('artplayerMount'),
    playerHud: document.getElementById('playerHud'),
    hudBackBtn: document.getElementById('hudBackBtn'),
    hudStreamTitle: document.getElementById('hudStreamTitle'),
    hudStreamCategory: document.getElementById('hudStreamCategory'),
    hudResolution: document.getElementById('hudResolution'),
    hudFps: document.getElementById('hudFps'),
    hudBitrate: document.getElementById('hudBitrate'),
    hudFavBtn: document.getElementById('hudFavBtn'),
    hudProgressContainer: document.getElementById('hudProgressContainer'),
    hudProgressFill: document.getElementById('hudProgressFill'),
    hudCurrentTime: document.getElementById('hudCurrentTime'),
    hudTotalTime: document.getElementById('hudTotalTime'),
    hudPrevEpBtn: document.getElementById('hudPrevEpBtn'),
    hudSeekBackBtn: document.getElementById('hudSeekBackBtn'),
    hudPlayBtn: document.getElementById('hudPlayBtn'),
    hudSeekFwdBtn: document.getElementById('hudSeekFwdBtn'),
    hudNextEpBtn: document.getElementById('hudNextEpBtn'),
    hudMuteBtn: document.getElementById('hudMuteBtn'),
    hudVolumeSlider: document.getElementById('hudVolumeSlider'),
    hudAudioTrackSelect: document.getElementById('hudAudioTrackSelect'),
    hudAspectSelect: document.getElementById('hudAspectSelect'),
    hudSpeedSelect: document.getElementById('hudSpeedSelect'),
    hudExitFullBtn: document.getElementById('hudExitFullBtn'),

    // Fullscreen Sync Overlay
    syncOverlay: document.getElementById('syncOverlay'),
    syncStep1: document.getElementById('syncStep1'),
    syncStep2: document.getElementById('syncStep2'),
    syncStep3: document.getElementById('syncStep3'),
    syncStep4: document.getElementById('syncStep4'),
    syncStep5: document.getElementById('syncStep5'),
    syncProgressFill: document.getElementById('syncProgressFill'),
    syncStatusMessage: document.getElementById('syncStatusMessage'),
    syncPercentText: document.getElementById('syncPercentText'),
    syncLiveCount: document.getElementById('syncLiveCount'),
    syncMoviesCount: document.getElementById('syncMoviesCount'),
    syncSeriesCount: document.getElementById('syncSeriesCount'),

    // Playlist Modal
    playlistModal: document.getElementById('playlistModal'),
    playlistModalKicker: document.getElementById('playlistModalKicker'),
    playlistModalTitle: document.getElementById('playlistModalTitle'),
    closePlaylistModalBtn: document.getElementById('closePlaylistModalBtn'),
    playlistTypeTabs: document.getElementById('playlistTypeTabs'),
    playlistForm: document.getElementById('playlistForm'),
    inputPlaylistTitle: document.getElementById('inputPlaylistTitle'),
    xtreamFieldsGroup: document.getElementById('xtreamFieldsGroup'),
    inputServerUrl: document.getElementById('inputServerUrl'),
    inputUsername: document.getElementById('inputUsername'),
    inputPassword: document.getElementById('inputPassword'),
    testConnectionBtn: document.getElementById('testConnectionBtn'),
    connectionTestStatus: document.getElementById('connectionTestStatus'),
    urlFieldsGroup: document.getElementById('urlFieldsGroup'),
    inputM3uUrl: document.getElementById('inputM3uUrl'),
    fileFieldsGroup: document.getElementById('fileFieldsGroup'),
    browseFileBtn: document.getElementById('browseFileBtn'),
    selectedFileName: document.getElementById('selectedFileName'),
    editPlaylistId: document.getElementById('editPlaylistId'),
    cancelPlaylistBtn: document.getElementById('cancelPlaylistBtn'),

    // Confirmation & Restart Modals
    confirmModal: document.getElementById('confirmModal'),
    confirmModalIcon: document.getElementById('confirmModalIcon'),
    confirmModalKicker: document.getElementById('confirmModalKicker'),
    confirmModalTitle: document.getElementById('confirmModalTitle'),
    confirmModalMessage: document.getElementById('confirmModalMessage'),
    confirmCancelBtn: document.getElementById('confirmCancelBtn'),
    confirmProceedBtn: document.getElementById('confirmProceedBtn'),
    restartNoticeModal: document.getElementById('restartNoticeModal'),
    restartRelaunchBtn: document.getElementById('restartRelaunchBtn'),
    restartCloseAppBtn: document.getElementById('restartCloseAppBtn'),

    // Shortcuts Cheatsheet Modal
    btnShortcutsHelp: document.getElementById('btnShortcutsHelp'),
    modalShortcuts: document.getElementById('modalShortcuts'),
    closeShortcutsModalBtn: document.getElementById('closeShortcutsModalBtn'),
    btnCloseShortcutsFooter: document.getElementById('btnCloseShortcutsFooter'),

    // Remote QR Modal & Live Status
    topRemoteStatusBadge: document.getElementById('topRemoteStatusBadge'),
    remoteModal: document.getElementById('remoteModal'),
    closeRemoteModalBtn: document.getElementById('closeRemoteModalBtn'),
    remoteQrImage: document.getElementById('remoteQrImage'),
    remoteUrlsContainer: document.getElementById('remoteUrlsContainer'),
    modalRemoteStatusPill: document.getElementById('modalRemoteStatusPill'),
    modalRemoteStatusDot: document.getElementById('modalRemoteStatusDot'),
    modalRemoteStatusText: document.getElementById('modalRemoteStatusText'),

    // TMDB Cast
    movieCastRow: document.getElementById('movieCastRow'),
    seriesCastRow: document.getElementById('seriesCastRow'),

    // Toast
    toast: document.getElementById('toastNotification')
  };
}

function saveWatchHistory() {
  try {
    localStorage.setItem('nidalplayer-watch-history', JSON.stringify(state.watchProgress));
  } catch {}
  bridge.saveWatchProgress?.(state.watchProgress);
}


function setupPlayerManager() {
  player = new PlayerManager({
    video: els.nativeVideo,
    artMount: els.artplayerMount,
    hls: window.Hls,
    artplayer: window.Artplayer,
    bridge,
    onState: payload => handlePlayerStateChange(payload),
    onTelemetry: stats => handlePlayerTelemetry(stats),
    onFullscreenEnter: () => expandFullscreenPlayer(),
    onFullscreenExit: () => closeFullscreenPlayer(),
    onFullscreenToggle: () => {
      if (state.isFullscreen) closeFullscreenPlayer();
      else expandFullscreenPlayer();
    },
    onPrevEpisode: () => playPreviousEpisode(),
    onNextEpisode: () => playNextEpisode(),
    onTimeUpdate: ({ itemId, currentTime, duration }) => {
      const curItem = state.playerItem || state.selectedVod;
      if (curItem && curItem.type !== 'live') {
        updateWatchProgress(itemId, currentTime, duration, {
          name: curItem.episodeTitle || curItem.name,
          logo: curItem.logo || state.selectedVod?.logo || '',
          group: curItem.group || state.selectedVod?.group || 'VOD',
          type: curItem.season ? 'series' : (curItem.type || 'movies'),
          season: curItem.season,
          episodeNumber: curItem.episodeNumber,
          parentSeriesId: curItem.seriesId || state.selectedVod?.id,
          parentSeriesName: state.selectedVod?.name
        });
        saveWatchHistory();
        if (state.destination === 'home') {
          renderContinueWatching();
        }
      }
      updatePlayerTimeDisplay(currentTime, duration);
    }
  });
  window.player = player;
  window.state = state;
  window.playMedia = playMedia;
}

async function bootstrapApp() {
  const bootScreen = document.getElementById('boot');
  const appShell = document.getElementById('appShell');

  if (bridge?.platform === 'win32' || navigator.userAgent.includes('Windows')) {
    document.body.classList.add('platform-win');
  }

  const bootStatusEl = document.getElementById('bootStatus');

  const completeBoot = () => {
    if (bootStatusEl) bootStatusEl.textContent = 'READY // LAUNCHING DASHBOARD';
    if (appShell) appShell.classList.remove('hidden');
    if (bootScreen) {
      bootScreen.classList.add('boot-fadeout');
      setTimeout(() => {
        bootScreen.classList.add('hidden');
      }, 420);
    }
    if (state.playlists && state.playlists.length === 0) {
      try { openPlaylistModal('add'); } catch {}
    }
  };

  try {
    let savedLocalWatch = {};
    try {
      savedLocalWatch = JSON.parse(localStorage.getItem('nidalplayer-watch-history') || '{}');
    } catch {}

    const [lib, ipcWatchHistory] = await Promise.all([
      store.load().catch(() => null),
      bridge.loadWatchProgress?.().catch(() => ({})) || {}
    ]);

    state.watchProgress = { ...ipcWatchHistory, ...savedLocalWatch };
    state.playlists = lib?.playlists || [];
    state.activePlaylistId = lib?.activePlaylistId || state.playlists[0]?.id || '';

    const activeRec = state.playlists.find(p => p.id === state.activePlaylistId);
    if (activeRec) {
      activatePlaylist(activeRec);
    }

    try {
      const diskFavs = await bridge.loadFavorites?.();
      const libFavs = lib?.favorites;
      const localFavs = JSON.parse(localStorage.getItem('nidalplayer-favs') || '[]');
      const mergedList = (Array.isArray(diskFavs) && diskFavs.length) ? diskFavs
        : ((Array.isArray(libFavs) && libFavs.length) ? libFavs : localFavs);
      state.favorites = new Set(mergedList || []);
      localStorage.setItem('nidalplayer-favs', JSON.stringify([...state.favorites]));
    } catch {}

    const curLang = getLang();
    if (els?.appLanguageSelect) els.appLanguageSelect.value = curLang;
    if (els?.settingLangSelect) els.settingLangSelect.value = curLang;

    if (els?.topEngineSelect) els.topEngineSelect.value = state.playerEngine;
    if (els?.settingEngineSelect) els.settingEngineSelect.value = state.playerEngine;
    if (els?.previewEngine) els.previewEngine.textContent = state.playerEngine === 'artplayer' ? 'ArtPlayer' : 'HTML5 / HLS';

    // Initialize GPU acceleration toggle
    try {
      const gpuEnabled = await bridge.getGpuAcceleration?.();
      if (els?.settingGpuAccelSelect) els.settingGpuAccelSelect.value = gpuEnabled ? 'true' : 'false';
    } catch {}

    // Load crash logs
    try { await loadCrashLogs(); } catch {}

    // Favorite team sports widget (standings, scorers, assists)
    try { initSidebarSportsWidget(); } catch (e) { console.error('Sidebar sports init error:', e); }

    try { initVirtualScrollers(); } catch (e) { console.error('VirtualScroller init error:', e); }
    try { refreshAllViews(); } catch (e) { console.error('refreshAllViews error:', e); }
    try { updatePlaylistDropdowns(); } catch (e) { console.error('updatePlaylistDropdowns error:', e); }

    try {
      publishRemoteState();
      setInterval(publishRemoteState, 2000);
    } catch {}
    completeBoot();

  } catch (err) {
    console.error('Bootstrap error:', err);
    completeBoot();
  }
}

/* ==========================================================================
   VIRTUAL SCROLLERS & CARDS
   ========================================================================== */
function initVirtualScrollers() {
  liveScroller = new VirtualScroller({
    container: els.liveVirtualContainer,
    itemHeight: 68,
    minItemWidth: 230,
    gap: 10,
    mode: state.view === 'list' ? 'list' : 'grid',
    renderItem: (item, index) => renderChannelCard(item, index)
  });

  moviesScroller = new VirtualScroller({
    container: els.moviesVirtualContainer,
    itemHeight: 250,
    minItemWidth: 155,
    gap: 14,
    mode: 'grid',
    renderItem: (item, index) => renderMovieCard(item, index)
  });

  seriesScroller = new VirtualScroller({
    container: els.seriesVirtualContainer,
    itemHeight: 250,
    minItemWidth: 155,
    gap: 14,
    mode: 'grid',
    renderItem: (item, index) => renderSeriesCard(item, index)
  });
}

/* ==========================================================================
   EPG FETCHING & RESOLUTION ENGINE
   ========================================================================== */
const epgCache = {};
const pendingEpgRequests = new Map();
let epgQueue = [];
let epgProcessing = false;

function atobSafe(str) {
  if (!str) return 'Live Program';
  try {
    if (typeof str === 'string' && str.length % 4 === 0 && /^[A-Za-z0-9+/=]+$/.test(str)) {
      return decodeURIComponent(escape(atob(str)));
    }
    return str;
  } catch (e) {
    try { return atob(str); } catch (_) { return str; }
  }
}

function formatEpgTime(timeStr) {
  if (!timeStr) return '--:--';
  if (typeof timeStr === 'string' && timeStr.indexOf(' ') !== -1) {
    return timeStr.split(' ')[1].slice(0, 5);
  }
  return String(timeStr).slice(0, 5);
}

async function processEpgQueue() {
  if (epgProcessing || epgQueue.length === 0) return;
  epgProcessing = true;

  const activeRec = state.playlists.find(p => p.id === state.activePlaylistId);
  if (!activeRec) {
    epgProcessing = false;
    return;
  }

  const base = activeRec.provider?.base || activeRec.sourceUrl;
  let username = activeRec.provider?.username;
  let password = activeRec.provider?.password;

  if (!username || !password) {
    try {
      const creds = await store.loadCredentials(activeRec.id);
      if (creds?.username) username = creds.username;
      if (creds?.password) password = creds.password;
    } catch (_) {}
  }

  if (!base || !username || !password) {
    epgProcessing = false;
    return;
  }

  const batch = epgQueue.splice(0, 8);
  await Promise.all(batch.map(async (streamId) => {
    try {
      const url = `${base.replace(/\/+$/, '')}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_short_epg&stream_id=${encodeURIComponent(streamId)}&limit=4`;
      const res = await bridge.fetchPlaylist(url);
      if (res?.ok && res?.text) {
        let data;
        try { data = JSON.parse(res.text); } catch (_) {}
        const listings = data?.epg_listings || [];
        if (Array.isArray(listings) && listings.length > 0) {
          const nowSec = Math.floor(Date.now() / 1000);
          let currentProg = null;
          for (let i = 0; i < listings.length; i++) {
            const prog = listings[i];
            const start = parseInt(prog.start_timestamp || prog.start || 0, 10);
            const stop = parseInt(prog.stop_timestamp || prog.end || 0, 10);
            if (start <= nowSec && nowSec <= stop) {
              currentProg = prog;
              break;
            }
          }
          if (!currentProg && listings.length > 0) currentProg = listings[0];

          if (currentProg) {
            const title = atobSafe(currentProg.title || currentProg.name || 'Live Broadcast');
            const time = `${formatEpgTime(currentProg.start)} - ${formatEpgTime(currentProg.end)}`;
            const epgObj = { title, time, full: `${time} • ${title}` };
            epgCache[streamId] = epgObj;
            const cbs = pendingEpgRequests.get(streamId) || [];
            cbs.forEach(cb => {
              try { cb(epgObj); } catch (_) {}
            });
            pendingEpgRequests.delete(streamId);
          }
        }
      }
    } catch (_) {}
  }));

  epgProcessing = false;
  if (epgQueue.length > 0) {
    setTimeout(processEpgQueue, 50);
  }
}

function requestChannelEpg(streamId, callback) {
  if (!streamId) return;
  if (epgCache[streamId]) {
    if (typeof callback === 'function') callback(epgCache[streamId]);
    return;
  }
  if (!pendingEpgRequests.has(streamId)) {
    pendingEpgRequests.set(streamId, []);
    epgQueue.push(streamId);
  }
  if (typeof callback === 'function') {
    pendingEpgRequests.get(streamId).push(callback);
  }
  processEpgQueue();
}

function renderChannelCard(item, _index) {
  const card = document.createElement('div');
  const isPlaying = state.playerItem?.id === item.id;
  card.className = `channel-card ${isPlaying ? 'playing' : ''}`;

  const isFav = state.favorites.has(item.id);
  const logoContent = item.logo
    ? `<img src="${item.logo}" alt="" class="channel-logo-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"><span class="channel-logo-placeholder" style="display:none;">${item.name.slice(0, 2).toUpperCase()}</span>`
    : `<span class="channel-logo-placeholder">${item.name.slice(0, 2).toUpperCase()}</span>`;

  const cleanStreamId = String(item.metadata?.stream_id || item.id || '').replace(/^(?:live|movie|series)-/, '');
  const cachedEpg = epgCache[cleanStreamId];
  const epgText = cachedEpg ? cachedEpg.title : 'Live Broadcast';

  card.innerHTML = `
    <div class="channel-logo-wrap">${logoContent}</div>
    <div class="channel-info">
      <div class="channel-name" title="${item.name}">${item.name}</div>
      <div class="channel-group-tag channel-epg-tag" data-stream-id="${cleanStreamId}" title="${cachedEpg?.full || epgText}">${epgText}</div>
    </div>
    <button class="channel-fav-btn ${isFav ? 'active' : ''}" title="Favorite">★</button>
  `;

  if (!cachedEpg && cleanStreamId) {
    requestChannelEpg(cleanStreamId, (epg) => {
      const tag = card.querySelector(`.channel-epg-tag[data-stream-id="${cleanStreamId}"]`);
      if (tag && epg?.title) {
        tag.textContent = epg.title;
        tag.title = epg.full || `${epg.time}: ${epg.title}`;
      }
    });
  }

  card.addEventListener('click', e => {
    if (e.target.closest('.channel-fav-btn')) {
      toggleFavorite(item.id);
      saveFavorites();
      e.target.closest('.channel-fav-btn').classList.toggle('active');
      renderSidebarCounts();
      updateAllFavButtons();
      publishRemoteState();
      return;
    }
    playMedia(item, 0, false);
  });

  return card;
}

function renderMovieCard(item, _index) {
  const card = document.createElement('div');
  card.className = 'poster-card';

  const isFav = state.favorites.has(item.id);
  const favBtn = `<button class="card-fav-btn ${isFav ? 'active' : ''}" title="Favorite">★</button>`;
  const progressData = state.watchProgress[item.id];
  const isWatched = progressData?.isWatched || (progressData?.percentage >= 90);

  let statusBadge = '';
  let progressFill = '';
  if (isWatched) {
    statusBadge = `<span class="poster-watched-badge">✓ WATCHED</span>`;
    progressFill = `<div class="poster-watch-progress"><div class="poster-watch-fill" style="width:100%; background:#00e676;"></div></div>`;
  } else if (progressData?.percentage > 0) {
    statusBadge = `<span class="poster-in-progress-badge">${progressData.percentage}%</span>`;
    progressFill = `<div class="poster-watch-progress"><div class="poster-watch-fill" style="width:${progressData.percentage}%;"></div></div>`;
  } else if (item.rating) {
    statusBadge = `<span class="poster-rating">★ ${parseFloat(item.rating).toFixed(1)}</span>`;
  }

  const imgContent = item.logo
    ? `<img src="${item.logo}" alt="" class="poster-img" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><div class="poster-fallback" style="display:none;">${item.name.slice(0, 2).toUpperCase()}</div>`
    : `<div class="poster-fallback">${item.name.slice(0, 2).toUpperCase()}</div>`;

  card.innerHTML = `
    <div class="poster-img-wrap">
      ${imgContent}
      ${favBtn}
      ${statusBadge}
      ${progressFill}
    </div>
    <div class="poster-meta">
      <div class="poster-title" title="${item.name}">${item.name}</div>
      <div class="poster-sub">${isWatched ? '👁 Watched' : (progressData?.percentage > 0 ? `▶ ${progressData.percentage}%` : '')}</div>
    </div>
  `;

  card.addEventListener('click', e => {
    if (e.target.closest('.card-fav-btn')) {
      toggleFavorite(item.id);
      saveFavorites();
      e.target.closest('.card-fav-btn').classList.toggle('active');
      renderSidebarCounts();
      updateAllFavButtons();
      publishRemoteState();
      return;
    }
    selectMovieForPreview(item, isWatched ? 0 : (progressData?.currentTime || 0));
  });

  return card;
}

function renderSeriesCard(item, _index) {
  const card = document.createElement('div');
  card.className = 'poster-card';

  const isFav = state.favorites.has(item.id);
  const favBtn = `<button class="card-fav-btn ${isFav ? 'active' : ''}" title="Favorite">★</button>`;

  const rawSeriesId = String(item.seriesId || item.id).replace(/^series-/, '');
  const seriesProgress = state.watchProgress[item.id] ||
    Object.values(state.watchProgress).find(p => (
      p.parentSeriesId === item.id ||
      p.parentSeriesId === rawSeriesId ||
      p.seriesId === item.id ||
      (p.type === 'series' && (p.parentSeriesName === item.name || p.name?.startsWith(item.name)))
    ));

  const isWatched = seriesProgress?.isWatched || (seriesProgress?.percentage >= 90);

  let statusBadge = '';
  let progressFill = '';
  if (isWatched) {
    statusBadge = `<span class="poster-watched-badge">✓ WATCHED</span>`;
    progressFill = `<div class="poster-watch-progress"><div class="poster-watch-fill" style="width:100%; background:#00e676;"></div></div>`;
  } else if (seriesProgress?.percentage > 0) {
    statusBadge = `<span class="poster-in-progress-badge">${seriesProgress.season ? `S${seriesProgress.season}E${seriesProgress.episodeNumber}` : `${seriesProgress.percentage}%`}</span>`;
    progressFill = `<div class="poster-watch-progress"><div class="poster-watch-fill" style="width:${seriesProgress.percentage}%;"></div></div>`;
  } else if (item.rating) {
    statusBadge = `<span class="poster-rating">★ ${parseFloat(item.rating).toFixed(1)}</span>`;
  }

  const imgContent = item.logo
    ? `<img src="${item.logo}" alt="" class="poster-img" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><div class="poster-fallback" style="display:none;">${item.name.slice(0, 2).toUpperCase()}</div>`
    : `<div class="poster-fallback">${item.name.slice(0, 2).toUpperCase()}</div>`;

  card.innerHTML = `
    <div class="poster-img-wrap">
      ${imgContent}
      ${favBtn}
      ${statusBadge}
      ${progressFill}
    </div>
    <div class="poster-meta">
      <div class="poster-title" title="${item.name}">${item.name}</div>
      <div class="poster-sub">${seriesProgress?.season ? `▶ S${seriesProgress.season}E${seriesProgress.episodeNumber}` : (isWatched ? '👁 Watched' : '')}</div>
    </div>
  `;

  card.addEventListener('click', e => {
    if (e.target.closest('.card-fav-btn')) {
      toggleFavorite(item.id);
      saveFavorites();
      e.target.closest('.card-fav-btn').classList.toggle('active');
      renderSidebarCounts();
      updateAllFavButtons();
      publishRemoteState();
      return;
    }
    selectSeriesForPreview(item);
  });

  return card;
}

/* ==========================================================================
   NAVIGATION & VIEWS
   ========================================================================== */
function navigateTo(dest) {
  state.destination = dest;
  state.category = 'all';
  state.search = '';
  els.globalSearchInput.value = '';
  els.clearSearchBtn.classList.add('hidden');

  document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-dest') === dest);
  });

  const views = {
    home: els.viewHome,
    live: els.viewLive,
    movies: els.viewMovies,
    series: els.viewSeries,
    settings: els.viewSettings
  };

  const indicators = {
    home: '// 01. HOME DASHBOARD',
    live: '// 02. LIVE TELEVISION',
    movies: '// 03. VOD MOVIES',
    series: '// 04. TV SERIES & SHOWS',
    settings: '// 05. PLAYLISTS & CONFIG'
  };

  els.viewIndicator.textContent = indicators[dest] || '// NIDALPLAYER';

  Object.entries(views).forEach(([key, panel]) => {
    if (panel) panel.classList.toggle('hidden', key !== dest);
  });

  // Reparent playing video to the active view dock
  if (!state.isFullscreen && state.playerItem) {
    reparentVideoToPreview();
  }

  if (dest === 'settings' && els.settingTmdbApiKey) {
    els.settingTmdbApiKey.value = tmdbService.getTMDBApiKey();
  }

  refreshActiveViewContent();
  publishRemoteState();
}

function refreshAllViews() {
  renderSidebarCounts();
  renderDashboardHero();
  renderContinueWatching();
  renderSportsMatchCenter();
  renderSettingsPlaylists();
  refreshActiveViewContent();
  updateAllFavButtons();
  publishRemoteState();
}

function refreshActiveViewContent() {
  const dest = state.destination;
  if (dest === 'live') {
    liveScroller?.recalculateDimensions();
    renderCategoryPills('live', els.liveCategoryList, els.liveCategoryCount, els.liveAllCount, state.liveGroups, state.liveItems);
    filterAndRenderItems(state.liveItems, liveScroller, els.liveShowingCount);
  } else if (dest === 'movies') {
    moviesScroller?.recalculateDimensions();
    renderCategoryPills('movies', els.moviesCategoryList, els.moviesCategoryCount, els.moviesAllCount, state.moviesGroups, state.moviesItems);
    filterAndRenderItems(state.moviesItems, moviesScroller, els.moviesShowingCount);
  } else if (dest === 'series') {
    seriesScroller?.recalculateDimensions();
    renderCategoryPills('series', els.seriesCategoryList, els.seriesCategoryCount, els.seriesAllCount, state.seriesGroups, state.seriesItems);
    filterAndRenderItems(state.seriesItems, seriesScroller, els.seriesShowingCount);
  } else if (dest === 'home') {
    renderDashboardHero();
    renderContinueWatching();
    renderSportsMatchCenter();
    renderHomeSearchResults();
  } else if (dest === 'settings') {
    renderSettingsPlaylists();
  }
}

function calculateExpiryInfo(account) {
  const raw = account?.exp_date || account?.expiry || null;
  if (!raw || raw === 'null' || raw === 'Unlimited' || raw === 0) {
    return { text: t('unlimited'), status: 'unlimited', days: 9999 };
  }

  let expTime = 0;
  if (typeof raw === 'number') {
    expTime = raw > 1e11 ? raw : raw * 1000;
  } else if (typeof raw === 'string' && /^\d+$/.test(raw)) {
    const num = parseInt(raw, 10);
    expTime = num > 1e11 ? num : num * 1000;
  } else {
    expTime = new Date(raw).getTime();
  }

  if (isNaN(expTime) || expTime <= 0) {
    return { text: t('unlimited'), status: 'unlimited', days: 9999 };
  }

  const now = Date.now();
  const diffDays = Math.ceil((expTime - now) / (1000 * 60 * 60 * 24));
  const dateStr = new Date(expTime).toLocaleDateString();

  if (diffDays <= 0) {
    return { text: `${t('expired')} (${dateStr})`, status: 'expired', days: diffDays };
  } else if (diffDays <= 30) {
    return { text: `${diffDays} ${t('days_left')} (${dateStr})`, status: 'warning', days: diffDays };
  } else {
    return { text: `${diffDays} ${t('days_left')} (${dateStr})`, status: 'good', days: diffDays };
  }
}

function renderSidebarCounts() {
  els.sidebarLiveCount.textContent = (state.liveItems.length || 0).toLocaleString();
  els.sidebarMoviesCount.textContent = (state.moviesItems.length || 0).toLocaleString();
  els.sidebarSeriesCount.textContent = (state.seriesItems.length || 0).toLocaleString();

  const activeRec = state.playlists.find(p => p.id === state.activePlaylistId);
  if (activeRec) {
    els.sidebarActivePlaylist.textContent = activeRec.name || 'Active Playlist';
    els.sidebarPlaylistMeta.textContent = `${activeRec.type.toUpperCase()} • ${state.items.length.toLocaleString()} items`;

    const expiry = calculateExpiryInfo(activeRec.account);
    els.sidebarExpiryPill.textContent = `${t('expires')}: ${expiry.text}`;
    els.sidebarExpiryPill.className = `expiry-pill ${expiry.status}`;
    els.homeExpiryPill.textContent = expiry.text;
    els.homeExpiryPill.className = `manifesto-pill ${expiry.status}`;
  } else {
    els.sidebarActivePlaylist.textContent = t('no_playlist');
    els.sidebarPlaylistMeta.textContent = 'Add or select a playlist';
    els.sidebarExpiryPill.textContent = `${t('expires')}: —`;
    els.sidebarExpiryPill.className = 'expiry-pill';
  }
}

function renderDashboardHero() {
  const liveCount = (state.liveItems?.length || 0).toLocaleString();
  const moviesCount = (state.moviesItems?.length || 0).toLocaleString();
  const seriesCount = (state.seriesItems?.length || 0).toLocaleString();

  if (els.heroLiveTotal) els.heroLiveTotal.textContent = liveCount;
  if (els.heroMoviesTotal) els.heroMoviesTotal.textContent = moviesCount;
  if (els.heroSeriesTotal) els.heroSeriesTotal.textContent = seriesCount;

  if (els.dashLiveCount) els.dashLiveCount.textContent = liveCount;
  if (els.dashMoviesCount) els.dashMoviesCount.textContent = moviesCount;
  if (els.dashSeriesCount) els.dashSeriesCount.textContent = seriesCount;

  renderHeroFavClub();
}

async function renderHeroFavClub() {
  const container = els.heroFavClubContainer;
  if (!container) return;

  const favTeam = favoriteTeamService.getFavoriteTeam();

  // Sync settings select if present
  if (els.settingFavTeamSelect && els.settingFavTeamSelect.value !== favTeam) {
    els.settingFavTeamSelect.value = favTeam;
  }

  if (!favTeam) {
    container.innerHTML = `
      <div class="fav-club-empty-card">
        <div class="fav-club-empty-top">
          <div class="fav-club-star-icon">⭐</div>
          <div class="fav-club-empty-info">
            <div class="fav-club-kicker">${t('fav_team_kicker') || 'FAVORITE CLUB RADAR //'}</div>
            <h3 class="fav-club-empty-title">${t('fav_team_prompt_title') || 'TRACK YOUR FAVORITE CLUB'}</h3>
            <p class="fav-club-empty-desc">${t('fav_team_prompt_desc') || 'Go to Settings to select your favorite football club (Real Madrid, Arsenal, Barcelona, Man City, PSG, Bayern, etc.). Their upcoming fixtures, kickoff countdown, and stats will be tracked right here!'}</p>
          </div>
        </div>
        <button id="btnGoToSettingsFavTeam" class="fav-club-cta-btn">
          <span>⚙</span> <span>${t('fav_team_btn') || 'SELECT FAVORITE TEAM IN SETTINGS →'}</span>
        </button>
      </div>
    `;

    container.querySelector('#btnGoToSettingsFavTeam')?.addEventListener('click', () => {
      navigateTo('settings');
      setTimeout(() => {
        if (els.settingFavTeamSelect) {
          els.settingFavTeamSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
          els.settingFavTeamSelect.focus();
        }
      }, 150);
    });
    return;
  }

  container.innerHTML = `
    <div class="fav-club-active-card">
      <div class="sports-loading-placeholder" style="padding:24px 12px; justify-content:center; color:var(--text-secondary);">
        <div class="spinner" style="width:20px; height:20px;"></div>
        <span style="font-size:11px; font-weight:700;">Loading ${favTeam} radar & next match…</span>
      </div>
    </div>
  `;

  try {
    const data = await favoriteTeamService.fetchTeamOverview(favTeam);
    if (!data) {
      container.innerHTML = `
        <div class="fav-club-active-card">
          <div class="fav-club-header">
            <div class="fav-club-identity">
              <h2 class="fav-club-name">⚽ ${favTeam}</h2>
            </div>
            <button id="btnChangeFavTeam" class="fav-club-edit-btn">
              <span>✏️</span> <span>${t('change_team') || 'CHANGE'}</span>
            </button>
          </div>
          <div style="font-size:11px; color:var(--text-muted); padding:12px 4px;">
            ${t('no_next_match') || 'No upcoming match data available at this time.'}
          </div>
        </div>
      `;
      wireChangeFavTeamBtn(container);
      return;
    }

    const next = data.nextMatch;
    const formHtml = (data.form || []).map(f => `
      <div class="form-badge ${f.result.toLowerCase()}" title="${f.result === 'W' ? 'Win' : (f.result === 'L' ? 'Loss' : 'Draw')} (${f.score} vs ${f.opponent})">${f.result}</div>
    `).join('');

    container.innerHTML = `
      <div class="fav-club-active-card">
        <div class="fav-club-header">
          <div class="fav-club-identity">
            ${data.badge ? `<img src="${data.badge}" alt="${data.name}" class="fav-club-logo" onerror="this.style.display='none';">` : ''}
            <div>
              <div class="fav-club-kicker">FAVORITE CLUB // ${data.league || 'EUROPE'}</div>
              <h2 class="fav-club-name">${data.name}</h2>
            </div>
          </div>
          <button id="btnChangeFavTeam" class="fav-club-edit-btn">
            <span>✏️</span> <span>${t('change_team') || 'CHANGE'}</span>
          </button>
        </div>

        ${next ? `
          <div class="fav-club-fixture-box">
            <div class="fav-fixture-top">
              <span class="fav-fixture-label">${t('next_match') || 'NEXT FIXTURE'}</span>
              <span class="match-time-badge">${next.round || next.league || 'Matchday'}</span>
            </div>
            <div class="fav-fixture-matchup">
              <div class="fav-fixture-team">
                ${next.homeBadge ? `<img src="${next.homeBadge}" class="fav-team-crest" onerror="this.style.display='none';">` : ''}
                <span>${next.homeTeam}</span>
              </div>
              <div class="fav-fixture-vs">VS</div>
              <div class="fav-fixture-team away">
                <span>${next.awayTeam}</span>
                ${next.awayBadge ? `<img src="${next.awayBadge}" class="fav-team-crest" onerror="this.style.display='none';">` : ''}
              </div>
            </div>
            <div class="fav-fixture-footer">
              <span class="fav-fixture-time">📅 ${next.dateStr || ''} • ${next.timeStr || ''}</span>
              <button class="fav-fixture-watch-btn" id="btnWatchFavMatch">▶ ${t('find_channels') || 'FIND CHANNELS'} →</button>
            </div>
          </div>
        ` : `
          <div style="font-size:11px; color:var(--text-muted); padding:12px 4px;">
            ${t('no_next_match') || 'No upcoming fixtures announced yet'}
          </div>
        `}

        <div class="fav-club-meta-row">
          <div class="fav-form-wrap">
            <span style="color:var(--text-muted); font-size:9px; font-weight:800;">${t('recent_form') || 'RECENT FORM'}:</span>
            <div class="fav-form-pills">
              ${formHtml || '<span style="color:var(--text-muted); font-size:9px;">N/A</span>'}
            </div>
          </div>
          ${data.stadium ? `<div class="fav-stadium-text">🏟️ ${data.stadium}</div>` : ''}
        </div>
      </div>
    `;

    wireChangeFavTeamBtn(container);

    if (next) {
      container.querySelector('#btnWatchFavMatch')?.addEventListener('click', () => {
        openMatchChannelsModal({
          id: next.id,
          homeTeam: next.homeTeam,
          awayTeam: next.awayTeam,
          leagueKey: 'all',
          leagueId: '',
          time: `${next.dateStr} ${next.timeStr}`
        });
      });
    }
  } catch (err) {
    console.warn('[renderHeroFavClub] Error:', err);
  }
}

function wireChangeFavTeamBtn(container) {
  container.querySelector('#btnChangeFavTeam')?.addEventListener('click', () => {
    navigateTo('settings');
    setTimeout(() => {
      if (els.settingFavTeamSelect) {
        els.settingFavTeamSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
        els.settingFavTeamSelect.focus();
      }
    }, 150);
  });
}

/* ==========================================================================
   SIDEBAR FAVORITE TEAM SPORTS WIDGET (STANDINGS, SCORERS, ASSISTS)
   ========================================================================== */
let currentSportsTab = 'table';
let currentSportsData = null;

function initSidebarSportsWidget() {
  if (!els.sidebarSportsTabs) return;

  const tabBtns = els.sidebarSportsTabs.querySelectorAll('.sidebar-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (!tab || tab === currentSportsTab) return;
      currentSportsTab = tab;
      tabBtns.forEach(b => b.classList.toggle('active', b === btn));
      renderSidebarSportsTab(currentSportsTab, currentSportsData);
    });
  });

  // Clicking team badge opens Settings to pick a different club
  els.sidebarSportsTeamBadge?.addEventListener('click', () => {
    navigateTo('settings');
    setTimeout(() => {
      if (els.settingFavTeamSelect) {
        els.settingFavTeamSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
        els.settingFavTeamSelect.focus();
      }
    }, 150);
  });

  updateSidebarSportsWidget();
}

async function updateSidebarSportsWidget(forceRefresh = false) {
  if (!els.sidebarSportsContent) return;

  const favTeam = favoriteTeamService.getFavoriteTeam() || 'Arsenal';

  if (els.sidebarSportsTeamBadge) {
    els.sidebarSportsTeamBadge.textContent = favTeam.toUpperCase();
    els.sidebarSportsTeamBadge.title = `Click to change favorite club (${favTeam})`;
    els.sidebarSportsTeamBadge.style.cursor = 'pointer';
  }

  if (!currentSportsData || forceRefresh) {
    els.sidebarSportsContent.innerHTML = `
      <div class="sidebar-sports-loading">
        <div class="spinner" style="width:12px; height:12px; margin:0 auto 4px auto;"></div>
        LOADING ${favTeam.toUpperCase()} STATS…
      </div>
    `;
  }

  try {
    const data = await favoriteTeamService.fetchLeagueStats(favTeam);
    currentSportsData = data;

    if (els.sidebarSportsLeagueName && data?.leagueName) {
      els.sidebarSportsLeagueName.textContent = data.leagueName.toUpperCase();
    }

    renderSidebarSportsTab(currentSportsTab, data);
  } catch (err) {
    console.warn('[updateSidebarSportsWidget] Error:', err);
    if (!currentSportsData) {
      els.sidebarSportsContent.innerHTML = `
        <div class="sidebar-sports-empty">Live stats temporarily unavailable</div>
      `;
    }
  }
}

function renderSidebarSportsTab(tab, data) {
  if (!els.sidebarSportsContent || !data) return;

  if (tab === 'table') {
    const standings = data.standings || [];
    if (standings.length === 0) {
      els.sidebarSportsContent.innerHTML = `<div class="sidebar-sports-empty">No standings data</div>`;
      return;
    }

    const headerHtml = `
      <div class="sidebar-sports-table-header">
        <span class="sports-col-rank">#</span>
        <span class="sports-col-club">CLUB</span>
        <span class="sports-col-num">P</span>
        <span class="sports-col-num">GD</span>
        <span class="sports-col-pts">PTS</span>
      </div>
    `;

    const rowsHtml = standings.map(row => {
      const favClass = row.isFavTeam ? 'fav-team' : '';
      const gdStr = row.gd > 0 ? `+${row.gd}` : `${row.gd}`;
      const logoTag = row.logo ? `<img class="sports-crest-img" src="${row.logo}" alt="" onerror="this.style.display='none'">` : '';

      return `
        <div class="sidebar-sports-row ${favClass}" title="${row.team} - Rank ${row.rank} (${row.pts} pts)">
          <span class="sports-col-rank">${row.rank}</span>
          <span class="sports-col-club">
            ${logoTag}
            <span class="sports-name-text">${row.short || row.team}</span>
          </span>
          <span class="sports-col-num">${row.played}</span>
          <span class="sports-col-num">${gdStr}</span>
          <span class="sports-col-pts">${row.pts}</span>
        </div>
      `;
    }).join('');

    els.sidebarSportsContent.innerHTML = headerHtml + rowsHtml;

    // Auto-scroll to favorite team row so user always sees their club's position
    const favRow = els.sidebarSportsContent.querySelector('.sidebar-sports-row.fav-team');
    if (favRow) {
      favRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  } else if (tab === 'scorers') {
    const scorers = data.scorers || [];
    if (scorers.length === 0) {
      els.sidebarSportsContent.innerHTML = `<div class="sidebar-sports-empty">No scorers data</div>`;
      return;
    }

    const headerHtml = `
      <div class="sidebar-sports-table-header">
        <span class="sports-col-rank">#</span>
        <span class="sports-col-player">TOP SCORER</span>
        <span class="sports-col-pts">GOALS</span>
      </div>
    `;

    const rowsHtml = scorers.map(p => {
      const logoTag = p.logo ? `<img class="sports-crest-img" src="${p.logo}" alt="" onerror="this.style.display='none'">` : '';

      return `
        <div class="sidebar-sports-row" title="${p.name} (${p.team}) - ${p.value} Goals">
          <span class="sports-col-rank">${p.rank}</span>
          <span class="sports-col-player">
            ${logoTag}
            <span class="sports-name-text"><strong>${p.name}</strong> <span style="color:var(--text-muted); font-size:8px;">${p.team}</span></span>
          </span>
          <span class="sports-col-pts"><span class="sports-stat-badge">${p.value}G</span></span>
        </div>
      `;
    }).join('');

    els.sidebarSportsContent.innerHTML = headerHtml + rowsHtml;
  } else if (tab === 'assists') {
    const assists = data.assists || [];
    if (assists.length === 0) {
      els.sidebarSportsContent.innerHTML = `<div class="sidebar-sports-empty">No assists data</div>`;
      return;
    }

    const headerHtml = `
      <div class="sidebar-sports-table-header">
        <span class="sports-col-rank">#</span>
        <span class="sports-col-player">TOP ASSIST</span>
        <span class="sports-col-pts">ASSISTS</span>
      </div>
    `;

    const rowsHtml = assists.map(p => {
      const logoTag = p.logo ? `<img class="sports-crest-img" src="${p.logo}" alt="" onerror="this.style.display='none'">` : '';

      return `
        <div class="sidebar-sports-row" title="${p.name} (${p.team}) - ${p.value} Assists">
          <span class="sports-col-rank">${p.rank}</span>
          <span class="sports-col-player">
            ${logoTag}
            <span class="sports-name-text"><strong>${p.name}</strong> <span style="color:var(--text-muted); font-size:8px;">${p.team}</span></span>
          </span>
          <span class="sports-col-pts"><span class="sports-stat-badge assist">${p.value}A</span></span>
        </div>
      `;
    }).join('');

    els.sidebarSportsContent.innerHTML = headerHtml + rowsHtml;
  }
}

async function renderSportsMatchCenter(forceRefresh = false) {
  const row = els.homeSportsMatchRow;
  if (!row) return;

  if (forceRefresh || currentSportsMatches.length === 0) {
    row.innerHTML = `
      <div class="sports-loading-placeholder">
        <div class="spinner"></div>
        <span>${t('upcoming_and_live') || 'Loading live match fixtures…'}</span>
      </div>
    `;
    currentSportsMatches = await matchCenter.fetchTopLeaguesMatches(forceRefresh);
  }

  const leagueFilter = selectedSportsLeague;
  const filtered = leagueFilter === 'all'
    ? currentSportsMatches
    : currentSportsMatches.filter(m => m.leagueKey === leagueFilter);

  if (filtered.length === 0) {
    const noGamesText = t('no_games_today') || 'NO GAMES SCHEDULED FOR TODAY';
    row.innerHTML = `
      <div class="sports-loading-placeholder" style="color:var(--text-secondary); width:100%; justify-content:center; padding:32px 20px; background:var(--bg-surface); border:1px dashed var(--border-subtle); border-radius:var(--radius-md);">
        <span style="font-size:18px; margin-right:8px;">⚽</span>
        <span style="font-weight:700; letter-spacing:0.5px;">${noGamesText}</span>
      </div>
    `;
    return;
  }

  row.innerHTML = '';
  filtered.forEach(match => {
    const card = document.createElement('div');
    card.className = 'sports-match-card';
    card.setAttribute('data-match-id', match.id);

    const timeLabel = matchCenter.formatMatchTime(match, t);
    const statusBadgeClass = match.isLive ? 'match-status-badge live' : (match.isFinished ? 'match-status-badge finished' : 'match-status-badge');
    const statusText = match.isLive
      ? (match.score ? `🔴 ${t('live_now') || 'LIVE'} • ${match.score}` : `🔴 ${t('live_now') || 'LIVE NOW'}`)
      : (match.isFinished ? (match.score ? `${t('full_time') || 'FT'} • ${match.score}` : (t('full_time') || 'FT')) : (match.round || t('upcoming') || 'UPCOMING'));

    const homeLogoHtml = match.homeBadge
      ? `<img src="${match.homeBadge}" alt="${match.homeTeam}" class="match-team-logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><div class="channel-fallback" style="display:none; width:28px; height:28px; font-size:10px;">${match.homeTeam.slice(0, 2).toUpperCase()}</div>`
      : `<div class="channel-fallback" style="width:28px; height:28px; font-size:10px;">${match.homeTeam.slice(0, 2).toUpperCase()}</div>`;

    const awayLogoHtml = match.awayBadge
      ? `<img src="${match.awayBadge}" alt="${match.awayTeam}" class="match-team-logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><div class="channel-fallback" style="display:none; width:28px; height:28px; font-size:10px;">${match.awayTeam.slice(0, 2).toUpperCase()}</div>`
      : `<div class="channel-fallback" style="width:28px; height:28px; font-size:10px;">${match.awayTeam.slice(0, 2).toUpperCase()}</div>`;

    card.innerHTML = `
      <div class="match-card-top">
        <span class="match-league-badge">${match.leagueIcon} ${match.leagueName}</span>
        <span class="${statusBadgeClass}">${statusText}</span>
      </div>
      <div class="match-teams-area">
        <div class="match-team-col">
          ${homeLogoHtml}
          <span class="match-team-name">${match.homeTeam}</span>
        </div>
        <div class="match-vs-divider">${match.score ? match.score : 'VS'}</div>
        <div class="match-team-col">
          ${awayLogoHtml}
          <span class="match-team-name">${match.awayTeam}</span>
        </div>
      </div>
      <div class="match-card-bottom">
        <span class="match-time-text">${timeLabel}</span>
        <span class="match-action-hint">▶ ${t('find_channels') || 'FIND CHANNELS'} →</span>
      </div>
    `;

    card.addEventListener('click', () => openMatchChannelsModal(match));
    row.appendChild(card);
  });
}

function openMatchChannelsModal(match) {
  if (!match || !els.matchChannelsModal) return;

  els.matchModalLeagueKicker.textContent = `${match.leagueIcon} ${match.leagueName.toUpperCase()} // ${t('match_broadcasters') || 'MATCH BROADCASTERS'}`;
  els.matchModalTitle.textContent = `${match.homeTeam.toUpperCase()} vs ${match.awayTeam.toUpperCase()}`;
  els.matchModalStatusBadge.textContent = match.isLive
    ? (match.score ? `🔴 ${t('live_now') || 'LIVE NOW'} • ${match.score}` : `🔴 ${t('live_now') || 'LIVE NOW'}`)
    : (match.isFinished ? (match.score ? `${t('full_time') || 'FULL TIME'} (${match.score})` : (t('full_time') || 'FULL TIME')) : (match.round || t('upcoming_fixture') || 'UPCOMING FIXTURE'));
  els.matchModalStatusBadge.className = match.isLive ? 'match-modal-badge live' : 'match-modal-badge';
  els.matchModalTimeText.textContent = matchCenter.formatMatchTime(match, t);

  // Reset tab active state to Broadcasters
  if (els.matchTabBroadcastersBtn && els.matchTabLineupsBtn) {
    els.matchTabBroadcastersBtn.classList.add('active');
    els.matchTabLineupsBtn.classList.remove('active');
    els.matchBroadcastersPanel?.classList.remove('hidden');
    els.matchLineupsPanel?.classList.add('hidden');
  }

  const matched = matchCenter.findChannelsForMatch(match, state.liveItems || state.items || [], epgCache);
  const grid = els.matchChannelsGrid;

  if (matched.length === 0) {
    grid.innerHTML = `
      <div class="modal-channel-empty">
        <div style="font-size:32px; margin-bottom:10px;">📺</div>
        <p>${t('no_channels_found') || 'No dedicated sports channels found in active playlist.'}</p>
        <p style="font-size:11px; color:var(--text-muted); margin-top:6px;">Try switching to a sports category in Live TV or checking your playlist channels.</p>
      </div>
    `;
  } else {
    grid.innerHTML = '';
    matched.slice(0, 36).forEach(({ channel, matchReason, epg }) => {
      const card = document.createElement('div');
      card.className = 'modal-channel-card';

      const logoContent = channel.logo
        ? `<img src="${channel.logo}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"><span style="display:none;">${channel.name.slice(0, 2).toUpperCase()}</span>`
        : `<span>${channel.name.slice(0, 2).toUpperCase()}</span>`;

      const epgSubtitle = epg?.full || epg?.title || (channel.group || 'Live Sports');

      card.innerHTML = `
        <div class="modal-channel-left">
          <div class="modal-channel-logo">${logoContent}</div>
          <div class="modal-channel-info">
            <strong>${channel.name}</strong>
            <div class="modal-channel-meta">
              <span class="modal-channel-group">${channel.group || 'SPORTS'}</span>
              <span class="modal-channel-match-badge">• ${matchReason}</span>
            </div>
            <div class="modal-channel-epg" title="${epgSubtitle}">${epgSubtitle}</div>
          </div>
        </div>
        <button class="modal-channel-play-btn" data-i18n="watch_match">▶ WATCH</button>
      `;

      card.addEventListener('click', () => {
        els.matchChannelsModal.classList.add('hidden');
        playMedia(channel, 0, false);
      });

      grid.appendChild(card);
    });
  }

  // Load tactical lineup in background
  loadMatchLineup(match);

  els.matchChannelsModal.classList.remove('hidden');
}

async function loadMatchLineup(match) {
  const container = els.matchLineupsContainer;
  if (!container) return;

  container.innerHTML = `
    <div class="sports-loading-placeholder" style="padding:40px 20px; justify-content:center; color:var(--text-secondary);">
      <div class="spinner"></div>
      <span style="font-weight:700; letter-spacing:0.5px;">Loading official match lineup & tactical formation…</span>
    </div>
  `;

  try {
    const data = await lineupService.fetchLineup(match);
    if (!data || !data.available || !data.teams || data.teams.length === 0) {
      container.innerHTML = `
        <div class="modal-channel-empty" style="padding:40px 20px;">
          <div style="font-size:36px; margin-bottom:12px;">📋</div>
          <p style="font-size:14px; font-weight:700; color:var(--text-pure);">${data?.message || t('lineups_unavailable') || 'Lineups will be announced ~1 hour before kickoff'}</p>
          <p style="font-size:12px; color:var(--text-muted); margin-top:6px;">Check back closer to match time for starting XI and tactical formations.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="lineups-teams-grid">
        ${data.teams.map(team => {
          const startersHtml = team.starters.map(p => {
            const posLower = (p.position || '').toLowerCase();
            let posClass = 'lineup-pos-tag';
            if (posLower.includes('g') || posLower.includes('gk')) posClass += ' gk';
            else if (posLower.includes('d') || posLower.includes('b') || posLower.includes('cb') || posLower.includes('lb') || posLower.includes('rb')) posClass += ' def';
            else if (posLower.includes('m') || posLower.includes('cm') || posLower.includes('dm') || posLower.includes('am')) posClass += ' mid';
            else if (posLower.includes('f') || posLower.includes('w') || posLower.includes('s') || posLower.includes('a') || posLower.includes('st')) posClass += ' fwd';

            return `
              <div class="lineup-player-row">
                <div class="lineup-player-left">
                  <span class="lineup-jersey-pill">${p.jersey || '•'}</span>
                  <span class="lineup-player-name">${p.name}</span>
                </div>
                <span class="${posClass}">${p.position || 'POS'}</span>
              </div>
            `;
          }).join('');

          const subsHtml = team.subs.map(p => `
            <div class="lineup-sub-chip">
              <span class="lineup-sub-jersey">#${p.jersey || '•'}</span>
              <span>${p.name}</span>
            </div>
          `).join('');

          return `
            <div class="lineup-team-card">
              <div class="lineup-team-header">
                <div class="lineup-team-title-wrap">
                  ${team.logo ? `<img src="${team.logo}" alt="${team.teamName}" class="lineup-team-logo" onerror="this.style.display='none';">` : ''}
                  <span class="lineup-team-name">${team.teamName}</span>
                </div>
                <span class="lineup-formation-badge">${team.formation ? `${t('formation') || 'Formation'}: ${team.formation}` : '4-3-3'}</span>
              </div>
              <div class="lineup-section-heading">${t('starters') || 'STARTING XI'} (${team.starters.length})</div>
              <div class="lineup-players-list">
                ${startersHtml || '<div style="font-size:11px; color:var(--text-muted);">Lineup pending confirmation</div>'}
              </div>
              ${team.subs.length > 0 ? `
                <div class="lineup-section-heading" style="margin-top:12px;">${t('substitutes') || 'SUBSTITUTES BENCH'} (${team.subs.length})</div>
                <div class="lineup-subs-chips">
                  ${subsHtml}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch (err) {
    console.error('Error loading lineup:', err);
    container.innerHTML = `
      <div class="modal-channel-empty">
        <div style="font-size:32px; margin-bottom:10px;">⚠️</div>
        <p>Could not load lineup for this match.</p>
      </div>
    `;
  }
}

function renderHomeSearchResults() {
  const section = els.homeSearchSection;
  if (!section) return;

  const query = String(state.search || '').trim().toLowerCase();
  if (!query) {
    section.classList.add('hidden');
    return;
  }

  const matches = items => (items || []).filter(item => (
    `${item.name || ''} ${item.group || ''} ${item.language || ''} ${item.country || ''}`
  ).toLowerCase().includes(query));

  const sections = [
    { items: matches(state.liveItems), row: els.homeSearchLiveRow, label: 'Live TV' },
    { items: matches(state.moviesItems), row: els.homeSearchMoviesRow, label: 'Movies' },
    { items: matches(state.seriesItems), row: els.homeSearchSeriesRow, label: 'Series' }
  ];

  section.classList.remove('hidden');
  sections.forEach(({ items, row, label }) => {
    if (!row) return;
    const wrapper = row.closest('.home-search-group');
    if (wrapper) wrapper.classList.toggle('hidden', items.length === 0);
    row.innerHTML = '';
    items.slice(0, 24).forEach((item, index) => {
      const card = item.type === 'live' ? renderChannelCard(item, index)
        : item.type === 'series' ? renderSeriesCard(item, index)
          : renderMovieCard(item, index);
      row.appendChild(card);
    });
    const count = wrapper?.querySelector('.home-search-count');
    if (count) count.textContent = `${items.length.toLocaleString()} found`;
  });

  const hasResults = sections.some(sectionData => sectionData.items.length > 0);
  const empty = section.querySelector('.home-search-empty');
  if (empty) empty.classList.toggle('hidden', hasResults);
}

function renderContinueWatching() {
  const entries = Object.entries(state.watchProgress)
    .filter(([_, d]) => d && (d.currentTime > 5 || d.percentage > 2 || d.isWatched))
    .sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0))
    .slice(0, 12);

  if (entries.length === 0) {
    els.continueWatchingSection?.classList.add('hidden');
    return;
  }

  els.continueWatchingSection?.classList.remove('hidden');
  els.continueWatchingRow.innerHTML = '';

  entries.forEach(([itemId, data]) => {
    let item = state.items.find(i => i.id === itemId);
    if (!item) {
      item = {
        id: itemId,
        name: data.name || 'Untitled Stream',
        logo: data.logo || '',
        group: data.group || 'VOD',
        type: data.type || (data.season ? 'series' : 'movies'),
        url: data.url,
        streamId: data.streamId,
        seriesId: data.parentSeriesId
      };
    }

    const isWatched = data.isWatched || data.percentage >= 90;
    const card = document.createElement('div');
    card.className = 'poster-card';
    card.style.width = '160px';
    card.style.minWidth = '160px';
    card.style.height = '245px';
    card.style.flexShrink = '0';

    const posterSrc = data.logo || item.logo;
    const imgTag = posterSrc
      ? `<img src="${posterSrc}" alt="" class="poster-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><div class="poster-fallback" style="display:none;">${item.name.slice(0, 2).toUpperCase()}</div>`
      : `<div class="poster-fallback">${item.name.slice(0, 2).toUpperCase()}</div>`;

    const badge = isWatched
      ? `<span class="poster-watched-badge">✓ WATCHED</span>`
      : `<span class="poster-in-progress-badge">${data.percentage}%</span>`;

    const subText = data.season
      ? `S${data.season} E${data.episodeNumber} • ${isWatched ? 'Watched' : `Resume ${data.percentage}%`}`
      : `${isWatched ? 'Watched' : `Resume ${data.percentage}%`}`;

    card.innerHTML = `
      <div class="poster-img-wrap">
        ${imgTag}
        <button class="card-remove-btn" title="Remove from Continue Watching">✕</button>
        ${badge}
        <div class="poster-watch-progress">
          <div class="poster-watch-fill" style="width: ${data.percentage}%; background:${isWatched ? '#00e676' : 'var(--accent-orange)'}"></div>
        </div>
      </div>
      <div class="poster-meta">
        <div class="poster-title" title="${item.name}">${item.name}</div>
        <div class="poster-sub">${subText}</div>
      </div>
    `;

    card.querySelector('.card-remove-btn').addEventListener('click', e => {
      e.stopPropagation();
      delete state.watchProgress[itemId];
      saveWatchHistory();
      renderContinueWatching();
      refreshActiveViewContent();
      showToast('Removed from Continue Watching');
    });

    card.addEventListener('click', () => {
      if (item.type === 'series' || data.type === 'series') {
        const parentSeries = state.items.find(i => i.id === data.parentSeriesId) || item;
        selectSeriesForPreview(parentSeries);
      } else {
        selectMovieForPreview(item, isWatched ? 0 : (data.currentTime || 0));
      }
    });

    els.continueWatchingRow.appendChild(card);
  });
}

function getWatchProgressForSort(item, type) {
  if (!item) return null;
  const wp = state.watchProgress || {};
  const itemId = String(item.id || '');
  const cleanId = itemId.replace(/^(?:series|movie|live)-/, '');
  const seriesId = item.seriesId ? String(item.seriesId).replace(/^series-/, '') : '';

  if (wp[itemId]) return wp[itemId];
  if (cleanId && wp[cleanId]) return wp[cleanId];
  if (seriesId && wp[seriesId]) return wp[seriesId];
  if (seriesId && wp['series-' + seriesId]) return wp['series-' + seriesId];

  if (type === 'series') {
    const vals = Object.values(wp);
    for (let i = 0; i < vals.length; i++) {
      const p = vals[i];
      if (!p) continue;
      const pSeriesId = String(p.seriesId || p.parentSeriesId || '').replace(/^series-/, '');
      if (pSeriesId && (pSeriesId === cleanId || (seriesId && pSeriesId === seriesId))) {
        return p;
      }
    }
  }
  return null;
}

function isItemWatchedOrProgress(item, type) {
  if (!item) return false;
  if (type === 'live') {
    return (state.recent && state.recent.includes(item.id)) || !!state.watchProgress[item.id];
  }
  const prog = getWatchProgressForSort(item, type);
  if (!prog) return false;
  if (prog.isWatched) return true;
  if (Number(prog.percentage || 0) >= 85) return true;
  if (Number(prog.currentTime || 0) >= 15 && Number(prog.percentage || 0) > 0) return true;
  if (Number(prog.updatedAt || prog.lastWatched || 0) > 0) return true;
  return false;
}

function renderCategoryPills(type, listEl, countEl, allCountEl, groupsMap, itemsList) {
  if (!listEl || !countEl || !allCountEl) return;
  countEl.textContent = (groupsMap?.size || 0).toLocaleString();
  allCountEl.textContent = (itemsList?.length || 0).toLocaleString();

  listEl.innerHTML = '';

  const allLabel = type === 'live' ? t('all_channels') : type === 'movies' ? t('all_movies') : t('all_series');
  const allBtn = document.createElement('button');
  allBtn.className = `cat-pill ${state.category === 'all' ? 'active' : ''}`;
  allBtn.setAttribute('data-category', 'all');
  allBtn.innerHTML = `<span>${allLabel}</span><b>${(itemsList?.length || 0).toLocaleString()}</b>`;
  allBtn.addEventListener('click', () => {
    state.category = 'all';
    listEl.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
    allBtn.classList.add('active');
    refreshActiveViewContent();
  });
  listEl.appendChild(allBtn);

  // Add a visual divider before the special category pills
  const divider = document.createElement('div');
  divider.style.cssText = 'height:1px; background:var(--border-subtle); margin:4px 2px; flex-shrink:0;';
  listEl.appendChild(divider);

  // 1. Dedicated Section WATCHED Category Pill (ABOVE FAVORITES)
  const watchedCount = (itemsList || []).filter(i => isItemWatchedOrProgress(i, type)).length;
  const watchedBtn = document.createElement('button');
  watchedBtn.className = `cat-pill pill-watched ${state.category === '__watched__' ? 'active' : ''}`;
  watchedBtn.setAttribute('data-category', '__watched__');
  watchedBtn.innerHTML = `<span>👁 ${t('nav_watched') || 'WATCHED'}</span><b>${watchedCount.toLocaleString()}</b>`;
  watchedBtn.addEventListener('click', () => {
    state.category = '__watched__';
    listEl.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
    watchedBtn.classList.add('active');
    refreshActiveViewContent();
  });
  listEl.appendChild(watchedBtn);

  // 2. Dedicated Section FAVORITES Category Pill
  const sectionFavCount = (itemsList || []).filter(i => state.favorites.has(i.id)).length;
  const favBtn = document.createElement('button');
  favBtn.className = `cat-pill pill-favorites ${state.category === '__favorites__' ? 'active' : ''}`;
  favBtn.setAttribute('data-category', '__favorites__');
  favBtn.innerHTML = `<span>★ ${t('nav_favorites') || 'FAVORITES'}</span><b>${sectionFavCount.toLocaleString()}</b>`;
  favBtn.addEventListener('click', () => {
    state.category = '__favorites__';
    listEl.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
    favBtn.classList.add('active');
    refreshActiveViewContent();
  });
  listEl.appendChild(favBtn);

  // Add a visual divider after special pills before regular categories
  const divider2 = document.createElement('div');
  divider2.style.cssText = 'height:1px; background:var(--border-subtle); margin:4px 2px; flex-shrink:0;';
  listEl.appendChild(divider2);

  // 3. Exact provider-ordered category sequence
  const providerOrderedGroups = [...(groupsMap?.entries() || [])];
  providerOrderedGroups.forEach(([groupName, count]) => {
    const btn = document.createElement('button');
    btn.className = `cat-pill ${state.category === groupName ? 'active' : ''}`;
    btn.setAttribute('data-category', groupName);
    btn.innerHTML = `<span>${groupName}</span><b>${count.toLocaleString()}</b>`;
    btn.addEventListener('click', () => {
      state.category = groupName;
      listEl.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      refreshActiveViewContent();
    });
    listEl.appendChild(btn);
  });
}

function selectCategory(category, type) {
  state.category = category;
  const listEl = type === 'live' ? els.liveCategoryList : type === 'movies' ? els.moviesCategoryList : els.seriesCategoryList;
  if (listEl) {
    listEl.querySelectorAll('.cat-pill').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-category') === category);
    });
  }
  refreshActiveViewContent();
}

function filterAndRenderItems(sourceItems, scroller, countEl) {
  if (!scroller) return;

  const curType = state.destination;
  let filtered = sourceItems || [];

  // A search always covers the complete active page, regardless of the
  // category/favorites filter selected in the sidebar.
  if (!state.search && state.category === '__watched__') {
    filtered = filtered.filter(i => isItemWatchedOrProgress(i, curType));
  } else if (!state.search && state.category === '__favorites__') {
    filtered = filtered.filter(i => state.favorites.has(i.id));
  } else if (!state.search && state.category && state.category !== 'all') {
    filtered = filtered.filter(i => (i.group || 'Other') === state.category);
  }

  if (state.search) {
    const q = state.search.toLowerCase();
    filtered = filtered.filter(i =>
      (i.name && i.name.toLowerCase().includes(q)) ||
      (i.group && i.group.toLowerCase().includes(q))
    );
  }

  // Strict deduplication
  const seenIds = new Set();
  filtered = filtered.filter(i => {
    if (!i || !i.id) return false;
    const k = String(i.id);
    if (seenIds.has(k)) return false;
    seenIds.add(k);
    return true;
  });

  // Move watched to the TOP for all pages
  filtered.sort((a, b) => {
    const watchedA = isItemWatchedOrProgress(a, curType);
    const watchedB = isItemWatchedOrProgress(b, curType);

    if (watchedA && !watchedB) return -1;
    if (!watchedA && watchedB) return 1;

    if (watchedA && watchedB) {
      const pA = getWatchProgressForSort(a, curType);
      const pB = getWatchProgressForSort(b, curType);
      const tA = (pA && (pA.updatedAt || pA.lastWatched || pA.currentTime)) || 0;
      const tB = (pB && (pB.updatedAt || pB.lastWatched || pB.currentTime)) || 0;
      if (tA !== tB) return tB - tA;
    }

    return (a.providerOrder || 0) - (b.providerOrder || 0);
  });

  if (countEl) countEl.textContent = `${t('showing')} ${filtered.length.toLocaleString()} ${t('items')}`;
  scroller.setItems(filtered);
}

const renderFilteredItems = filterAndRenderItems;

function renderCastAvatars(container, cast) {
  if (!container || !cast || cast.length === 0) return;
  container.innerHTML = cast.map(actor => `
    <div class="cast-card">
      <img src="${actor.profile || 'assets/logo.png'}" class="cast-avatar" alt="${actor.name}" onerror="this.src='assets/logo.png'">
      <span class="cast-name" title="${actor.name}">${actor.name}</span>
      <span class="cast-character" title="${actor.character}">${actor.character || ''}</span>
    </div>
  `).join('');
  container.classList.remove('hidden');
}

/* ==========================================================================
   MOVIES & SERIES RIGHT DOCK PREVIEWS
   ========================================================================== */
function selectMovieForPreview(movie, startTime = 0) {
  state.selectedVod = movie;
  currentMovieTitle = movie.name;
  els.moviePlaceholder.classList.add('hidden');
  els.moviePreviewTitle.textContent = movie.name;
  els.moviePreviewRating.textContent = movie.rating ? `★ ${parseFloat(movie.rating).toFixed(1)}` : '★ N/A';
  els.moviePreviewYear.textContent = movie.releaseDate || movie.metadata?.year || '2024';
  els.moviePreviewGenre.textContent = movie.metadata?.genre || movie.group || 'Cinema';
  els.moviePreviewPlot.textContent = movie.metadata?.plot || movie.metadata?.description || 'No detailed plot description available.';

  // Reset cast
  if (els.movieCastRow) {
    els.movieCastRow.innerHTML = '';
    els.movieCastRow.classList.add('hidden');
  }

  // TMDB Metadata Enrichment
  tmdbService.fetchTMDBDetails(movie.name, 'movie', movie.releaseDate || movie.metadata?.year).then(details => {
    if (!details || currentMovieTitle !== movie.name) return;
    if (details.rating) els.moviePreviewRating.textContent = `★ ${details.rating}`;
    if (details.overview && (!movie.metadata?.plot || movie.metadata.plot.length < 25)) {
      els.moviePreviewPlot.textContent = details.overview;
    }
    if (details.cast && details.cast.length > 0 && els.movieCastRow) {
      renderCastAvatars(els.movieCastRow, details.cast);
    }
  }).catch(() => {});

  updateAllFavButtons();
  playMedia(movie, startTime, false);
}

async function selectSeriesForPreview(series) {
  state.selectedVod = series;
  currentSeriesTitle = series.name;
  els.seriesPlaceholder.classList.add('hidden');
  els.seriesPreviewTitle.textContent = series.name;
  els.seriesPreviewRating.textContent = series.rating ? `★ ${parseFloat(series.rating).toFixed(1)}` : '★ N/A';
  els.seriesActiveEpLabel.textContent = 'Loading seasons…';

  // Reset cast
  if (els.seriesCastRow) {
    els.seriesCastRow.innerHTML = '';
    els.seriesCastRow.classList.add('hidden');
  }

  // TMDB Metadata Enrichment
  tmdbService.fetchTMDBDetails(series.name, 'series', series.releaseDate || series.metadata?.year).then(details => {
    if (!details || currentSeriesTitle !== series.name) return;
    if (details.rating) els.seriesPreviewRating.textContent = `★ ${details.rating}`;
    if (details.cast && details.cast.length > 0 && els.seriesCastRow) {
      renderCastAvatars(els.seriesCastRow, details.cast);
    }
  }).catch(() => {});

  updateAllFavButtons();
  els.seriesDockSeasonTabs.innerHTML = '';
  els.seriesDockEpisodeList.innerHTML = '<p style="padding:12px; color:#888; font-size:11px;">Fetching seasons & episodes…</p>';

  const activeRec = state.playlists.find(p => p.id === state.activePlaylistId);
  if (activeRec?.type === 'xtream') {
    const creds = (await store.loadCredentials(activeRec.id)) || activeRec.provider || {};
    const username = creds.username || activeRec.provider?.username;
    const password = creds.password || activeRec.provider?.password;
    const base = activeRec.provider?.base || activeRec.sourceUrl;

    if (username && password && base) {
      try {
        const rawSeriesId = String(series.seriesId || series.metadata?.series_id || series.id || '').replace(/^series-/, '');
        const seriesData = await xtream.seriesInfo(base, username, password, rawSeriesId);
        if (seriesData && (seriesData.seasons?.length > 0 || seriesData.episodes?.length > 0)) {
          renderSeriesDockSeasons(seriesData);
        } else {
          const seriesTitle = (series.seriesName || series.name || '').toLowerCase();
          const relatedEps = state.items.filter(item => {
            if (item.id === series.id) return false;
            const itemName = (item.name || '').toLowerCase();
            return (item.seriesId && item.seriesId === series.id) ||
                   (item.group && item.group === series.group && itemName.includes(seriesTitle));
          });
          if (relatedEps.length > 0) {
            renderSeriesDockSeasons({
              seasons: [{ season: 1, count: relatedEps.length }],
              episodes: relatedEps.map((ep, idx) => ({ ...ep, season: 1, episodeNumber: idx + 1 }))
            });
          } else {
            renderSeriesDockSeasons(seriesData);
          }
        }
      } catch (err) {
        console.error('Failed to load series info:', err);
        els.seriesDockEpisodeList.innerHTML = `<p style="color:#ff3d00; padding:12px; font-size:11px;">Failed to load seasons: ${err.message}</p>`;
      }
    } else {
      els.seriesDockEpisodeList.innerHTML = '<p style="color:#ffb703; padding:12px; font-size:11px;">Missing login credentials. Please edit playlist in Settings.</p>';
    }
  } else {
    // M3U / URL playlist series support
    const seriesTitle = (series.seriesName || series.name || '').toLowerCase();
    const relatedEps = state.items.filter(item => {
      if (item.id === series.id) return false;
      const itemName = (item.name || '').toLowerCase();
      return (item.seriesId && item.seriesId === series.id) ||
             (item.group && item.group === series.group && itemName.includes(seriesTitle));
    });

    if (relatedEps.length > 0) {
      renderSeriesDockSeasons({
        seasons: [{ season: 1, count: relatedEps.length }],
        episodes: relatedEps.map((ep, idx) => ({
          ...ep,
          season: 1,
          episodeNumber: idx + 1
        }))
      });
    } else {
      renderSeriesDockSeasons({
        seasons: [{ season: 1, count: 1 }],
        episodes: [{ ...series, season: 1, episodeNumber: 1 }]
      });
    }
  }
}

function renderSeriesDockSeasons(seriesData) {
  els.seriesDockSeasonTabs.innerHTML = '';
  let seasons = seriesData?.seasons || [];
  activeSeriesEpisodes = seriesData?.episodes || [];

  if (seasons.length === 0 && activeSeriesEpisodes.length > 0) {
    const seasonMap = new Map();
    activeSeriesEpisodes.forEach(ep => {
      const s = Number(ep.season) || 1;
      seasonMap.set(s, (seasonMap.get(s) || 0) + 1);
    });
    seasons = [...seasonMap.keys()].sort((a, b) => a - b).map(s => ({ season: s, count: seasonMap.get(s) }));
  }

  if (seasons.length === 0 && activeSeriesEpisodes.length === 0) {
    els.seriesDockEpisodeList.innerHTML = '<p style="padding:12px; color:#888; font-size:11px;">No episodes found.</p>';
    return;
  }

  seasons.forEach((s, idx) => {
    const tab = document.createElement('button');
    tab.className = `season-btn ${idx === 0 ? 'active' : ''}`;
    tab.textContent = `S${s.season}`;
    tab.addEventListener('click', () => {
      els.seriesDockSeasonTabs.querySelectorAll('.season-btn').forEach(b => b.classList.remove('active'));
      tab.classList.add('active');
      renderSeriesDockEpisodes(s.season);
    });
    els.seriesDockSeasonTabs.appendChild(tab);
  });

  renderSeriesDockEpisodes(seasons[0].season);
}

function renderSeriesDockEpisodes(seasonNum) {
  els.seriesDockEpisodeList.innerHTML = '';
  const seasonEps = activeSeriesEpisodes.filter(e => Number(e.season) === Number(seasonNum));

  if (seasonEps.length === 0) {
    els.seriesDockEpisodeList.innerHTML = `<p style="padding:12px; color:#888; font-size:11px;">No episodes in Season ${seasonNum}.</p>`;
    return;
  }

  seasonEps.forEach((ep, idx) => {
    const item = document.createElement('div');
    const isPlaying = state.playerItem?.id === ep.id;
    const epProg = state.watchProgress[ep.id];
    const isWatched = epProg?.isWatched || (epProg?.percentage >= 90);

    item.className = `dock-episode-item ${isPlaying ? 'active' : ''} ${isWatched ? 'watched' : ''}`;
    item.innerHTML = `
      <div style="flex:1; min-width:0;">
        <div style="display:flex; align-items:center; gap:6px;">
          <strong style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">E${ep.episodeNumber}: ${ep.episodeTitle || ep.name}</strong>
          ${isWatched ? '<span class="dock-episode-watched-badge">✓ WATCHED</span>' : ''}
        </div>
        <div style="display:flex; align-items:center; gap:8px; margin-top:2px;">
          <small>${ep.duration ? `${ep.duration}m` : 'HD Stream'}</small>
          ${!isWatched && epProg?.percentage > 0 ? `<small style="color:var(--accent-orange); font-weight:bold;">${epProg.percentage}% watched</small>` : ''}
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:6px;">
        <button class="btn-action primary" style="padding:3px 8px; font-size:10px;">▶</button>
      </div>
    `;

    item.addEventListener('click', () => {
      els.seriesDockEpisodeList.querySelectorAll('.dock-episode-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      els.seriesActiveEpLabel.textContent = `S${ep.season} E${ep.episodeNumber}`;
      playMedia(ep, isWatched ? 0 : (epProg?.currentTime || 0), false);
    });

    els.seriesDockEpisodeList.appendChild(item);
  });
}

/* ==========================================================================
   PLAYBACK & EMBEDDED PREVIEW & FULLSCREEN HUD
   ========================================================================== */
function setEngine(engine) {
  state.playerEngine = engine === 'artplayer' ? 'artplayer' : 'html5';
  localStorage.setItem('nidalplayer-player-engine', state.playerEngine);

  if (els.topEngineSelect) els.topEngineSelect.value = state.playerEngine;
  if (els.settingEngineSelect) els.settingEngineSelect.value = state.playerEngine;
  if (els.previewEngine) els.previewEngine.textContent = state.playerEngine === 'artplayer' ? 'ArtPlayer' : 'HTML5 / HLS';

  if (state.playerItem) {
    playMedia(state.playerItem, player?.video?.currentTime || 0, state.isFullscreen);
  }
  showToast(`Engine set to ${state.playerEngine === 'artplayer' ? 'ArtPlayer' : 'HTML5 / HLS'}`);
}

function updateAllFavButtons() {
  const currentId = state.playerItem?.id || state.selectedVod?.id;
  const isFav = currentId ? state.favorites.has(currentId) : false;

  if (els.liveFavBtn) els.liveFavBtn.style.color = (state.playerItem && state.favorites.has(state.playerItem.id)) ? '#ffb703' : 'var(--text-muted)';
  if (els.movieFavBtn) els.movieFavBtn.style.color = (state.selectedVod && state.favorites.has(state.selectedVod.id)) ? '#ffb703' : 'var(--text-muted)';
  if (els.seriesFavBtn) els.seriesFavBtn.style.color = (state.selectedVod && state.favorites.has(state.selectedVod.id)) ? '#ffb703' : 'var(--text-muted)';
  if (els.hudFavBtn) els.hudFavBtn.style.color = isFav ? '#ffb703' : 'var(--text-muted)';
}

function playNextEpisode() {
  if (!activeSeriesEpisodes || activeSeriesEpisodes.length === 0) {
    showToast('No episodes available in this series');
    return;
  }
  const curId = state.playerItem?.id;
  const curIdx = activeSeriesEpisodes.findIndex(e => e.id === curId || e.episodeId === curId);
  if (curIdx >= 0 && curIdx < activeSeriesEpisodes.length - 1) {
    const nextEp = activeSeriesEpisodes[curIdx + 1];
    if (els.seriesActiveEpLabel) {
      els.seriesActiveEpLabel.textContent = `S${nextEp.season} E${nextEp.episodeNumber}`;
    }
    const prog = state.watchProgress[nextEp.id];
    playMedia(nextEp, prog?.isWatched ? 0 : (prog?.currentTime || 0), state.isFullscreen);
    showToast(`Next: S${nextEp.season} E${nextEp.episodeNumber} - ${nextEp.episodeTitle || nextEp.name}`);
  } else if (curIdx === -1 && activeSeriesEpisodes.length > 0) {
    const firstEp = activeSeriesEpisodes[0];
    playMedia(firstEp, 0, state.isFullscreen);
  } else {
    showToast('You are watching the last episode');
  }
}

function playPreviousEpisode() {
  if (!activeSeriesEpisodes || activeSeriesEpisodes.length === 0) {
    showToast('No episodes available in this series');
    return;
  }
  const curId = state.playerItem?.id;
  const curIdx = activeSeriesEpisodes.findIndex(e => e.id === curId || e.episodeId === curId);
  if (curIdx > 0) {
    const prevEp = activeSeriesEpisodes[curIdx - 1];
    if (els.seriesActiveEpLabel) {
      els.seriesActiveEpLabel.textContent = `S${prevEp.season} E${prevEp.episodeNumber}`;
    }
    const prog = state.watchProgress[prevEp.id];
    playMedia(prevEp, prog?.isWatched ? 0 : (prog?.currentTime || 0), state.isFullscreen);
    showToast(`Previous: S${prevEp.season} E${prevEp.episodeNumber} - ${prevEp.episodeTitle || prevEp.name}`);
  } else {
    showToast('You are at the first episode');
  }
}

function playMedia(item, startTime = 0, forceFullscreen = false) {
  if (!item?.url) {
    showToast('This item does not have a playable stream URL.');
    return;
  }

  state.playerItem = item;
  state.isPlaying = true;
  // Do not let the previous movie/episode duration control the new scrubber.
  state.currentTime = 0;
  state.duration = 0;
  addRecent(item.id);

  // Series-only episode buttons visibility
  const isSeriesItem = item.type === 'series' || Boolean(item.season) || Boolean(item.episodeNumber);
  if (isSeriesItem) {
    els.hudPrevEpBtn?.classList.remove('hidden');
    els.hudNextEpBtn?.classList.remove('hidden');
    els.seriesPrevEpBtn?.classList.remove('hidden');
    els.seriesNextEpBtn?.classList.remove('hidden');
  } else {
    els.hudPrevEpBtn?.classList.add('hidden');
    els.hudNextEpBtn?.classList.add('hidden');
    els.seriesPrevEpBtn?.classList.add('hidden');
    els.seriesNextEpBtn?.classList.add('hidden');
  }

  // Update Live Preview Dock Info
  els.previewPlaceholder?.classList.add('hidden');
  if (els.previewTitle) els.previewTitle.textContent = item.name || item.episodeTitle || 'Stream';
  if (item.type === 'live') {
    const cleanStreamId = String(item.metadata?.stream_id || item.id || '').replace(/^(?:live|movie|series)-/, '');
    const cachedEpg = epgCache[cleanStreamId];
    if (els.previewGroup) els.previewGroup.textContent = cachedEpg ? cachedEpg.full : (item.group || 'Live Television');
    
    // Auto-detect and render Live Sidebar Match Lineup safely
    try {
      updateLiveSidebarMatchLineup(item, cachedEpg);
    } catch (e) {
      console.warn('updateLiveSidebarMatchLineup error:', e);
    }

    if (!cachedEpg && cleanStreamId) {
      requestChannelEpg(cleanStreamId, (epg) => {
        if (state.playerItem?.id === item.id && els.previewGroup) {
          els.previewGroup.textContent = epg.full || epg.title;
          try {
            updateLiveSidebarMatchLineup(item, epg);
          } catch (e) {}
        }
      });
    }
  } else {
    if (els.previewGroup) els.previewGroup.textContent = item.group || item.type.toUpperCase();
    els.liveSidebarLineupDock?.classList.add('hidden');
  }
  if (els.previewStatusBadge) els.previewStatusBadge.textContent = 'CONNECTING';

  // Update HUD Info
  if (els.hudStreamTitle) els.hudStreamTitle.textContent = item.name || item.episodeTitle || 'Stream';
  if (els.hudStreamCategory) els.hudStreamCategory.textContent = item.group || item.type.toUpperCase();

  updateAllFavButtons();

  // If triggered from Home dashboard (e.g. Favorite match or Match Center), navigate to Live TV
  if (state.destination === 'home' && item.type === 'live') {
    navigateTo('live');
  } else if (state.isFullscreen || forceFullscreen) {
    expandFullscreenPlayer();
  } else {
    reparentVideoToPreview();
  }

  player.play(item, state.playerEngine, false, startTime);
  publishRemoteState();
}

async function updateLiveSidebarMatchLineup(item, epgObj) {
  const dock = els.liveSidebarLineupDock;
  const content = els.sidebarLineupContent;
  if (!dock || !content) return;

  if (!item || item.type !== 'live') {
    dock.classList.add('hidden');
    return;
  }

  const epgTitle = epgObj?.full || epgObj?.title || '';
  const text = (item.name + ' ' + (item.group || '') + ' ' + epgTitle).toLowerCase();

  // 1. Check against active sports matches
  let matchedFixture = null;
  for (const m of currentSportsMatches) {
    const home = (m.homeTeam || '').toLowerCase();
    const away = (m.awayTeam || '').toLowerCase();
    if (home.length >= 3 && away.length >= 3 && (text.includes(home) || text.includes(away))) {
      matchedFixture = m;
      break;
    }
  }

  // 2. Fallback: extract 'Team A vs Team B' from EPG title
  if (!matchedFixture) {
    const vsMatch = epgTitle.match(/([a-zA-Z\s]+)\s+(?:vs|v|-)\s+([a-zA-Z\s]+)/i);
    if (vsMatch && vsMatch[1].trim().length >= 3 && vsMatch[2].trim().length >= 3) {
      matchedFixture = {
        homeTeam: vsMatch[1].trim(),
        awayTeam: vsMatch[2].trim(),
        leagueKey: 'epl',
        leagueId: '4328'
      };
    }
  }

  if (!matchedFixture) {
    dock.classList.add('hidden');
    return;
  }

  // Show dock with loading indicator
  dock.classList.remove('hidden');
  content.innerHTML = `
    <div class="sports-loading-placeholder" style="padding:14px 8px; justify-content:center; color:var(--text-secondary);">
      <div class="spinner" style="width:16px; height:16px;"></div>
      <span style="font-size:10px; font-weight:700;">Loading match lineup & starting XI…</span>
    </div>
  `;

  try {
    const data = await lineupService.fetchLineup(matchedFixture);
    if (!data || !data.available || !data.teams || data.teams.length === 0) {
      content.innerHTML = `
        <div style="font-size:11px; color:var(--text-muted); text-align:center; padding:8px 4px;">
          ${data?.message || t('lineups_unavailable') || 'Lineups will be announced ~1 hour before kickoff'}
        </div>
      `;
      return;
    }

    renderSidebarLineupTabs(data, 0);
  } catch (err) {
    console.warn('[SidebarLineup] Error:', err);
    dock.classList.add('hidden');
  }
}

function renderSidebarLineupTabs(data, activeTeamIdx = 0) {
  const content = els.sidebarLineupContent;
  if (!content || !data || !data.teams) return;

  const teams = data.teams;
  const currentTeam = teams[activeTeamIdx] || teams[0];
  if (!currentTeam) return;

  const tabsHtml = `
    <div class="sidebar-team-tabs">
      ${teams.map((t, idx) => `
        <button class="sidebar-team-tab-btn ${idx === activeTeamIdx ? 'active' : ''}" data-team-idx="${idx}">
          ${t.teamName} (${t.formation || '4-3-3'})
        </button>
      `).join('')}
    </div>
  `;

  const startersHtml = currentTeam.starters.map(p => {
    const posLower = (p.position || '').toLowerCase();
    let posClass = 'lineup-pos-tag';
    if (posLower.includes('g') || posLower.includes('gk')) posClass += ' gk';
    else if (posLower.includes('d') || posLower.includes('b') || posLower.includes('cb') || posLower.includes('lb') || posLower.includes('rb')) posClass += ' def';
    else if (posLower.includes('m') || posLower.includes('cm') || posLower.includes('dm') || posLower.includes('am')) posClass += ' mid';
    else if (posLower.includes('f') || posLower.includes('w') || posLower.includes('s') || posLower.includes('a') || posLower.includes('st')) posClass += ' fwd';

    return `
      <div class="lineup-player-row" style="padding:4px 8px;">
        <div class="lineup-player-left">
          <span class="lineup-jersey-pill" style="width:18px; height:18px; font-size:9px;">${p.jersey || '•'}</span>
          <span class="lineup-player-name" style="font-size:11px;">${p.name}</span>
        </div>
        <span class="${posClass}" style="font-size:8px; padding:1px 4px;">${p.position || 'POS'}</span>
      </div>
    `;
  }).join('');

  const subsHtml = currentTeam.subs.map(p => `
    <div class="lineup-sub-chip" style="padding:2px 6px; font-size:10px;">
      <span class="lineup-sub-jersey" style="font-size:8px;">#${p.jersey || '•'}</span>
      <span>${p.name}</span>
    </div>
  `).join('');

  content.innerHTML = `
    ${tabsHtml}
    <div class="lineup-section-heading" style="font-size:9px; margin-top:2px;">${t('starters') || 'STARTING XI'} (${currentTeam.starters.length})</div>
    <div class="sidebar-lineup-roster">
      ${startersHtml || '<div style="font-size:10px; color:var(--text-muted);">Lineup pending confirmation</div>'}
    </div>
    ${currentTeam.subs.length > 0 ? `
      <div class="lineup-section-heading" style="font-size:9px; margin-top:6px;">${t('substitutes') || 'BENCH'} (${currentTeam.subs.length})</div>
      <div class="lineup-subs-chips" style="gap:4px;">
        ${subsHtml}
      </div>
    ` : ''}
  `;

  content.querySelectorAll('.sidebar-team-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-team-idx'), 10);
      renderSidebarLineupTabs(data, idx);
    });
  });
}

function updateHomeMiniPlayerState() {
  if (!els.homeMiniPlayerCard) return;

  if (state.playerItem && state.isPlaying) {
    els.homeMiniStandby?.classList.add('hidden');
    els.homeMiniLiveBadge?.classList.remove('hidden');
    if (els.homeMiniLiveText) {
      els.homeMiniLiveText.textContent = state.playerItem.type === 'live' ? 'LIVE BROADCAST' : 'VOD PLAYING';
    }
    if (els.homeMiniTitle) els.homeMiniTitle.textContent = state.playerItem.name || state.playerItem.episodeTitle || state.playerItem.title || 'Stream';
    if (els.homeMiniCategory) els.homeMiniCategory.textContent = `${state.playerItem.group || state.playerItem.type.toUpperCase()} • Streaming in Background`;
    if (els.homeMiniPlayPauseBtn) els.homeMiniPlayPauseBtn.textContent = (player?.video?.paused) ? '▶' : '⏸';
  } else {
    els.homeMiniStandby?.classList.remove('hidden');
    els.homeMiniLiveBadge?.classList.add('hidden');
    if (els.homeMiniTitle) els.homeMiniTitle.textContent = 'No stream currently active';
    if (els.homeMiniCategory) els.homeMiniCategory.textContent = 'Select any channel or movie to stream here';
    if (els.homeMiniPlayPauseBtn) els.homeMiniPlayPauseBtn.textContent = '▶';
  }
}

function reparentVideoToPreview() {
  state.isFullscreen = false;
  els.fullscreenPlayer?.classList.add('hidden');

  let targetContainer = els.previewVideoContainer;
  if (state.destination === 'home') {
    targetContainer = els.homeMiniPlayerMount || els.previewVideoContainer;
  } else if (state.destination === 'movies') {
    targetContainer = els.moviesPreviewVideoContainer || els.previewVideoContainer;
  } else if (state.destination === 'series') {
    targetContainer = els.seriesPreviewVideoContainer || els.previewVideoContainer;
  }

  if (targetContainer) {
    if (els.nativeVideo && els.nativeVideo.parentElement !== targetContainer) {
      targetContainer.appendChild(els.nativeVideo);
    }
    if (els.artplayerMount && els.artplayerMount.parentElement !== targetContainer) {
      targetContainer.appendChild(els.artplayerMount);
      try { player?.art?.resize(); } catch {}
    }
  }

  updateHomeMiniPlayerState();
}

async function expandFullscreenPlayer() {
  state.isFullscreen = true;

  if (els.fullscreenViewport) {
    if (els.nativeVideo && els.nativeVideo.parentElement !== els.fullscreenViewport) {
      els.fullscreenViewport.appendChild(els.nativeVideo);
    }
    if (els.artplayerMount && els.artplayerMount.parentElement !== els.fullscreenViewport) {
      els.fullscreenViewport.appendChild(els.artplayerMount);
    }
  }
  els.fullscreenPlayer?.classList.remove('hidden');

  if (state.playerEngine === 'artplayer') {
    // In ArtPlayer mode: hide custom bottom HUD so Artplayer controls are fully interactive
    if (els.playerHud) {
      els.playerHud.classList.remove('hidden');
      const hudBottom = els.playerHud.querySelector('.hud-bottom');
      if (hudBottom) hudBottom.classList.add('hidden');
    }
  } else {
    if (els.playerHud) {
      els.playerHud.classList.remove('hidden');
      const hudBottom = els.playerHud.querySelector('.hud-bottom');
      if (hudBottom) hudBottom.classList.remove('hidden');
    }
    showPlayerHud();
  }

  try {
    if (bridge?.enterNativeFullscreen) {
      await bridge.enterNativeFullscreen();
    } else if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen().catch(() => {});
    }
  } catch (err) {
    console.warn('Could not enter native fullscreen:', err);
  }

  if (player?.art) {
    setTimeout(() => {
      try { player.art.resize(); } catch {}
    }, 60);
  }

  if (els.topWindowFullscreenIcon) {
    els.topWindowFullscreenIcon.textContent = '🗗';
  }
  const artIconExpand = document.getElementById('artFullscreenIcon');
  if (artIconExpand) artIconExpand.textContent = '🗗';

  publishRemoteState();
}

async function closeFullscreenPlayer() {
  state.isFullscreen = false;

  try {
    if (bridge?.exitNativeFullscreen) {
      await bridge.exitNativeFullscreen();
    } else if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
    }
  } catch (err) {
    console.warn('Could not exit native fullscreen:', err);
  }

  if (els.topWindowFullscreenIcon) {
    els.topWindowFullscreenIcon.textContent = '⛶';
  }
  const artIconClose = document.getElementById('artFullscreenIcon');
  if (artIconClose) artIconClose.textContent = '⛶';

  els.fullscreenPlayer?.classList.add('hidden');
  reparentVideoToPreview();

  if (player?.art) {
    setTimeout(() => {
      try { player.art.resize(); } catch {}
    }, 60);
  }

  publishRemoteState();
}

function showPlayerHud() {
  els.playerHud.classList.remove('autohide');
  clearTimeout(hudHideTimer);
  hudHideTimer = setTimeout(() => {
    if (state.isPlaying) {
      els.playerHud.classList.add('autohide');
    }
  }, 4000);
}

function updatePlayPauseButtons(isPlaying) {
  const icon = isPlaying ? '⏸' : '▶';
  if (els.previewPlayBtn) els.previewPlayBtn.textContent = icon;
  if (els.moviePlayBtn) els.moviePlayBtn.textContent = icon;
  if (els.seriesPlayBtn) els.seriesPlayBtn.textContent = icon;
  if (els.hudPlayBtn) els.hudPlayBtn.textContent = icon;
  if (els.homeMiniPlayPauseBtn) els.homeMiniPlayPauseBtn.textContent = icon;
}

function handlePlayerStateChange(status) {
  if (status.status === 'connected' || status.status === 'playing') {
    state.isPlaying = true;
    if (els.previewStatusBadge) {
      els.previewStatusBadge.textContent = 'LIVE';
      els.previewStatusBadge.style.color = '#00e676';
    }
    updatePlayPauseButtons(true);
  } else if (status.status === 'paused' || status.status === 'ended') {
    state.isPlaying = false;
    if (els.previewStatusBadge) {
      els.previewStatusBadge.textContent = 'PAUSED';
      els.previewStatusBadge.style.color = '#ffb703';
    }
    updatePlayPauseButtons(false);
  } else if (status.status === 'buffering' || status.status === 'connecting') {
    if (els.previewStatusBadge) {
      els.previewStatusBadge.textContent = 'BUFFERING';
      els.previewStatusBadge.style.color = '#ffb703';
    }
    if (els.hudBitrate) els.hudBitrate.textContent = 'BUFFERING';
  } else if (status.status === 'retrying') {
    if (els.previewStatusBadge) {
      els.previewStatusBadge.textContent = 'CONNECTING';
      els.previewStatusBadge.style.color = '#ffb703';
    }
    if (els.hudBitrate) els.hudBitrate.textContent = 'CONNECTING';
  } else if (status.status === 'offline') {
    state.isPlaying = false;
    if (els.previewStatusBadge) {
      els.previewStatusBadge.textContent = 'OFFLINE';
      els.previewStatusBadge.style.color = '#ff3d00';
    }
    if (els.hudBitrate) els.hudBitrate.textContent = 'OFFLINE';
    updatePlayPauseButtons(false);
    showToast(`Channel Offline: ${status.message || 'Stream server not responding'}`);
  } else if (status.status === 'error') {
    state.isPlaying = false;
    if (els.previewStatusBadge) {
      els.previewStatusBadge.textContent = 'ERROR';
      els.previewStatusBadge.style.color = '#ff3d00';
    }
    if (els.hudBitrate) els.hudBitrate.textContent = 'ERROR';
    updatePlayPauseButtons(false);
    showToast(`Stream Notice: ${status.message || 'Unable to decode stream'}`);
  }
  publishRemoteState();
}

function handlePlayerTelemetry(stats) {
  if (stats.width && stats.height) {
    const w = stats.width;
    const h = stats.height;
    let label = `${w}x${h}`;
    if (h >= 2160 || w >= 3840) label = `4K (${w}x${h})`;
    else if (h >= 1080) label = `1080P (${w}x${h})`;
    else if (h >= 720) label = `720P (${w}x${h})`;
    else if (h >= 576) label = `576P (${w}x${h})`;
    else if (h >= 480) label = `480P (${w}x${h})`;

    if (els.previewResolution) els.previewResolution.textContent = label;
    if (els.hudResolution) els.hudResolution.textContent = `${w}x${h}`;
  }

  if (stats.fps && stats.fps > 0) {
    const fpsText = `${stats.fps} FPS`;
    if (els.previewFps) els.previewFps.textContent = fpsText;
    if (els.hudFps) {
      els.hudFps.textContent = fpsText;
      els.hudFps.classList.remove('hidden');
    }
  }

  if (stats.mbps) {
    const mb = `${stats.mbps.toFixed(1)} Mbps`;
    if (els.previewBitrate) els.previewBitrate.textContent = mb;
    if (els.hudBitrate && state.isPlaying) els.hudBitrate.textContent = mb;
  }
  if (stats.audioTracks && stats.audioTracks.length > 1) {
    if (els.hudAudioTrackSelect) {
      els.hudAudioTrackSelect.classList.remove('hidden');
      els.hudAudioTrackSelect.innerHTML = stats.audioTracks.map((t, idx) =>
        `<option value="${idx}">${t.name || t.lang || ('Track ' + (idx + 1))}</option>`
      ).join('');
    }
  } else if (els.hudAudioTrackSelect) {
    els.hudAudioTrackSelect.classList.add('hidden');
  }
}

function updatePlayerTimeDisplay(currentTime, duration) {
  state.currentTime = currentTime || 0;
  state.duration = duration || 0;
  const curStr = formatDuration(currentTime);
  const durStr = duration && duration < 86400 && duration > 0 ? formatDuration(duration) : 'LIVE';

  if (els.hudCurrentTime) els.hudCurrentTime.textContent = curStr;
  if (els.hudTotalTime) els.hudTotalTime.textContent = durStr;
  if (els.movieCurrentTime) els.movieCurrentTime.textContent = curStr;
  if (els.movieTotalTime) els.movieTotalTime.textContent = durStr;
  if (els.seriesCurrentTime) els.seriesCurrentTime.textContent = curStr;
  if (els.seriesTotalTime) els.seriesTotalTime.textContent = durStr;

  if (duration && duration > 0) {
    const percent = Math.min(100, Math.max(0, (currentTime / duration) * 100));
    if (els.hudProgressFill) els.hudProgressFill.style.width = `${percent}%`;
    if (els.movieProgressFill) els.movieProgressFill.style.width = `${percent}%`;
    if (els.seriesProgressFill) els.seriesProgressFill.style.width = `${percent}%`;
  }
}

function formatDuration(sec) {
  if (!sec || isNaN(sec)) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/* ==========================================================================
   PLAYLIST SYNC & PROGRESSION
   ========================================================================== */
async function startPlaylistSync(record) {
  if (!record) {
    showToast('Please select a playlist to synchronize.');
    return;
  }

  els.syncOverlay.classList.remove('hidden');
  state.syncState = {
    active: true,
    step: 0,
    totalSteps: record.type === 'xtream' ? 5 : 3,
    stepText: 'Starting playlist synchronization…',
    progress: 0,
    error: null,
    counts: { live: 0, movies: 0, series: 0 }
  };
  publishRemoteState();
  resetSyncSteps();

  try {
    if (record.type === 'xtream') {
      const creds = await store.loadCredentials(record.id);
      if (!creds?.username || !creds?.password) {
        throw new Error('Provider credentials missing. Please edit this playlist.');
      }

      const result = await xtream.loadWithProgress(
        record.provider?.base || record.sourceUrl,
        creds.username,
        creds.password,
        progress => updateSyncOverlayProgress(progress)
      );

      const previousSeriesCount = Array.isArray(record.items)
        ? record.items.filter(item => item.type === 'series').length
        : 0;
      const loadedSeriesCount = Array.isArray(result.items)
        ? result.items.filter(item => item.type === 'series').length
        : 0;
      if (previousSeriesCount > 0 && loadedSeriesCount === 0) {
        throw new Error('The provider returned no series during this refresh. The previous series catalogue was kept; please retry.');
      }

      record.items = result.items;
      record.account = result.account;
      record.categories = result.categories;
      record.lastRefresh = Date.now();
      record.updatedAt = Date.now();

    } else if (record.type === 'url') {
      record.sourceUrl = normalizePlaylistUrl(record.sourceUrl);
      updateSyncOverlayProgress({ step: 1, totalSteps: 3, message: 'Downloading M3U playlist stream…', percent: 30 });
      const resp = await bridge.fetchPlaylist(record.sourceUrl);
      if (!resp.ok) {
        // A direct HLS manifest is playable by the media engine even when the
        // provider blocks catalogue downloads from Electron. Keep it usable as
        // a one-stream playlist instead of reporting a misleading sync failure.
        if (/\.m3u8(?:$|[?#])/i.test(record.sourceUrl)) {
          const name = decodeURIComponent(record.sourceUrl.split('/').pop()?.split(/[?#]/)[0] || 'HLS Stream');
          record.items = [{
            id: `url-stream-${record.id}`,
            name,
            group: 'Live TV',
            type: 'live',
            url: record.sourceUrl,
            providerOrder: 0
          }];
          updateSyncOverlayProgress({
            step: 3,
            totalSteps: 3,
            message: 'Direct M3U8 stream ready.',
            percent: 100,
            counts: { live: 1, movies: 0, series: 0 }
          });
        } else {
          throw new Error(resp.error || `Failed to fetch M3U playlist URL (HTTP ${resp.status || 'network error'}).`);
        }
      }

      if (resp.ok) {
        updateSyncOverlayProgress({ step: 2, totalSteps: 3, message: 'Parsing channels and categories…', percent: 70 });
        const parsed = parseM3U(resp.text);
        if (!parsed.validation?.playable) {
          throw new Error('The URL responded, but no playable M3U/M3U8 stream entries were found.');
        }
        record.items = parsed.items;
        record.lastRefresh = Date.now();
        record.updatedAt = Date.now();

        updateSyncOverlayProgress({
          step: 3,
          totalSteps: 3,
          message: 'Sync complete!',
          percent: 100,
          counts: {
            live: record.items.filter(i => i.type === 'live').length,
            movies: record.items.filter(i => i.type === 'movies').length,
            series: record.items.filter(i => i.type === 'series').length
          }
        });
      }
      record.lastRefresh = Date.now();
      record.updatedAt = Date.now();
    }

    await store.saveMetadata({
      playlists: state.playlists,
      activePlaylistId: state.activePlaylistId
    });

    activatePlaylist(record);
    refreshAllViews();
    showToast('Playlist synchronized successfully!');

    state.syncState = {
      ...state.syncState,
      active: false,
      stepText: 'Synchronization complete',
      progress: 100,
      error: null,
      counts: {
        live: state.liveItems.length,
        movies: state.moviesItems.length,
        series: state.seriesItems.length
      }
    };
    publishRemoteState();

    setTimeout(() => {
      els.syncOverlay.classList.add('hidden');
    }, 1200);

  } catch (error) {
    state.syncState = {
      ...state.syncState,
      active: false,
      stepText: `Sync failed: ${error.message}`,
      error: error.message
    };
    publishRemoteState();
    els.syncStatusMessage.textContent = `Sync Error: ${error.message}`;
    els.syncStatusMessage.style.color = '#ff3d00';
    showToast(`Sync Failed: ${error.message}`);
    setTimeout(() => {
      els.syncOverlay.classList.add('hidden');
    }, 3500);
  }
}

function resetSyncSteps() {
  [els.syncStep1, els.syncStep2, els.syncStep3, els.syncStep4, els.syncStep5].forEach(step => {
    if (step) {
      step.className = 'sync-step';
      step.querySelector('.step-status').textContent = 'PENDING';
    }
  });
  els.syncProgressFill.style.width = '0%';
  els.syncPercentText.textContent = '0%';
  els.syncLiveCount.textContent = '0';
  els.syncMoviesCount.textContent = '0';
  els.syncSeriesCount.textContent = '0';
  els.syncStatusMessage.style.color = '';
}

function updateSyncOverlayProgress({ step, message, percent, counts }) {
  state.syncState = {
    ...state.syncState,
    active: true,
    step,
    stepText: message || 'Syncing…',
    progress: percent || 0,
    counts: counts || state.syncState.counts
  };
  publishRemoteState();
  const stepElements = [els.syncStep1, els.syncStep2, els.syncStep3, els.syncStep4, els.syncStep5];

  stepElements.forEach((el, index) => {
    if (!el) return;
    const stepNum = index + 1;
    if (stepNum < step) {
      el.className = 'sync-step done';
      el.querySelector('.step-status').textContent = 'DONE';
    } else if (stepNum === step) {
      el.className = 'sync-step active';
      el.querySelector('.step-status').textContent = 'IN PROGRESS';
    } else {
      el.className = 'sync-step';
      el.querySelector('.step-status').textContent = 'PENDING';
    }
  });

  els.syncProgressFill.style.width = `${percent || 0}%`;
  els.syncPercentText.textContent = `${percent || 0}%`;
  els.syncStatusMessage.textContent = message || 'Syncing…';

  if (counts) {
    if (counts.live !== undefined) els.syncLiveCount.textContent = counts.live.toLocaleString();
    if (counts.movies !== undefined) els.syncMoviesCount.textContent = counts.movies.toLocaleString();
    if (counts.series !== undefined) els.syncSeriesCount.textContent = counts.series.toLocaleString();
  }
}

/* ==========================================================================
   CONFIRMATION MODAL HELPER
   ========================================================================== */
let activeConfirmCallback = null;

function showConfirmDialog({ icon = '⚠️', kicker = 'CONFIRM ACTION // 01', title = 'CONFIRM', message = 'Are you sure?', proceedText = 'CONFIRM', isDanger = true, onConfirm }) {
  if (els.confirmModalIcon) els.confirmModalIcon.textContent = icon;
  if (els.confirmModalKicker) els.confirmModalKicker.textContent = kicker;
  if (els.confirmModalTitle) els.confirmModalTitle.textContent = title;
  if (els.confirmModalMessage) els.confirmModalMessage.textContent = message;
  if (els.confirmProceedBtn) {
    els.confirmProceedBtn.textContent = proceedText;
    els.confirmProceedBtn.className = isDanger ? 'btn-danger' : 'btn-action primary';
  }
  activeConfirmCallback = onConfirm;
  els.confirmModal?.classList.remove('hidden');
}

/* ==========================================================================
   CRASH LOG VIEWER
   ========================================================================== */
async function loadCrashLogs() {
  try {
    const [logsResult, gpuInfoResult] = await Promise.allSettled([
      bridge.getCrashLogs?.() || [],
      bridge.getGpuInfo?.() || null
    ]);

    const logs = logsResult.status === 'fulfilled' ? logsResult.value : [];
    renderCrashLogs(logs);

    if (gpuInfoResult.status === 'fulfilled' && gpuInfoResult.value && els.gpuDiagnosticsStatus) {
      const info = gpuInfoResult.value;
      const feat = info.featureStatus || {};
      const statusParts = [];
      statusParts.push(`<strong>Mode:</strong> <span style="color:#4ade80;">Hardware Accelerated (Active by Default)</span>`);
      if (feat.video_decode) statusParts.push(`<strong>Video Decode:</strong> ${feat.video_decode}`);
      if (feat.rasterization) statusParts.push(`<strong>Rasterization:</strong> ${feat.rasterization}`);
      if (feat.gpu_compositing) statusParts.push(`<strong>Compositing:</strong> ${feat.gpu_compositing}`);
      els.gpuDiagnosticsStatus.innerHTML = statusParts.join(' &nbsp;•&nbsp; ');
      els.gpuDiagnosticsStatus.style.display = 'block';
    }
  } catch (err) {
    console.error('Failed to load crash logs:', err);
  }
}

function renderCrashLogs(logs) {
  if (!els.crashLogsList || !els.crashLogsEmpty) return;

  if (!logs || logs.length === 0) {
    els.crashLogsEmpty.style.display = 'block';
    els.crashLogsList.innerHTML = '';
    return;
  }

  els.crashLogsEmpty.style.display = 'none';

  // Render newest-first
  const reversedLogs = [...logs].reverse();
  els.crashLogsList.innerHTML = reversedLogs.map((log, i) => {
    const date = log.timestamp ? new Date(log.timestamp) : null;
    const timeStr = date ? date.toLocaleString() : 'Unknown time';
    const gpuLabel = log.gpuAcceleration ? 'GPU: ON' : 'GPU: OFF';

    // Color-code by severity
    let typeColor = '#ff6b6b';
    let typeIcon = '🔴';
    if (log.type === 'renderer-unresponsive') {
      typeColor = '#ff9f1c';
      typeIcon = '🟡';
    } else if (log.type === 'child-process-gone' && log.processType === 'GPU') {
      typeColor = '#ff3d00';
      typeIcon = '💥';
    } else if (log.type === 'child-process-gone') {
      typeColor = '#f87171';
      typeIcon = '⚠️';
    }

    const details = [];
    if (log.processType) details.push(`Process: ${log.processType}`);
    if (log.reason && log.reason !== 'unknown') details.push(`Reason: ${log.reason}`);
    if (log.exitCode !== undefined && log.exitCode !== null) details.push(`Exit: ${log.exitCode}`);
    if (log.serviceName) details.push(`Service: ${log.serviceName}`);
    if (log.name) details.push(`Name: ${log.name}`);
    if (log.message) details.push(`Message: ${log.message}`);
    if (log.appVersion) details.push(`v${log.appVersion}`);

    return `<div style="padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.06); ${i === 0 ? 'background:rgba(255,60,0,0.04); padding:10px; margin:-4px -4px 6px -4px; border-radius:6px;' : ''}">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:3px;">
        <span>${typeIcon}</span>
        <span style="color:${typeColor}; font-weight:600; text-transform:uppercase;">${log.type || 'Unknown'}</span>
        <span style="color:var(--text-muted); margin-left:auto; font-size:10px;">${gpuLabel}</span>
      </div>
      <div style="color:var(--text-muted); font-size:10px;">${timeStr}</div>
      ${details.length ? `<div style="color:var(--text-secondary); font-size:10px; margin-top:2px;">${details.join(' · ')}</div>` : ''}
      ${log.stack ? `<pre style="margin-top:4px; padding:4px 8px; background:rgba(0,0,0,0.3); border-radius:4px; font-size:9px; color:#ff8080; white-space:pre-wrap; max-height:80px; overflow-y:auto;">${log.stack}</pre>` : ''}
    </div>`;
  }).join('');
}

/* ==========================================================================
   PLAYLIST MODAL
   ========================================================================== */
async function openPlaylistModal(mode = 'add', playlistId = null) {
  els.playlistModal.classList.remove('hidden');
  els.connectionTestStatus.textContent = '';
  els.connectionTestStatus.className = 'test-status-msg';

  let record = null;
  if (playlistId) {
    record = state.playlists.find(p => p.id === playlistId);
  }
  console.log('[openPlaylistModal]', mode, playlistId, 'found record:', record ? record.name : 'NONE');

  if (mode === 'edit' && record) {
    els.playlistModalKicker.textContent = 'EDIT & FIX CONNECTION // 01';
    els.playlistModalTitle.textContent = `${t('edit_fix') || 'EDIT PLAYLIST'}: ${record.name}`;
    els.editPlaylistId.value = record.id;
    els.inputPlaylistTitle.value = record.name || '';

    const type = record.type || (record.provider?.base ? 'xtream' : 'url');
    switchPlaylistTab(type);

    if (type === 'xtream') {
      const serverUrl = record.provider?.base || record.sourceUrl || '';
      els.inputServerUrl.value = serverUrl;
      els.inputUsername.value = record.provider?.username || '';
      els.inputPassword.value = '';

      const creds = await store.loadCredentials(record.id);
      if (creds) {
        if (creds.username) els.inputUsername.value = creds.username;
        if (creds.password) els.inputPassword.value = creds.password;
      }
    } else if (type === 'url') {
      els.inputM3uUrl.value = record.sourceUrl || '';
    } else if (type === 'm3u') {
      if (els.selectedFileName) {
        els.selectedFileName.textContent = record.sourceUrl ? record.sourceUrl.split(/[\\/]/).pop() : 'Local file loaded';
      }
    }

  } else {
    els.playlistModalKicker.textContent = 'PROVIDER SETUP // 01';
    els.playlistModalTitle.textContent = t('add_playlist');
    els.editPlaylistId.value = '';
    els.playlistForm.reset();
    
    switchPlaylistTab('xtream');
  }
}

function switchPlaylistTab(type) {
  els.playlistTypeTabs.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-type') === type);
  });

  els.xtreamFieldsGroup.classList.toggle('hidden', type !== 'xtream');
  els.urlFieldsGroup.classList.toggle('hidden', type !== 'url');
  els.fileFieldsGroup.classList.toggle('hidden', type !== 'm3u');
}

function normalizePlaylistUrl(value) {
  let raw = String(value || '').trim();
  if (!raw) throw new Error('Please enter an M3U / M3U8 playlist URL.');
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(raw)) raw = `https://${raw}`;

  let parsed;
  try { parsed = new URL(raw); } catch {
    throw new Error('Please enter a complete HTTP or HTTPS playlist URL.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Playlist URL must use HTTP or HTTPS.');
  }

  // Some IPTV hosts route their catalogue only through the explicit HTTP
  // service port. URL.toString() removes the default :80, so preserve/add it.
  const host = parsed.hostname.includes(':') ? `[${parsed.hostname}]` : parsed.hostname;
  const auth = parsed.username
    ? `${encodeURIComponent(parsed.username)}${parsed.password ? `:${encodeURIComponent(parsed.password)}` : ''}@`
    : '';
  const port = parsed.port || (parsed.protocol === 'http:' ? '80' : '');
  return `${parsed.protocol}//${auth}${host}${port ? `:${port}` : ''}${parsed.pathname || '/'}${parsed.search}${parsed.hash}`;
}

async function handlePlaylistFormSubmit(e) {
  e.preventDefault();
  const activeTab = els.playlistTypeTabs.querySelector('.tab-btn.active').getAttribute('data-type');
  const title = els.inputPlaylistTitle.value.trim();
  const editId = els.editPlaylistId.value;

  if (!title) {
    showToast('Please enter a Title for this playlist.');
    return;
  }

  let record = editId ? state.playlists.find(p => p.id === editId) : null;
  const isNew = !record;

  if (isNew) {
    record = {
      id: `pl-${Date.now()}`,
      name: title,
      type: activeTab,
      items: [],
      createdAt: Date.now()
    };
  } else {
    record.name = title;
    record.type = activeTab;
  }

  if (activeTab === 'xtream') {
    const rawServer = els.inputServerUrl.value.trim();
    const username = els.inputUsername.value.trim();
    const password = els.inputPassword.value.trim();

    if (!rawServer || !username || !password) {
      showToast('Please fill in Server URL, Username, and Password.');
      return;
    }

    try {
      const base = normalizeServer(rawServer);
      record.sourceUrl = base;
      record.provider = { base, username };
      await store.saveCredentials(record.id, { username, password }, true);
    } catch (err) {
      showToast(err.message);
      return;
    }

  } else if (activeTab === 'url') {
    try {
      record.sourceUrl = normalizePlaylistUrl(els.inputM3uUrl.value);
    } catch (err) {
      showToast(err.message);
      return;
    }
  }

  if (isNew) state.playlists.push(record);
  state.activePlaylistId = record.id;
  await store.saveMetadata({ playlists: state.playlists, activePlaylistId: state.activePlaylistId });

  els.playlistModal.classList.add('hidden');
  updatePlaylistDropdowns();
  renderSettingsPlaylists();

  startPlaylistSync(record);
}

function updatePlaylistDropdowns() {
  if (els.quickPlaylistSwitch) {
    els.quickPlaylistSwitch.innerHTML = '';
    state.playlists.forEach(pl => {
      const opt = document.createElement('option');
      opt.value = pl.id;
      opt.textContent = pl.name || 'Untitled Playlist';
      if (pl.id === state.activePlaylistId) opt.selected = true;
      els.quickPlaylistSwitch.appendChild(opt);
    });
  }
}

function renderSettingsPlaylists() {
  els.settingsPlaylistsList.innerHTML = '';
  if (state.playlists.length === 0) {
    els.settingsPlaylistsList.innerHTML = `
      <div class="playlist-empty-state">
        <div style="font-size:32px; margin-bottom:8px;">📡</div>
        <strong>No playlists configured yet</strong>
        <p>Click "+ ADD NEW PLAYLIST" above to connect your stream service.</p>
      </div>`;
    return;
  }

  state.playlists.forEach(pl => {
    const card = document.createElement('div');
    const isActive = pl.id === state.activePlaylistId;
    card.className = `playlist-item-card ${isActive ? 'active' : ''}`;

    const itemCount = pl.items ? pl.items.length : (pl.itemCount || 0);
    const lastSync = pl.lastRefresh ? new Date(pl.lastRefresh).toLocaleString() : 'Never';
    const expiry = calculateExpiryInfo(pl.account);
    const serverDisplay = pl.provider?.base || pl.sourceUrl || (pl.type === 'm3u' ? 'Local file' : 'Server connected');

    card.innerHTML = `
      <div class="playlist-card-left">
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="status-indicator ${isActive ? 'active' : ''}"></span>
          <strong class="playlist-card-title">${pl.name}</strong>
          ${isActive ? `<span class="active-badge">${t('active')}</span>` : ''}
        </div>
        <div class="playlist-card-meta">
          <span class="meta-tag type">${pl.type.toUpperCase()}</span>
          <span class="meta-tag server">${serverDisplay}</span>
          <span class="meta-tag items">${itemCount.toLocaleString()} items</span>
          <span class="expiry-pill ${expiry.status}">${expiry.text}</span>
        </div>
        <div class="playlist-sync-time">Last synced: ${lastSync}</div>
      </div>
      <div class="playlist-card-actions">
        ${!isActive ? `<button class="btn-action btn-set-active" title="Set as primary playlist">⚡ ${t('activate')}</button>` : ''}
        <button class="btn-action btn-sync-one" title="Synchronize and fetch latest channels">↻ ${t('sync')}</button>
        <button class="btn-action btn-edit-one" title="Edit server URL, username, or password">✏️ ${t('edit_fix')}</button>
        <button class="btn-danger-outline btn-delete-one" title="Delete playlist">🗑️ ${t('delete')}</button>
      </div>
    `;

    // 1. Activate
    card.querySelector('.btn-set-active')?.addEventListener('click', e => {
      e.stopPropagation();
      activatePlaylist(pl);
      store.saveMetadata({ playlists: state.playlists, activePlaylistId: state.activePlaylistId });
      refreshAllViews();
      updatePlaylistDropdowns();
      showToast(`Activated "${pl.name}"`);
    });

    // 2. Sync
    card.querySelector('.btn-sync-one')?.addEventListener('click', e => {
      e.stopPropagation();
      startPlaylistSync(pl);
    });

    // 3. Edit / Modify
    card.querySelector('.btn-edit-one')?.addEventListener('click', e => {
      e.stopPropagation();
      openPlaylistModal('edit', pl.id);
    });

    // 4. Delete with guaranteed In-App Confirmation Modal
    card.querySelector('.btn-delete-one')?.addEventListener('click', e => {
      e.stopPropagation();
      console.log('[DELETE BUTTON CLICKED IN SETTINGS]', pl.id, pl.name);
      showConfirmDialog({
        icon: '🗑️',
        kicker: 'PLAYLIST MANAGEMENT // 02',
        title: `DELETE PLAYLIST: "${pl.name}"`,
        message: `Are you sure you want to permanently delete "${pl.name}"? All associated channels and saved credentials will be removed.`,
        proceedText: 'DELETE PLAYLIST',
        isDanger: true,
        onConfirm: async () => {
          const targetId = pl.id;
          const targetName = pl.name;
          console.log('[delete onConfirm START]', targetId, targetName, 'before count:', state.playlists.length);

          // 1. Instant visual feedback
          card.remove();

          // 2. Filter state array
          state.playlists = state.playlists.filter(p => p.id !== targetId);
          console.log('[delete onConfirm FILTERED]', 'after count:', state.playlists.length);

          // 3. Re-assign active playlist if needed
          if (state.activePlaylistId === targetId) {
            if (player) player.stop();
            if (state.playlists.length > 0) {
              state.activePlaylistId = state.playlists[0].id;
              activatePlaylist(state.playlists[0]);
            } else {
              clearActivePlaylistState();
            }
          }

          // 4. Save metadata to disk immediately & remove credentials
          await store.removeCredentials(targetId);
          const saveRes = await store.saveMetadata({
            playlists: state.playlists,
            activePlaylistId: state.activePlaylistId
          });
          console.log('[delete onConfirm SAVED METADATA]', saveRes);

          // 5. Re-render UI
          renderSettingsPlaylists();
          updatePlaylistDropdowns();
          refreshAllViews();

          // Reset live docks
          els.previewPlaceholder?.classList.remove('hidden');
          if (els.previewTitle) els.previewTitle.textContent = 'No Channel Selected';
          if (els.previewGroup) els.previewGroup.textContent = 'Live Television';
          if (els.previewStatusBadge) els.previewStatusBadge.textContent = 'STANDBY';
          if (els.previewResolution) els.previewResolution.textContent = '—';
          if (els.previewFps) els.previewFps.textContent = '—';
          if (els.previewBitrate) els.previewBitrate.textContent = '—';

          els.moviePlaceholder?.classList.remove('hidden');
          if (els.moviePreviewTitle) els.moviePreviewTitle.textContent = 'No Movie Selected';
          if (els.moviePreviewPlot) els.moviePreviewPlot.textContent = 'Select a movie to read its synopsis.';

          els.seriesPlaceholder?.classList.remove('hidden');
          if (els.seriesPreviewTitle) els.seriesPreviewTitle.textContent = 'No Series Selected';
          if (els.seriesActiveEpLabel) els.seriesActiveEpLabel.textContent = 'Select a season & episode';
          if (els.seriesDockSeasonTabs) els.seriesDockSeasonTabs.innerHTML = '';
          if (els.seriesDockEpisodeList) els.seriesDockEpisodeList.innerHTML = '';

          updateHomeMiniPlayerState();
          showToast(`Deleted playlist "${targetName}"`);
        }
      });
    });

    els.settingsPlaylistsList.appendChild(card);
  });
}

/* ==========================================================================
   REMOTE CONTROL LAN COMMUNICATION
   ========================================================================== */
function publishRemoteState() {
  let liveChannels = state.liveItems || [];
  let movies = state.moviesItems || [];
  let series = state.seriesItems || [];

  if ((!liveChannels.length && !movies.length && !series.length) && state.items && state.items.length) {
    liveChannels = state.items.filter(i => i.type === 'live' || !i.type);
    movies = state.items.filter(i => i.type === 'movies');
    series = state.items.filter(i => i.type === 'series');
  }

  const categories = {
    live: state.liveGroups ? [...state.liveGroups.keys()] : [],
    movies: state.moviesGroups ? [...state.moviesGroups.keys()] : [],
    series: state.seriesGroups ? [...state.seriesGroups.keys()] : []
  };

  if (!categories.live.length && liveChannels.length) {
    const s = new Set();
    liveChannels.forEach(c => s.add(c.group || 'Live'));
    categories.live = [...s];
  }
  if (!categories.movies.length && movies.length) {
    const s = new Set();
    movies.forEach(m => s.add(m.group || 'Movies'));
    categories.movies = [...s];
  }
  if (!categories.series.length && series.length) {
    const s = new Set();
    series.forEach(sr => s.add(sr.group || 'Series'));
    categories.series = [...s];
  }

  const activeRec = state.playlists.find(p => p.id === state.activePlaylistId);
  const snapshot = {
    language: getLang(),
    syncing: Boolean(state.syncState?.active),
    syncState: state.syncState || { active: false },
    activePlaylistId: state.activePlaylistId,
    activePlaylistName: activeRec?.name || 'Nidalplayer',
    provider: activeRec ? {
      server: activeRec.provider?.base || activeRec.sourceUrl || activeRec.server || '',
      user: activeRec.provider?.username || activeRec.user || '',
      pass: activeRec.provider?.password || activeRec.pass || ''
    } : null,
    playlists: state.playlists.map(p => ({
      id: p.id,
      name: p.name,
      server: p.provider?.base || p.sourceUrl || p.server || '',
      itemCount: (p.id === state.activePlaylistId && state.items ? state.items.length : (p.itemCount || p.items?.length || 0))
    })),
    favorites: Array.from(state.favorites),
    categories,
    // Prioritize all favorited and watched items so they are never omitted by slice
    channels: (() => {
      const favSet = state.favorites || new Set();
      const isFavOrWatched = c => favSet.has(c.id) || (state.watchProgress && (state.watchProgress[c.id] || state.watchProgress[String(c.id).replace(/^(?:series|movie|live)-/, '')]));
      return [...liveChannels.filter(isFavOrWatched), ...liveChannels.filter(c => !isFavOrWatched(c))]
        .slice(0, 2000)
        .map(c => ({ id: c.id, name: c.name, group: c.group, logo: c.logo, type: 'live' }));
    })(),
    movies: (() => {
      const favSet = state.favorites || new Set();
      const isFavOrWatched = m => favSet.has(m.id) || (state.watchProgress && (state.watchProgress[m.id] || state.watchProgress[String(m.id).replace(/^(?:series|movie|live)-/, '')]));
      return [...movies.filter(isFavOrWatched), ...movies.filter(m => !isFavOrWatched(m))]
        .slice(0, 2000)
        .map(m => ({ id: m.id, name: m.name, group: m.group, logo: m.logo, type: 'movies', rating: m.rating, year: m.releaseDate }));
    })(),
    series: (() => {
      const favSet = state.favorites || new Set();
      const isFavOrWatched = s => favSet.has(s.id) || (s.seriesId && favSet.has(s.seriesId)) || (state.watchProgress && (state.watchProgress[s.id] || (s.seriesId && state.watchProgress[s.seriesId])));
      return [...series.filter(isFavOrWatched), ...series.filter(s => !isFavOrWatched(s))]
        .slice(0, 2000)
        .map(s => ({ id: s.id, seriesId: s.seriesId, name: s.name, group: s.group, logo: s.logo, type: 'series', rating: s.rating }));
    })(),
    activeSeriesEpisodes: (activeSeriesEpisodes || []).slice(0, 300).map(e => ({ id: e.id, season: e.season, episodeNumber: e.episodeNumber, name: e.name, episodeTitle: e.episodeTitle, duration: e.duration })),
    watchProgress: state.watchProgress || {},
    epgCache: epgCache || {},
    playback: {
      title: state.playerItem?.name || state.playerItem?.episodeTitle || '',
      status: state.isPlaying ? 'connected' : 'paused',
      paused: !state.isPlaying,
      volume: state.volume,
      muted: state.isMuted,
      engine: state.playerEngine,
      itemId: state.playerItem?.id || '',
      type: state.playerItem?.type || 'live',
      season: state.playerItem?.season,
      episodeNumber: state.playerItem?.episodeNumber,
      seriesName: state.selectedVod?.name || state.playerItem?.seriesName,
      seriesId: state.selectedVod?.seriesId || state.playerItem?.seriesId || state.selectedVod?.id,
      isFullscreen: state.isFullscreen,
      currentTime: player?.getCurrentTime?.() || 0,
      duration: player?.getDuration?.() || 0,
      percentage: (() => {
        const dur = player?.getDuration?.() || 0;
        const cur = player?.getCurrentTime?.() || 0;
        return dur > 0 ? Math.round((cur / dur) * 100) : 0;
      })()
    }
  };

  bridge.publishRemoteState?.(snapshot);
}

async function importPlaylistFromPhone(payload) {
  const publishPhoneImportError = message => {
    state.syncState = {
      ...state.syncState,
      active: false,
      error: message,
      stepText: `Import failed: ${message}`
    };
    publishRemoteState();
    showToast(`Phone playlist import failed: ${message}`);
  };
  const rawServer = String(payload?.server || '').trim();
  const username = String(payload?.user || '').trim();
  const password = String(payload?.pass || '').trim();
  if (!rawServer || !username || !password) {
    publishPhoneImportError('Server, username, and password are required.');
    return { ok: false, error: 'Missing server, username, or password.' };
  }

  let base = rawServer.replace(/\/+$/, '');
  // Accept either a provider host or a pasted player_api.php URL.
  base = base.replace(/\/player_api\.php(?:\?.*)?$/i, '').replace(/\/panel_api\.php(?:\?.*)?$/i, '');
  try {
    const parsed = new URL(base);
    if (!/^https?:$/i.test(parsed.protocol)) throw new Error('Only HTTP and HTTPS servers are supported.');
  } catch (error) {
    publishPhoneImportError(error.message);
    return { ok: false, error: error.message };
  }

  // Reject unreachable phone entries before creating a playlist record. This
  // prevents a bad address from starting a long-running catalogue sync.
  try {
    const validation = await bridge.validateXtream?.({ base, username, password });
    if (validation && !validation.ok) throw new Error(validation.error || 'Provider validation failed.');
  } catch (error) {
    publishPhoneImportError(error.message);
    return { ok: false, error: error.message };
  }

  const existing = state.playlists.find(p => {
    const existingBase = String(p.provider?.base || p.sourceUrl || '').replace(/\/+$/, '').toLowerCase();
    return p.type === 'xtream' && existingBase === base.toLowerCase() && String(p.provider?.username || '').toLowerCase() === username.toLowerCase();
  });

  const playlist = existing || {
    id: `pl-${Date.now()}`,
    name: String(payload.name || 'Phone IPTV Account').trim() || 'Phone IPTV Account',
    type: 'xtream',
    sourceUrl: base,
    provider: { base, username },
    updatedAt: Date.now(),
    lastRefresh: 0,
    items: []
  };

  playlist.name = String(payload.name || playlist.name || 'Phone IPTV Account').trim();
  playlist.sourceUrl = base;
  playlist.provider = { ...(playlist.provider || {}), base, username };
  playlist.updatedAt = Date.now();
  if (!existing) state.playlists.push(playlist);
  state.activePlaylistId = playlist.id;

  await store.saveCredentials(playlist.id, { username, password });
  await store.saveMetadata({ playlists: state.playlists, activePlaylistId: state.activePlaylistId });

  updatePlaylistDropdowns();
  refreshAllViews();
  publishRemoteState();
  showToast('Playlist imported from Phone! Synchronizing...');

  try {
    await startPlaylistSync(playlist);
    if (state.syncState?.error) return { ok: false, error: state.syncState.error };
    return { ok: true, playlistId: playlist.id };
  } catch (error) {
    showToast(`Phone playlist sync failed: ${error.message}`);
    return { ok: false, error: error.message };
  }
}

function setupRemoteControlBridge() {
  bridge.onImportPlaylistFromPhone?.(async payload => {
    await importPlaylistFromPhone(payload);
  });

  bridge.onRemoteAction?.(async action => {
    const { type, requestId } = action;
    let ok = true;
    let error = null;
    let result = null;

    try {
      if (type === 'togglePlay') {
        player.togglePlay();
      } else if (type === 'toggleMute') {
        state.isMuted = !state.isMuted;
        player?.setMuted?.(state.isMuted);
        player?.setVolume?.(state.isMuted ? 0 : state.volume);
      } else if (type === 'toggleFullscreen') {
        if (state.isFullscreen) {
          closeFullscreenPlayer();
        } else if (state.playerItem) {
          expandFullscreenPlayer();
        }
      } else if (type === 'toggleWindowFullscreen') {
        const isFS = await bridge.toggleNativeFullscreen?.();
        if (els.topWindowFullscreenIcon) {
          els.topWindowFullscreenIcon.textContent = isFS ? '🗗' : '⛶';
        }
      } else if (type === 'setVolume') {
        state.volume = Math.max(0, Math.min(1, parseFloat(action.value || 1)));
        player.setVolume(state.volume);
      } else if (type === 'toggleFavorite') {
        toggleFavorite(action.itemId);
        saveFavorites();
        renderSidebarCounts();
        refreshActiveViewContent();
        updateAllFavButtons();
      } else if (type === 'selectPlaylist') {
        const pl = state.playlists.find(p => p.id === action.playlistId);
        if (pl) {
          activatePlaylist(pl);
          store.saveMetadata({ playlists: state.playlists, activePlaylistId: state.activePlaylistId });
          updatePlaylistDropdowns();
          refreshAllViews();
          publishRemoteState();
        }
      } else if (type === 'playItem') {
        const item = state.items.find(i => i.id === action.itemId) ||
                     activeSeriesEpisodes.find(e => e.id === action.itemId || e.episodeId === action.itemId) ||
                     action.item;
        if (item && item.url) {
          playMedia(item, 0, false);
        } else if (item && !item.url && activeSeriesEpisodes.length > 0) {
          const match = activeSeriesEpisodes.find(e => e.id === item.id || e.episodeId === item.id);
          if (match && match.url) {
            playMedia(match, 0, false);
          }
        }
      } else if (type === 'playNextEpisode') {
        playNextEpisode();
      } else if (type === 'playPrevEpisode') {
        playPreviousEpisode();
      } else if (type === 'fetchSeriesEpisodes') {
        const activeRec = state.playlists.find(p => p.id === state.activePlaylistId);
        if (activeRec?.type === 'xtream') {
          const creds = await store.loadCredentials(activeRec.id);
          if (creds) {
            const rawSeriesId = String(action.seriesId || '').replace(/^series-/, '');
            const seriesData = await xtream.seriesInfo(
              activeRec.provider?.base || activeRec.sourceUrl,
              creds.username,
              creds.password,
              rawSeriesId
            );
            activeSeriesEpisodes = seriesData.episodes || [];
            result = { seasons: seriesData.seasons || [], episodes: seriesData.episodes || [] };
          } else {
            error = 'Missing credentials for active playlist';
          }
        } else {
          error = 'Active playlist is not an Xtream Codes provider';
        }
      } else if (type === 'seek') {
        // Relative seek: { relative: ±seconds } OR Absolute seek: { time: seconds }
        if (action.time !== undefined) {
          const target = Math.max(0, parseFloat(action.time || 0));
          player?.seek?.(target);
          updatePlayerTimeDisplay(target, state.duration || player?.getDuration?.());
        } else {
          const secs = parseFloat(action.relative || 0);
          player?.seekRelative?.(secs);
        }
      } else if (type === 'seekPercent') {
        // Absolute seek by percentage: { percentage: 0-100 }
        const dur = state.duration || player?.getDuration?.() || 0;
        if (dur > 0) {
          const target = (parseFloat(action.percentage) / 100) * dur;
          player?.seek?.(target);
          updatePlayerTimeDisplay(target, dur);
        }
      } else if (type === 'setLanguage') {
        const lang = action.language;
        if (lang) {
          setLang(lang);
          if (els.appLanguageSelect) els.appLanguageSelect.value = lang;
          if (els.settingLangSelect) els.settingLangSelect.value = lang;
          refreshAllViews();
        }
      } else if (type === 'refreshPlaylist') {
        const active = state.playlists.find(p => p.id === state.activePlaylistId);
        if (active) startPlaylistSync(active);
      }
    } catch (err) {
      ok = false;
      error = err.message;
    }

    bridge.publishRemoteActionResult?.({ requestId, ok, error, result });
    publishRemoteState();
  });
}

/* ==========================================================================
   EVENT LISTENERS & BINDINGS
   ========================================================================== */
function setupEventListeners() {
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.getAttribute('data-dest')));
  });

  document.querySelectorAll('.dest-card, .hero-dest-card').forEach(card => {
    card.addEventListener('click', () => navigateTo(card.getAttribute('data-dest')));
  });

  // Language Switchers
  const handleLangChange = e => {
    setLang(e.target.value);
    if (els.appLanguageSelect) els.appLanguageSelect.value = e.target.value;
    if (els.settingLangSelect) els.settingLangSelect.value = e.target.value;
    refreshAllViews();
    publishRemoteState();
  };
  els.appLanguageSelect?.addEventListener('change', handleLangChange);
  els.settingLangSelect?.addEventListener('change', handleLangChange);

  document.querySelectorAll('.home-lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.getAttribute('data-lang');
      if (lang) {
        setLang(lang);
        if (els.appLanguageSelect) els.appLanguageSelect.value = lang;
        if (els.settingLangSelect) els.settingLangSelect.value = lang;
        refreshAllViews();
        publishRemoteState();
      }
    });
  });

  // Engine Switchers
  const handleEngineChange = e => setEngine(e.target.value);
  els.topEngineSelect?.addEventListener('change', handleEngineChange);
  els.settingEngineSelect?.addEventListener('change', handleEngineChange);

  // Favorite Football Club Switcher
  if (els.settingFavTeamSelect) {
    els.settingFavTeamSelect.value = favoriteTeamService.getFavoriteTeam();
    els.settingFavTeamSelect.addEventListener('change', e => {
      favoriteTeamService.setFavoriteTeam(e.target.value);
      renderHeroFavClub();
      updateSidebarSportsWidget(true);
      showToast(e.target.value ? `Favorite club updated to ${e.target.value}` : 'Favorite club cleared');
    });
  }

  // TMDB API Key Configuration
  if (els.settingTmdbApiKey) {
    els.settingTmdbApiKey.value = tmdbService.getTMDBApiKey();

    els.settingToggleTmdbKeyVisBtn?.addEventListener('click', () => {
      const isPass = els.settingTmdbApiKey.type === 'password';
      els.settingTmdbApiKey.type = isPass ? 'text' : 'password';
      if (els.settingToggleTmdbKeyVisBtn) {
        els.settingToggleTmdbKeyVisBtn.textContent = isPass ? '🔒' : '👁';
      }
    });

    els.settingSaveTmdbKeyBtn?.addEventListener('click', () => {
      const key = els.settingTmdbApiKey.value.trim();
      tmdbService.setTMDBApiKey(key);
      if (els.settingTmdbStatus) {
        els.settingTmdbStatus.textContent = key
          ? '✓ TMDB API Key saved successfully. 4K metadata & poster discovery enabled.'
          : 'TMDB API Key cleared. Default stream metadata will be used.';
        els.settingTmdbStatus.style.color = key ? 'var(--accent-green, #2ec4b6)' : 'var(--text-muted)';
      }
      showToast(key ? 'TMDB API Key saved!' : 'TMDB API Key removed');
    });

    els.settingTestTmdbKeyBtn?.addEventListener('click', async () => {
      const key = els.settingTmdbApiKey.value.trim();
      if (!key) {
        if (els.settingTmdbStatus) {
          els.settingTmdbStatus.textContent = 'Please enter an API key to test.';
          els.settingTmdbStatus.style.color = '#ff9f1c';
        }
        return;
      }
      if (els.settingTmdbStatus) {
        els.settingTmdbStatus.textContent = 'Testing connection with TMDB…';
        els.settingTmdbStatus.style.color = 'var(--text-muted)';
      }
      const res = await tmdbService.testTMDBApiKey(key);
      if (res.ok) {
        if (els.settingTmdbStatus) {
          els.settingTmdbStatus.textContent = `✓ ${res.message}`;
          els.settingTmdbStatus.style.color = 'var(--accent-green, #2ec4b6)';
        }
        showToast('TMDB Connection Verified!');
      } else {
        if (els.settingTmdbStatus) {
          els.settingTmdbStatus.textContent = `✗ Verification failed: ${res.error}`;
          els.settingTmdbStatus.style.color = '#e63946';
        }
        showToast(`TMDB Test Failed: ${res.error}`);
      }
    });
  }

  // GPU Hardware Acceleration
  if (els.settingGpuAccelSelect) {
    els.settingGpuAccelSelect.addEventListener('change', async (e) => {
      const enabled = e.target.value === 'true';
      try {
        const result = await bridge.setGpuAcceleration?.(enabled);
        if (result?.ok) {
          if (els.settingGpuStatus) {
            els.settingGpuStatus.textContent = enabled
              ? '✓ GPU HARDWARE ACCELERATION ENABLED BY DEFAULT.'
              : '✓ Safe UI Mode selected (CPU UI rendering, video streams active). Restart required.';
            els.settingGpuStatus.style.color = 'var(--accent-orange, #ff9f1c)';
          }
          showToast(`GPU mode updated to ${enabled ? 'Hardware Accelerated' : 'Safe UI Mode'} — restart required`);

          // Show confirm dialog prompting restart
          showConfirmDialog({
            icon: '🖥️',
            kicker: 'GPU CONFIGURATION CHANGE',
            title: 'RESTART REQUIRED',
            message: `GPU mode updated to ${enabled ? 'Hardware Accelerated' : 'Safe UI Mode'}. Restart required to apply. Restart now?`,
            proceedText: '↻ RESTART NOW',
            isDanger: false,
            onConfirm: () => bridge.relaunchApp?.()
          });
        }
      } catch (err) {
        showToast('Failed to save GPU setting');
      }
    });
  }

  // Crash Logs
  els.refreshCrashLogsBtn?.addEventListener('click', () => loadCrashLogs());
  els.clearCrashLogsBtn?.addEventListener('click', async () => {
    await bridge.clearCrashLogs?.();
    loadCrashLogs();
    showToast('Crash logs cleared');
  });

  // Listen for live crash events
  bridge.onCrashEvent?.((entry) => {
    loadCrashLogs();
    showToast(`⚠ ${entry.type}: ${entry.reason || 'unknown'} (GPU: ${entry.gpuAcceleration ? 'ON' : 'OFF'})`, 8000);
  });

  els.topSyncBtn?.addEventListener('click', () => {
    const active = state.playlists.find(p => p.id === state.activePlaylistId);
    startPlaylistSync(active);
  });
  els.topAddPlaylistBtn?.addEventListener('click', () => openPlaylistModal('add'));
  els.sidebarQuickEditBtn?.addEventListener('click', () => openPlaylistModal('edit', state.activePlaylistId));
  els.settingsAddBtn?.addEventListener('click', () => openPlaylistModal('add'));
  els.settingsRefreshAllBtn?.addEventListener('click', () => {
    const active = state.playlists.find(p => p.id === state.activePlaylistId);
    startPlaylistSync(active);
  });

  els.quickPlaylistSwitch?.addEventListener('change', e => {
    const pl = state.playlists.find(p => p.id === e.target.value);
    if (pl) {
      activatePlaylist(pl);
      store.saveMetadata({ playlists: state.playlists, activePlaylistId: state.activePlaylistId });
      refreshAllViews();
    }
  });

  els.globalSearchInput?.addEventListener('input', e => {
    const val = e.target.value.trim();
    state.search = val;
    els.clearSearchBtn?.classList.toggle('hidden', !val);

    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      refreshActiveViewContent();
    }, 150);
  });

  els.clearSearchBtn?.addEventListener('click', () => {
    state.search = '';
    if (els.globalSearchInput) els.globalSearchInput.value = '';
    els.clearSearchBtn?.classList.add('hidden');
    refreshActiveViewContent();
  });

  // Favorite toggle helper
  const handleFavToggle = () => {
    const target = state.playerItem?.id || state.selectedVod?.id;
    if (target) {
      toggleFavorite(target);
      saveFavorites();
      renderSidebarCounts();
      updateAllFavButtons();
      refreshActiveViewContent();
      publishRemoteState();
      showToast(state.favorites.has(target) ? 'Added to Favorites ★' : 'Removed from Favorites');
    }
  };

  els.liveFavBtn?.addEventListener('click', handleFavToggle);
  els.movieFavBtn?.addEventListener('click', handleFavToggle);
  els.seriesFavBtn?.addEventListener('click', handleFavToggle);
  els.hudFavBtn?.addEventListener('click', handleFavToggle);

  // Home Mini-Player Dock Controls & Double Click Fullscreen
  els.homeMiniPlayerCard?.addEventListener('dblclick', () => {
    if (state.playerItem && state.isPlaying) {
      expandFullscreenPlayer();
    }
  });
  els.homeMiniExpandBtn?.addEventListener('click', e => {
    e.stopPropagation();
    if (state.playerItem && state.isPlaying) {
      expandFullscreenPlayer();
    }
  });
  els.homeMiniPlayPauseBtn?.addEventListener('click', e => {
    e.stopPropagation();
    if (player) {
      player.togglePlay();
      updateHomeMiniPlayerState();
    }
  });
  els.homeMiniStopBtn?.addEventListener('click', e => {
    e.stopPropagation();
    if (player) {
      player.stop();
      state.isPlaying = false;
      state.playerItem = null;
      updateHomeMiniPlayerState();
    }
  });

  function attachProgressBarScrubber(containerEl) {
    if (!containerEl) return;

    let tooltip = containerEl.querySelector('.hud-seek-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.className = 'hud-seek-tooltip';
      containerEl.appendChild(tooltip);
    }

    const getDuration = () => {
      return state.duration || player?.getDuration?.() || 0;
    };

    const getPositionTime = (e) => {
      const dur = getDuration();
      if (!dur || isNaN(dur) || dur <= 0) return { pos: 0, time: 0, dur: 0 };
      const rect = containerEl.getBoundingClientRect();
      if (rect.width <= 0) return { pos: 0, time: 0, dur: 0 };
      const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return { pos, time: pos * dur, dur };
    };

    const updateVisual = (pos, time, dur) => {
      if (dur <= 0) return;
      const fillEl = containerEl.querySelector('.hud-progress-fill');
      if (fillEl) fillEl.style.width = `${(pos * 100).toFixed(2)}%`;

      const timeCurrent = containerEl.querySelector('.hud-time-row span:first-child') || containerEl.parentElement?.querySelector('.hud-time-row span:first-child');
      if (timeCurrent) timeCurrent.textContent = formatDuration(time);

      tooltip.textContent = formatDuration(time);
      const rect = containerEl.getBoundingClientRect();
      const offsetX = pos * rect.width;
      tooltip.style.left = `${offsetX}px`;
      tooltip.classList.add('visible');
    };

    let isDragging = false;
    let pendingSeekTime = null;

    const startScrub = (e) => {
      e.preventDefault?.();
      isDragging = true;
      try { containerEl.setPointerCapture?.(e.pointerId); } catch {}
      const { pos, time, dur } = getPositionTime(e);
      pendingSeekTime = time;
      updateVisual(pos, time, dur);
    };

    const moveScrub = (e) => {
      if (e.pointerId !== undefined && !isDragging) return;
      const { pos, time, dur } = getPositionTime(e);
      if (dur <= 0) {
        tooltip.classList.remove('visible');
        return;
      }
      if (isDragging) {
        pendingSeekTime = time;
      }
      updateVisual(pos, time, dur);
    };

    const endScrub = (e) => {
      if (isDragging) {
        try { containerEl.releasePointerCapture?.(e?.pointerId); } catch {}
        isDragging = false;
        tooltip.classList.remove('visible');
        if (pendingSeekTime !== null) {
          player?.seek?.(pendingSeekTime);
          const dur = getDuration();
          updatePlayerTimeDisplay(pendingSeekTime, dur);
          pendingSeekTime = null;
        }
      }
    };

    // Pointer events provide one consistent path for mouse, touch and pen.
    // Pointer capture prevents the seek from stopping when the cursor/finger
    // leaves the thin progress bar while dragging.
    containerEl.addEventListener('pointerdown', startScrub);
    containerEl.addEventListener('pointermove', moveScrub);
    containerEl.addEventListener('pointerup', endScrub);
    containerEl.addEventListener('pointercancel', endScrub);
    containerEl.addEventListener('pointerleave', () => {
      if (!isDragging) tooltip.classList.remove('visible');
    });
  }

  // Live TV Embedded Preview Controls
  els.previewExpandBtn?.addEventListener('click', expandFullscreenPlayer);
  els.previewSeekBackBtn?.addEventListener('click', () => player?.seekRelative?.(-10));
  els.previewPlayBtn?.addEventListener('click', () => player?.togglePlay?.());
  els.previewSeekFwdBtn?.addEventListener('click', () => player?.seekRelative?.(10));
  els.previewMuteBtn?.addEventListener('click', () => {
    state.isMuted = !state.isMuted;
    player?.setVolume?.(state.isMuted ? 0 : state.volume);
    if (els.previewMuteBtn) els.previewMuteBtn.textContent = state.isMuted ? '🔇' : '🔊';
  });
  els.previewVolumeSlider?.addEventListener('input', e => {
    state.volume = parseFloat(e.target.value);
    player?.setVolume?.(state.volume);
  });
  els.previewVideoContainer?.addEventListener('dblclick', expandFullscreenPlayer);

  // Movie Dock Preview Controls
  els.movieExpandBtn?.addEventListener('click', expandFullscreenPlayer);
  els.movieSeekBackBtn?.addEventListener('click', () => player?.seekRelative?.(-10));
  els.moviePlayBtn?.addEventListener('click', () => player?.togglePlay?.());
  els.movieSeekFwdBtn?.addEventListener('click', () => player?.seekRelative?.(10));
  els.movieMuteBtn?.addEventListener('click', () => {
    state.isMuted = !state.isMuted;
    player?.setVolume?.(state.isMuted ? 0 : state.volume);
    if (els.movieMuteBtn) els.movieMuteBtn.textContent = state.isMuted ? '🔇' : '🔊';
  });
  els.movieVolumeSlider?.addEventListener('input', e => {
    state.volume = parseFloat(e.target.value);
    player?.setVolume?.(state.volume);
  });
  els.moviesPreviewVideoContainer?.addEventListener('dblclick', expandFullscreenPlayer);
  attachProgressBarScrubber(els.movieProgressWrap);

  // Series Dock Preview Controls
  els.seriesExpandBtn?.addEventListener('click', expandFullscreenPlayer);
  els.seriesPrevEpBtn?.addEventListener('click', () => playPreviousEpisode());
  els.seriesSeekBackBtn?.addEventListener('click', () => player?.seekRelative?.(-10));
  els.seriesPlayBtn?.addEventListener('click', () => player?.togglePlay?.());
  els.seriesSeekFwdBtn?.addEventListener('click', () => player?.seekRelative?.(10));
  els.seriesNextEpBtn?.addEventListener('click', () => playNextEpisode());
  els.seriesMuteBtn?.addEventListener('click', () => {
    state.isMuted = !state.isMuted;
    player?.setVolume?.(state.isMuted ? 0 : state.volume);
    if (els.seriesMuteBtn) els.seriesMuteBtn.textContent = state.isMuted ? '🔇' : '🔊';
  });
  els.seriesVolumeSlider?.addEventListener('input', e => {
    state.volume = parseFloat(e.target.value);
    player?.setVolume?.(state.volume);
  });
  els.seriesPreviewVideoContainer?.addEventListener('dblclick', expandFullscreenPlayer);
  attachProgressBarScrubber(els.seriesProgressWrap);

  // Fullscreen HUD Return & Controls
  els.hudBackBtn?.addEventListener('click', closeFullscreenPlayer);
  els.hudExitFullBtn?.addEventListener('click', closeFullscreenPlayer);
  els.hudPrevEpBtn?.addEventListener('click', () => playPreviousEpisode());
  els.hudSeekBackBtn?.addEventListener('click', () => player?.seekRelative?.(-10));
  els.hudPlayBtn?.addEventListener('click', () => player?.togglePlay?.());
  els.hudSeekFwdBtn?.addEventListener('click', () => player?.seekRelative?.(10));
  els.hudNextEpBtn?.addEventListener('click', () => playNextEpisode());
  els.hudMuteBtn?.addEventListener('click', () => {
    state.isMuted = !state.isMuted;
    player?.setVolume?.(state.isMuted ? 0 : state.volume);
    if (els.hudMuteBtn) els.hudMuteBtn.textContent = state.isMuted ? '🔇' : '🔊';
  });
  els.hudVolumeSlider?.addEventListener('input', e => {
    state.volume = parseFloat(e.target.value);
    player?.setVolume?.(state.volume);
  });
  els.hudAudioTrackSelect?.addEventListener('change', e => {
    player?.setAudioTrack?.(parseInt(e.target.value, 10));
    showToast(`Switched audio track`);
  });
  els.hudAspectSelect?.addEventListener('change', e => player?.setAspectRatio?.(e.target.value));
  els.hudSpeedSelect?.addEventListener('change', e => player?.setPlaybackSpeed?.(e.target.value));
  attachProgressBarScrubber(els.hudProgressContainer);

  els.fullscreenPlayer?.addEventListener('mousemove', showPlayerHud);

  // Grid/List toggle for Live TV
  els.liveGridBtn?.addEventListener('click', () => {
    state.view = 'grid';
    els.liveGridBtn.classList.add('active');
    els.liveListBtn.classList.remove('active');
    if (liveScroller) {
      liveScroller.mode = 'grid';
      liveScroller.recalculateDimensions();
    }
    refreshActiveViewContent();
  });
  els.liveListBtn?.addEventListener('click', () => {
    state.view = 'list';
    els.liveListBtn.classList.add('active');
    els.liveGridBtn.classList.remove('active');
    if (liveScroller) {
      liveScroller.mode = 'list';
      liveScroller.recalculateDimensions();
    }
    refreshActiveViewContent();
  });

  // Playlist Modal Tabs & Form
  els.playlistTypeTabs?.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchPlaylistTab(btn.getAttribute('data-type')));
  });
  els.closePlaylistModalBtn?.addEventListener('click', () => els.playlistModal?.classList.add('hidden'));
  els.cancelPlaylistBtn?.addEventListener('click', () => els.playlistModal?.classList.add('hidden'));
  els.playlistForm?.addEventListener('submit', handlePlaylistFormSubmit);

  // Server Connection Tester
  els.testConnectionBtn?.addEventListener('click', async () => {
    const rawUrl = els.inputServerUrl?.value?.trim();
    if (!rawUrl) {
      showToast('Please enter a server host to test.');
      return;
    }
    if (els.connectionTestStatus) {
      els.connectionTestStatus.textContent = 'Testing latency…';
      els.connectionTestStatus.className = 'test-status-msg';
    }

    try {
      const base = normalizeServer(rawUrl);
      const res = await bridge.testConnection(base);
      if (res.ok) {
        if (els.connectionTestStatus) {
          els.connectionTestStatus.textContent = `✓ Server Online (${res.latency}ms)`;
          els.connectionTestStatus.className = 'test-status-msg success';
        }
      } else {
        if (els.connectionTestStatus) {
          els.connectionTestStatus.textContent = `✕ Server Unreachable (${res.status || 'Timeout'})`;
          els.connectionTestStatus.className = 'test-status-msg error';
        }
      }
    } catch (err) {
      if (els.connectionTestStatus) {
        els.connectionTestStatus.textContent = `✕ Error: ${err.message}`;
        els.connectionTestStatus.className = 'test-status-msg error';
      }
    }
  });

  // Local File Selector
  els.browseFileBtn?.addEventListener('click', async () => {
    const file = await bridge.openM3UFile();
    if (file) {
      if (els.selectedFileName) els.selectedFileName.textContent = file.name;
      const parsed = parseM3U(file.content);
      const title = els.inputPlaylistTitle?.value?.trim() || file.name.replace(/\.[^/.]+$/, '');
      if (els.inputPlaylistTitle) els.inputPlaylistTitle.value = title;

      const record = {
        id: `pl-${Date.now()}`,
        name: title,
        type: 'm3u',
        items: parsed.items,
        sourceUrl: file.path,
        createdAt: Date.now(),
        lastRefresh: Date.now()
      };

      state.playlists.push(record);
      state.activePlaylistId = record.id;
      await store.saveMetadata({ playlists: state.playlists, activePlaylistId: state.activePlaylistId });
      activatePlaylist(record);
      els.playlistModal?.classList.add('hidden');
      refreshAllViews();
      updatePlaylistDropdowns();
      showToast(`Loaded ${parsed.items.length.toLocaleString()} channels from file.`);
    }
  });

  // Mobile Remote Modal
  els.topRemoteBtn?.addEventListener('click', async () => {
    const info = await bridge.remoteInfo?.();
    if (info) {
      if (els.remoteQrImage) els.remoteQrImage.src = info.qrDataUrls?.[0] || '';
      if (els.remoteUrlsContainer) {
        const primaryUrl = info.urls?.[0] || '';
        const mobileLinks = primaryUrl ? `<div style="margin-bottom:6px;"><span style="color:var(--accent-orange); font-weight:700;">📱 Mobile Remote:</span> <a href="${primaryUrl}" target="_blank" style="color:#fff; text-decoration:none; word-break:break-all;">${primaryUrl}</a></div>` : '';
        els.remoteUrlsContainer.innerHTML = mobileLinks;
      }
      els.remoteModal?.classList.remove('hidden');
    }
  });
  els.closeRemoteModalBtn?.addEventListener('click', () => els.remoteModal?.classList.add('hidden'));

  // Sports Match Center League Chips
  els.sportsLeagueChips?.querySelectorAll('.sports-chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      els.sportsLeagueChips.querySelectorAll('.sports-chip-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedSportsLeague = btn.getAttribute('data-league') || 'all';
      renderSportsMatchCenter();
    });
  });

  // Smooth mouse-wheel horizontal scrolling for sports elements
  const enableHorizontalWheel = (container) => {
    if (!container) return;
    container.addEventListener('wheel', (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        container.scrollLeft += e.deltaY * 0.9;
      }
    }, { passive: false });
  };
  enableHorizontalWheel(els.sportsLeagueChips);
  enableHorizontalWheel(els.homeSportsMatchRow);

  // Sports Match Channels & Lineups Modal Tabs
  els.matchTabBroadcastersBtn?.addEventListener('click', () => {
    els.matchTabBroadcastersBtn.classList.add('active');
    els.matchTabLineupsBtn?.classList.remove('active');
    els.matchBroadcastersPanel?.classList.remove('hidden');
    els.matchLineupsPanel?.classList.add('hidden');
  });

  els.matchTabLineupsBtn?.addEventListener('click', () => {
    els.matchTabLineupsBtn.classList.add('active');
    els.matchTabBroadcastersBtn?.classList.remove('active');
    els.matchLineupsPanel?.classList.remove('hidden');
    els.matchBroadcastersPanel?.classList.add('hidden');
  });

  // Sports Match Channels Modal Close
  els.closeMatchModalBtn?.addEventListener('click', () => {
    els.matchChannelsModal?.classList.add('hidden');
  });

  els.matchChannelsModal?.addEventListener('click', e => {
    if (e.target === els.matchChannelsModal) {
      els.matchChannelsModal.classList.add('hidden');
    }
  });

  // Remote Connection Status Tracker
  bridge.onRemoteStatusChange?.(status => {
    if (status?.connected) {
      els.topRemoteStatusBadge?.classList.remove('hidden');
      if (els.modalRemoteStatusPill) {
        els.modalRemoteStatusPill.classList.add('connected');
        if (els.modalRemoteStatusDot) els.modalRemoteStatusDot.classList.remove('offline');
        if (els.modalRemoteStatusText) els.modalRemoteStatusText.textContent = '🟢 Phone Connected & Active!';
      }
    } else {
      els.topRemoteStatusBadge?.classList.add('hidden');
      if (els.modalRemoteStatusPill) {
        els.modalRemoteStatusPill.classList.remove('connected');
        if (els.modalRemoteStatusDot) els.modalRemoteStatusDot.classList.add('offline');
        if (els.modalRemoteStatusText) els.modalRemoteStatusText.textContent = 'Waiting for phone to scan...';
      }
    }
  });

  // Data Cleaners
  els.clearCacheBtn?.addEventListener('click', async () => {
    await bridge.clearDiagnostics?.();
    showToast('Cache cleared.');
  });

  els.resetAllDataBtn?.addEventListener('click', () => {
    showConfirmDialog({
      icon: '🧨',
      kicker: 'DATA MANAGEMENT // 02',
      title: 'RESET ALL DATA & PLAYLISTS',
      message: 'This will permanently wipe all saved playlists, active login credentials, and cached diagnostics. Are you sure you want to proceed?',
      proceedText: 'PERMANENTLY RESET ALL DATA',
      isDanger: true,
      onConfirm: async () => {
        await bridge.clearAllData?.();
        if (player) {
          player.stop();
        }
        state.playlists = [];
        state.items = [];
        state.liveItems = [];
        state.moviesItems = [];
        state.seriesItems = [];
        state.activePlaylistId = '';
        clearActivePlaylistState();
        try { localStorage.clear(); } catch {}
        renderSettingsPlaylists();
        updatePlaylistDropdowns();
        refreshAllViews();

        // Close any other open modals
        els.confirmModal?.classList.add('hidden');
        els.playlistModal?.classList.add('hidden');
        els.remoteModal?.classList.add('hidden');

        // Show Restart Notice Modal with guaranteed display
        if (els.restartNoticeModal) {
          els.restartNoticeModal.classList.remove('hidden');
          els.restartNoticeModal.style.display = 'flex';
          els.restartNoticeModal.style.zIndex = '99999';
        }
      }
    });
  });

  // Confirmation Modal Actions
  els.confirmProceedBtn?.addEventListener('click', async e => {
    e.stopPropagation();
    console.log('[CONFIRM PROCEED CLICKED IN APP]');
    els.confirmModal?.classList.add('hidden');
    if (activeConfirmCallback) {
      const cb = activeConfirmCallback;
      activeConfirmCallback = null;
      await cb();
    }
  });
  els.confirmCancelBtn?.addEventListener('click', e => {
    e.stopPropagation();
    activeConfirmCallback = null;
    els.confirmModal?.classList.add('hidden');
  });

  // Shortcuts Modal Actions
  els.btnShortcutsHelp?.addEventListener('click', () => {
    els.modalShortcuts?.classList.remove('hidden');
  });
  els.closeShortcutsModalBtn?.addEventListener('click', () => {
    els.modalShortcuts?.classList.add('hidden');
  });
  els.btnCloseShortcutsFooter?.addEventListener('click', () => {
    els.modalShortcuts?.classList.add('hidden');
  });

  // Window Fullscreen Action
  els.topWindowFullscreenBtn?.addEventListener('click', async () => {
    const isFS = await bridge.toggleNativeFullscreen?.();
    if (els.topWindowFullscreenIcon) {
      els.topWindowFullscreenIcon.textContent = isFS ? '🗗' : '⛶';
    }
  });

  bridge?.onNativeFullscreenChange?.(isFS => {
    if (!isFS && state.isFullscreen) {
      closeFullscreenPlayer();
    }
    if (els.topWindowFullscreenIcon) {
      els.topWindowFullscreenIcon.textContent = isFS ? '🗗' : '⛶';
    }
  });

  // Restart Notice Actions
  els.restartRelaunchBtn?.addEventListener('click', () => {
    bridge.relaunchApp?.();
  });
  els.restartCloseAppBtn?.addEventListener('click', () => {
    bridge.exitApp?.();
  });

  // Setup GitHub Releases Auto-Updater UI
  setupUpdaterUI();
}

function saveFavorites() {
  const list = [...state.favorites];
  localStorage.setItem('nidalplayer-favs', JSON.stringify(list));
  bridge.saveFavorites?.(list).catch?.(() => {});
  if (state.playlists && state.playlists.length) {
    store.saveMetadata({
      activePlaylistId: state.activePlaylistId,
      playlists: state.playlists,
      favorites: list
    }).catch?.(() => {});
  }
}

function setupKeyboardShortcuts() {
  window.addEventListener('keydown', async e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === '?' || e.key === 'F1') {
      e.preventDefault();
      els.modalShortcuts?.classList.toggle('hidden');
      return;
    }

    if (e.key === 's' || e.key === 'S' || e.key === '/') {
      e.preventDefault();
      els.globalSearchInput?.focus();
      els.globalSearchInput?.select();
      return;
    }

    if (e.key === '1') { switchView('home'); return; }
    if (e.key === '2') { switchView('live'); return; }
    if (e.key === '3') { switchView('movies'); return; }
    if (e.key === '4') { switchView('series'); return; }
    if (e.key === '5') { switchView('settings'); return; }

    if (e.key === 'F11') {
      e.preventDefault();
      const isFS = await bridge.toggleNativeFullscreen?.();
      if (els.topWindowFullscreenIcon) {
        els.topWindowFullscreenIcon.textContent = isFS ? '🗗' : '⛶';
      }
      return;
    }

    if (e.key === 'f' || e.key === 'F') {
      if (state.isFullscreen) closeFullscreenPlayer();
      else if (state.playerItem) expandFullscreenPlayer();
    } else if (e.key === ' ' || e.key === 'k' || e.key === 'K') {
      player?.togglePlay?.();
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' || e.key === 'j' || e.key === 'J') {
      player?.seekRelative?.(-10);
      e.preventDefault();
    } else if (e.key === 'ArrowRight' || e.key === 'l' || e.key === 'L') {
      player?.seekRelative?.(10);
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      state.volume = Math.min(1, state.volume + 0.05);
      player?.setVolume?.(state.volume);
      if (els.previewVolumeSlider) els.previewVolumeSlider.value = state.volume;
      if (els.movieVolumeSlider) els.movieVolumeSlider.value = state.volume;
      if (els.seriesVolumeSlider) els.seriesVolumeSlider.value = state.volume;
      if (els.hudVolumeSlider) els.hudVolumeSlider.value = state.volume;
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      state.volume = Math.max(0, state.volume - 0.05);
      player?.setVolume?.(state.volume);
      if (els.previewVolumeSlider) els.previewVolumeSlider.value = state.volume;
      if (els.movieVolumeSlider) els.movieVolumeSlider.value = state.volume;
      if (els.seriesVolumeSlider) els.seriesVolumeSlider.value = state.volume;
      if (els.hudVolumeSlider) els.hudVolumeSlider.value = state.volume;
      e.preventDefault();
    } else if (e.key === 'm' || e.key === 'M') {
      state.isMuted = !state.isMuted;
      player?.setVolume?.(state.isMuted ? 0 : state.volume);
      const icon = state.isMuted ? '🔇' : '🔊';
      if (els.previewMuteBtn) els.previewMuteBtn.textContent = icon;
      if (els.movieMuteBtn) els.movieMuteBtn.textContent = icon;
      if (els.seriesMuteBtn) els.seriesMuteBtn.textContent = icon;
      if (els.hudMuteBtn) els.hudMuteBtn.textContent = icon;
    } else if (e.key === 'Escape') {
      if (!els.modalShortcuts?.classList.contains('hidden')) {
        els.modalShortcuts?.classList.add('hidden');
        return;
      }
      if (state.isFullscreen) {
        closeFullscreenPlayer();
        return;
      }
      if (!els.playlistModal?.classList.contains('hidden') ||
          !els.remoteModal?.classList.contains('hidden') ||
          !els.confirmModal?.classList.contains('hidden')) {
        els.playlistModal?.classList.add('hidden');
        els.remoteModal?.classList.add('hidden');
        els.confirmModal?.classList.add('hidden');
        return;
      }
      const isAppFS = await bridge.isNativeFullscreen?.();
      if (isAppFS) {
        await bridge.exitNativeFullscreen?.();
        if (els.topWindowFullscreenIcon) {
          els.topWindowFullscreenIcon.textContent = '⛶';
        }
      }
    }
  });
}

function setupUpdaterUI() {
  if (!bridge?.checkForUpdates) return;

  const githubReleasesUrl = 'https://github.com/nidal0xp/Nidalplayer/releases/latest';
  let availableUpdateInfo = null;
  let skippedVersion = localStorage.getItem('nidalplayer-skipped-version') || '';

  // ── Dynamic version injection (fixes hardcoded version issue) ──────────────
  bridge.getAppVersion?.().then(version => {
    if (!version) return;
    const major = version.split('.').slice(0, 2).join('.');
    // Boot screen badge
    const bootBadge = document.getElementById('bootVersionBadge');
    if (bootBadge) bootBadge.textContent = `V${major} PRO`;
    // Sidebar version tag
    const sidebarTag = document.getElementById('sidebarVersionTag');
    if (sidebarTag) sidebarTag.textContent = `V${major}`;
    // Settings header line
    const settingsLine = document.getElementById('settingsVersionLine');
    if (settingsLine) settingsLine.textContent = `Version ${version} \u2022 Swiss Industrial Edition \u2022 Obsidian & International Signal Orange`;
    // Settings update title
    if (els.settingsUpdateTitle) els.settingsUpdateTitle.textContent = `Version Status: v${version}`;
  });

  // ── Helper: format raw release notes into readable text ───────────────────
  function formatReleaseNotes(raw, version) {
    if (!raw || typeof raw !== 'string' || raw.trim().length < 10) {
      return `\u2713 Bug fixes and stability improvements\n\u2713 Stream engine performance enhancements\n\u2713 GPU memory optimizations\n\nView full changelog: github.com/nidal0xp/Nidalplayer/releases`;
    }
    // Strip HTML tags if present
    const clean = raw.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    return clean;
  }

  // ── Helper: show update available state (before download) ─────────────────
  function showUpdateAvailableUI(info) {
    availableUpdateInfo = info;
    const ver = info?.version || '';
    const notes = formatReleaseNotes(info?.releaseNotes, ver);

    // Settings section
    if (els.settingsUpdateSubtitle) {
      els.settingsUpdateSubtitle.textContent = `\u2728 Nidalplayer v${ver} is available — download when ready.`;
    }
    document.getElementById('settingsDownloadUpdateBtn')?.classList.remove('hidden');
    document.getElementById('settingsSkipUpdateBtn')?.classList.remove('hidden');
    document.getElementById('settingsInstallUpdateBtn')?.classList.add('hidden');
    if (els.settingsUpdateProgressRow) els.settingsUpdateProgressRow.classList.add('hidden');

    // Update modal
    if (els.updateModalTitle) els.updateModalTitle.textContent = `UPDATE v${ver} AVAILABLE`;
    if (els.updateModalNotes) els.updateModalNotes.textContent = notes;
    if (els.updateModalDesc) els.updateModalDesc.textContent = `Nidalplayer v${ver} is ready to download. Click below to start downloading in the background — you can keep using the app while it downloads.`;
    document.getElementById('updateModalDownloadBtn')?.classList.remove('hidden');
    document.getElementById('updateModalRestartBtn')?.classList.add('hidden');

    // Floating banner
    if (els.floatingUpdateBanner) {
      els.floatingUpdateBanner.classList.remove('hidden');
      if (els.floatingUpdateTitle) els.floatingUpdateTitle.textContent = `UPDATE AVAILABLE // v${ver}`;
      if (els.floatingUpdateDesc) els.floatingUpdateDesc.textContent = `Nidalplayer v${ver} is available. Download it now and restart when ready.`;
      if (els.floatingUpdateProgressTrack) els.floatingUpdateProgressTrack.classList.add('hidden');
      document.getElementById('floatingUpdateDownloadBtn')?.classList.remove('hidden');
      if (els.floatingUpdateInstallBtn) els.floatingUpdateInstallBtn.classList.add('hidden');
    }

    showToast(`Update v${ver} available — click to download when ready.`);
  }

  // ── Helper: show downloading state ────────────────────────────────────────
  function showDownloadingUI(ver) {
    if (els.settingsUpdateSubtitle) els.settingsUpdateSubtitle.textContent = `Downloading v${ver}…`;
    document.getElementById('settingsDownloadUpdateBtn')?.classList.add('hidden');
    document.getElementById('settingsSkipUpdateBtn')?.classList.add('hidden');
    if (els.settingsUpdateProgressRow) els.settingsUpdateProgressRow.classList.remove('hidden');

    if (els.floatingUpdateBanner) {
      els.floatingUpdateBanner.classList.remove('hidden');
      if (els.floatingUpdateTitle) els.floatingUpdateTitle.textContent = `DOWNLOADING // v${ver}`;
      if (els.floatingUpdateDesc) els.floatingUpdateDesc.textContent = `Downloading Nidalplayer v${ver} in the background…`;
      if (els.floatingUpdateProgressTrack) els.floatingUpdateProgressTrack.classList.remove('hidden');
      if (els.floatingUpdateProgressBar) els.floatingUpdateProgressBar.style.width = '0%';
      document.getElementById('floatingUpdateDownloadBtn')?.classList.add('hidden');
      if (els.floatingUpdateInstallBtn) els.floatingUpdateInstallBtn.classList.add('hidden');
    }
  }

  // ── Helper: show downloaded/ready-to-install state ────────────────────────
  function showReadyToInstallUI(info) {
    availableUpdateInfo = info;
    const ver = info?.version || '';
    const notes = formatReleaseNotes(info?.releaseNotes, ver);

    // Settings section
    if (els.settingsUpdateProgressRow) els.settingsUpdateProgressRow.classList.add('hidden');
    if (els.settingsInstallUpdateBtn) els.settingsInstallUpdateBtn.classList.remove('hidden');
    document.getElementById('settingsDownloadUpdateBtn')?.classList.add('hidden');
    document.getElementById('settingsSkipUpdateBtn')?.classList.remove('hidden');
    if (els.settingsUpdateSubtitle) {
      els.settingsUpdateSubtitle.textContent = `v${ver} downloaded successfully — restart to apply.`;
    }
    if (els.topUpdateBtn) {
      els.topUpdateBtn.classList.remove('hidden');
      if (els.topUpdateBtnText) els.topUpdateBtnText.textContent = `UPDATE v${ver} READY`;
    }

    // Update modal
    if (els.updateModalTitle) els.updateModalTitle.textContent = `UPDATE v${ver} READY TO INSTALL`;
    if (els.updateModalNotes) els.updateModalNotes.textContent = notes;
    if (els.updateModalDesc) els.updateModalDesc.textContent = `Nidalplayer v${ver} has been downloaded. Restart now to apply it, or click LATER to install it next time you close the app.`;
    document.getElementById('updateModalDownloadBtn')?.classList.add('hidden');
    document.getElementById('updateModalRestartBtn')?.classList.remove('hidden');

    // Floating banner
    if (els.floatingUpdateBanner) {
      els.floatingUpdateBanner.classList.remove('hidden');
      if (els.floatingUpdateTitle) els.floatingUpdateTitle.textContent = `READY TO INSTALL // v${ver}`;
      if (els.floatingUpdateDesc) els.floatingUpdateDesc.textContent = `v${ver} downloaded. Restart Nidalplayer to apply the update.`;
      if (els.floatingUpdateProgressTrack) els.floatingUpdateProgressTrack.classList.add('hidden');
      document.getElementById('floatingUpdateDownloadBtn')?.classList.add('hidden');
      if (els.floatingUpdateInstallBtn) {
        els.floatingUpdateInstallBtn.textContent = '\u26a1 RESTART & INSTALL';
        els.floatingUpdateInstallBtn.classList.remove('hidden');
      }
    }

    // Show modal automatically only once per version
    if (ver && localStorage.getItem('nidalplayer-notified-install') !== ver) {
      localStorage.setItem('nidalplayer-notified-install', ver);
      els.updateNoticeModal?.classList.remove('hidden');
    }
    showToast(`Update v${ver} ready — restart to install.`);
  }

  // ── Helper: trigger install ────────────────────────────────────────────────
  const triggerInstall = () => {
    showToast('Restarting Nidalplayer to apply update...');
    bridge.restartAndInstallUpdate?.();
  };

  // ── Helper: skip this version ──────────────────────────────────────────────
  const skipVersion = () => {
    const ver = availableUpdateInfo?.version || '';
    if (ver) {
      skippedVersion = ver;
      localStorage.setItem('nidalplayer-skipped-version', ver);
    }
    els.updateNoticeModal?.classList.add('hidden');
    els.floatingUpdateBanner?.classList.add('hidden');
    document.getElementById('settingsDownloadUpdateBtn')?.classList.add('hidden');
    document.getElementById('settingsSkipUpdateBtn')?.classList.add('hidden');
    if (els.settingsUpdateSubtitle) {
      els.settingsUpdateSubtitle.textContent = ver ? `Update v${ver} skipped. Click CHECK FOR UPDATES to re-check.` : 'Update skipped.';
    }
    showToast(`Update v${ver || ''} skipped.`);
  };

  // ── Helper: user-triggered download ───────────────────────────────────────
  const triggerDownload = async () => {
    const ver = availableUpdateInfo?.version || '';
    showDownloadingUI(ver);
    showToast(`Downloading update v${ver}…`);
    try {
      await bridge.triggerUpdateDownload?.();
    } catch (err) {
      showToast('Download failed — try again or download from GitHub.');
      if (els.settingsUpdateSubtitle) {
        els.settingsUpdateSubtitle.textContent = 'Download failed. Retry or visit GitHub Releases.';
      }
      document.getElementById('settingsDownloadUpdateBtn')?.classList.remove('hidden');
    }
  };

  // ── Updater Events ────────────────────────────────────────────────────────
  bridge.onUpdaterChecking?.(() => {
    if (els.settingsCheckUpdateIcon) els.settingsCheckUpdateIcon.textContent = '\u21bb';
    if (els.settingsCheckUpdateText) els.settingsCheckUpdateText.textContent = 'CHECKING...';
    if (els.settingsCheckUpdateBtn) els.settingsCheckUpdateBtn.disabled = true;
  });

  bridge.onUpdaterAvailable?.(info => {
    if (els.settingsCheckUpdateBtn) els.settingsCheckUpdateBtn.disabled = false;
    if (els.settingsCheckUpdateText) els.settingsCheckUpdateText.textContent = 'CHECK FOR UPDATES';

    // Respect user's skip choice
    if (info?.version && info.version === skippedVersion) {
      console.log(`[Updater UI] Version ${info.version} was skipped by user.`);
      if (els.settingsUpdateSubtitle) {
        els.settingsUpdateSubtitle.textContent = `v${info.version} available (skipped). Clear skip in Settings to re-enable.`;
      }
      return;
    }
    showUpdateAvailableUI(info);
  });

  bridge.onUpdaterNotAvailable?.(info => {
    availableUpdateInfo = null;
    if (els.settingsCheckUpdateBtn) els.settingsCheckUpdateBtn.disabled = false;
    if (els.settingsCheckUpdateText) els.settingsCheckUpdateText.textContent = 'CHECK FOR UPDATES';
    if (els.settingsUpdateSubtitle) {
      els.settingsUpdateSubtitle.textContent = `\u2713 Nidalplayer is up to date (v${info?.version || ''}).`;
    }
    if (els.settingsUpdateProgressRow) els.settingsUpdateProgressRow.classList.add('hidden');
    els.floatingUpdateBanner?.classList.add('hidden');
    showToast('Nidalplayer is up to date.');
  });

  bridge.onUpdaterProgress?.(progress => {
    const percent = Math.round(progress?.percent || 0);
    if (els.settingsUpdateProgressRow) els.settingsUpdateProgressRow.classList.remove('hidden');
    if (els.settingsUpdateProgressBar) els.settingsUpdateProgressBar.style.width = `${percent}%`;
    if (els.settingsUpdateProgressText) els.settingsUpdateProgressText.textContent = `Downloading update… ${percent}%`;
    if (els.settingsUpdateSpeedText && progress?.bytesPerSecond) {
      els.settingsUpdateSpeedText.textContent = `${(progress.bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
    }
    if (els.floatingUpdateProgressBar) els.floatingUpdateProgressBar.style.width = `${percent}%`;
    if (els.floatingUpdateDesc) {
      const speed = progress?.bytesPerSecond ? ` · ${(progress.bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s` : '';
      els.floatingUpdateDesc.textContent = `Downloading update… ${percent}%${speed}`;
    }
  });

  bridge.onUpdaterDownloaded?.(info => showReadyToInstallUI(info));

  bridge.onUpdaterError?.(err => {
    if (els.settingsCheckUpdateBtn) els.settingsCheckUpdateBtn.disabled = false;
    if (els.settingsCheckUpdateText) els.settingsCheckUpdateText.textContent = 'CHECK FOR UPDATES';
    if (els.settingsUpdateProgressRow) els.settingsUpdateProgressRow.classList.add('hidden');
    const msg = String(err?.message || err || '');
    console.warn('[Updater UI] Error:', msg);
    const targetVer = availableUpdateInfo?.version ? `v${availableUpdateInfo.version}` : 'latest version';

    if (els.settingsUpdateSubtitle) {
      if (msg.includes('404')) {
        els.settingsUpdateSubtitle.innerHTML = `<span style="color:#ff9f1c;">\u26a0 Release binary not yet attached to this GitHub release.</span> <a href="#" id="settingsManualReleaseLink" style="color:var(--accent-cyan); text-decoration:underline; font-weight:600; margin-left:6px; cursor:pointer;">Download ${targetVer} from GitHub manually</a>`;
      } else {
        els.settingsUpdateSubtitle.innerHTML = `<span>Update error: ${msg.slice(0, 80)}</span> <a href="#" id="settingsManualReleaseLink" style="color:var(--accent-cyan); text-decoration:underline; font-weight:600; margin-left:6px; cursor:pointer;">Open GitHub Releases</a>`;
      }
      document.getElementById('settingsManualReleaseLink')?.addEventListener('click', e => {
        e.preventDefault();
        bridge.openExternal?.(githubReleasesUrl);
      });
    }

    // Reset floating banner to offer manual download
    if (els.floatingUpdateBanner && !els.floatingUpdateBanner.classList.contains('hidden')) {
      const fver = availableUpdateInfo?.version;
      if (els.floatingUpdateTitle) els.floatingUpdateTitle.textContent = fver ? `UPDATE ${fver.toUpperCase()} // ERROR` : 'UPDATE ERROR';
      if (els.floatingUpdateDesc) els.floatingUpdateDesc.textContent = `Background download failed. Click to download ${targetVer} from GitHub.`;
      if (els.floatingUpdateProgressTrack) els.floatingUpdateProgressTrack.classList.add('hidden');
      if (els.floatingUpdateInstallBtn) els.floatingUpdateInstallBtn.classList.add('hidden');
      const dlBtn = document.getElementById('floatingUpdateDownloadBtn');
      if (dlBtn) {
        dlBtn.textContent = '\ud83c\udf10 DOWNLOAD FROM GITHUB';
        dlBtn.classList.remove('hidden');
        dlBtn.onclick = () => bridge.openExternal?.(githubReleasesUrl);
      }
    }
  });

  // ── Button: Check for Updates ─────────────────────────────────────────────
  els.settingsCheckUpdateBtn?.addEventListener('click', async () => {
    els.settingsCheckUpdateBtn.disabled = true;
    if (els.settingsCheckUpdateText) els.settingsCheckUpdateText.textContent = 'CHECKING...';
    try {
      const res = await bridge.checkForUpdates();
      if (res?.dev) {
        showToast(res.message || 'Auto-updates active in packaged builds.');
        if (els.settingsUpdateSubtitle) els.settingsUpdateSubtitle.textContent = res.message || 'Running in dev mode. Updates active in packaged app.';
      } else if (res?.ok === false) {
        showToast('Update check failed: ' + (res.error?.slice(0, 60) || 'Unknown error.'));
      }
    } catch {
      showToast('Could not reach update server. Check your connection.');
    } finally {
      setTimeout(() => {
        if (els.settingsCheckUpdateBtn) els.settingsCheckUpdateBtn.disabled = false;
        if (els.settingsCheckUpdateText) els.settingsCheckUpdateText.textContent = 'CHECK FOR UPDATES';
      }, 2000);
    }
  });

  // ── Button: Download Update (Settings) ────────────────────────────────────
  document.getElementById('settingsDownloadUpdateBtn')?.addEventListener('click', triggerDownload);

  // ── Button: Skip Version (Settings) ───────────────────────────────────────
  document.getElementById('settingsSkipUpdateBtn')?.addEventListener('click', skipVersion);

  // ── Button: Install Update (Settings) ─────────────────────────────────────
  els.settingsInstallUpdateBtn?.addEventListener('click', triggerInstall);

  // ── Top Bar Update Button ─────────────────────────────────────────────────
  els.topUpdateBtn?.addEventListener('click', () => els.updateNoticeModal?.classList.remove('hidden'));

  // ── Update Modal Buttons ──────────────────────────────────────────────────
  document.getElementById('updateModalDownloadBtn')?.addEventListener('click', () => {
    els.updateNoticeModal?.classList.add('hidden');
    triggerDownload();
  });
  document.getElementById('updateModalRestartBtn')?.addEventListener('click', triggerInstall);
  document.getElementById('updateModalSkipBtn')?.addEventListener('click', skipVersion);
  els.updateModalDismissBtn?.addEventListener('click', () => els.updateNoticeModal?.classList.add('hidden'));

  // ── Floating Banner Buttons ───────────────────────────────────────────────
  els.floatingUpdateCloseBtn?.addEventListener('click', () => els.floatingUpdateBanner?.classList.add('hidden'));
  els.floatingUpdateDetailsBtn?.addEventListener('click', () => els.updateNoticeModal?.classList.remove('hidden'));
  document.getElementById('floatingUpdateDownloadBtn')?.addEventListener('click', () => {
    els.floatingUpdateBanner?.classList.add('hidden');
    triggerDownload();
  });
  document.getElementById('floatingUpdateSkipBtn')?.addEventListener('click', skipVersion);
  els.floatingUpdateInstallBtn?.addEventListener('click', triggerInstall);
}

function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.remove('hidden');
  clearTimeout(els.toast.timer);
  els.toast.timer = setTimeout(() => {
    els.toast.classList.add('hidden');
  }, 3500);
}
