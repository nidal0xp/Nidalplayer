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

function oldWay() {
    return {
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
    };
}

function newWay() {
    return {
    channels: (() => {
      const favSet = state.favorites || new Set();
      const wp = state.watchProgress || {};
      const result = [];
      const others = [];
      for (let i = 0; i < liveChannels.length; i++) {
        const c = liveChannels[i];
        const idStr = String(c.id);
        const isFav = favSet.has(c.id) || wp[c.id] || wp[idStr.startsWith('live-') ? idStr.slice(5) : (idStr.startsWith('movie-') ? idStr.slice(6) : (idStr.startsWith('series-') ? idStr.slice(7) : idStr))];
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
    })(),
    movies: (() => {
      const favSet = state.favorites || new Set();
      const wp = state.watchProgress || {};
      const result = [];
      const others = [];
      for (let i = 0; i < movies.length; i++) {
        const m = movies[i];
        const idStr = String(m.id);
        const isFav = favSet.has(m.id) || wp[m.id] || wp[idStr.startsWith('live-') ? idStr.slice(5) : (idStr.startsWith('movie-') ? idStr.slice(6) : (idStr.startsWith('series-') ? idStr.slice(7) : idStr))];
        const mapped = { id: m.id, name: m.name, group: m.group, logo: m.logo, type: 'movies', rating: m.rating, year: m.releaseDate };
        if (isFav) {
          if (result.length < 2000) result.push(mapped);
        } else {
          if (others.length < 2000) others.push(mapped);
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
      for (let i = 0; i < series.length; i++) {
        const s = series[i];
        const isFav = favSet.has(s.id) || (s.seriesId && favSet.has(s.seriesId)) || wp[s.id] || (s.seriesId && wp[s.seriesId]);
        const mapped = { id: s.id, seriesId: s.seriesId, name: s.name, group: s.group, logo: s.logo, type: 'series', rating: s.rating };
        if (isFav) {
          if (result.length < 2000) result.push(mapped);
        } else {
          if (others.length < 2000) others.push(mapped);
        }
        if (result.length >= 2000 && others.length >= 2000) break;
      }
      for (let i = 0; i < others.length && result.length < 2000; i++) result.push(others[i]);
      return result;
    })(),
    };
}

const t0 = performance.now();
oldWay();
const t1 = performance.now();
console.log(`Old way took ${t1 - t0} milliseconds.`);

const t2 = performance.now();
newWay();
const t3 = performance.now();
console.log(`New way took ${t3 - t2} milliseconds.`);
