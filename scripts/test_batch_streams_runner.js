const fs = require('fs');

const domElements = {};
function createMockElement(tag, id = '') {
  const el = {
    tagName: tag.toUpperCase(),
    id: id,
    textContent: '',
    _innerHTML: '',
    get innerHTML() { return this._innerHTML; },
    set innerHTML(val) {
      this._innerHTML = val;
      if (val === '') this.children = [];
    },
    value: '',
    style: {},
    tabIndex: 0,
    dataset: {},
    children: [],
    paused: true,
    videoWidth: 1920,
    videoHeight: 1080,
    removeAttribute(a) { delete this.dataset[a]; },
    setAttribute(k, v) { this.dataset[k] = String(v); },
    getAttribute(k) { return this.dataset[k] !== undefined ? this.dataset[k] : null; },
    load() {},
    pause() { this.paused = true; },
    play() { this.paused = false; return Promise.resolve(); },
    classList: {
      _classes: new Set(),
      add(...cls) { cls.forEach(c => this._classes.add(c)); },
      remove(...cls) { cls.forEach(c => this._classes.delete(c)); },
      contains(c) { return this._classes.has(c); },
      toggle(c, f) { if (f !== undefined) (f ? this.add(c) : this.remove(c)); else (this.contains(c) ? this.remove(c) : this.add(c)); }
    },
    appendChild(child) {
      this.children.push(child);
      if (child.innerHTML) this._innerHTML += child.innerHTML;
      return child;
    },
    contains(node) {
      if (!node) return false;
      return this.children.includes(node);
    },
    querySelectorAll(selector) {
      const res = [];
      function recurse(n) {
        if (n.classList && selector.startsWith('.')) {
          if (n.classList.contains(selector.substring(1))) res.push(n);
        }
        (n.children || []).forEach(recurse);
      }
      recurse(el);
      return res;
    },
    querySelector(s) {
      const all = this.querySelectorAll(s);
      return all[0] || null;
    },
    addEventListener(evt, fn) { this['on' + evt] = fn; },
    getBoundingClientRect() { return { left: 700, top: 120, width: 480, height: 270 }; },
    focus() { if (this.onfocus) this.onfocus(); },
    click() { if (this.onclick) this.onclick(); }
  };
  return el;
}

const mockIds = [
  'tvLiveCats', 'tvLiveList', 'tvLiveCatTotal', 'tvLiveChanTotal', 'tvPreviewTitle', 'tvPreviewMeta', 'tvLivePreviewBox', 'tvPreviewVideo',
  'tvMovieCats', 'tvMovieList', 'tvMovieCatTotal', 'tvMovieTotal', 'tvMoviePreviewTitle', 'tvMoviePreviewMeta', 'tvMoviePreviewPoster', 'tvMoviePreviewVideo', 'tvMoviePreviewBadge', 'tvMoviePreviewBox',
  'tvSeriesCats', 'tvSeriesList', 'tvSeriesCatTotal', 'tvSeriesTotal', 'tvSeriesPreviewTitle', 'tvSeriesSeasonChips', 'tvSeriesEpisodesScroll', 'tvSeriesPreviewBox', 'tvSeriesPreviewVideo',
  'tvViewHome', 'tvViewLive', 'tvViewMovies', 'tvViewSeries', 'tvViewConfig', 'tvShelfLive', 'tvShelfMovies', 'tvShelfSeries', 'tvHomePreviewBox',
  'tvFsPlayer', 'tvFsVideo', 'tvModalOverlay', 'tvModalContent', 'tvResumeModal', 'resumePromptText', 'btnResumePlay', 'btnResumeStart'
];

mockIds.forEach(id => {
  domElements[id] = createMockElement('div', id);
});

// Map camelCase aliases matching tv-app.js dom bindings
domElements.liveCats = domElements.tvLiveCats;
domElements.liveList = domElements.tvLiveList;
domElements.previewTitle = domElements.tvPreviewTitle;
domElements.previewMeta = domElements.tvPreviewMeta;
domElements.previewVideoBox = domElements.tvLivePreviewBox;
domElements.previewVideo = domElements.tvPreviewVideo;

domElements.movieCats = domElements.tvMovieCats;
domElements.movieList = domElements.tvMovieList;
domElements.moviePreviewTitle = domElements.tvMoviePreviewTitle;
domElements.moviePreviewMeta = domElements.tvMoviePreviewMeta;
domElements.moviePreviewPoster = domElements.tvMoviePreviewPoster;
domElements.moviePreviewVideo = domElements.tvMoviePreviewVideo;
domElements.moviePreviewBadge = domElements.tvMoviePreviewBadge;
domElements.moviePreviewBox = domElements.tvMoviePreviewBox || domElements.tvMoviePreviewVideo;

domElements.seriesCats = domElements.tvSeriesCats;
domElements.seriesList = domElements.tvSeriesList;
domElements.seriesPreviewTitle = domElements.tvSeriesPreviewTitle;
domElements.seriesSeasonChips = domElements.tvSeriesSeasonChips;
domElements.seriesEpisodesScroll = domElements.tvSeriesEpisodesScroll;
domElements.seriesPreviewBox = domElements.tvSeriesPreviewBox;
domElements.seriesPreviewVideo = domElements.tvSeriesPreviewVideo;

domElements.tvFsPlayer.classList.add('hidden');
domElements.tvModalOverlay.classList.add('hidden');
domElements.tvResumeModal.classList.add('hidden');

let nativePlayedItem = null;
global.window = {
  location: { href: 'http://localhost:8765/' },
  localStorage: {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
  },
  setInterval: () => {},
  clearInterval: () => {},
  setTimeout: (fn) => fn(),
  clearTimeout: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  AndroidBridge: {
    updateRemoteState() {},
    log() {},
    playNativeStream(url, name) { nativePlayedItem = { url, name }; },
    playNativeMedia(url, name) { nativePlayedItem = { url, name }; },
    playNativeEpisode(url, name) { nativePlayedItem = { url, name }; },
    stopNativeStream() { nativePlayedItem = null; },
    playNativePreview(url, l, t, w, h) { nativePlayedItem = { url, isPreview: true }; },
    expandNativePreviewToFullscreen() { if (nativePlayedItem) nativePlayedItem.isFs = true; },
    shrinkNativePreview() { if (nativePlayedItem) nativePlayedItem.isFs = false; },
    stopNativePreview() { nativePlayedItem = null; }
  }
};
global.localStorage = global.window.localStorage;
global.document = {
  getElementById(id) {
    if (!domElements[id]) domElements[id] = createMockElement('div', id);
    return domElements[id];
  },
  createElement(tag) { return createMockElement(tag); },
  querySelectorAll(sel) { return []; },
  querySelector(sel) { return null; },
  addEventListener(evt, fn) { this['on' + evt] = fn; },
  documentElement: {
    lang: 'en',
    dir: 'ltr',
    setAttribute(k, v) { this[k] = v; }
  },
  body: createMockElement('body')
};

let tvAppCode = fs.readFileSync('android-tv/assets/www/js/tv-app.js', 'utf8').trim();
const firstBrace = tvAppCode.indexOf('{');
const lastBrace = tvAppCode.lastIndexOf('}');
tvAppCode = tvAppCode.substring(firstBrace + 1, lastBrace);
tvAppCode = tvAppCode.replace('var state = {', 'window.tvState = state = {');

const injectedTvCode = `
  var dom = domElements;
` + tvAppCode;

eval(injectedTvCode);

const testState = window.tvState;

// BUNCH OF 20 DIVERSE STREAMS
const batchLiveStreams = [
  { id: 'live-hls-1', name: 'Sky Cinema Premiere HD', group: 'Cinema', type: 'live', url: 'http://cdn.iptv.com/live/u1/p1/1001.m3u8' },
  { id: 'live-ts-2', name: 'BBC One HD (TS Stream)', group: 'General', type: 'live', url: 'http://cdn.iptv.com/live/u1/p1/1002.ts' },
  { id: 'live-ts-3', name: 'Canal+ Sport 4K', group: 'Sports', type: 'live', url: 'http://cdn.iptv.com/live/u1/p1/1003.ts' },
  { id: 'live-direct-4', name: 'BeIN Sports 1 Premium', group: 'Sports', type: 'live', url: 'http://cdn.iptv.com/live/u1/p1/1004' },
  { id: 'live-hls-5', name: 'Eurosport 1 UHD', group: 'Sports', type: 'live', url: 'http://cdn.iptv.com/live/u1/p1/1005.m3u8' },
  { id: 'live-ts-6', name: 'Discovery Science HD', group: 'Doc', type: 'live', url: 'http://cdn.iptv.com/live/u1/p1/1006.ts' },
  { id: 'live-hls-7', name: 'National Geographic Wild', group: 'Doc', type: 'live', url: 'http://cdn.iptv.com/live/u1/p1/1007.m3u8' }
];

const batchMovieStreams = [
  { id: 'vod-mp4-1', name: 'Dune: Part Two (2024)', group: 'Sci-Fi', type: 'movies', url: 'http://cdn.iptv.com/movie/u1/p1/2001.mp4' },
  { id: 'vod-mkv-2', name: 'Oppenheimer (2023)', group: 'Drama', type: 'movies', url: 'http://cdn.iptv.com/movie/u1/p1/2002.mkv' },
  { id: 'vod-mp4-3', name: 'Gladiator II (2024)', group: 'Action', type: 'movies', url: 'http://cdn.iptv.com/movie/u1/p1/2003.mp4' },
  { id: 'vod-webm-4', name: 'Alien: Romulus (2024)', group: 'Horror', type: 'movies', url: 'http://cdn.iptv.com/movie/u1/p1/2004.webm' },
  { id: 'vod-avi-5', name: 'The Matrix (1999 Classic)', group: 'Action', type: 'movies', url: 'http://cdn.iptv.com/movie/u1/p1/2005.avi' },
  { id: 'vod-ts-6', name: 'Avatar: The Way of Water', group: 'Sci-Fi', type: 'movies', url: 'http://cdn.iptv.com/movie/u1/p1/2006.ts' },
  { id: 'vod-mkv-7', name: 'Interstellar IMAX Remaster', group: 'Sci-Fi', type: 'movies', url: 'http://cdn.iptv.com/movie/u1/p1/2007.mkv' }
];

const batchSeriesStreams = [
  {
    id: 'series-501', seriesId: '501', name: 'House of the Dragon', group: 'Fantasy', type: 'series',
    episodes: [
      { id: 'ep-501-1', title: 'The Heirs of the Dragon', num: 1, season: '1', url: 'http://cdn.iptv.com/series/u1/p1/50101.mp4' },
      { id: 'ep-501-2', title: 'The Rogue Prince', num: 2, season: '1', url: 'http://cdn.iptv.com/series/u1/p1/50102.mkv' },
      { id: 'ep-501-3', title: 'Second of His Name', num: 3, season: '1', url: 'http://cdn.iptv.com/series/u1/p1/50103.ts' }
    ]
  },
  {
    id: 'series-502', seriesId: '502', name: 'Shogun (2024)', group: 'Historical', type: 'series',
    episodes: [
      { id: 'ep-502-1', title: 'Chapter One: Anjin', num: 1, season: '1', url: 'http://cdn.iptv.com/series/u1/p1/50201.mkv' },
      { id: 'ep-502-2', title: 'Chapter Two: Servants of Two Masters', num: 2, season: '1', url: 'http://cdn.iptv.com/series/u1/p1/50202.mp4' },
      { id: 'ep-502-3', title: 'Chapter Three: Tomorrow is Tomorrow', num: 3, season: '1', url: 'http://cdn.iptv.com/series/u1/p1/50203.mkv' }
    ]
  }
];

testState.categories = {
  live: ['Cinema', 'General', 'Sports', 'Doc'],
  movies: ['Sci-Fi', 'Drama', 'Action', 'Horror'],
  series: ['Fantasy', 'Historical']
};
testState.liveItems = batchLiveStreams;
testState.movieItems = batchMovieStreams;
testState.seriesItems = batchSeriesStreams;

let passCount = 0;
let failCount = 0;

console.log('================================================================');
console.log('TESTING BATCH OF 20 DIVERSE STREAMS ACROSS LIVE, MOVIES & SERIES');
console.log('================================================================\n');

// 1. Test Live TV Streams (7 streams)
switchView('live');
render3ColLive();

batchLiveStreams.forEach((st, idx) => {
  console.log(`[TEST LIVE ${idx + 1}/7] Stream: ${st.name} | Format: ${st.url.split('.').pop()}`);
  const itemEl = domElements.tvLiveList.children[idx];
  
  // Focus: verify NO auto-play
  itemEl.focus();
  if (testState.playingPreviewId !== null && testState.playingPreviewId === st.id) {
    console.error(`  ❌ Failed: Auto-played on focus for ${st.name}`);
    failCount++;
    return;
  }
  
  // 1st OK: verify preview plays in native bridge or HTML5 video
  itemEl.click();
  const isPreviewing = testState.playingPreviewId === st.id && (nativePlayedItem !== null || domElements.tvPreviewVideo.paused === false);
  if (!isPreviewing || testState.isFullscreen) {
    console.error(`  ❌ Failed: 1st OK did not start preview for ${st.name}`);
    failCount++;
    return;
  }
  
  // 2nd OK: verify fullscreen launches
  itemEl.click();
  const isFs = testState.isFullscreen === true || (nativePlayedItem && nativePlayedItem.isFs);
  if (!isFs) {
    console.error(`  ❌ Failed: 2nd OK failed to enter fullscreen for ${st.name}`);
    failCount++;
    return;
  }
  
  // Clean exit from fullscreen
  nativePlayedItem = null;
  closeFullscreen();
  stopLivePreviewVideo();
  
  console.log(`  ✅ Passed: Preview & Fullscreen OK for ${st.name}`);
  passCount++;
});

// 2. Test Movie Streams (7 streams)
switchView('movies');
render3ColMovies();

batchMovieStreams.forEach((mov, idx) => {
  console.log(`\n[TEST MOVIE ${idx + 1}/7] Movie: ${mov.name} | Ext: ${mov.url.split('.').pop()}`);
  
  // Re-render to simulate navigating to movie view
  render3ColMovies(true);
  const itemEl = domElements.tvMovieList.children.find(c => c.dataset['data-preview-item-id'] === String(mov.id)) || domElements.tvMovieList.children[idx];
  
  // Focus: verify NO auto-play
  itemEl.focus();
  if (testState.playingPreviewId !== null && testState.playingPreviewId === mov.id) {
    console.error(`  ❌ Failed: Auto-played on focus for ${mov.name}`);
    failCount++;
    return;
  }
  
  // 1st OK: verify movie preview plays in native bridge / HTML5 video
  itemEl.click();
  const isMoviePreviewing = testState.playingPreviewId === mov.id && (nativePlayedItem !== null || domElements.tvMoviePreviewVideo.paused === false);
  
  if (!isMoviePreviewing) {
    console.error(`  ❌ Failed: 1st OK did not activate movie preview player for ${mov.name} (isMoviePreviewing=${isMoviePreviewing}, playingPreviewId=${testState.playingPreviewId})`);
    failCount++;
    return;
  }
  
  // 2nd OK: verify fullscreen launches
  itemEl.click();
  const isFs = testState.isFullscreen === true || (nativePlayedItem && nativePlayedItem.isFs) || !domElements.tvResumeModal.classList.contains('hidden');
  if (!isFs) {
    console.error(`  ❌ Failed: 2nd OK failed to launch movie player for ${mov.name}`);
    failCount++;
    return;
  }
  
  nativePlayedItem = null;
  closeFullscreen();
  stopLivePreviewVideo();
  
  console.log(`  ✅ Passed: Movie Preview & Fullscreen OK for ${mov.name}`);
  passCount++;
});

// 3. Test Series Episode Streams (6 episodes)
switchView('series');
render3ColSeries();

let epTestCount = 0;
batchSeriesStreams.forEach(ser => {
  testState.activeSeries = ser;
  ser.episodes.forEach(ep => {
    epTestCount++;
    console.log(`\n[TEST SERIES EP ${epTestCount}/6] Episode: ${ser.name} S${ep.season}E${ep.num} (${ep.title})`);
    
    state.activeSeries = ser;
    state.currentEpisodeList = ser.episodes;
    renderDockEpisodes(ser.episodes, ep.season);
    const epEl = domElements.tvSeriesEpisodesScroll.children[ep.num - 1];
    
    // 1st OK: verify episode preview plays & dock preview box opens
    epEl.click();
    const isSeriesPreviewing = testState.playingPreviewId === ep.id && (nativePlayedItem !== null || domElements.tvSeriesPreviewVideo.paused === false);
    
    if (!isSeriesPreviewing) {
      console.error(`  ❌ Failed: 1st OK did not start series dock preview for ${ep.title}`);
      failCount++;
      return;
    }
    
    // 2nd OK: verify fullscreen launches
    epEl.click();
    const isFs = testState.isFullscreen === true || (nativePlayedItem && nativePlayedItem.isFs) || !domElements.tvResumeModal.classList.contains('hidden');
    if (!isFs) {
      console.error(`  ❌ Failed: 2nd OK failed to enter fullscreen for ${ep.title}`);
      failCount++;
      return;
    }
    
    nativePlayedItem = null;
    closeFullscreen();
    stopLivePreviewVideo();
    
    console.log(`  ✅ Passed: Series Episode Preview & Fullscreen OK for ${ep.title}`);
    passCount++;
  });
});

console.log('\n================================================================');
console.log(`BATCH STREAM TEST COMPLETE: ${passCount} PASSED, ${failCount} FAILED (TOTAL 20 STREAMS)`);
console.log('================================================================');

if (failCount > 0) process.exit(1);
else process.exit(0);
