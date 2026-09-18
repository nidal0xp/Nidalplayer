function commaOutsideQuotes(value) {
  let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '"') quoted = !quoted;
    if (!quoted && value[index] === ',') return index;
  }
  return -1;
}

function attributes(value) {
  const result = {};
  const expression = /([\w-]+)\s*=\s*(?:"([^"]*)"|([^\s,]*))/g;
  for (const match of value.matchAll(expression)) result[match[1].toLowerCase()] = match[2] ?? match[3] ?? '';
  return result;
}

function streamLine(value) {
  const parts = value.split('|');
  const url = parts.shift().trim();
  const headers = {};
  for (const pair of parts.join('|').split('&')) {
    const index = pair.indexOf('=');
    if (index > 0) headers[pair.slice(0, index).toLowerCase()] = decodeURIComponent(pair.slice(index + 1));
  }
  return { url, headers };
}

function inferType(name, group, url, metadata) {
  const text = `${name} ${group} ${url} ${metadata.type || ''} ${metadata['content-type'] || ''}`.toLowerCase();
  if (/\/series\/|\bseries\b|tv\s*show|tvshows|\bs\d{1,2}e\d{1,3}\b|\b\d{1,2}x\d{1,3}\b/.test(text)) return 'series';
  if (/\/movie\/|\bmovies?\b|\bvod\b|\bfilms?\b/.test(text)) return 'movies';
  return 'live';
}

function normalizeGroup(group, name, url) {
  const value = String(group || '').trim();
  if (value && value.toLowerCase() !== 'uncategorized') return value;
  const text = `${name || ''} ${url || ''}`.toLowerCase();
  if (text.includes('/series/')) return 'Series';
  if (text.includes('/movie/')) return 'Movies';
  if (text.includes('/live/')) return 'Live TV';
  return value || 'Other';
}

function seriesMeta(name, url = '') {
  const raw = String(name || '').trim();
  const match = raw.match(/^(.*?)(?:[ ._-]+S(\d{1,2})E(\d{1,3})|[ ._-]+(\d{1,2})x(\d{1,3}))(?:\b|[ ._-]|$)/i);
  if (!match) return { seriesId: raw.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || String(url).split('/').slice(-2, -1)[0] || 'series', seriesName: raw, season: 1, episodeNumber: 1, episodeTitle: raw };
  const seriesName = match[1].replace(/[._-]+$/, '').trim() || raw;
  const season = Number(match[2] || match[4]) || 1;
  const episodeNumber = Number(match[3] || match[5]) || 1;
  return { seriesId: seriesName.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, ''), seriesName, season, episodeNumber, episodeTitle: raw };
}

export function validateM3U(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/);
  const issues = [];
  if (!lines.some(line => line.trim().toUpperCase().startsWith('#EXTM3U'))) issues.push('Missing #EXTM3U header; the file was parsed in tolerant mode.');
  let playable = 0;
  for (const line of lines) if (line.trim() && !line.trim().startsWith('#') && /^https?:\/\//i.test(line.trim().split('|')[0])) playable += 1;
  if (!playable) issues.push('No HTTP or HTTPS stream URLs were found.');
  return { valid: issues.length === 0, issues, playable };
}

export function parseM3U(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/);
  const result = [];
  const duplicates = new Set();
  const seen = new Set();
  let metadata = null;
  let pendingHeaders = {};
  let sequence = 1;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.toUpperCase().startsWith('#EXTVLCOPT:')) {
      const pair = line.slice(11);
      const index = pair.indexOf('=');
      if (index > 0) pendingHeaders[pair.slice(0, index).toLowerCase()] = pair.slice(index + 1);
      continue;
    }
    if (line.toUpperCase().startsWith('#EXTINF')) {
      const comma = commaOutsideQuotes(line);
      const descriptor = comma >= 0 ? line.slice(0, comma) : line;
      const name = comma >= 0 ? line.slice(comma + 1).trim() : `Item ${sequence}`;
      const metadataAttributes = attributes(descriptor);
      const group = normalizeGroup(metadataAttributes['group-title'] || metadataAttributes.group, name, '');
      metadata = {
        name: name || `Item ${sequence}`,
        group,
        logo: metadataAttributes['tvg-logo'] || metadataAttributes.logo || '',
        tvgId: metadataAttributes['tvg-id'] || '',
        language: metadataAttributes['tvg-language'] || '',
        country: metadataAttributes['tvg-country'] || '',
        type: inferType(name, group, '', metadataAttributes),
        headers: { ...pendingHeaders }
      };
      pendingHeaders = {};
      continue;
    }
    if (line.startsWith('#')) continue;
    const stream = streamLine(line);
    if (!/^https?:\/\//i.test(stream.url)) continue;
    const current = metadata || { name: `Item ${sequence}`, group: 'Other', logo: '', tvgId: '', language: '', country: '', type: inferType('', '', stream.url, {}), headers: {} };
    const type = current.type === 'live' ? inferType(current.name, current.group, stream.url, current) : current.type;
    const duplicateKey = `${current.name.toLowerCase()}|${stream.url}`;
    if (seen.has(duplicateKey)) duplicates.add(duplicateKey);
    seen.add(duplicateKey);
    const series = type === 'series' ? seriesMeta(current.name, stream.url) : {};
    result.push({
      ...current,
      id: current.tvgId || `${current.name}|${stream.url}`,
      url: stream.url,
      type,
      ...(type === 'series' ? series : {}),
      headers: { ...current.headers, ...stream.headers },
      duplicate: duplicates.has(duplicateKey),
      providerOrder: result.length
    });
    sequence += 1;
    metadata = null;
    pendingHeaders = {};
  }
  return { items: result, duplicates: duplicates.size, validation: validateM3U(text) };
}
