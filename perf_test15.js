const { performance } = require('perf_hooks');

const state = { favorites: new Set(), watchProgress: {} };
const liveChannels = [];
const movies = [];
const series = [];
for(let i=0; i<150000; i++) {
  liveChannels.push({ id: `live-${i}`, name: `Channel ${i}`, group: 'Live', logo: '' });
  movies.push({ id: `movie-${i}`, name: `Movie ${i}`, group: 'Movies', logo: '', rating: '5', releaseDate: '2024' });
  series.push({ id: `series-${i}`, seriesId: `seriesId-${i}`, name: `Series ${i}`, group: 'Series', logo: '', rating: '5' });
  if (i % 100 === 0) {
    state.favorites.add(`live-${i}`);
    state.favorites.add(`movie-${i}`);
    state.favorites.add(`series-${i}`);
  }
}

function newWay4() {
    return {
    channels: (() => {
      const favSet = state.favorites || new Set();
      const wp = state.watchProgress || {};
      const result = [];
      const others = [];
      const len = liveChannels.length;
      for (let i = 0; i < len; i++) {
        const c = liveChannels[i];
        const cid = String(c.id);
        const cleanId = cid.startsWith('live-') ? cid.slice(5) : cid;
        if (favSet.has(c.id) || wp[c.id] || wp[cleanId]) {
          if (result.length < 2000) result.push({ id: c.id, name: c.name, group: c.group, logo: c.logo, type: 'live' });
        } else if (others.length < 2000) {
          others.push({ id: c.id, name: c.name, group: c.group, logo: c.logo, type: 'live' });
        }
        if (result.length >= 2000 && others.length >= 2000) break;
      }
      for (let i = 0; i < others.length && result.length < 2000; i++) result.push(others[i]);
      return result;
    })(),
    movies: (() => {
      const favSet = state.favorites || new Set();
      const wp = state.watchProgress || {};
      const result = [];
      const others = [];
      const len = movies.length;
      for (let i = 0; i < len; i++) {
        const m = movies[i];
        const mid = String(m.id);
        const cleanId = mid.startsWith('movie-') ? mid.slice(6) : mid;
        if (favSet.has(m.id) || wp[m.id] || wp[cleanId]) {
          if (result.length < 2000) result.push({ id: m.id, name: m.name, group: m.group, logo: m.logo, type: 'movies', rating: m.rating, year: m.releaseDate });
        } else if (others.length < 2000) {
          others.push({ id: m.id, name: m.name, group: m.group, logo: m.logo, type: 'movies', rating: m.rating, year: m.releaseDate });
        }
        if (result.length >= 2000 && others.length >= 2000) break;
      }
      for (let i = 0; i < others.length && result.length < 2000; i++) result.push(others[i]);
      return result;
    })(),
    series: (() => {
      const favSet = state.favorites || new Set();
      const wp = state.watchProgress || {};
      const result = [];
      const others = [];
      const len = series.length;
      for (let i = 0; i < len; i++) {
        const s = series[i];
        if (favSet.has(s.id) || (s.seriesId && favSet.has(s.seriesId)) || wp[s.id] || (s.seriesId && wp[s.seriesId])) {
          if (result.length < 2000) result.push({ id: s.id, seriesId: s.seriesId, name: s.name, group: s.group, logo: s.logo, type: 'series', rating: s.rating });
        } else if (others.length < 2000) {
          others.push({ id: s.id, seriesId: s.seriesId, name: s.name, group: s.group, logo: s.logo, type: 'series', rating: s.rating });
        }
        if (result.length >= 2000 && others.length >= 2000) break;
      }
      for (let i = 0; i < others.length && result.length < 2000; i++) result.push(others[i]);
      return result;
    })(),
    };
}
const t0 = performance.now();
newWay4();
const t1 = performance.now();
console.log(`New way took ${t1 - t0} milliseconds.`);
