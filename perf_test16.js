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

const t0 = performance.now();
oldWay();
const t1 = performance.now();
console.log(`Old way took ${t1 - t0} milliseconds.`);
