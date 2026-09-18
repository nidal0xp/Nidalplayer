function list(payload, keys = []) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    // Check provided keys first
    for (const key of keys) {
      const val = payload[key];
      if (Array.isArray(val)) return val;
      if (val && typeof val === 'object') return Object.values(val);
    }
    // Common Xtream/Panel keys
    const commonKeys = ['data', 'items', 'streams', 'live_streams', 'vod_streams', 'series', 'series_streams', 'js'];
    for (const key of commonKeys) {
      const val = payload[key];
      if (Array.isArray(val)) return val;
      if (val && typeof val === 'object') return Object.values(val);
    }
  }
  return [];
}

function categoryMap(payload) {
  const map = {};
  for (const row of list(payload, ['categories'])) {
    const id = String(row.category_id ?? row.id ?? '');
    const name = String(row.category_name ?? row.name ?? '').trim();
    if (id && name) map[id] = name;
  }
  return map;
}

function safeExtension(value, fallback = 'mp4') {
  return String(value || fallback).replace(/^\./, '').replace(/[^a-z0-9]/gi, '') || fallback;
}

function streamType(type, name, group, url) {
  const text = `${type} ${name} ${group} ${url}`.toLowerCase();
  if (type === 'series' || text.includes('/series/')) return 'series';
  if (type === 'movies' || text.includes('/movie/')) return 'movies';
  return 'live';
}

function streamUrl(base, username, password, kind, id, extension = 'mp4') {
  return `${base}/${kind}/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${encodeURIComponent(id)}.${safeExtension(extension)}`;
}

function normalizeStreams(payload, type, categories, base, username, password, orderOffset = 0) {
  const result = [];
  for (const [providerOrder, stream] of list(payload, ['live_streams', 'vod_streams', 'series', 'streams']).entries()) {
    const id = String(stream.stream_id ?? stream.series_id ?? stream.id ?? '');
    if (!id) continue;
    const name = String(stream.name || `${type} ${id}`).trim();
    const group = categories[String(stream.category_id)] || stream.category_name || stream.group_title || 'Other';
    const normalized = streamType(type, name, group, stream.direct_source || '');
    const providerIndex = orderOffset + providerOrder;
    if (normalized === 'series') {
      result.push({
        id: `series-${id}`,
        seriesId: id,
        seriesName: name,
        name,
        group,
        type: 'series',
        logo: stream.cover || stream.stream_icon || '',
        url: '',
        metadata: stream,
        providerOrder: providerIndex,
        rating: stream.rating || stream.rating_5based || null,
        releaseDate: stream.releaseDate || stream.year || ''
      });
    } else if (normalized === 'movies') {
      const ext = safeExtension(stream.container_extension || stream.extension);
      result.push({
        id: `movie-${id}`,
        name,
        group,
        type: 'movies',
        logo: stream.stream_icon || stream.cover || '',
        url: stream.direct_source || streamUrl(base, username, password, 'movie', id, ext),
        metadata: stream,
        providerOrder: providerIndex,
        rating: stream.rating || stream.rating_5based || null,
        releaseDate: stream.releaseDate || stream.year || ''
      });
    } else {
      result.push({
        id: `live-${id}`,
        name,
        group,
        type: 'live',
        logo: stream.stream_icon || stream.icon || '',
        url: stream.direct_source || streamUrl(base, username, password, 'live', id, 'm3u8'),
        fallbackUrl: stream.direct_source ? '' : streamUrl(base, username, password, 'live', id, 'ts'),
        metadata: stream,
        providerOrder: providerIndex
      });
    }
  }
  return result;
}

export function normalizeServer(value) {
  let input = String(value || '').trim().replace(/^['"]|['"]$/g, '');
  if (!input) throw new Error('Enter a server address.');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) input = `http://${input}`;
  const explicitPort = input.match(/^[a-z][a-z0-9+.-]*:\/\/[^/]+:(\d+)/i)?.[1] || input.match(/^[^/]+:(\d+)/)?.[1] || '';
  const parsed = new URL(input);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only HTTP and HTTPS servers are supported.');
  parsed.pathname = parsed.pathname.replace(/\/+$/, '').replace(/\/(?:player_api|panel_api|get)\.php(?:\/.*)?$/i, '');
  if (/\/(?:live|movie|series)\//i.test(parsed.pathname)) parsed.pathname = '';
  parsed.search = '';
  parsed.hash = '';
  let normalized = parsed.toString().replace(/\/$/, '');
  if (explicitPort && !normalized.match(/:\d+$/)) normalized += `:${explicitPort}`;
  return normalized;
}

export class XtreamApi {
  constructor(fetcher, seriesDiscoveryFetcher = null, onEvent = () => {}) {
    this.fetcher = fetcher;
    this.seriesDiscoveryFetcher = seriesDiscoveryFetcher;
    this.onEvent = onEvent;
  }

  async request(base, username, password, action, extra = '') {
    const query = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=${encodeURIComponent(action)}${extra}`;
    let lastError;
    // Providers commonly return a transient 5xx/timeout while building a
    // large catalogue. Retrying here prevents those failures from becoming
    // an apparently valid empty series list.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        this.onEvent({ type: 'request', action, base, attempt: attempt + 1 });
        const response = await this.fetcher(`${base}/player_api.php?${query}`);
        this.onEvent({ type: 'response', action, status: response?.status || 0, ok: Boolean(response?.ok), attempt: attempt + 1 });
        if (!response?.ok) throw new Error(`Provider request failed (${response?.status || 'network error'}).`);
        let payload;
        try { payload = JSON.parse(response.text); } catch { throw new Error('The provider returned an invalid API response.'); }
        if (payload?.user_info && String(payload.user_info.auth) === '0') throw new Error('The provider rejected the login credentials.');
        return payload;
      } catch (error) {
        lastError = error;
        if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 350));
      }
    }
    throw lastError || new Error('Provider request failed.');
  }

  async loadWithProgress(base, username, password, onProgress = () => {}) {
    onProgress({ step: 1, totalSteps: 5, message: 'Validating credentials & server handshake…', percent: 15 });
    // Do not fall back to an unauthenticated-looking raw response here. Some
    // providers return user_info.auth=0 for bad credentials, and the old
    // fallback bypassed that check and allowed an empty/infinite sync.
    const userInfoPayload = await this.request(base, username, password, 'get_user_info');

    const account = userInfoPayload?.user_info || userInfoPayload || {};

    onProgress({ step: 2, totalSteps: 5, message: 'Fetching Live TV channels and categories…', percent: 35 });
    const [liveCats, liveStreams] = await Promise.all([
      this.request(base, username, password, 'get_live_categories').catch(() => []),
      this.request(base, username, password, 'get_live_streams').catch(() => [])
    ]);
    const liveCategories = categoryMap(liveCats);
    const live = normalizeStreams(liveStreams, 'live', liveCategories, base, username, password, 0);

    onProgress({
      step: 3,
      totalSteps: 5,
      message: `Fetching VOD Movies catalog (${live.length.toLocaleString()} Live TV loaded)…`,
      percent: 60,
      counts: { live: live.length, movies: 0, series: 0 }
    });
    const [vodCats, vodStreams] = await Promise.all([
      this.request(base, username, password, 'get_vod_categories').catch(() => []),
      this.request(base, username, password, 'get_vod_streams').catch(() => [])
    ]);
    const vodCategories = categoryMap(vodCats);
    const movies = normalizeStreams(vodStreams, 'movies', vodCategories, base, username, password, live.length);

    onProgress({
      step: 4,
      totalSteps: 5,
      message: `Fetching TV Series & Shows (${movies.length.toLocaleString()} Movies loaded)…`,
      percent: 85,
      counts: { live: live.length, movies: movies.length, series: 0 }
    });
    let seriesRequestError = null;
    let [seriesCats, seriesStreams] = await Promise.all([
      this.request(base, username, password, 'get_series_categories').catch(() => []),
      this.request(base, username, password, 'get_series').catch(error => {
        seriesRequestError = error;
        return [];
      })
    ]);
    let seriesCategories = categoryMap(seriesCats);
    let series = normalizeStreams(seriesStreams, 'series', seriesCategories, base, username, password, live.length + movies.length);

    // Only recover by category when the provider returned no series at all.
    // Fetching every category for a normal small catalogue made refreshes
    // unnecessarily slow and could amplify provider rate limiting.
    if (series.length === 0 && Object.keys(seriesCategories).length > 0) {
      onProgress({
        step: 4,
        totalSteps: 5,
        message: `Deep-syncing series via ${Object.keys(seriesCategories).length} categories…`,
        percent: 88,
        counts: { live: live.length, movies: movies.length, series: series.length }
      });

      const catIds = Object.keys(seriesCategories);
      const catSeriesResults = await Promise.all(
        catIds.map(catId => 
          this.request(base, username, password, 'get_series', `&category_id=${catId}`)
            .catch(() => [])
        )
      );

      const seenIds = new Set(series.map(s => s.seriesId));
      catSeriesResults.forEach(payload => {
        const catItems = normalizeStreams(payload, 'series', seriesCategories, base, username, password, 0);
        catItems.forEach(item => {
          if (!seenIds.has(item.seriesId)) {
            seenIds.add(item.seriesId);
            item.providerOrder = live.length + movies.length + series.length;
            series.push(item);
          }
        });
      });
    }

    if (series.length === 0 && seriesRequestError) {
      throw new Error(`Series catalogue could not be downloaded: ${seriesRequestError.message}`);
    }

    // Do not launch the old 250,000-ID discovery scan automatically. It can
    // take minutes and still report zero for providers with sparse IDs. The
    // provider's get_series/category endpoints are the authoritative source;
    // a user can still open individual series through get_series_info later.

    const allItems = [...live, ...movies, ...series];
    onProgress({
      step: 5,
      totalSteps: 5,
      message: `Finalizing catalog index (${allItems.length.toLocaleString()} total items)…`,
      percent: 100,
      counts: { live: live.length, movies: movies.length, series: series.length }
    });

    return {
      items: allItems,
      account,
      categories: { live: liveCategories, movies: vodCategories, series: seriesCategories }
    };
  }

  async fetchSeriesFallback(base, username, password) {
    if (typeof this.seriesDiscoveryFetcher === 'function') {
      try {
        const discResult = await this.seriesDiscoveryFetcher({ base, username, password });
        if (discResult?.ok && Array.isArray(discResult.series) && discResult.series.length > 0) {
          return {
            series: discResult.series,
            categories: discResult.categories || {}
          };
        }
      } catch (e) {
        console.warn('seriesDiscoveryFetcher error:', e);
      }
    }
    return { series: [], categories: {} };
  }

  async seriesInfo(base, username, password, seriesId) {
    try {
      const payload = await this.request(base, username, password, 'get_series_info', `&series_id=${encodeURIComponent(seriesId)}`);
      if (payload && (payload.episodes || payload.seasons || payload.info)) {
        return this.normalizeSeriesInfo(payload, base, username, password, { seriesId });
      }
    } catch {}
    return { seasons: [], episodes: [] };
  }

  normalizeSeriesInfo(payload, base, username, password, show = {}) {
    const root = payload?.data && typeof payload.data === 'object' && (payload.data.episodes || payload.data.seasons || payload.data.info) ? payload.data : payload;
    const rawEpisodes = root?.episodes || {};
    const groups = Array.isArray(rawEpisodes) ? [['', rawEpisodes]] : Object.entries(rawEpisodes);
    const episodes = [];

    for (const [seasonKey, seasonEpisodes] of groups) {
      const episodeRows = Array.isArray(seasonEpisodes)
        ? seasonEpisodes
        : (seasonEpisodes && typeof seasonEpisodes === 'object' ? Object.values(seasonEpisodes).filter(v => v && typeof v === 'object') : []);

      for (const [index, rawEpisode] of episodeRows.entries()) {
        const ep = rawEpisode && typeof rawEpisode === 'object' ? rawEpisode : {};
        const id = String(ep.id ?? ep.episode_id ?? ep.stream_id ?? `${show.seriesId || show.id}-${seasonKey}-${index + 1}`);
        
        // Multi-level season number resolution
        let seasonNum = Number(
          ep.season ??
          ep.season_number ??
          ep.season_num ??
          ep.info?.season ??
          ep.info?.season_number ??
          ep.info?.season_num ??
          seasonKey
        );
        if (!Number.isFinite(seasonNum) || seasonNum < 1) {
          seasonNum = Number(seasonKey) || 1;
        }

        const episodeNumber = Number(ep.episode_num ?? ep.episode_number ?? ep.episode ?? ep.info?.episode_num ?? index + 1) || (index + 1);
        const extension = safeExtension(ep.container_extension || ep.extension || ep.info?.container_extension);
        const title = String(ep.title || ep.name || ep.info?.name || `Episode ${episodeNumber}`);

        episodes.push({
          id: `episode-${show.seriesId || show.id}-${id}`,
          episodeId: id,
          seriesId: String(show.seriesId || show.id || ''),
          seriesName: show.seriesName || show.name || root?.info?.name || 'Series',
          name: title,
          episodeTitle: title,
          season: seasonNum,
          episodeNumber,
          group: show.group || 'Other',
          type: 'series',
          logo: ep.info?.movie_image || ep.info?.cover_big || ep.cover || show.logo || '',
          url: ep.direct_source || streamUrl(base, username, password, 'series', id, extension),
          duration: ep.info?.duration_secs ? Math.round(ep.info.duration_secs / 60) : (ep.info?.duration || ''),
          plot: ep.info?.plot || ep.info?.description || '',
          metadata: ep,
          providerOrder: episodes.length
        });
      }
    }

    // Collect all season numbers from episodes
    const episodeCounts = new Map();
    for (const episode of episodes) {
      episodeCounts.set(episode.season, (episodeCounts.get(episode.season) || 0) + 1);
    }

    // Also collect any seasons declared in root.seasons
    const rawSeasons = root?.seasons || [];
    const declaredSeasons = Array.isArray(rawSeasons)
      ? rawSeasons
      : (typeof rawSeasons === 'object' ? Object.values(rawSeasons) : []);

    const allSeasonNums = new Set([...episodeCounts.keys()]);
    for (const s of declaredSeasons) {
      const sNum = Number(s?.season_number ?? s?.season ?? s?.num ?? s?.id);
      if (Number.isFinite(sNum) && sNum > 0) {
        allSeasonNums.add(sNum);
      }
    }

    if (allSeasonNums.size === 0) allSeasonNums.add(1);

    const sortedSeasons = [...allSeasonNums].sort((a, b) => a - b).map(season => ({
      season,
      count: episodeCounts.get(season) || 0
    }));

    return {
      show: {
        ...show,
        ...(root?.info || {}),
        seriesId: String(show.seriesId || show.id || root?.info?.series_id || ''),
        name: root?.info?.name || show.name || 'Series',
        logo: root?.info?.cover_big || root?.info?.cover || show.logo || '',
        backdrop: root?.info?.backdrop_path?.[0] || root?.info?.cover_big || show.logo || '',
        plot: root?.info?.plot || root?.info?.description || '',
        genre: root?.info?.genre || '',
        rating: root?.info?.rating_5based || root?.info?.rating || '',
        releaseDate: root?.info?.releaseDate || root?.info?.year || ''
      },
      seasons: sortedSeasons,
      episodes,
      payload
    };
  }
}
