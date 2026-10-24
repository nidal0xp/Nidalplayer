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
        const cleanId = idStr.startsWith('live-') ? idStr.slice(5) : (idStr.startsWith('movie-') ? idStr.slice(6) : (idStr.startsWith('series-') ? idStr.slice(7) : idStr));
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
    })(),
    movies: (() => {
      const favSet = state.favorites || new Set();
      const wp = state.watchProgress || {};
      const result = [];
      const others = [];
      for (let i = 0; i < movies.length; i++) {
        const m = movies[i];
        const idStr = String(m.id);
        const cleanId = idStr.startsWith('live-') ? idStr.slice(5) : (idStr.startsWith('movie-') ? idStr.slice(6) : (idStr.startsWith('series-') ? idStr.slice(7) : idStr));
        const isFav = favSet.has(m.id) || wp[m.id] || wp[cleanId];
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
newWay();
