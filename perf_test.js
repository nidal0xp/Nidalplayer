const { performance } = require('perf_hooks');

const state = { favorites: new Set(), watchProgress: {} };
const liveChannels = [];
for(let i=0; i<50000; i++) {
  liveChannels.push({ id: `live-${i}`, name: `Channel ${i}`, group: 'Live', logo: '' });
  if (i % 100 === 0) {
    state.favorites.add(`live-${i}`);
  }
}

function oldWay() {
    const favSet = state.favorites || new Set();
    const isFavOrWatched = c => favSet.has(c.id) || (state.watchProgress && (state.watchProgress[c.id] || state.watchProgress[String(c.id).replace(/^(?:series|movie|live)-/, '')]));
    return [...liveChannels.filter(isFavOrWatched), ...liveChannels.filter(c => !isFavOrWatched(c))]
      .slice(0, 2000)
      .map(c => ({ id: c.id, name: c.name, group: c.group, logo: c.logo, type: 'live' }));
}

function newWay() {
    const result = [];
    const others = [];
    const favSet = state.favorites || new Set();
    const wp = state.watchProgress || {};
    for (let i = 0; i < liveChannels.length; i++) {
      const c = liveChannels[i];
      let cid = String(c.id);
      const cleanId = cid.startsWith('live-') ? cid.slice(5) : (cid.startsWith('movie-') ? cid.slice(6) : (cid.startsWith('series-') ? cid.slice(7) : cid));
      const isFav = favSet.has(c.id) || wp[c.id] || wp[cleanId];
      const mapped = { id: c.id, name: c.name, group: c.group, logo: c.logo, type: 'live' };
      if (isFav) {
        if (result.length < 2000) result.push(mapped);
      } else {
        if (others.length < 2000) others.push(mapped);
      }
      if (result.length >= 2000 && others.length >= 2000) break;
    }
    for (let i = 0; i < others.length && result.length < 2000; i++) result.push(others[i]);
    return result;
}

const t0 = performance.now();
oldWay();
const t1 = performance.now();
console.log(`Old way took ${t1 - t0} milliseconds.`);

const t2 = performance.now();
newWay();
const t3 = performance.now();
console.log(`New way took ${t3 - t2} milliseconds.`);
