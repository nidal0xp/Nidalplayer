/**
 * TMDB API Service for Nidalplayer
 * Enriches Movies & TV Shows with 4K backdrops, IMDb ratings, cast headshots, and YouTube trailers.
 * Requires a user-provided TMDB v3 API Key (stored locally in localStorage or passed via process.env.TMDB_API_KEY).
 */

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_ORIGINAL = 'https://image.tmdb.org/t/p/original';
const IMAGE_BASE_W500 = 'https://image.tmdb.org/t/p/w500';
const IMAGE_BASE_W185 = 'https://image.tmdb.org/t/p/w185';

const cache = new Map();

/**
 * Retrieves the active TMDB API key from environment variable or local browser storage.
 */
export function getTMDBApiKey() {
  if (typeof process !== 'undefined' && process.env?.TMDB_API_KEY) {
    return process.env.TMDB_API_KEY.trim();
  }
  if (typeof localStorage !== 'undefined') {
    return (localStorage.getItem('nidalplayer_tmdb_api_key') || '').trim();
  }
  return '';
}

/**
 * Saves or removes the user's custom TMDB API key.
 */
export function setTMDBApiKey(key) {
  if (typeof localStorage !== 'undefined') {
    if (key && key.trim()) {
      localStorage.setItem('nidalplayer_tmdb_api_key', key.trim());
    } else {
      localStorage.removeItem('nidalplayer_tmdb_api_key');
    }
  }
  cache.clear();
}

/**
 * Tests an API key by making a lightweight request to TMDB configuration endpoint.
 */
export async function testTMDBApiKey(key) {
  const apiKey = (key || getTMDBApiKey() || '').trim();
  if (!apiKey) {
    return { ok: false, error: 'Please enter a TMDB API Key.' };
  }
  try {
    const res = await fetch(`${TMDB_BASE_URL}/authentication?api_key=${encodeURIComponent(apiKey)}`);
    const data = await res.json();
    if (res.ok && data.success) {
      return { ok: true, message: 'Valid TMDB API Key! Connection successful.' };
    }
    return { ok: false, error: data.status_message || `TMDB responded with HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err.message || 'Connection failed.' };
  }
}

/**
 * Cleans noisy stream titles by stripping codec, year, resolution, and language tags.
 */
export function cleanTitle(rawTitle) {
  if (!rawTitle) return '';
  return String(rawTitle)
    .replace(/\[[^\]]*\]/g, '') // Remove [1080p], [4K], etc.
    .replace(/\([^)]*\)/g, '') // Remove (2024), (VF), etc.
    .replace(/-[A-Za-z0-9]+$/g, '') // Strip trailing -Group (e.g. -Nidal, -RARBG)
    .replace(/\b(19\d\d|20\d\d)\b/g, '') // Strip year if in dot/space separated format
    .replace(/\b(1080p|720p|480p|4k|uhd|fhd|hd|hevc|x265|x264|h264|h265|bluray|web-?dl|webrip|dvdrip|remux|multi|vostfr|vf|en|ar|fr|es|de|ita|ac3|dts|aac|atmos)\b/gi, '')
    .replace(/[-_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts year from title if present.
 */
export function extractYear(rawTitle) {
  const match = String(rawTitle || '').match(/\b(19\d\d|20\d\d)\b/);
  return match ? match[1] : '';
}

/**
 * Searches TMDB for a movie or TV show.
 */
export async function fetchTMDBDetails(title, type = 'movie', yearHint = '', customKey = null) {
  const apiKey = (customKey || getTMDBApiKey() || '').trim();
  if (!apiKey) {
    // Graceful exit if user hasn't configured a key
    return null;
  }

  const cleaned = cleanTitle(title);
  if (!cleaned) return null;

  const year = yearHint || extractYear(title);
  const cacheKey = `${type}:${cleaned}:${year}`.toLowerCase();
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  try {
    const isTv = type === 'series' || type === 'tv';
    const searchEndpoint = isTv ? `${TMDB_BASE_URL}/search/tv` : `${TMDB_BASE_URL}/search/movie`;
    const params = new URLSearchParams({
      api_key: apiKey,
      query: cleaned,
      include_adult: 'false',
      language: 'en-US'
    });
    if (year && !isTv) params.append('primary_release_year', year);
    if (year && isTv) params.append('first_air_date_year', year);

    const res = await fetch(`${searchEndpoint}?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    const result = data.results && data.results[0];
    if (!result) return null;

    const id = result.id;
    const detailEndpoint = isTv ? `${TMDB_BASE_URL}/tv/${id}` : `${TMDB_BASE_URL}/movie/${id}`;
    const detailParams = new URLSearchParams({
      api_key: apiKey,
      append_to_response: 'credits',
      language: 'en-US'
    });

    const detailRes = await fetch(`${detailEndpoint}?${detailParams.toString()}`);
    if (!detailRes.ok) return null;
    const detail = await detailRes.json();

    // Extract top cast (first 8 actors)
    const cast = (detail.credits?.cast || []).slice(0, 8).map(actor => ({
      name: actor.name,
      character: actor.character || '',
      profile: actor.profile_path ? `${IMAGE_BASE_W185}${actor.profile_path}` : ''
    }));

    const enriched = {
      tmdbId: id,
      title: detail.title || detail.name || cleaned,
      originalTitle: detail.original_title || detail.original_name || '',
      overview: detail.overview || '',
      tagline: detail.tagline || '',
      rating: detail.vote_average ? detail.vote_average.toFixed(1) : null,
      voteCount: detail.vote_count || 0,
      releaseDate: detail.release_date || detail.first_air_date || '',
      runtime: detail.runtime || (detail.episode_run_time && detail.episode_run_time[0]) || null,
      genres: (detail.genres || []).map(g => g.name),
      backdropUrl: detail.backdrop_path ? `${IMAGE_BASE_ORIGINAL}${detail.backdrop_path}` : '',
      posterUrl: detail.poster_path ? `${IMAGE_BASE_W500}${detail.poster_path}` : '',
      cast
    };

    cache.set(cacheKey, enriched);
    return enriched;
  } catch (err) {
    console.warn('[TMDB] Fetch error:', err.message);
    return null;
  }
}

export default {
  getTMDBApiKey,
  setTMDBApiKey,
  testTMDBApiKey,
  fetchTMDBDetails,
  cleanTitle,
  extractYear
};
