const state = {
  favorites: new Set(),
  watchProgress: {}
};
for (let i = 0; i < 50; i++) {
  state.favorites.add(`live-${i}`);
  state.watchProgress[`series-${i}`] = { isWatched: true };
}

const liveChannels = [];
const movies = [];
const series = [];

for (let i = 0; i < 50000; i++) {
  liveChannels.push({ id: `live-${i}`, name: `Ch ${i}`, group: 'TV', logo: '' });
  movies.push({ id: `movie-${i}`, name: `Movie ${i}`, group: 'Movies', logo: '', rating: '5.0', releaseDate: '2023' });
  series.push({ id: `series-${i}`, name: `Series ${i}`, group: 'Series', logo: '', rating: '4.0', seriesId: `series-${i}` });
}

function publishRemoteState_original() {
  const start = performance.now();

  const channels = (() => {
    const favSet = state.favorites || new Set();
    const isFavOrWatched = c => favSet.has(c.id) || (state.watchProgress && (state.watchProgress[c.id] || state.watchProgress[String(c.id).replace(/^(?:series|movie|live)-/, '')]));
    return [...liveChannels.filter(isFavOrWatched), ...liveChannels.filter(c => !isFavOrWatched(c))]
      .slice(0, 2000)
      .map(c => ({ id: c.id, name: c.name, group: c.group, logo: c.logo, type: 'live' }));
  })();

  const moviesList = (() => {
    const favSet = state.favorites || new Set();
    const isFavOrWatched = m => favSet.has(m.id) || (state.watchProgress && (state.watchProgress[m.id] || state.watchProgress[String(m.id).replace(/^(?:series|movie|live)-/, '')]));
    return [...movies.filter(isFavOrWatched), ...movies.filter(m => !isFavOrWatched(m))]
      .slice(0, 2000)
      .map(m => ({ id: m.id, name: m.name, group: m.group, logo: m.logo, type: 'movies', rating: m.rating, year: m.releaseDate }));
  })();

  const seriesList = (() => {
    const favSet = state.favorites || new Set();
    const isFavOrWatched = s => favSet.has(s.id) || (s.seriesId && favSet.has(s.seriesId)) || (state.watchProgress && (state.watchProgress[s.id] || (s.seriesId && state.watchProgress[s.seriesId])));
    return [...series.filter(isFavOrWatched), ...series.filter(s => !isFavOrWatched(s))]
      .slice(0, 2000)
      .map(s => ({ id: s.id, seriesId: s.seriesId, name: s.name, group: s.group, logo: s.logo, type: 'series', rating: s.rating }));
  })();

  const end = performance.now();
  return end - start;
}

function publishRemoteState_optimized() {
  const start = performance.now();

  const channels = (() => {
    const favSet = state.favorites || new Set();
    const isFavOrWatched = c => favSet.has(c.id) || (state.watchProgress && (state.watchProgress[c.id] || state.watchProgress[String(c.id).replace(/^(?:series|movie|live)-/, '')]));

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
    return top.concat(rest).slice(0, 2000);
  })();

  const moviesList = (() => {
    const favSet = state.favorites || new Set();
    const isFavOrWatched = m => favSet.has(m.id) || (state.watchProgress && (state.watchProgress[m.id] || state.watchProgress[String(m.id).replace(/^(?:series|movie|live)-/, '')]));

    const top = [];
    const rest = [];
    for (let i = 0; i < movies.length; i++) {
      const m = movies[i];
      if (isFavOrWatched(m)) {
        top.push({ id: m.id, name: m.name, group: m.group, logo: m.logo, type: 'movies', rating: m.rating, year: m.releaseDate });
      } else if (rest.length < 2000) {
        rest.push({ id: m.id, name: m.name, group: m.group, logo: m.logo, type: 'movies', rating: m.rating, year: m.releaseDate });
      }
    }
    return top.concat(rest).slice(0, 2000);
  })();

  const seriesList = (() => {
    const favSet = state.favorites || new Set();
    const isFavOrWatched = s => favSet.has(s.id) || (s.seriesId && favSet.has(s.seriesId)) || (state.watchProgress && (state.watchProgress[s.id] || (s.seriesId && state.watchProgress[s.seriesId])));

    const top = [];
    const rest = [];
    for (let i = 0; i < series.length; i++) {
      const s = series[i];
      if (isFavOrWatched(s)) {
        top.push({ id: s.id, seriesId: s.seriesId, name: s.name, group: s.group, logo: s.logo, type: 'series', rating: s.rating });
      } else if (rest.length < 2000) {
        rest.push({ id: s.id, seriesId: s.seriesId, name: s.name, group: s.group, logo: s.logo, type: 'series', rating: s.rating });
      }
    }
    return top.concat(rest).slice(0, 2000);
  })();

  const end = performance.now();
  return end - start;
}

const orig = publishRemoteState_original();
const opt = publishRemoteState_optimized();
console.log(`Original: ${orig.toFixed(2)}ms`);
console.log(`Optimized: ${opt.toFixed(2)}ms`);
