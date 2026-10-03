const state = {
  favorites: new Set(),
  watchProgress: {},
  destination: 'series'
};
for (let i = 0; i < 50; i++) {
  state.favorites.add(`series-${i}`);
  state.watchProgress[`series-${i}`] = { isWatched: true, currentTime: 10 };
}

const series = [];
for (let i = 0; i < 20000; i++) {
  series.push({ id: `series-${i}`, name: `Series ${i}`, group: 'Series', type: 'series', seriesId: `series-${i}` });
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

function getWatchProgressForSortOptimized(item, type, seriesProgressMap) {
  if (!item) return null;
  const wp = state.watchProgress || {};
  const itemId = String(item.id || '');
  const cleanId = itemId.replace(/^(?:series|movie|live)-/, '');
  const seriesId = item.seriesId ? String(item.seriesId).replace(/^series-/, '') : '';

  if (wp[itemId]) return wp[itemId];
  if (cleanId && wp[cleanId]) return wp[cleanId];
  if (seriesId && wp[seriesId]) return wp[seriesId];
  if (seriesId && wp['series-' + seriesId]) return wp['series-' + seriesId];

  if (type === 'series' && seriesProgressMap) {
      if (seriesProgressMap.has(cleanId)) return seriesProgressMap.get(cleanId);
      if (seriesId && seriesProgressMap.has(seriesId)) return seriesProgressMap.get(seriesId);
  }
  return null;
}

function isItemWatchedOrProgressOptimized(item, type, seriesProgressMap) {
  if (!item) return false;
  if (type === 'live') {
    return (state.recent && state.recent.includes(item.id)) || !!state.watchProgress[item.id];
  }
  const prog = getWatchProgressForSortOptimized(item, type, seriesProgressMap);
  if (!prog) return false;
  if (prog.isWatched) return true;
  if (Number(prog.percentage || 0) >= 85) return true;
  if (Number(prog.currentTime || 0) >= 15 && Number(prog.percentage || 0) > 0) return true;
  if (Number(prog.updatedAt || prog.lastWatched || 0) > 0) return true;
  return false;
}


function filterAndRenderItems_original() {
  const start = performance.now();
  let filtered = [...series];
  const curType = state.destination;

  const sortMetaMap = new Map();
  for (let i = 0; i < filtered.length; i++) {
    const item = filtered[i];
    const watched = isItemWatchedOrProgress(item, curType);
    let time = 0;
    if (watched) {
      const p = getWatchProgressForSort(item, curType);
      time = (p && (p.updatedAt || p.lastWatched || p.currentTime)) || 0;
    }
    sortMetaMap.set(item, { watched, time });
  }

  filtered.sort((a, b) => {
    const metaA = sortMetaMap.get(a) || { watched: false, time: 0 };
    const metaB = sortMetaMap.get(b) || { watched: false, time: 0 };
    const watchedA = metaA.watched;
    const watchedB = metaB.watched;
    if (watchedA && !watchedB) return -1;
    if (!watchedA && watchedB) return 1;
    if (watchedA && watchedB) {
      if (metaA.time !== metaB.time) return metaB.time - metaA.time;
    }
    return (a.providerOrder || 0) - (b.providerOrder || 0);
  });

  const end = performance.now();
  return end - start;
}

function filterAndRenderItems_optimized() {
  const start = performance.now();
  let filtered = [...series];
  const curType = state.destination;

  const seriesProgressMap = new Map();
  if (curType === 'series') {
    const wp = state.watchProgress || {};
    for (const key in wp) {
      const p = wp[key];
      if (p) {
        const pSeriesId = String(p.seriesId || p.parentSeriesId || '').replace(/^series-/, '');
        if (pSeriesId) {
          seriesProgressMap.set(pSeriesId, p);
        }
      }
    }
  }

  const sortMetaMap = new Map();
  for (let i = 0; i < filtered.length; i++) {
    const item = filtered[i];
    const watched = isItemWatchedOrProgressOptimized(item, curType, seriesProgressMap);
    let time = 0;
    if (watched) {
      const p = getWatchProgressForSortOptimized(item, curType, seriesProgressMap);
      time = (p && (p.updatedAt || p.lastWatched || p.currentTime)) || 0;
    }
    sortMetaMap.set(item, { watched, time });
  }

  filtered.sort((a, b) => {
    const metaA = sortMetaMap.get(a) || { watched: false, time: 0 };
    const metaB = sortMetaMap.get(b) || { watched: false, time: 0 };
    const watchedA = metaA.watched;
    const watchedB = metaB.watched;
    if (watchedA && !watchedB) return -1;
    if (!watchedA && watchedB) return 1;
    if (watchedA && watchedB) {
      if (metaA.time !== metaB.time) return metaB.time - metaA.time;
    }
    return (a.providerOrder || 0) - (b.providerOrder || 0);
  });

  const end = performance.now();
  return end - start;
}


const orig = filterAndRenderItems_original();
const opt = filterAndRenderItems_optimized();
console.log(`filterAndRenderItems Original: ${orig.toFixed(2)}ms`);
console.log(`filterAndRenderItems Optimized: ${opt.toFixed(2)}ms`);
