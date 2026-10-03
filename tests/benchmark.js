const state = { watchProgress: {} };
for (let i = 0; i < 1000; i++) {
  state.watchProgress[`item-${i}`] = { seriesId: `series-${i}`, currentTime: 10 };
}

const series = [];
for (let i = 0; i < 20000; i++) {
  series.push({ id: `series-${i}`, type: 'series' });
}

function getWatchProgressForSort(item, type, seriesProgressMap = null) {
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
    if (seriesProgressMap) {
      if (seriesProgressMap.has(cleanId)) return seriesProgressMap.get(cleanId);
      if (seriesId && seriesProgressMap.has(seriesId)) return seriesProgressMap.get(seriesId);
    } else {
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
  }
  return null;
}

const start1 = performance.now();
for (const s of series) {
  getWatchProgressForSort(s, 'series');
}
const end1 = performance.now();

const start2 = performance.now();
const seriesProgressMap = new Map();
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
for (const s of series) {
  getWatchProgressForSort(s, 'series', seriesProgressMap);
}
const end2 = performance.now();

console.log(`Original: ${(end1 - start1).toFixed(2)}ms`);
console.log(`Optimized: ${(end2 - start2).toFixed(2)}ms`);

// Benchmark publishRemoteState array operations
const liveChannels = [];
const favSet = new Set(['live-500', 'live-1000']);
for (let i = 0; i < 100000; i++) {
  liveChannels.push({ id: `live-${i}`, name: `Ch ${i}`, group: 'TV', logo: '' });
}
const isFavOrWatched = c => favSet.has(c.id);

const start3 = performance.now();
const res1 = [...liveChannels.filter(isFavOrWatched), ...liveChannels.filter(c => !isFavOrWatched(c))]
  .slice(0, 2000)
  .map(c => ({ id: c.id, name: c.name, group: c.group, logo: c.logo, type: 'live' }));
const end3 = performance.now();

const start4 = performance.now();
const top = [];
const rest = [];
for (let i = 0; i < liveChannels.length; i++) {
  const c = liveChannels[i];
  if (isFavOrWatched(c)) {
    top.push({ id: c.id, name: c.name, group: c.group, logo: c.logo, type: 'live' });
  } else if (rest.length < 2000) {
    rest.push({ id: c.id, name: c.name, group: c.group, logo: c.logo, type: 'live' });
  }
}
const res2 = top.concat(rest).slice(0, 2000);
const end4 = performance.now();

console.log(`Publish Original: ${(end3 - start3).toFixed(2)}ms`);
console.log(`Publish Optimized: ${(end4 - start4).toFixed(2)}ms`);
